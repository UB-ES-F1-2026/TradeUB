-- US5.6 (#191): motor de preus simulats.
--
-- El preu de cada actiu es calcula a Postgres amb una fórmula determinista, sense taules de preus: dona el mateix
-- preu a tothom i per a qualsevol instant, passat o actual. La cerca, la compra, la venda, l'execució de les ordres
-- pendents (US6.6) i els gràfics (US10.2) el llegeixen d'aquí, així que tots fan servir el mateix preu.
--
-- Segona migració de la cadena SQL del Sprint 3 (després de 20261125120000_orders_create.sql).
--
-- La migració es pot tornar a executar.

-- --- Paràmetres de cada actiu ---
--
-- close_price_eur queda com a preu d'ancoratge: la fórmula oscil·la al seu voltant. daily_change_pct i price_date
-- deixen de fer-se servir (la variació es calcula), però no s'esborren.
-- - volatility: amplitud de les oscil·lacions dins del dia, en tant per u. Entre 0,0058 i 0,0092 dona un rang diari
--   d'entre l'1 % i el 3 % (mesurat cada minut durant 40 sessions). Les accions es mouen més que els ETF.
-- - drift: amplitud de la tendència de setmanes, en tant per u (±2–5 % en unes sis setmanes).
-- Per defecte, uns valors prudents: els prenen els actius que s'afegeixin sense indicar-los.

alter table public.assets
    add column if not exists volatility numeric(6, 4) not null default 0.0072,
    add column if not exists drift numeric(6, 4) not null default 0.0300;

update public.assets as a
set volatility = v.volatility, drift = v.drift
from (values
    ('AAPL', 0.0080, 0.0400),
    ('MSFT', 0.0076, 0.0350),
    ('AMZN', 0.0084, 0.0450),
    ('GOOGL', 0.0080, 0.0400),
    ('NVDA', 0.0092, 0.0500),
    ('TSLA', 0.0092, 0.0500),
    ('META', 0.0086, 0.0450),
    ('ASML', 0.0084, 0.0450),
    ('SAP', 0.0076, 0.0350),
    ('MC', 0.0078, 0.0400),
    ('ITX', 0.0076, 0.0350),
    ('SAN', 0.0082, 0.0450),
    ('IBE', 0.0072, 0.0300),
    ('TEF', 0.0072, 0.0300),
    ('EUNL', 0.0058, 0.0200),
    ('VWRL', 0.0058, 0.0200),
    ('SXR8', 0.0060, 0.0250),
    ('SXRV', 0.0068, 0.0300),
    ('XDWD', 0.0058, 0.0200),
    ('IS3N', 0.0066, 0.0300)
) as v (ticker, volatility, drift)
where a.ticker = v.ticker;

-- Si la columna ja existia (la migració es torna a executar), també ha de tenir el valor per defecte
alter table public.assets
    alter column volatility set default 0.0072,
    alter column drift set default 0.0300,
    drop constraint if exists assets_volatility_range,
    add constraint assets_volatility_range check (volatility > 0 and volatility <= 0.05),
    drop constraint if exists assets_drift_range,
    add constraint assets_drift_range check (drift >= 0 and drift <= 0.2);

-- --- Horari del mercat ---
--
-- Les accions i els ETF cotitzen de dilluns a divendres de 7:30:00 a 22:59:59, hora de Madrid, sense festius.
-- "at time zone 'Europe/Madrid'" passa l'instant a l'hora local: el canvi d'hora el resol Postgres.

create or replace function public.market_is_open(p_asset_type text, p_at timestamptz default now())
returns boolean
language sql
stable
set search_path = ''
as $$
    select case
        when p_asset_type in ('accio', 'etf') then
            extract(isodow from (p_at at time zone 'Europe/Madrid')) between 1 and 5
            and (p_at at time zone 'Europe/Madrid')::time >= time '07:30'
            and (p_at at time zone 'Europe/Madrid')::time < time '23:00'
        -- US5.7 hi afegeix 'cripto', que cotitza a tota hora
        else false
    end
$$;

-- Rellotge de mercat: quants segons de mercat obert hi ha hagut des del dilluns 5 de gener de 2026 (00:00, hora de
-- Madrid) fins a l'instant p_at, amb resolució d'1 segon. Només avança amb el mercat obert: amb el mercat tancat es
-- queda a l'últim segon de la sessió anterior (22:59:59), i el primer segon de la sessió següent (7:30:00) és el
-- següent. Així el preu d'obertura continua el del tancament (US5.6).
--
-- Es calcula en temps constant, sense recórrer dies: les setmanes senceres valen 5 sessions de 55.800 segons
-- (7:30–23:00) i, de la setmana en curs, compten els dies feiners ja passats i els segons de la sessió d'avui.
-- Abans de l'origen el rellotge és negatiu, i la fórmula continua funcionant.

create or replace function public.market_seconds(p_at timestamptz default now())
returns bigint
language sql
stable
set search_path = ''
as $$
    with local as (
        select date_trunc('second', p_at at time zone 'Europe/Madrid') as at
    ), parts as (
        select
            (at::date - date '2026-01-05') as days,
            extract(epoch from at::time)::integer - 27000 as session_second
        from local
    ), week as (
        select
            floor(days / 7.0)::bigint as weeks,
            (days - 7 * floor(days / 7.0))::integer as weekday,
            session_second
        from parts
    )
    select
        (weeks * 5 + least(weekday, 5)) * 55800
        -- Dies feiners: el segon de la sessió, sense passar de 22:59:59 ni de l'últim segon de la sessió anterior.
        -- Dissabte i diumenge: l'últim segon del divendres
        + case when weekday < 5 then greatest(least(session_second, 55799), -1) else -1 end
    from week
$$;

-- Només el backend (service_role) calcula preus: la vista de cotitzacions i les funcions de compra i venda
revoke all on function public.market_is_open(text, timestamptz) from public, anon, authenticated;
grant execute on function public.market_is_open(text, timestamptz) to service_role;
revoke all on function public.market_seconds(timestamptz) from public, anon, authenticated;
grant execute on function public.market_seconds(timestamptz) to service_role;

-- --- Preu de cada actiu ---
--
-- asset_price(actiu, instant): el preu simulat d'un actiu en un instant, passat o actual, amb resolució d'1 segon.
-- Determinista (sense random() ni taules de preus): dona el mateix preu a tothom. Es calcula en temps constant, perquè
-- els gràfics (US10.2) en demanaran centenars de punts.
--
-- Fórmula, sobre el rellotge de mercat m (market_seconds, que només avança amb el mercat obert):
--
--   preu = close_price_eur × exp(tendència + dins del dia + soroll)
--
-- - tendència: drift × sin(m / 30 sessions): puja i baixa a poc a poc durant unes sis setmanes.
-- - dins del dia: volatility × (tres sinus de 45 min, 2 h i 5 h). Dona el rang diari d'entre l'1 % i el 3 %.
-- - soroll: ±0,05 % per segon, d'un hash md5 de (actiu, m). md5 dona el mateix resultat en qualsevol versió de
--   Postgres, i així els preus passats no canvien mai.
-- Les fases de cada sinus surten de l'id de l'actiu, perquè els actius no es moguin tots alhora. exp() fa que el preu
-- no sigui mai negatiu ni zero.
--
-- Amb el mercat tancat, m no avança: el preu és el del tancament (22:59:59). El primer segon de la sessió següent
-- continua aquest preu, sense salt a l'obertura. Arrodonit a 2 decimals: el preu que es veu és el que s'executa.
-- Si l'actiu no existeix, retorna null.

create or replace function public.asset_price(p_asset_id bigint, p_at timestamptz default now())
returns numeric
language plpgsql
stable
set search_path = ''
as $$
declare
    -- plpgsql i no sql: una funció sql amb search_path no es pot inserir a la consulta i es tornaria a planificar a
    -- cada crida (uns 0,2 ms); plpgsql en guarda el pla
    v_close double precision;
    v_volatility double precision;
    v_drift double precision;
    v_m double precision := public.market_seconds(p_at);
    v_noise double precision;
begin
    select close_price_eur, volatility, drift into v_close, v_volatility, v_drift
    from public.assets
    where id = p_asset_id;

    if not found then
        return null;
    end if;

    -- Soroll de cada segon, entre −0,05 % i +0,05 %: els 32 primers bits de l'md5 de (actiu, segon), entre −1 i 1
    v_noise := ('x' || substr(md5(p_asset_id::text || ':' || v_m::bigint::text), 1, 8))::bit(32)::integer / 2147483648.0;

    return round((v_close * exp(
        -- Tendència de setmanes: un cicle cada 30 sessions de 55.800 segons
        v_drift * sin(2 * pi() * v_m / (30 * 55800.0) + p_asset_id * 2.399)
        -- Dins del dia: cicles de 45 minuts, 2 hores i 5 hores
        + v_volatility * (
            0.55 * sin(2 * pi() * v_m / 2700.0 + p_asset_id * 1.731)
            + 0.30 * sin(2 * pi() * v_m / 7200.0 + p_asset_id * 0.947)
            + 0.15 * sin(2 * pi() * v_m / 18000.0 + p_asset_id * 3.083)
        )
        + 0.0005 * v_noise
    ))::numeric, 2);
end;
$$;

revoke all on function public.asset_price(bigint, timestamptz) from public, anon, authenticated;
grant execute on function public.asset_price(bigint, timestamptz) to service_role;

-- --- Cotització actual ---
--
-- market_time(m): l'instant que correspon al segon m del rellotge de mercat. És la inversa de market_seconds: el
-- segon s d'una sessió és a les 7:30 + s, hora de Madrid, del seu dia feiner.

create or replace function public.market_time(p_market_seconds bigint)
returns timestamptz
language sql
stable
set search_path = ''
as $$
    with session as (
        select
            floor(p_market_seconds / 55800.0)::bigint as n,
            p_market_seconds - floor(p_market_seconds / 55800.0)::bigint * 55800 as second
    )
    select (
        date '2026-01-05' + (floor(n / 5.0)::integer * 7 + (n - floor(n / 5.0)::bigint * 5)::integer)
        + time '07:30' + second * interval '1 second'
    ) at time zone 'Europe/Madrid'
    from session
$$;

-- asset_quotes: la cotització actual de cada actiu, per a la cerca (#192), la Cartera (US8.2) i la fitxa (US10.1).
-- - price: el preu d'ara (asset_price).
-- - price_at: l'instant d'aquest preu. Amb el mercat obert, el segon actual; amb el mercat tancat, el del tancament
--   (22:59:59 de l'última sessió).
-- - daily_change_pct: la variació respecte al tancament de la sessió anterior. Amb el mercat tancat, la de l'última
--   sessió respecte a l'anterior. En tots dos casos, la referència és l'últim segon de la sessió abans de la del
--   rellotge.
-- - market_open: si ara cotitza.
-- now() és l'instant de la transacció: totes les columnes i tots els actius fan servir el mateix instant.
-- security_invoker: es llegeix amb els permisos de qui consulta. Només el backend (service_role) la pot llegir.

create or replace view public.asset_quotes
with (security_invoker = true)
as
select
    a.id,
    a.name,
    a.ticker,
    a.isin,
    a.type,
    q.price,
    public.market_time(c.m) as price_at,
    round((q.price / q.previous_close - 1) * 100, 2) as daily_change_pct,
    public.market_is_open(a.type) as market_open
from public.assets as a
cross join lateral (select public.market_seconds() as m) as c
cross join lateral (
    select
        public.asset_price(a.id) as price,
        public.asset_price(a.id, public.market_time(floor(c.m / 55800.0)::bigint * 55800 - 1)) as previous_close
) as q;

revoke all on function public.market_time(bigint) from public, anon, authenticated;
grant execute on function public.market_time(bigint) to service_role;
revoke all on public.asset_quotes from public, anon, authenticated;
grant select on public.asset_quotes to service_role;
