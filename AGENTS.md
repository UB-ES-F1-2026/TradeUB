# AGENTS.md - Instruccions del projecte

TradeUB és una còpia reduïda, amb finalitats acadèmiques, de l'experiència web de Trade Republic. El producte combina un frontend Vue 3/Vite amb un backend FastAPI i autenticació Supabase. No és una plataforma financera real: no s'hi han d'afegir funcionalitats que puguin interpretar-se com operacions financeres reals sense una decisió explícita de l'equip.

## Llenguatge i estil

- Backend: Python 3.12, FastAPI, Pydantic i Ruff.
- Frontend: JavaScript amb Vue 3, Vite, Vue Router i Pinia.
- Mantenir el format i el linting d'acord amb la configuració existent de Ruff i ESLint sense modificar les seves regles per resoldre errors puntuals.

## Convencions de l'equip

- Branques:
  - Crear una branca pare de User Story amb el format `feature/US<numero>`,
    per exemple, `feature/US1.1`.
  - Per a cada tasca concreta, crear una branca filla a partir de la branca
    de la User Story amb el format
    `feature/US<numero>-<explicacio-tasca-concreta>`.
  - Quan la tasca estigui acabada, obrir una Pull Request de la branca
    `feature/US<numero>-<explicacio-tasca-concreta>` cap a `feature/US<numero>`. Anomenada `Feature/us1.1 <titol-tasca>` per exemple.
  - Quan la User Story estigui completada, obrir una Pull Request de la branca
    `feature/US<numero>` cap a `develop`. Anomenada `US1.1 <titol-user-story>` per exemple.
- Els noms de les explicacions de tasca a les branques han de ser breus, en
  minúscules i separats per guions.
- Els commits han de tenir una descripció breu i clara en anglès, en imperatiu.
- Noms de variables, funcions, components i fitxers de codi en anglès.
- Textos visuals de la interfície, missatges d'error i documentació d'ús en català.
- Estructura de carpetes a respectar:
  - `backend/api/`: routers i dependències de l'API.
  - `backend/core/`: configuració compartida i integracions transversals.
  - `backend/api/tests/`: tests del backend.
  - `frontend/src/views/`: pantalles i vistes.
  - `frontend/src/components/ui/`: components visuals reutilitzables (`UiButton`, `UiInput`, `UiCard`, `UiAlert`, `UiBadge`, `UiLogo`).
  - `frontend/src/styles/tokens.css`: única font de veritat per colors, tipografia, espais, radis i ombres (no hardcodegar colors).
  - `frontend/src/styles/base.css`: reset i estils globals.
  - `frontend/src/stores/` i `frontend/src/services/`: estat i integracions.
  - `.github/workflows/ci.yml`: validacions executades a CI.
  - `.github/skills/` i `.github/agents/`: procediments i perfils per a agents.
  - `docs/agents/`: plantilles de treball amb agents del curs.
- Utilitzar la font Inter, les classes `.tabular`, `.eyebrow` i `.tub-on-dark` quan correspongui, i mantenir el disseny adaptatiu (responsive) a 900 px o menys.

## Restriccions permanents

- No afegir dependències noves sense justificar-ho a la tasca i actualitzar el manifest corresponent.
- L'autenticació i el TOTP 2FA es deleguen a Supabase: no desar secrets TOTP ni factors localment.
- No utilitzar dades que suggereixin una operació de compra o venda real; fer servir dades simulades.
- No aprovar ni executar ordres destructives, instal·lacions o migracions sense revisió humana explícita.
- Conservar sempre els canvis previs de l'equip en fer modificacions acotades.

## Tests i qualitat

- Frameworks de testing: `pytest` per al backend i el runner definit a `npm test` per al frontend.
- La CI és la referència final (executa lint, build i tests). Documentar la manca de cobertura en la revisió en lloc d'inventar tests.
- Cada comportament nou del backend ha d'incloure o actualitzar tests a
  `backend/api/tests/`.
- Els canvis de frontend han d'incloure o actualitzar tests quan introdueixin
  lògica o comportament verificable. Els canvis purament visuals o de
  documentació s'han de validar manualment.
- Ordres per a validació local:
  - Backend (des de `backend/`):
    ```powershell
    python -m compileall -q .
    python -m ruff check .
    pytest
    ```
  - Frontend (des de `frontend/`):
    ```powershell
    npm run lint
    npm run build
    npm test
    ```

## Build i execució

- Per preparar l'entorn local:
  - Copiar `backend/.env.example` a `backend/.env`.
  - Copiar `frontend/.env.example` a `frontend/.env`.
  - Instal·lar les dependències del backend amb `pip install -r requirements.txt`
    des de `backend/`.
  - Instal·lar les dependències del frontend amb `npm ci` des de `frontend/`.
- Per iniciar el backend, des de `backend/`, executar:
  ```powershell
  uvicorn main:app --reload
  ```
- Per iniciar el frontend, des de `frontend/`, executar:
  ```powershell
  npm run dev
  ```
- Mantenir les rutes de l'API sota `/api/v1` i conservar els tags de FastAPI.
- Les rutes protegides han de reutilitzar les dependències d'autenticació de
  `backend/api/deps.py` i retornar errors HTTP explícits.
- Les variables d'entorn només poden procedir dels fitxers `.env` locals o del
  secret store de l'entorn. Els fitxers `.env` locals no s'han de versionar.
  Queda prohibit introduir claus, tokens o dades reals al repositori.

## Àrees sensibles

- **UI / Sistema visual:** Abans de modificar vistes o components, cal llegir `.github/skills/tradeub-ui/SKILL.md`, `tokens.css` i el catàleg `/ui`. Si es modifiquen tokens o components compartits, cal actualitzar la skill de UI i la vista `/ui`.
- **Procés de treball de l'agent:** Explora primer el codi, proposa un pla curt abans d'editar, revisa el diff, executa les validacions i explica qualsevol limitació o test no executat.
- **Decisions crítiques:** Les tasques sobre arquitectura, seguretat, secrets, dades, producte o canvis amplis d'infraestructura requereixen una revisió humana exhaustiva.