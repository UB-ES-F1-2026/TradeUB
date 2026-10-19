# Execució i validació en local

## Backend (Python / FastAPI)

### 1. Configurar les variables d'entorn
Crear el fitxer `backend/.env` prenent com a base el fitxer `backend/.env.example`.

### 2. Instal·lar les dependències
```bash
cd backend
pip install -r requirements.txt
```

### 3. Validacions abans de fer un Pull Request

**Validar i corregir l'estil i la sintaxi del codi (Ruff):**

```bash
# Comprovar si hi ha errors d'estil o sintaxi
python -m ruff check .

# Corregir automàticament els errors que es puguin resoldre
python -m ruff check --fix .
```

**Executar els tests unitaris:**

```bash
pytest
```

### API de doble factor (2FA)

La configuració de 2FA utilitza el MFA TOTP de Supabase:

1. Amb el JWT de la sessió, el frontend fa `POST /api/v1/users/2fa/enroll`.
2. El backend retorna `factor_id` i una URI `otpauth://`. El frontend la converteix en un codi QR perquè l'usuari la pugui escanejar amb la seva aplicació d'autenticació.
3. El frontend envia el codi de sis dígits i `factor_id` a `POST /api/v1/users/2fa/verify`.
4. Si el codi no és correcte, l'API retorna `400` amb el missatge `El codi d'autenticació és incorrecte`.

El JWT s'ha d'enviar com `Authorization: Bearer <token>`. Supabase conserva el factor i el secret TOTP; el backend no els desa localment.


## Frontend (Vue 3 / Vite)

### 1. Configurar les variables d'entorn

Crear el fitxer `frontend/.env` prenent com a base el fitxer `frontend/.env.example`.

### 2. Instal·lar les dependències

```bash
cd frontend
npm ci
```

### 3. Validacions abans de fer una Pull Request

**Validar i corregir l'estil del codi (ESLint):**

```bash
# Comprova si hi ha errors d'estil
npm run lint

# Corregeix automàticament els problemes d'estil que es puguin resoldre
npx eslint . --fix
```

**Verificar que l'aplicació compila correctament:**

```bash
npm run build
```

**Executar els tests unitaris:**

```bash
npm test
```


## Abans de fer `git push`

Cal comprovar el següent:

* S'han configurat els fitxers `.env` a partir dels fitxers `.env.example`.
* El backend supera les comprovacions de Ruff (`python -m ruff check .`).
* Els tests del backend passen amb `pytest`.
* El frontend supera les comprovacions d'ESLint (`npm run lint`).
* El frontend es compila correctament amb `npm run build`.
* Els tests del frontend passen amb `npm test`.

**Important:** Cal executar les ordres de cada secció dins del directori corresponent (`/backend` o `/frontend`).

## Treball amb agents de codi

Les instruccions i plantilles del projecte per treballar amb agents de codi són a:

- [`AGENTS.md`](AGENTS.md): normes generals de codi, arquitectura, seguretat i
  validació.
- [`.github/copilot-instructions.md`](.github/copilot-instructions.md):
  instruccions que VS Code aplica al xat i al mode Agent.
- [`.github/skills/`](.github/skills/): procediments reutilitzables de
  validació i sistema visual.
- [`.github/agents/`](.github/agents/): perfils de backend, frontend i revisió.
- [`docs/agents/`](docs/agents/): especificació de tasques, matriu de
  delegació, Definition of Done, revisió, seguiment, Sprint Review,
  retrospectiva, Sprint 0 i registre acumulatiu.

Abans d'acceptar canvis generats per un agent, revisa sempre el diff i executa
les validacions indicades a `AGENTS.md`. No comparteixis claus d'API ni dades
reals al repositori o en una petició a un agent.
