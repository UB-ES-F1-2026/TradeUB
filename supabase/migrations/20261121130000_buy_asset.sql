-- US6.1 (#126): compra d'un actiu simulat.
--
-- Decisions (#126):
-- - Només unitats enteres.
-- - Comissió: el mínim entre l'1% del cost i 1 €, arrodonit a l'alça al
--   cèntim. Amb unitats enteres el cost ja surt en cèntims exactes, així que
--   l'1% arrodonit a l'alça és ceil(cost) / 100.
-- - La comissió va dins del moviment de compra i compta en el preu mitjà.
--
-- buy_asset fa tota la compra en una sola transacció: si qualsevol pas falla,
-- no es desa res. Crida process_cash_movement, que bloqueja primer la fila
-- del compte; així dues compres del mateix usuari s'executen en cua i
-- l'upsert de positions sempre parteix de la posició ja confirmada. La venda
-- (#128) ha de seguir el mateix ordre: primer el compte, després la posició.
--
-- Errors (el backend els converteix en errors HTTP):
-- - 22023: unitats no enteres o <= 0.
-- - P0004: l'actiu no existeix.
-- - P0003: saldo insuficient (el llança process_cash_movement).
--
-- La migració es pot tornar a executar.

-- Només unitats enteres a les posicions.
alter table public.positions
    drop constraint if exists positions_units_whole,
    add constraint positions_units_whole check (units = trunc(units));

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

    -- Bloqueja el compte, comprova el saldo i registra el moviment de compra.
    v_balance := public.process_cash_movement(p_user_id, 'compra', -v_total);

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

    -- Els imports viatgen com a text perquè el backend els llegeixi com a
    -- Decimal exacte, sense passar per un float.
    return jsonb_build_object(
        'balance', v_balance::text,
        'units', trunc(v_units)::text,
        'avg_price', v_avg_price::text,
        'cost', v_cost::text,
        'commission', v_commission::text,
        'total', v_total::text
    );
end;
$$;

-- Només el backend (service_role) pot executar la compra.
revoke all on function public.buy_asset(uuid, bigint, numeric) from public, anon, authenticated;
grant execute on function public.buy_asset(uuid, bigint, numeric) to service_role;
