-- US2.2 (#58): columnes del pas de dades personals a profiles.
--
-- El pas "dades-personals" de l'onboarding es considera completat quan totes
-- aquestes columnes tenen valor (core/onboarding.py). Per això són nullables:
-- les files existents i les noves (el trigger handle_new_user només insereix
-- l'id) comencen amb NULL, que vol dir "pas pendent".
--
-- L'obligatorietat dels camps i la lletra de control del NIF/NIE les valida
-- l'endpoint POST /api/v1/profile/personal-data. Els check d'aquí són una
-- segona defensa del format per si algú escriu a la taula per un altre camí.
--
-- nif i residencia_fiscal ja existien (buides a totes les files) i es
-- reutilitzen. nom_complet i nacionalitat no es toquen.
--
-- El RLS no canvia: l'usuari només pot llegir la seva fila i les escriptures
-- les fa el backend amb la clau secreta (vegeu
-- 20261103000000_profiles_read_only.sql).

alter table public.profiles
  add column if not exists nom text,
  add column if not exists cognoms text,
  add column if not exists data_naixement date,
  add column if not exists telefon text,
  add column if not exists carrer text,
  add column if not exists codi_postal text,
  add column if not exists poblacio text;

-- add constraint no admet "if not exists": s'esborra abans perquè la
-- migració es pugui tornar a executar sense errors.
alter table public.profiles
  drop constraint if exists profiles_nif_format,
  add constraint profiles_nif_format
    check (nif ~ '^([0-9]{8}|[XYZ][0-9]{7})[A-Z]$'),
  drop constraint if exists profiles_residencia_fiscal_iso,
  add constraint profiles_residencia_fiscal_iso
    check (residencia_fiscal ~ '^[A-Z]{2}$');
