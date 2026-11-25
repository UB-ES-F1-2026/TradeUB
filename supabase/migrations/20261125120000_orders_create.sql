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
