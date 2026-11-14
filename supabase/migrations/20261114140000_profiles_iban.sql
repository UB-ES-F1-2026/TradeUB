-- US3.3 (#134): IBAN vinculat de l'usuari a profiles.
--
-- Un sol IBAN per usuari, on es fan les retirades simulades (#116). És
-- nullable: NULL vol dir que l'usuari encara no n'ha vinculat cap.
--
-- Els dígits de control (mod-97) els valida l'endpoint
-- PUT /api/v1/profile/iban (core/iban.py), que el desa normalitzat: sense
-- espais i en majúscules. El check d'aquí és una segona defensa del format
-- per si algú escriu a la taula per un altre camí.
--
-- A diferència del hash del PIN (20261114130000_profile_pins.sql), l'IBAN no
-- és un secret d'autenticació: és una dada de l'usuari que pot llegir de la
-- seva pròpia fila. GET /api/v1/users/me el retorna només emmascarat.
--
-- El RLS no canvia: l'usuari només pot llegir la seva fila i les escriptures
-- les fa el backend amb la clau secreta (vegeu
-- 20261103000000_profiles_read_only.sql).

alter table public.profiles
  add column if not exists iban text;

-- add constraint no admet "if not exists": s'esborra abans perquè la
-- migració es pugui tornar a executar sense errors.
alter table public.profiles
  drop constraint if exists profiles_iban_format,
  add constraint profiles_iban_format
    check (iban is null or iban ~ '^ES[0-9]{22}$');
