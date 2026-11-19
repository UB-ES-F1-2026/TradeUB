-- TR11 (#110): catàleg d'actius simulat.
--
-- És l'única font de dades d'actius: no es connecta cap API de mercat. La
-- cerca (US5.1), el preu i la variació (US5.3) i la compra i venda (US6.1,
-- US6.2) llegeixen d'aquesta taula.
--
-- Els noms, tickers i ISIN són reals; el preu de tancament, la variació
-- diària i la data són simulats i no s'actualitzen. US5.3 mostra el preu i
-- la variació desats, sense calcular-los ni convertir divises.
--
-- type: 'accio' o 'etf'. El text visible ("Acció", "ETF") el posa el
-- frontend.
-- close_price_eur: numeric i no float perquè la compra (#126) en calcula el
--   cost.
--
-- RLS: els usuaris autenticats poden llegir tot el catàleg. No hi ha
-- polítiques d'INSERT, UPDATE ni DELETE, així que el client no hi pot
-- escriure. El backend, amb la clau secreta, salta el RLS.
--
-- La migració es pot tornar a executar: el seed actualitza els actius que ja
-- existeixen (per ticker).

create table if not exists public.assets (
  id bigint generated always as identity primary key,
  name text not null,
  ticker text not null unique,
  isin text not null unique,
  type text not null,
  close_price_eur numeric(12, 2) not null,
  daily_change_pct numeric(6, 2) not null,
  price_date date not null
);

-- add constraint no admet "if not exists": s'esborra abans perquè la
-- migració es pugui tornar a executar sense errors.
alter table public.assets
  drop constraint if exists assets_isin_format,
  add constraint assets_isin_format
    check (isin ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$'),
  drop constraint if exists assets_type_valid,
  add constraint assets_type_valid
    check (type in ('accio', 'etf')),
  drop constraint if exists assets_close_price_positive,
  add constraint assets_close_price_positive
    check (close_price_eur > 0);

alter table public.assets enable row level security;

drop policy if exists "Els usuaris autenticats poden veure el catàleg d'actius." on public.assets;
create policy "Els usuaris autenticats poden veure el catàleg d'actius."
  on public.assets for select
  to authenticated
  using (true);

insert into public.assets
  (name, ticker, isin, type, close_price_eur, daily_change_pct, price_date)
values
  ('Apple', 'AAPL', 'US0378331005', 'accio', 212.40, 0.85, '2026-11-13'),
  ('Microsoft', 'MSFT', 'US5949181045', 'accio', 398.15, -0.42, '2026-11-13'),
  ('Amazon', 'AMZN', 'US0231351067', 'accio', 186.70, 1.23, '2026-11-13'),
  ('Alphabet (classe A)', 'GOOGL', 'US02079K3059', 'accio', 165.30, -1.08, '2026-11-13'),
  ('NVIDIA', 'NVDA', 'US67066G1040', 'accio', 128.90, 2.47, '2026-11-13'),
  ('Tesla', 'TSLA', 'US88160R1014', 'accio', 241.55, -3.12, '2026-11-13'),
  ('Meta Platforms', 'META', 'US30303M1027', 'accio', 512.80, 0.37, '2026-11-13'),
  ('ASML Holding', 'ASML', 'NL0010273215', 'accio', 684.20, -0.95, '2026-11-13'),
  ('SAP', 'SAP', 'DE0007164600', 'accio', 221.35, 0.64, '2026-11-13'),
  ('LVMH', 'MC', 'FR0000121014', 'accio', 618.40, -1.56, '2026-11-13'),
  ('Inditex', 'ITX', 'ES0148396007', 'accio', 49.82, 0.28, '2026-11-13'),
  ('Banco Santander', 'SAN', 'ES0113900J37', 'accio', 5.12, 1.79, '2026-11-13'),
  ('Iberdrola', 'IBE', 'ES0144580Y14', 'accio', 13.46, -0.22, '2026-11-13'),
  ('Telefónica', 'TEF', 'ES0178430E18', 'accio', 4.31, 0.00, '2026-11-13'),
  ('iShares Core MSCI World UCITS ETF (Acc)', 'EUNL', 'IE00B4L5Y983', 'etf', 98.75, 0.41, '2026-11-13'),
  ('Vanguard FTSE All-World UCITS ETF (Dist)', 'VWRL', 'IE00B3RBWM25', 'etf', 121.60, 0.33, '2026-11-13'),
  ('iShares Core S&P 500 UCITS ETF (Acc)', 'SXR8', 'IE00B5BMR087', 'etf', 548.20, 0.52, '2026-11-13'),
  ('iShares NASDAQ 100 UCITS ETF (Acc)', 'SXRV', 'IE00B53SZB19', 'etf', 972.40, 0.88, '2026-11-13'),
  ('Xtrackers MSCI World UCITS ETF 1C', 'XDWD', 'IE00BJ0KDQ92', 'etf', 109.15, 0.39, '2026-11-13'),
  ('iShares Core MSCI EM IMI UCITS ETF (Acc)', 'IS3N', 'IE00BKM4GZ66', 'etf', 33.48, -0.61, '2026-11-13')
on conflict (ticker) do update set
  name = excluded.name,
  isin = excluded.isin,
  type = excluded.type,
  close_price_eur = excluded.close_price_eur,
  daily_change_pct = excluded.daily_change_pct,
  price_date = excluded.price_date;
