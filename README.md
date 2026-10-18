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
