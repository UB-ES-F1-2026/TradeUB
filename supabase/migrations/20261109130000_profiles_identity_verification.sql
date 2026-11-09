-- US2.4 (#70): columnes del pas de verificació d'identitat i termes a profiles.
--
-- La verificació del DNI és simulada: no es desa cap imatge, només el moment
-- en què l'usuari ha enviat el document. L'estat ("pendent", "en-revisio" o
-- "verificat") el calcula el backend a partir d'aquest moment
-- (core/verification.py), sense cap temporitzador a la base de dades.
--
-- Totes les columnes són nullables: NULL vol dir que l'usuari encara no ha
-- enviat el document o no ha acceptat els termes.
--
-- El RLS no canvia: l'usuari només pot llegir la seva fila i les escriptures
-- les fa el backend amb la clau secreta (vegeu
-- 20261103000000_profiles_read_only.sql).

alter table public.profiles
  add column if not exists dni_enviat_at timestamptz,
  add column if not exists termes_versio text,
  add column if not exists termes_acceptats_at timestamptz;

-- add constraint no admet "if not exists": s'esborra abans perquè la
-- migració es pugui tornar a executar sense errors.
alter table public.profiles
  -- La versió i la data de l'acceptació van sempre juntes
  drop constraint if exists profiles_termes_complets,
  add constraint profiles_termes_complets
    check ((termes_versio is null) = (termes_acceptats_at is null)),
  -- Els termes només es poden acceptar després d'enviar el document
  drop constraint if exists profiles_termes_despres_dni,
  add constraint profiles_termes_despres_dni
    check (termes_acceptats_at is null or dni_enviat_at is not null);
