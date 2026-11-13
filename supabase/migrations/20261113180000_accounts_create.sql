-- US3.2 (#109): Versionat de la taula accounts, creada prèviament a mà (#56).
--
-- Aquesta migració incorpora al repositori l'esquema de la taula de comptes
-- virtuals per assegurar que qualsevol entorn nou la creï abans d'executar
-- les migracions dependents (com cash_movements).
--
-- El RLS garanteix que cada usuari només pugui consultar el seu propi saldo,
-- mentre que les modificacions queden reservades exclusivament al backend
-- mitjançant la clau de servei (service_role) o funcions segures.

create table if not exists public.accounts (
    user_id uuid primary key references auth.users(id) on delete cascade,
    balance numeric(12, 2) not null default 10000.00,
    currency text not null default 'EUR',
    updated_at timestamptz not null default now()
);

-- Activació de la seguretat a nivell de fila (RLS).
alter table public.accounts enable row level security;

-- Política de lectura: l'usuari autenticat només pot veure el seu propi compte.
-- S'esborra abans perquè la migració es pugui tornar a executar sense errors.
drop policy if exists "Users can read their own account" on public.accounts;
create policy "Users can read their own account"
    on public.accounts for select
    using (auth.uid() = user_id);
