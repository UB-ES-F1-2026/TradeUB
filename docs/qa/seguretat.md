# Proves de seguretat de les dades

Objectiu: comprovar que cap usuari pot veure ni modificar les dades d'un altre i
que ningú es pot canviar el saldo del compte virtual. Les dades són simulades,
però el control d'accés s'ha de comportar com en una aplicació real.

La seguretat té dues capes i cal provar-les totes dues:

1. **Backend (FastAPI):** valida el token de Supabase i filtra sempre per
   l'usuari del token. Es prova amb tests automàtics a la CI.
2. **Base de dades (Supabase, RLS):** encara que algú cridi Supabase directament
   des del navegador amb el seu token, les polítiques RLS només li deixen fer el
   que toca. Es prova amb les consultes SQL d'aquest document.

## 1. Tests automàtics (CI)

| Comprovació | Fitxer |
|---|---|
| Cap ruta de `/api/v1` respon sense sessió (401). Si algú afegeix una ruta nova sense protegir, el test falla | `backend/api/tests/test_security.py` |
| Els paràmetres o capçaleres de la petició no permeten demanar les dades d'un altre usuari | `backend/api/tests/test_security.py` |
| Amb la 2FA activa, una sessió amb només contrasenya (aal1) rep 403 i no arriba a la base de dades | `backend/api/tests/test_security.py` |
| Tokens caducats, mal signats, sense signatura, d'un altre projecte o d'una altra audiència → 401 | `backend/api/tests/test_users_me.py` |
| `/account/balance` filtra pel `sub` del token | `backend/api/tests/test_account_balance.py` (US3.1) |
| El frontend no crida l'API sense sessió i esborra el saldo en tancar sessió | `frontend/src/tests/api.spec.js`, `accountStore.spec.js` (US3.1) |

Per executar-los: `pytest` des de `backend/` i `npm test` des de `frontend/`.

## 2. Comprovacions a la base de dades

Executar al **SQL Editor** de Supabase, cada consulta per separat (l'editor
només mostra el resultat de l'última). Cap consulta modifica dades.

### 2.1 Configuració: RLS, polítiques i triggers

```sql
select 'rls_' || relname as tipus, relrowsecurity::text as nom, null as comanda
from pg_class
where oid in ('public.accounts'::regclass, 'public.profiles'::regclass)
union all
select 'policy_' || tablename, policyname, cmd
from pg_policies
where tablename in ('accounts', 'profiles')
union all
select 'trigger', tgname, null
from pg_trigger
where tgrelid = 'auth.users'::regclass and not tgisinternal;
```

Esperat: RLS a `true` a les dues taules, només polítiques de tipus `SELECT` i
els triggers `on_auth_user_created` (crea `profiles`) i
`on_auth_user_created_account` (crea `accounts`).

### 2.2 Simular un usuari: què veu i què pot modificar

La consulta s'executa amb el rol `authenticated` i el `sub` del primer usuari
registrat, igual que una crida feta des del navegador amb el seu token.
L'`update` deixa el saldo igual (`balance = balance`), així que no canvia res
encara que la seguretat fallés.

```sql
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users order by created_at limit 1), 'role', 'authenticated')::text,
  true);
set local role authenticated;
with prova_update as (
  update public.accounts set balance = balance returning user_id
)
select
  (select count(*) from public.accounts) as comptes_visibles,
  (select count(*) from prova_update) as comptes_modificats,
  (select count(*) from public.profiles) as perfils_visibles;
```

Esperat: `comptes_visibles = 1`, `comptes_modificats = 0`, `perfils_visibles = 1`.

### 2.3 Simular un usuari: crear un compte

```sql
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users order by created_at limit 1), 'role', 'authenticated')::text,
  true);
set local role authenticated;
insert into public.accounts (user_id, balance, currency) values (gen_random_uuid(), 1, 'EUR');
```

Esperat: error `42501: new row violates row-level security policy for table "accounts"`.

## 3. Registre d'execucions

| Data | Comprovació | Resultat obtingut | |
|---|---|---|---|
| 06/11/2026 | 2.1 | RLS `true` a `accounts` i `profiles`. Polítiques: `accounts_select_own` (SELECT) i "Els usuaris poden veure el seu propi perfil." (SELECT). Triggers `on_auth_user_created` i `on_auth_user_created_account`. 11 comptes per a 11 usuaris | ✅ |
| 06/11/2026 | 2.2 | `comptes_visibles = 1`, `comptes_modificats = 0`, `perfils_visibles = 1` | ✅ |
| 06/11/2026 | 2.3 | `ERROR: 42501: new row violates row-level security policy for table "accounts"` | ✅ |

Conclusió: un usuari només veu el seu compte i el seu perfil, no es pot
modificar el saldo i no pot crear comptes. Les escriptures només les fa el
servidor (triggers i backend).

## Limitacions

- Les comprovacions de la secció 2 es fan a mà: la CI no té accés a la base de
  dades de Supabase i no s'hi han de posar claus.
- El `user_metadata` de Supabase Auth el pot modificar el mateix usuari. Per això
  el perfil d'inversor que s'hi desa ara (#46) és provisional fins a la #69, i
  el saldo no s'hi desa mai.
- En local a Windows, els tests del backend que fan servir `TestClient` fallen
  perquè el fixture `no_network` bloqueja la connexió interna d'`asyncio`. A la
  CI (Linux) funcionen.
