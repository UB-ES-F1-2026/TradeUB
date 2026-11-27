-- Tests del motor de preus (US5.6, #191) contra un Postgres real amb les migracions aplicades: horari, rellotge de
-- mercat, preu (determinisme, preu aturat, sense salts, rang diari), cotització actual i compra i venda al preu del
-- motor. Tot va dins d'una transacció que es desfà al final. S'executa amb supabase/tests/run.sh.
--
-- Els instants van en hora de Madrid. La setmana de referència és la del 30/11/2026 (dilluns) al 4/12/2026 (divendres).

set client_min_messages = notice;

begin;

-- El backend calcula els preus amb la clau secreta (service_role)
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

-- Instant en hora de Madrid
create function pg_temp.at(p_local text) returns timestamptz
language sql as $$ select (p_local::timestamp) at time zone 'Europe/Madrid' $$;

-- --- Horari del mercat (C1) ---

do $$
begin
    perform pg_temp.ok(not public.market_is_open('accio', pg_temp.at('2026-11-30 07:29:59')), 'horari: dilluns a les 7:29:59 és tancat');
    perform pg_temp.ok(public.market_is_open('accio', pg_temp.at('2026-11-30 07:30:00')), 'horari: dilluns a les 7:30:00 és obert');
    perform pg_temp.ok(public.market_is_open('etf', pg_temp.at('2026-11-30 22:59:59')), 'horari: a les 22:59:59 és obert');
    perform pg_temp.ok(not public.market_is_open('etf', pg_temp.at('2026-11-30 23:00:00')), 'horari: a les 23:00:00 és tancat');
    perform pg_temp.ok(not public.market_is_open('accio', pg_temp.at('2026-12-05 12:00:00')), 'horari: dissabte és tancat');
    perform pg_temp.ok(not public.market_is_open('accio', pg_temp.at('2026-12-06 12:00:00')), 'horari: diumenge és tancat');
    -- Canvi d'hora: l'horari és a l'hora local, abans i després
    perform pg_temp.ok(public.market_is_open('accio', pg_temp.at('2026-03-27 22:59:59')), 'horari: divendres abans del canvi a l''hora d''estiu, a les 22:59:59, és obert');
    perform pg_temp.ok(not public.market_is_open('accio', pg_temp.at('2026-03-30 07:29:59')), 'horari: dilluns després del canvi a l''hora d''estiu, a les 7:29:59, és tancat');
    perform pg_temp.ok(public.market_is_open('accio', pg_temp.at('2026-03-30 07:30:00')), 'horari: dilluns després del canvi a l''hora d''estiu, a les 7:30:00, és obert');
    perform pg_temp.ok(public.market_is_open('accio', pg_temp.at('2026-10-26 07:30:00')), 'horari: dilluns després del canvi a l''hora d''hivern, a les 7:30:00, és obert');
end $$;

-- --- Rellotge de mercat ---

do $$
declare
    v_errors integer;
begin
    perform pg_temp.is(
        public.market_seconds(pg_temp.at('2026-12-01 07:30:00')) - public.market_seconds(pg_temp.at('2026-11-30 22:59:59')), 1,
        'rellotge: l''obertura és el segon següent al tancament del dia anterior'
    );
    perform pg_temp.is(
        public.market_seconds(pg_temp.at('2026-12-07 07:30:00')) - public.market_seconds(pg_temp.at('2026-12-04 22:59:59')), 1,
        'rellotge: l''obertura del dilluns és el segon següent al tancament del divendres'
    );
    perform pg_temp.is(
        public.market_seconds(pg_temp.at('2026-03-30 07:30:00')) - public.market_seconds(pg_temp.at('2026-03-27 22:59:59')), 1,
        'rellotge: el canvi d''hora no hi afegeix ni hi treu cap segon'
    );
    perform pg_temp.is(
        public.market_seconds(pg_temp.at('2026-12-05 12:00:00')), public.market_seconds(pg_temp.at('2026-12-04 22:59:59')),
        'rellotge: amb el mercat tancat es queda al tancament'
    );

    select count(*) into v_errors
    from generate_series(-300, 3000) as g, lateral (select g * 9973::bigint as m) as s
    where public.market_seconds(public.market_time(s.m)) <> s.m;
    perform pg_temp.is(v_errors, 0, 'rellotge: market_time és la inversa de market_seconds');
end $$;

-- --- Preu (C5) ---

do $$
declare
    v_tsla bigint := (select id from public.assets where ticker = 'TSLA');
begin
    perform pg_temp.is(
        public.asset_price(v_tsla, pg_temp.at('2026-12-02 11:00:00')), public.asset_price(v_tsla, pg_temp.at('2026-12-02 11:00:00')),
        'preu: el mateix instant dona el mateix preu (determinista)'
    );
    perform pg_temp.is(
        public.asset_price(v_tsla, pg_temp.at('2026-12-02 11:00:00.999')), public.asset_price(v_tsla, pg_temp.at('2026-12-02 11:00:00')),
        'preu: resolució d''1 segon'
    );
    perform pg_temp.is(
        public.asset_price(v_tsla, pg_temp.at('2026-12-05 12:00:00')), public.asset_price(v_tsla, pg_temp.at('2026-12-04 22:59:59')),
        'preu: el dissabte és el del tancament del divendres'
    );
    perform pg_temp.is(
        public.asset_price(v_tsla, pg_temp.at('2026-12-07 07:29:59')), public.asset_price(v_tsla, pg_temp.at('2026-12-04 22:59:59')),
        'preu: el dilluns abans de l''obertura continua sent el del tancament del divendres'
    );
    perform pg_temp.ok(public.asset_price(-1) is null, 'preu: un actiu que no existeix no té preu');
end $$;

-- Cap preu ≤ 0 ni cap salt de més del 0,5 % entre dos segons seguits: una hora de cada actiu segon a segon, i el pas
-- del tancament a l'obertura (d'un dia a l'altre i del divendres al dilluns)
do $$
declare
    v_min numeric;
    v_jump numeric;
    v_open_jump numeric;
begin
    with prices as (
        select a.id, s.at, public.asset_price(a.id, s.at) as price
        from public.assets as a,
            generate_series(pg_temp.at('2026-12-02 10:00:00'), pg_temp.at('2026-12-02 11:00:00'), interval '1 second') as s(at)
    ), jumps as (
        select price, abs(price / lag(price) over (partition by id order by at) - 1) as jump from prices
    )
    select min(price), max(jump) into v_min, v_jump from jumps;

    select max(abs(public.asset_price(a.id, opens.at) / public.asset_price(a.id, opens.at - interval '1 second') - 1))
    into v_open_jump
    from public.assets as a,
        (values (pg_temp.at('2026-12-01 07:30:00')), (pg_temp.at('2026-12-07 07:30:00'))) as opens(at);

    perform pg_temp.ok(v_min > 0, 'preu: mai és zero ni negatiu');
    perform pg_temp.ok(v_jump <= 0.005, format('preu: cap salt de més del 0,5 %% entre dos segons seguits (màxim %s %%)', round(v_jump * 100, 3)));
    perform pg_temp.ok(v_open_jump <= 0.005, format('preu: l''obertura no salta respecte al tancament (màxim %s %%)', round(v_open_jump * 100, 3)));
end $$;

-- Rang diari entre l'1 % i el 3 %, amb una mostra cada minut, de tots els actius durant 5 sessions
do $$
declare
    v_min numeric;
    v_max numeric;
begin
    with samples as (
        select a.id, d.day, public.asset_price(a.id, s.at) as price
        from public.assets as a,
            generate_series(0, 4) as d(day),
            generate_series(
                pg_temp.at('2026-11-30 07:30:00') + d.day * interval '1 day',
                pg_temp.at('2026-11-30 22:59:00') + d.day * interval '1 day',
                interval '1 minute'
            ) as s(at)
    ), ranges as (
        select max(price) / min(price) - 1 as r from samples group by id, day
    )
    select min(r), max(r) into v_min, v_max from ranges;

    perform pg_temp.ok(v_min >= 0.01, format('preu: el rang diari és almenys de l''1 %% (mínim %s %%)', round(v_min * 100, 2)));
    perform pg_temp.ok(v_max <= 0.03, format('preu: el rang diari no passa del 3 %% (màxim %s %%)', round(v_max * 100, 2)));
end $$;

-- --- Cotització actual ---

do $$
declare
    v_quote record;
    v_m bigint := public.market_seconds();
begin
    select * into v_quote from public.asset_quotes where ticker = 'AAPL';

    perform pg_temp.is(v_quote.price, public.asset_price(v_quote.id), 'cotització: el preu és el del motor ara');
    perform pg_temp.ok(v_quote.price_at = public.market_time(v_m), 'cotització: price_at és el segon del preu (l''actual o el del tancament)');
    perform pg_temp.ok(v_quote.market_open = public.market_is_open('accio'), 'cotització: market_open diu si ara cotitza');
    perform pg_temp.is(
        v_quote.daily_change_pct,
        round((v_quote.price / public.asset_price(v_quote.id, public.market_time(floor(v_m / 55800.0)::bigint * 55800 - 1)) - 1) * 100, 2),
        'cotització: la variació és respecte al tancament de la sessió anterior'
    );
    perform pg_temp.is((select count(*) from public.asset_quotes), (select count(*) from public.assets), 'cotització: hi ha tots els actius');
end $$;

-- --- Compra i venda al preu del motor (C7) ---

do $$
declare
    v_user uuid := gen_random_uuid();
    v_asset bigint := (select id from public.assets where ticker = 'AAPL');
    v_price numeric := public.asset_price(v_asset);
    v_buy jsonb;
    v_sell jsonb;
begin
    insert into auth.users (id) values (v_user);
    update public.accounts set balance = 10000 where user_id = v_user;

    -- now() és l'instant de la transacció: el preu de la compra i el de la venda són el d'aquest instant
    v_buy := public.buy_asset(v_user, v_asset, 2);
    v_sell := public.sell_asset(v_user, v_asset, 1);

    perform pg_temp.is((v_buy ->> 'price')::numeric, v_price, 'compra: al preu de asset_price en aquest instant');
    perform pg_temp.is((v_buy ->> 'cost')::numeric, 2 * v_price, 'compra: el cost és unitats × preu del motor');
    perform pg_temp.is((v_sell ->> 'price')::numeric, v_price, 'venda: al preu de asset_price en aquest instant');
    perform pg_temp.ok(
        (select bool_and(price = v_price) from public.orders where user_id = v_user),
        'ordres: desen el preu del motor'
    );
end $$;

rollback;
