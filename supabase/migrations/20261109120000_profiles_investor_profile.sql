-- US2.3 (#69): columnes del qüestionari d'experiència inversora a profiles.
--
-- El perfil d'inversor el calcula i el desa el backend
-- (POST /api/v1/profile/investor-questionnaire) perquè l'usuari no el pugui
-- triar des del navegador. El pas "questionari-inversor" de l'onboarding es
-- considera completat quan hi ha un perfil desat (core/onboarding.py).
--
-- respostes_questionari: les 5 respostes tal com les envia el frontend,
--   { "experiencia": "cap", "coneixement": "baix", ... } (id de pregunta → id
--   d'opció, els de frontend/src/utils/investorQuestions.js). Es desen per
--   poder justificar el perfil assignat.
-- perfil_inversor: el perfil resultant.
--
-- Totes dues són nullables: les files existents i les noves (el trigger
-- handle_new_user només insereix l'id) comencen amb NULL, que vol dir
-- "pas pendent".
--
-- Les respostes i el càlcul els valida l'endpoint. Els check d'aquí són una
-- segona defensa per si algú escriu a la taula per un altre camí.
--
-- El RLS no canvia: l'usuari només pot llegir la seva fila i les escriptures
-- les fa el backend amb la clau secreta (vegeu
-- 20261103000000_profiles_read_only.sql).

alter table public.profiles
  add column if not exists respostes_questionari jsonb,
  add column if not exists perfil_inversor text;

-- add constraint no admet "if not exists": s'esborra abans perquè la
-- migració es pugui tornar a executar sense errors.
alter table public.profiles
  drop constraint if exists profiles_perfil_inversor_valid,
  add constraint profiles_perfil_inversor_valid
    check (perfil_inversor in ('principiant', 'intermedi', 'avancat')),
  drop constraint if exists profiles_respostes_questionari_object,
  add constraint profiles_respostes_questionari_object
    check (jsonb_typeof(respostes_questionari) = 'object'),
  -- Un perfil sense respostes (o al revés) vol dir que algú s'ha saltat l'endpoint
  drop constraint if exists profiles_questionari_complet,
  add constraint profiles_questionari_complet
    check ((respostes_questionari is null) = (perfil_inversor is null));
