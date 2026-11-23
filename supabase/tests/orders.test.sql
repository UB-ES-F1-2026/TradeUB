-- Tests de buy_asset (US6.1, #126) i sell_asset (US6.2, #128) contra un Postgres real amb les migracions aplicades.
-- Els tests del backend simulen la crida RPC: aquí es comprova el que fa la funció de veritat (imports, comissió,
-- preu mitjà, posició i moviment, errors i permisos). Tot va dins d'una transacció que es desfà al final.
-- S'executa amb supabase/tests/run.sh.

set client_min_messages = notice;

begin;

-- El backend crida les funcions amb la clau secreta (service_role)
set local request.jwt.claim.role = 'service_role';

create function pg_temp.ok(p_cond boolean, p_name text) returns void
language plpgsql as $$
begin
    if p_cond is not true then
        raise exception 'not ok - %', p_name;
    end if;
    raise notice 'ok - %', p_name;
end $$;

create function pg_temp.is(p_got numeric, p_want numeric, p_name text) returns void
language plpgsql as $$
begin
    if p_got is distinct from p_want then
        raise exception 'not ok - %: s''esperava %, s''ha obtingut %', p_name, p_want, p_got;
    end if;
    raise notice 'ok - %', p_name;
end $$;

create function pg_temp.throws(p_sql text, p_code text, p_name text) returns void
language plpgsql as $$
begin
    begin
        execute p_sql;
    -- P0004 (actiu no trobat) és també el codi d'assert_failure, que others no captura
    exception when others or assert_failure then
        if sqlstate = p_code then
            raise notice 'ok - %', p_name;
            return;
        end if;
        raise exception 'not ok - %: s''esperava l''error %, s''ha obtingut % (%)', p_name, p_code, sqlstate, sqlerrm;
    end;
    raise exception 'not ok - %: s''esperava l''error %, no n''hi ha hagut cap', p_name, p_code;
end $$;

-- Usuari nou amb el saldo indicat. El trigger de auth.users ja li crea el compte
create function pg_temp.new_user(p_balance numeric) returns uuid
language plpgsql as $$
declare
    v_user uuid := gen_random_uuid();
begin
    insert into auth.users (id) values (v_user);
    update public.accounts set balance = p_balance where user_id = v_user;
    return v_user;
end $$;

create function pg_temp.asset(p_ticker text) returns bigint
language sql as $$ select id from public.assets where ticker = p_ticker $$;

create function pg_temp.balance(p_user uuid) returns numeric
language sql as $$ select balance from public.accounts where user_id = p_user $$;

-- Actius de prova amb preus coneguts, a part del catàleg simulat
insert into public.assets (name, ticker, isin, type, close_price_eur, daily_change_pct, price_date) values
    ('Test 25', 'TST25', 'XX0000000025', 'accio', 25.00, 0, '2026-11-20'),
    ('Test 150', 'TST150', 'XX0000000150', 'accio', 150.00, 0, '2026-11-20'),
    ('Test 12,34', 'TST1234', 'XX0000001234', 'etf', 12.34, 0, '2026-11-20');

-- --- buy_asset ---

do $$
declare
    v_user uuid := pg_temp.new_user(1000);
    v_result jsonb;
    v_position record;
    v_movement record;
begin
    v_result := public.buy_asset(v_user, pg_temp.asset('TST25'), 2);

    -- 2 × 25 € = 50 €, comissió 1% = 0,50 €
    perform pg_temp.is((v_result ->> 'cost')::numeric, 50.00, 'compra: el cost és unitats × preu del catàleg');
    perform pg_temp.is((v_result ->> 'commission')::numeric, 0.50, 'compra: la comissió és l''1% del cost');
    perform pg_temp.is((v_result ->> 'total')::numeric, 50.50, 'compra: el total és cost + comissió');
    perform pg_temp.is((v_result ->> 'balance')::numeric, 949.50, 'compra: retorna el saldo nou');
    perform pg_temp.is(pg_temp.balance(v_user), 949.50, 'compra: el saldo baixa el total');

    select units, avg_price into v_position from public.positions
    where user_id = v_user and asset_id = pg_temp.asset('TST25');
    perform pg_temp.is(v_position.units, 2, 'compra: crea la posició amb les unitats');
    perform pg_temp.is(v_position.avg_price, 25.25, 'compra: el preu mitjà inclou la comissió');

    select type, amount, balance_after into v_movement from public.cash_movements where user_id = v_user;
    perform pg_temp.ok(v_movement.type = 'compra', 'compra: registra un moviment de tipus compra');
    perform pg_temp.is(v_movement.amount, -50.50, 'compra: el moviment resta el total');
    perform pg_temp.is(v_movement.balance_after, 949.50, 'compra: el moviment desa el saldo resultant');
end $$;

do $$
declare
    v_user uuid := pg_temp.new_user(1000);
    v_result jsonb;
begin
    perform public.buy_asset(v_user, pg_temp.asset('TST25'), 2);
    -- El preu del catàleg canvia: 2 × 35 € + 0,70 € = 70,70 €
    update public.assets set close_price_eur = 35.00 where ticker = 'TST25';
    v_result := public.buy_asset(v_user, pg_temp.asset('TST25'), 2);
    update public.assets set close_price_eur = 25.00 where ticker = 'TST25';

    perform pg_temp.is((v_result ->> 'units')::numeric, 4, 'segona compra: suma les unitats a la posició');
    -- (50,50 + 70,70) / 4
    perform pg_temp.is((v_result ->> 'avg_price')::numeric, 30.30, 'segona compra: recalcula el preu mitjà ponderat');
    perform pg_temp.ok(
        (select count(*) from public.positions where user_id = v_user) = 1,
        'segona compra: no crea una segona posició'
    );
end $$;

do $$
declare
    v_user uuid := pg_temp.new_user(1000);
begin
    -- 150 € → 1% = 1,50 €, però el màxim és 1 €
    perform pg_temp.is(
        (public.buy_asset(v_user, pg_temp.asset('TST150'), 1) ->> 'commission')::numeric, 1.00,
        'compra: la comissió no passa d''1 €'
    );
    -- 12,34 € → 1% = 0,1234 €, arrodonit a l'alça
    perform pg_temp.is(
        (public.buy_asset(v_user, pg_temp.asset('TST1234'), 1) ->> 'commission')::numeric, 0.13,
        'compra: la comissió s''arrodoneix a l''alça al cèntim'
    );
end $$;

do $$
declare
    v_user uuid := pg_temp.new_user(50.49);
begin
    -- Cal 50,50 €: falta un cèntim
    perform pg_temp.throws(
        format('select public.buy_asset(%L, %s, 2)', v_user, pg_temp.asset('TST25')),
        'P0003', 'compra sense prou saldo: P0003'
    );
    perform pg_temp.is(pg_temp.balance(v_user), 50.49, 'compra sense prou saldo: el saldo no canvia');
    perform pg_temp.ok(
        not exists (select 1 from public.positions where user_id = v_user),
        'compra sense prou saldo: no crea la posició'
    );
end $$;

do $$
declare
    v_user uuid := pg_temp.new_user(1000);
    v_asset bigint := pg_temp.asset('TST25');
begin
    perform pg_temp.throws(format('select public.buy_asset(%L, %s, 1.5)', v_user, v_asset), '22023', 'compra d''1,5 unitats: 22023');
    perform pg_temp.throws(format('select public.buy_asset(%L, %s, 0)', v_user, v_asset), '22023', 'compra de 0 unitats: 22023');
    perform pg_temp.throws(format('select public.buy_asset(%L, %s, -1)', v_user, v_asset), '22023', 'compra d''unitats negatives: 22023');
    perform pg_temp.throws(format('select public.buy_asset(%L, %s, null)', v_user, v_asset), '22023', 'compra sense unitats: 22023');
    perform pg_temp.throws(format('select public.buy_asset(%L, -1, 1)', v_user), 'P0004', 'compra d''un actiu que no existeix: P0004');
end $$;

-- --- sell_asset ---

do $$
declare
    v_user uuid := pg_temp.new_user(1000);
    v_result jsonb;
    v_movement record;
begin
    -- 4 × 25 € + 1 € de comissió = 101 € → saldo 899 €, preu mitjà 25,25 €
    perform public.buy_asset(v_user, pg_temp.asset('TST25'), 4);
    v_result := public.sell_asset(v_user, pg_temp.asset('TST25'), 1);

    -- 1 × 25 € = 25 €, comissió 0,25 €, net 24,75 €
    perform pg_temp.is((v_result ->> 'amount')::numeric, 25.00, 'venda: l''import és unitats × preu del catàleg');
    perform pg_temp.is((v_result ->> 'commission')::numeric, 0.25, 'venda: la comissió és l''1% de l''import');
    perform pg_temp.is((v_result ->> 'net')::numeric, 24.75, 'venda: el net és import − comissió');
    perform pg_temp.is((v_result ->> 'balance')::numeric, 923.75, 'venda: retorna el saldo nou');
    perform pg_temp.is(pg_temp.balance(v_user), 923.75, 'venda: el saldo puja el net');
    perform pg_temp.is((v_result ->> 'units')::numeric, 3, 'venda: retorna les unitats que queden');
    perform pg_temp.is(
        (select units from public.positions where user_id = v_user), 3,
        'venda: la posició es redueix'
    );
    perform pg_temp.is(
        (select avg_price from public.positions where user_id = v_user), 25.25,
        'venda: el preu mitjà de les unitats que queden no canvia'
    );

    select type, amount, balance_after into v_movement from public.cash_movements
    where user_id = v_user and type = 'venda';
    perform pg_temp.is(v_movement.amount, 24.75, 'venda: registra un moviment de venda amb el net');
    perform pg_temp.is(v_movement.balance_after, 923.75, 'venda: el moviment desa el saldo resultant');
end $$;

do $$
declare
    v_user uuid := pg_temp.new_user(1000);
    v_result jsonb;
begin
    perform public.buy_asset(v_user, pg_temp.asset('TST25'), 3);
    v_result := public.sell_asset(v_user, pg_temp.asset('TST25'), 3);

    perform pg_temp.is((v_result ->> 'units')::numeric, 0, 'vendre-ho tot: retorna 0 unitats');
    perform pg_temp.ok(
        not exists (select 1 from public.positions where user_id = v_user),
        'vendre-ho tot: esborra la posició'
    );
end $$;

do $$
declare
    v_user uuid := pg_temp.new_user(1000);
begin
    perform public.buy_asset(v_user, pg_temp.asset('TST150'), 1);
    perform pg_temp.is(
        (public.sell_asset(v_user, pg_temp.asset('TST150'), 1) ->> 'commission')::numeric, 1.00,
        'venda: la comissió no passa d''1 €'
    );
end $$;

do $$
declare
    v_user uuid := pg_temp.new_user(1000);
    v_asset bigint := pg_temp.asset('TST25');
begin
    perform public.buy_asset(v_user, v_asset, 2);

    perform pg_temp.throws(format('select public.sell_asset(%L, %s, 3)', v_user, v_asset), 'P0005', 'vendre més unitats de les que es tenen: P0005');
    perform pg_temp.is((select units from public.positions where user_id = v_user), 2, 'vendre més unitats: la posició no canvia');
    perform pg_temp.throws(
        format('select public.sell_asset(%L, %s, 1)', v_user, pg_temp.asset('TST150')),
        'P0005', 'vendre un actiu sense posició: P0005'
    );
    perform pg_temp.throws(format('select public.sell_asset(%L, %s, 1.5)', v_user, v_asset), '22023', 'venda d''1,5 unitats: 22023');
    perform pg_temp.throws(format('select public.sell_asset(%L, %s, 0)', v_user, v_asset), '22023', 'venda de 0 unitats: 22023');
    perform pg_temp.throws(format('select public.sell_asset(%L, -1, 1)', v_user), 'P0004', 'venda d''un actiu que no existeix: P0004');
end $$;

-- --- Permisos ---

do $$
declare
    v_user uuid := pg_temp.new_user(1000);
    v_other uuid := pg_temp.new_user(1000);
    v_asset bigint := pg_temp.asset('TST25');
begin
    perform public.buy_asset(v_user, v_asset, 2);

    -- Amb el token d'un altre usuari, process_cash_movement atura la compra i la venda
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claim.sub', v_other::text, true);
    perform pg_temp.throws(format('select public.buy_asset(%L, %s, 1)', v_user, v_asset), '42501', 'compra amb el token d''un altre usuari: 42501');
    perform pg_temp.throws(format('select public.sell_asset(%L, %s, 1)', v_user, v_asset), '42501', 'venda amb el token d''un altre usuari: 42501');
    perform set_config('request.jwt.claim.role', 'service_role', true);
    perform set_config('request.jwt.claim.sub', '', true);
end $$;

-- Des del navegador (rol authenticated) les funcions no es poden executar
set local role authenticated;
do $$
begin
    begin
        perform public.buy_asset(gen_random_uuid(), 1, 1);
        raise exception 'not ok - authenticated no pot executar buy_asset';
    exception when insufficient_privilege then
        raise notice 'ok - authenticated no pot executar buy_asset';
    end;
    begin
        perform public.sell_asset(gen_random_uuid(), 1, 1);
        raise exception 'not ok - authenticated no pot executar sell_asset';
    exception when insufficient_privilege then
        raise notice 'ok - authenticated no pot executar sell_asset';
    end;
end $$;
reset role;

rollback;
