-- El mínim de Supabase que necessiten les migracions per aplicar-se en un Postgres buit: l'esquema auth amb
-- auth.users, auth.uid() i auth.role(), i els rols anon, authenticated i service_role. auth.uid() i auth.role()
-- llegeixen el token igual que a Supabase, de request.jwt.claim.sub i request.jwt.claim.role.
-- Només per als tests: a Supabase això ja existeix.

do $$
begin
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
exception when duplicate_object then null;
end $$;

create schema if not exists auth;

create table if not exists auth.users (
    id uuid primary key default gen_random_uuid()
);

create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create or replace function auth.role() returns text
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.role', true), '')::text $$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
