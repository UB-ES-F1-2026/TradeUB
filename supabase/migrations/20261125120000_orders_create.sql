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

-- buy_asset: desa l'ordre executada.
--
-- La compra fa el mateix que a 20261121130000_buy_asset.sql (mateixa
-- signatura, mateix preu del catàleg, mateixa comissió) i, dins de la mateixa
-- transacció, insereix l'ordre 'executada'. Si qualsevol pas falla, no es desa
-- ni el moviment, ni la posició, ni l'ordre.
--
-- - L'id del moviment es genera aquí i es passa a process_cash_movement, així
--   l'ordre el pot guardar a cash_movement_id.
-- - El preu mitjà anterior es llegeix després de process_cash_movement, que
--   bloqueja el compte. Si es llegís abans, dues compres simultànies podrien
--   llegir el mateix preu mitjà, i la segona desaria el d'abans de la primera.
--   Es llegeix amb un select a part perquè el RETURNING de l'upsert només dona
--   els valors nous.
-- - Retorna també order_id i price. La resta del resultat no canvia.

create or replace function public.buy_asset(
    p_user_id uuid,
    p_asset_id bigint,
    p_units numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_price numeric(12, 2);
    v_cost numeric(14, 2);
    v_commission numeric(14, 2);
    v_total numeric(14, 2);
    v_balance numeric(14, 2);
    v_units numeric(20, 8);
    v_avg_price numeric(18, 6);
    v_previous_avg_price numeric(18, 6);
    v_movement_id uuid := gen_random_uuid();
    v_order_id uuid;
begin
    if p_units is null or p_units <= 0 or p_units <> trunc(p_units) then
        raise exception 'Units must be a positive whole number'
            using errcode = '22023';
    end if;

    -- El preu sempre surt del catàleg, mai de la petició.
    select close_price_eur into v_price
    from public.assets
    where id = p_asset_id;

    if not found then
        raise exception 'Asset not found: %', p_asset_id
            using errcode = 'P0004';
    end if;

    v_cost := p_units * v_price;
    v_commission := least(ceil(v_cost) / 100, 1.00);
    v_total := v_cost + v_commission;

    -- Bloqueja el compte, comprova el saldo i registra el moviment de compra
    -- amb l'id que després es guarda a l'ordre.
    v_balance := public.process_cash_movement(
        p_user_id, 'compra', -v_total, p_movement_id => v_movement_id
    );

    -- Preu mitjà de la posició abans de la compra. Si és la primera compra de
    -- l'actiu no hi ha fila i queda null.
    select avg_price into v_previous_avg_price
    from public.positions
    where user_id = p_user_id and asset_id = p_asset_id;

    -- Crea la posició o hi suma les unitats. Les expressions del SET llegeixen
    -- els valors anteriors de la fila, així que el preu mitjà es calcula amb
    -- les unitats d'abans de la compra.
    insert into public.positions as p (user_id, asset_id, units, avg_price)
    values (p_user_id, p_asset_id, p_units, v_total / p_units)
    on conflict (user_id, asset_id) do update set
        avg_price = (p.units * p.avg_price + v_total) / (p.units + excluded.units),
        units = p.units + excluded.units,
        updated_at = now()
    returning p.units, p.avg_price into v_units, v_avg_price;

    -- L'ordre desa les dades del moment de la compra: el detall (US6.5) no
    -- canvia encara que després canviï el preu del catàleg.
    insert into public.orders (
        user_id, asset_id, side, status, units, price, amount, commission,
        total, avg_price_at_execution, executed_at, cash_movement_id
    )
    values (
        p_user_id, p_asset_id, 'compra', 'executada', p_units, v_price, v_cost,
        v_commission, v_total, v_previous_avg_price, now(), v_movement_id
    )
    returning id into v_order_id;

    -- Els imports viatgen com a text perquè el backend els llegeixi com a
    -- Decimal exacte, sense passar per un float.
    return jsonb_build_object(
        'order_id', v_order_id,
        'price', v_price::text,
        'balance', v_balance::text,
        'units', trunc(v_units)::text,
        'avg_price', v_avg_price::text,
        'cost', v_cost::text,
        'commission', v_commission::text,
        'total', v_total::text
    );
end;
$$;

-- Mateixos permisos que abans: només el backend (service_role).
revoke all on function public.buy_asset(uuid, bigint, numeric) from public, anon, authenticated;
grant execute on function public.buy_asset(uuid, bigint, numeric) to service_role;

-- sell_asset: desa l'ordre executada.
--
-- La venda fa el mateix que a 20261123120000_sell_asset.sql (mateixa
-- signatura, mateix ordre de bloqueig: primer el compte, després la posició)
-- i, dins de la mateixa transacció, insereix l'ordre 'executada'. Si qualsevol
-- pas falla, no es desa ni el moviment, ni el canvi de la posició, ni l'ordre.
--
-- - L'id del moviment es genera aquí i es passa a process_cash_movement, com
--   a buy_asset.
-- - El preu mitjà anterior és el de la fila de la posició que la funció ja
--   bloqueja abans de vendre: no cal cap lectura més.
-- - El total de l'ordre és l'import net que s'abona (amount − comissió).
-- - L'ordre es desa encara que la venda liquidi tota la posició i se n'esborri
--   la fila.
-- - Retorna també order_id i price. La resta del resultat no canvia.

create or replace function public.sell_asset(
    p_user_id uuid,
    p_asset_id bigint,
    p_units numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_price numeric(12, 2);
    v_held numeric(20, 8);
    v_avg_price numeric(18, 6);
    v_amount numeric(14, 2);
    v_commission numeric(14, 2);
    v_net numeric(14, 2);
    v_balance numeric(14, 2);
    v_movement_id uuid := gen_random_uuid();
    v_order_id uuid;
begin
    if p_units is null or p_units <= 0 or p_units <> trunc(p_units) then
        raise exception 'Units must be a positive whole number'
            using errcode = '22023';
    end if;

    -- El preu sempre surt del catàleg, mai de la petició.
    select close_price_eur into v_price
    from public.assets
    where id = p_asset_id;

    if not found then
        raise exception 'Asset not found: %', p_asset_id
            using errcode = 'P0004';
    end if;

    -- Primer el compte, després la posició (mateix ordre que buy_asset).
    perform 1 from public.accounts where user_id = p_user_id for update;

    select units, avg_price into v_held, v_avg_price
    from public.positions
    where user_id = p_user_id and asset_id = p_asset_id
    for update;

    if not found or v_held < p_units then
        raise exception 'Not enough units: held %, requested %',
            coalesce(v_held, 0), p_units
            using errcode = 'P0005';
    end if;

    v_amount := p_units * v_price;
    v_commission := least(ceil(v_amount) / 100, 1.00);
    v_net := v_amount - v_commission;

    -- Suma l'import net al saldo i registra el moviment de venda amb l'id que
    -- després es guarda a l'ordre.
    v_balance := public.process_cash_movement(
        p_user_id, 'venda', v_net, p_movement_id => v_movement_id
    );

    if v_held = p_units then
        delete from public.positions
        where user_id = p_user_id and asset_id = p_asset_id;
    else
        update public.positions
        set units = units - p_units, updated_at = now()
        where user_id = p_user_id and asset_id = p_asset_id;
    end if;

    -- L'ordre desa les dades del moment de la venda: el detall (US6.5) no
    -- canvia encara que després canviï el preu del catàleg.
    insert into public.orders (
        user_id, asset_id, side, status, units, price, amount, commission,
        total, avg_price_at_execution, executed_at, cash_movement_id
    )
    values (
        p_user_id, p_asset_id, 'venda', 'executada', p_units, v_price, v_amount,
        v_commission, v_net, v_avg_price, now(), v_movement_id
    )
    returning id into v_order_id;

    -- Els imports viatgen com a text perquè el backend els llegeixi com a
    -- Decimal exacte, sense passar per un float.
    return jsonb_build_object(
        'order_id', v_order_id,
        'price', v_price::text,
        'balance', v_balance::text,
        'units', trunc(v_held - p_units)::text,
        'avg_price', v_avg_price::text,
        'amount', v_amount::text,
        'commission', v_commission::text,
        'net', v_net::text
    );
end;
$$;

-- Mateixos permisos que abans: només el backend (service_role).
revoke all on function public.sell_asset(uuid, bigint, numeric) from public, anon, authenticated;
grant execute on function public.sell_asset(uuid, bigint, numeric) to service_role;
