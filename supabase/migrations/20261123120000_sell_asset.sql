-- US6.2 (#128): venda d'unitats d'una posició.
--
-- Decisions (#126, #128):
-- - Només unitats enteres.
-- - Mateixa comissió que a la compra: el mínim entre l'1% de l'import i 1 €,
--   arrodonit a l'alça al cèntim, i es descompta de l'import de la venda.
--   Com que no supera mai l'1%, l'import net sempre és positiu.
--
-- sell_asset fa tota la venda en una sola transacció: si qualsevol pas falla,
-- no es desa res. Bloqueja primer el compte i després la posició, en el
-- mateix ordre que buy_asset, perquè una compra i una venda simultànies no
-- es bloquegin mútuament. Si es venen totes les unitats, la fila s'esborra:
-- positions no admet units = 0. El preu mitjà de les unitats que queden no
-- canvia.
--
-- Errors (el backend els converteix en errors HTTP):
-- - 22023: unitats no enteres o <= 0.
-- - P0004: l'actiu no existeix.
-- - P0005: no hi ha prou unitats a la posició (o no n'hi ha cap).
--
-- La migració es pot tornar a executar.

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

    -- Suma l'import net al saldo i registra el moviment de venda.
    v_balance := public.process_cash_movement(p_user_id, 'venda', v_net);

    if v_held = p_units then
        delete from public.positions
        where user_id = p_user_id and asset_id = p_asset_id;
    else
        update public.positions
        set units = units - p_units, updated_at = now()
        where user_id = p_user_id and asset_id = p_asset_id;
    end if;

    -- Els imports viatgen com a text perquè el backend els llegeixi com a
    -- Decimal exacte, sense passar per un float.
    return jsonb_build_object(
        'balance', v_balance::text,
        'units', trunc(v_held - p_units)::text,
        'avg_price', v_avg_price::text,
        'amount', v_amount::text,
        'commission', v_commission::text,
        'net', v_net::text
    );
end;
$$;

-- Només el backend (service_role) pot executar la venda.
revoke all on function public.sell_asset(uuid, bigint, numeric) from public, anon, authenticated;
grant execute on function public.sell_asset(uuid, bigint, numeric) to service_role;
