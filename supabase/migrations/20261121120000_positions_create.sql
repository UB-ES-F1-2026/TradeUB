-- US6.1: posicions agregades per usuari i actiu simulat.
--
-- Aquesta taula és la base comuna de les futures operacions de compra i venda.
-- Cada usuari només pot tenir una fila per actiu; les operacions actualitzaran
-- les unitats i el preu mitjà des del backend.

create table if not exists public.positions (
    user_id uuid not null references auth.users (id) on delete cascade,
    asset_id bigint not null references public.assets (id),
    units numeric(20, 8) not null,
    avg_price numeric(12, 2) not null,
    updated_at timestamptz not null default now(),
    primary key (user_id, asset_id),
    constraint positions_units_positive check (units > 0),
    constraint positions_avg_price_positive check (avg_price > 0)
);

-- RLS: el client només pot consultar les posicions del mateix usuari.
-- No hi ha polítiques d'INSERT, UPDATE ni DELETE: les escriptures futures
-- quedaran reservades a operacions del backend amb la clau de servei.
alter table public.positions enable row level security;

drop policy if exists "Users can read their own positions" on public.positions;
create policy "Users can read their own positions"
    on public.positions for select
    to authenticated
    using ((select auth.uid()) = user_id);
