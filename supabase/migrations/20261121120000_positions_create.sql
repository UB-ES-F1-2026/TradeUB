-- US6.1: posicions agregades per usuari i actiu simulat.
--
-- Aquesta taula és la base comuna de les futures operacions de compra i venda.
-- Cada usuari només pot tenir una fila per actiu; les operacions actualitzaran
-- les unitats i el preu mitjà des del backend.
--
-- avg_price: preu mitjà ponderat per unitats. Té 6 decimals perquè la mitjana
--   de diverses compres gairebé mai surt en cèntims exactes; amb 2 decimals
--   l'error d'arrodoniment s'acumularia a cada compra i falsejaria el
--   resultat de la venda (US6.2). S'arrodoneix a cèntims només en mostrar-lo.
-- units > 0: una posició amb 0 unitats no existeix. Quan una venda (US6.2)
--   liquida totes les unitats, cal esborrar la fila, no posar-la a 0.

create table if not exists public.positions (
    user_id uuid not null references auth.users (id) on delete cascade,
    asset_id bigint not null references public.assets (id),
    units numeric(20, 8) not null,
    avg_price numeric(18, 6) not null,
    updated_at timestamptz not null default now(),
    primary key (user_id, asset_id),
    constraint positions_units_positive check (units > 0),
    constraint positions_avg_price_positive check (avg_price > 0)
);

-- La clau primària ja cobreix les consultes per usuari. Postgres no indexa
-- les claus foranes, així que s'indexa asset_id per a les consultes i
-- comprovacions per actiu.
create index if not exists positions_asset_id_idx
    on public.positions (asset_id);

-- RLS: el client només pot consultar les posicions del mateix usuari.
-- No hi ha polítiques d'INSERT, UPDATE ni DELETE: les escriptures futures
-- quedaran reservades a operacions del backend amb la clau de servei.
alter table public.positions enable row level security;

-- Supabase dona permisos per defecte a anon i authenticated sobre les taules
-- noves de public. Sense polítiques d'escriptura el RLS ja les denega; es
-- revoquen igualment com a segona defensa per si algú hi afegeix una política.
revoke insert, update, delete on public.positions from anon, authenticated;

drop policy if exists "Users can read their own positions" on public.positions;
create policy "Users can read their own positions"
    on public.positions for select
    to authenticated
    using ((select auth.uid()) = user_id);
