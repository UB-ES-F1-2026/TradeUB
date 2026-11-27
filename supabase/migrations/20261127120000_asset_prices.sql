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
-- - volatility: amplitud de les oscil·lacions dins del dia, en tant per u. Dona un rang diari d'entre l'1 % i el 3 %.
--   Les accions es mouen més que els ETF.
-- - drift: amplitud de la tendència de setmanes, en tant per u.
-- Per defecte, uns valors prudents: els prenen els actius que s'afegeixin sense indicar-los.

alter table public.assets
    add column if not exists volatility numeric(6, 4) not null default 0.0080,
    add column if not exists drift numeric(6, 4) not null default 0.0400;

update public.assets as a
set volatility = v.volatility, drift = v.drift
from (values
    ('AAPL', 0.0090, 0.0500),
    ('MSFT', 0.0085, 0.0450),
    ('AMZN', 0.0100, 0.0550),
    ('GOOGL', 0.0095, 0.0500),
    ('NVDA', 0.0120, 0.0700),
    ('TSLA', 0.0120, 0.0800),
    ('META', 0.0105, 0.0600),
    ('ASML', 0.0100, 0.0550),
    ('SAP', 0.0085, 0.0450),
    ('MC', 0.0090, 0.0500),
    ('ITX', 0.0085, 0.0450),
    ('SAN', 0.0095, 0.0550),
    ('IBE', 0.0080, 0.0400),
    ('TEF', 0.0080, 0.0400),
    ('EUNL', 0.0050, 0.0300),
    ('VWRL', 0.0050, 0.0300),
    ('SXR8', 0.0055, 0.0350),
    ('SXRV', 0.0070, 0.0400),
    ('XDWD', 0.0050, 0.0300),
    ('IS3N', 0.0065, 0.0400)
) as v (ticker, volatility, drift)
where a.ticker = v.ticker;

-- Si la columna ja existia (la migració es torna a executar), també ha de tenir el valor per defecte
alter table public.assets
    alter column volatility set default 0.0080,
    alter column drift set default 0.0400,
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
