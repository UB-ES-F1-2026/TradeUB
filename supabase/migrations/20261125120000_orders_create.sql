-- US6.5 (#185): ordres de compra i venda.
--
-- Cada compra o venda desa una fila a orders amb les dades del moment de
-- l'operació (unitats, preu, imports i comissió). El detall de l'operació
-- (US6.5) les llegeix d'aquí, així que no canvien encara que després canviï el
-- preu de l'actiu. És la base de US5.6, US5.7, US6.6, US6.7, US8.8 i US14.1.
--
-- Columnes:
-- - side: 'compra' o 'venda'.
-- - status: en aquesta US només 'executada'. US6.6 (pendent) i US6.7
--   (cancel·lada) amplien orders_status_check.
-- - amount: unitats × preu. total: a la compra, amount + comissió (el que es
--   carrega); a la venda, amount − comissió (l'import net que s'abona).
-- - price i avg_price_at_execution tenen 6 decimals, com positions.avg_price.
-- - avg_price_at_execution: preu mitjà de la posició just abans d'executar
--   l'ordre. És null a la primera compra d'un actiu. El fa servir US8.8 per
--   calcular el guany o la pèrdua d'una venda.
-- - cash_movement_id: el moviment d'efectiu de la mateixa operació. Null fins
--   que l'ordre s'executa (US6.6). Únic: un moviment és d'una sola ordre.
-- - rejection_reason: el motiu quan una ordre es rebutja (US6.6).
--
-- Les compres i vendes anteriors a aquesta migració no tenen ordre: no van
-- desar l'actiu ni les unitats, i no se'n reconstrueix cap.
--
-- La migració es pot tornar a executar.

create table if not exists public.orders (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    asset_id bigint not null references public.assets (id),
    side text not null,
    status text not null,
    units numeric(20, 8) not null,
    price numeric(18, 6) not null,
    amount numeric(14, 2) not null,
    commission numeric(14, 2) not null,
    total numeric(14, 2) not null,
    avg_price_at_execution numeric(18, 6),
    created_at timestamptz not null default now(),
    executed_at timestamptz,
    cash_movement_id uuid unique references public.cash_movements (id),
    rejection_reason text,
    constraint orders_side_check check (side in ('compra', 'venda')),
    constraint orders_status_check check (status in ('executada')),
    constraint orders_units_positive check (units > 0),
    constraint orders_price_positive check (price > 0),
    constraint orders_commission_not_negative check (commission >= 0),
    -- Una ordre executada sempre té la data d'execució i el seu moviment.
    constraint orders_executed_check check (
        status <> 'executada'
        or (executed_at is not null and cash_movement_id is not null)
    )
);

-- L'historial llegeix les ordres de l'usuari de la més recent a la més antiga.
create index if not exists orders_user_created_at_idx
    on public.orders (user_id, created_at desc);

-- RLS: el client només pot consultar les seves ordres. No hi ha polítiques
-- d'INSERT, UPDATE ni DELETE: les ordres les escriuen buy_asset i sell_asset,
-- que només pot executar el backend.
alter table public.orders enable row level security;

-- Com a positions: sense polítiques d'escriptura el RLS ja les denega, però es
-- revoquen els permisos que Supabase dona per defecte com a segona defensa.
revoke insert, update, delete on public.orders from anon, authenticated;

drop policy if exists "Users can read their own orders" on public.orders;
create policy "Users can read their own orders"
    on public.orders for select
    to authenticated
    using ((select auth.uid()) = user_id);

-- process_cash_movement: id del moviment opcional.
--
-- Cada ordre executada apunta al seu moviment (cash_movement_id), però
-- process_cash_movement retorna el saldo, no l'id del moviment que crea.
-- Rep el nou paràmetre p_movement_id (per defecte NULL): si arriba, el
-- moviment es desa amb aquest id. Així buy_asset i sell_asset generen l'id
-- abans de cridar-la i el guarden a l'ordre. Els ingressos i les retirades
-- (core/cash_movements.py) no el passen i no canvien.
--
-- Com a 20261119180000_cash_movements_iban_masked.sql: Postgres tracta una
-- signatura diferent com una funció nova, de manera que primer s'esborra la
-- de quatre paràmetres i després es tornen a donar els permisos. La resta del
-- cos és igual: només canvia l'id de l'insert.

drop function if exists public.process_cash_movement(uuid, text, numeric, text);

create or replace function public.process_cash_movement(
    p_user_id uuid,
    p_type text,
    p_amount numeric,
    p_iban_masked text default null,
    p_movement_id uuid default null
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

    -- Una retirada sempre va a un IBAN: sense, no es pot registrar.
    if v_type = 'retirada' and p_iban_masked is null then
        raise exception 'A withdrawal requires the masked IBAN'
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

    -- Sense p_movement_id, l'id es genera com fins ara.
    insert into public.cash_movements (id, user_id, type, amount, balance_after, iban_masked)
    values (
        coalesce(p_movement_id, gen_random_uuid()),
        p_user_id, v_type, p_amount, v_new_balance, p_iban_masked
    );

    return v_new_balance;
end;
$$;

-- Mateixos permisos que la versió anterior: només el backend (service_role).
revoke all on function public.process_cash_movement(uuid, text, numeric, text, uuid) from public, anon, authenticated;
grant execute on function public.process_cash_movement(uuid, text, numeric, text, uuid) to service_role;
