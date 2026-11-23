#!/usr/bin/env bash
# Tests de les funcions SQL contra un Postgres buit: el mínim de Supabase, les migracions en ordre i els fitxers
# *.test.sql. Cada test escriu "ok - ..." i el primer que falla atura l'script.
# Les migracions de profiles s'ometen: la taula es va crear a mà abans de la primera migració i no es pot
# reconstruir des del repositori. Les funcions que es proven aquí no la fan servir.
#
# Ús: DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."

run_sql() { psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 -v VERBOSITY=terse "$@"; }

PGOPTIONS='-c client_min_messages=warning' run_sql -f tests/supabase_stub.sql
for f in migrations/*.sql; do
  if grep -q 'profiles' "$f"; then continue; fi
  PGOPTIONS='-c client_min_messages=warning' run_sql -f "$f"
done
for f in tests/*.test.sql; do
  echo "== $f"
  run_sql -f "$f" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
done
