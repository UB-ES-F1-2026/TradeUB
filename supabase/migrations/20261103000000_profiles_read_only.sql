-- US2.1 (#66): la taula profiles passa a ser de només lectura per a l'usuari.
--
-- L'estat de l'onboarding es dedueix de les dades de profiles, així que el
-- client no hi ha de poder escriure directament. Només el backend hi escriu,
-- amb la clau secreta (que salta el RLS).
--
-- Polítiques abans d'aquesta migració:
--   SELECT "Els usuaris poden veure el seu propi perfil."      (auth.uid() = id)
--   UPDATE "Els usuaris poden actualitzar el seu propi perfil." (auth.uid() = id)
--
-- No hi ha polítiques d'INSERT ni de DELETE, així que amb el RLS actiu ja
-- estan denegades. La fila de cada usuari la crea el trigger
-- on_auth_user_created (handle_new_user), que no depèn d'aquestes polítiques.
--
-- La política de SELECT es manté tal com està. La política restrictiva aal2
-- de la #23 queda fora d'aquesta migració.

alter table public.profiles enable row level security;

drop policy if exists "Els usuaris poden actualitzar el seu propi perfil." on public.profiles;
