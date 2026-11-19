-- US3.2 (#109): Taula immutable de moviments d'efectiu i operació d'escriptura atòmica.
--
-- Estableix el registre històric de totes les operacions amb diners
-- ficticis (ingressos, retirades, compres i vendes) i la funció transaccional
-- que manté sincronitzat el saldo de public.accounts.
--
-- Seguretat i integritat:
-- 1. El client només té permís de lectura (SELECT) sobre els seus propis moviments.
-- 2. No existeixen polítiques d'INSERT, UPDATE ni DELETE: cap client pot alterar
--    el historial directament des del navegador.
-- 3. L'execució de process_cash_movement queda restringida al rol de servidor
--    (service_role) i bloqueja la fila del compte (FOR UPDATE) per evitar
--    condicions de carrera (race conditions) en peticions simultànies.

create table if not exists public.cash_movements (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.accounts(user_id) on delete cascade,
    type text not null,
    amount numeric(14, 2) not null check (amount <> 0),
    balance_after numeric(14, 2) not null,
    created_at timestamptz not null default now(),
    constraint cash_movements_type_check check (
        type in ('ingres', 'retirada', 'compra', 'venda')
    )
);

-- Índex per optimitzar les consultes de l'historial ordenades per data recent.
create index if not exists cash_movements_user_created_at_idx
    on public.cash_movements (user_id, created_at desc);

-- Activació de la seguretat a nivell de fila (RLS) per a l'historial.
alter table public.cash_movements enable row level security;

-- Política de lectura: cada usuari només pot consultar els seus propis moviments.
drop policy if exists "Users can read their own cash movements" on public.cash_movements;
create policy "Users can read their own cash movements"
    on public.cash_movements for select
    using (auth.uid() = user_id);

-- Deliberadament no hi ha polítiques d'INSERT, UPDATE ni DELETE. El llibre
-- major només es pot escriure mitjançant aquesta funció, que també valida
-- qui fa la crida i la coherència del signe de l'import.
create or replace function public.process_cash_movement(
    p_user_id uuid,
    p_type text,
    p_amount numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
    v_current_balance numeric(14, 2);
    v_new_balance numeric(14, 2);
    v_type text := lower(trim(p_type));
begin
    -- Defensa addicional: impedeix que un usuari operi sobre el compte d'un altre
    -- si la funció fos invocada fora del context de service_role.
    if auth.role() <> 'service_role' and auth.uid() is distinct from p_user_id then
        raise exception 'User cannot modify another user account'
            using errcode = '42501';
    end if;

    -- Un moviment sense import no té sentit comptable.
    if p_amount = 0 then
        raise exception 'Amount cannot be zero'
            using errcode = '22023';
    end if;

    -- Validació estricta entre el tipus d'operació i el signe de l'import:
    -- ingressos/vendes sumen (+), retirades/compres resten (-).
    if v_type in ('ingres', 'venda') and p_amount <= 0 then
        raise exception 'This movement type requires a positive amount'
            using errcode = '22023';
    elsif v_type in ('retirada', 'compra') and p_amount >= 0 then
        raise exception 'This movement type requires a negative amount'
            using errcode = '22023';
    elsif v_type not in ('ingres', 'retirada', 'compra', 'venda') then
        raise exception 'Unsupported movement type: %', p_type
            using errcode = '22023';
    end if;

    -- Bloqueig exclusiu de la fila de l'usuari (FOR UPDATE) fins que acabi la
    -- transacció. Dues peticions seguides s'executaran en cua sense trepitjar-se.
    select balance into v_current_balance
    from public.accounts
    where user_id = p_user_id
    for update;

    if not found then
        raise exception 'Account not found for user %', p_user_id
            using errcode = 'P0002';
    end if;

    -- Càlcul del saldo resultant i comprovació que mai quedi en descobert.
    v_new_balance := v_current_balance + p_amount;
    if v_new_balance < 0 then
        raise exception 'Insufficient balance: current %, requested %',
            v_current_balance, abs(p_amount)
            using errcode = 'P0003';
    end if;

    -- Actualització atòmica del saldo i registre del moviment en la mateixa transacció.
    update public.accounts
    set balance = v_new_balance, updated_at = now()
    where user_id = p_user_id;

    insert into public.cash_movements (user_id, type, amount, balance_after)
    values (p_user_id, v_type, p_amount, v_new_balance);

    return v_new_balance;
end;
$$;

-- Blindatge de permisos: es revoca l'execució a qualsevol usuari públic, anònim o
-- autenticat des del client i s'atorga únicament al backend (service_role).
revoke all on function public.process_cash_movement(uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.process_cash_movement(uuid, text, numeric) to service_role;