-- US3.2 (#109): Versionat de la taula accounts, creada prèviament a mà (#56, PR #64).
--
-- Aquesta migració incorpora al repositori l'esquema de la taula de comptes
-- virtuals per assegurar que qualsevol entorn nou la creï abans d'executar
-- les migracions dependents (com cash_movements).
--
-- El RLS garanteix que cada usuari autenticat només pugui llegir el seu propi
-- saldo, mentre que les escriptures queden reservades al backend.

create table if not exists public.accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance numeric(14, 2) not null default 10000.00,
  currency text not null default 'EUR',
  updated_at timestamptz not null default now()
);

-- Activació de la seguretat a nivell de fila (RLS).
alter table public.accounts enable row level security;

-- Només lectura de la fila pròpia; cap política d'escriptura per al client.
drop policy if exists "accounts_select_own" on public.accounts;
create policy "accounts_select_own" on public.accounts
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Funció trigger que crea automàticament el compte virtual en donar d'alta un usuari.
create or replace function public.handle_new_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.accounts (user_id) values (new.id);
  return new;
end;
$$;

-- Trigger vinculat a la inserció de nous usuaris a auth.users.
drop trigger if exists on_auth_user_created_account on auth.users;
create trigger on_auth_user_created_account
  after insert on auth.users
  for each row execute function public.handle_new_account();

-- Backfill: crea el compte virtual per als usuaris que ja existien abans d'aquest trigger.
insert into public.accounts (user_id)
select id from auth.users
on conflict (user_id) do nothing;