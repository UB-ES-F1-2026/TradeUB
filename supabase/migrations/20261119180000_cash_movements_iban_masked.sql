-- US3.3 (#116): IBAN emmascarat de les retirades a cash_movements.
--
-- Cada retirada desa l'IBAN emmascarat que tenia l'usuari en aquell moment,
-- perquè el concepte de l'historial (US3.5, "Retirada a ES•• 1332") no canviï
-- si després en vincula un altre. Mai es desa l'IBAN sencer: el backend
-- l'emmascara amb core/iban.py abans de cridar la funció.
--
-- process_cash_movement rep el nou paràmetre p_iban_masked (per defecte NULL,
-- així els ingressos no canvien). Postgres tracta una signatura diferent com
-- una funció nova, de manera que primer s'esborra la de tres paràmetres
-- (20261113190000_cash_movements_create.sql) i després es tornen a donar els
-- permisos. La resta del cos és igual: només s'hi afegeix la comprovació de
-- l'IBAN a les retirades i la columna a l'insert.
--
-- La migració es pot tornar a executar.

alter table public.cash_movements
    add column if not exists iban_masked text;

drop function if exists public.process_cash_movement(uuid, text, numeric);

create or replace function public.process_cash_movement(
    p_user_id uuid,
    p_type text,
    p_amount numeric,
    p_iban_masked text default null
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

    insert into public.cash_movements (user_id, type, amount, balance_after, iban_masked)
    values (p_user_id, v_type, p_amount, v_new_balance, p_iban_masked);

    return v_new_balance;
end;
$$;

-- Mateixos permisos que la versió anterior: només el backend (service_role).
revoke all on function public.process_cash_movement(uuid, text, numeric, text) from public, anon, authenticated;
grant execute on function public.process_cash_movement(uuid, text, numeric, text) to service_role;
