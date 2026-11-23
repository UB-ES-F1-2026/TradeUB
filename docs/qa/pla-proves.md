# Pla de proves d'acceptació i regressió

Casos de prova manuals construïts a partir dels criteris d'acceptació de Trello.
Serveixen per comprovar a **producció** (Netlify + Azure) que cada user story fa
el que promet abans de cada demo.

- **Proves d'acceptació:** les user stories del sprint actual (US2.x, US3.1).
- **Proves de regressió:** les user stories ja lliurades (US1.x). Es tornen a
  executar a cada demo per comprovar que els canvis nous no han trencat res.
- **Proves exploratòries:** sessió lliure de 30 minuts per trobar errors que els
  casos escrits no cobreixen (secció final).

Els resultats esperats corresponen a l'estat de `develop` del 09/11/2026. La columna
**Resultat obtingut** guarda l'última execució; les anteriors queden al
[registre d'execucions](#registre-dexecucions).

## Com fer-lo servir

1. Obrir l'aplicació desplegada (la de `develop`) en una finestra d'incògnit.
2. Seguir els passos de cada cas i comparar amb el resultat esperat.
3. Apuntar el resultat a la columna **Resultat obtingut**: ✅ compleix · ❌ no compleix ·
   ⏳ encara no desplegat · ➖ no aplicable aquest sprint.
4. Per cada ❌, crear una issue a GitHub amb el número del cas (p. ex. `US1.2-03`)
   i afegir-la a la taula d'[errors trobats](#errors-trobats).
5. Afegir una fila al [registre d'execucions](#registre-dexecucions).

## Dades de prova

Només dades simulades. No fer servir dades personals reals.

| Usuari | Per a què |
|---|---|
| **A**: compte nou, sense onboarding fet | US1.1, US2.x |
| **B**: compte sense 2FA (de moment l'onboarding no es pot acabar, vegeu [D4](#discrepàncies-detectades)) | US1.2, US1.3, US3.1 |
| **C**: compte amb la 2FA activa i una aplicació d'autenticació configurada | US1.4 |

- NIF de prova amb format vàlid: `12345678Z`. NIF amb format invàlid: `1234ABCD`.
- Contrasenya vàlida: com a mínim la longitud i els tipus de caràcters que
  demana el registre. Contrasenya invàlida: `abc`.

---

## Regressió: Sprint 0

### US1.1 Registre i verificació del correu

| ID | Criteri | Passos | Resultat esperat | Resultat obtingut |
|---|---|---|---|---|
| US1.1-01 | Correu ja registrat | Registrar-se amb el correu de l'usuari B | Error "Aquest correu ja està registrat." | ✅ |
| US1.1-02 | Contrasenya sense els requisits | Registrar-se amb la contrasenya `abc` | Error "La contrasenya no compleix els requisits." | ✅ |
| US1.1-03 | Contrasenya xifrada | Supabase → Authentication → Users → obrir l'usuari | La contrasenya no es veu enlloc (la gestiona Supabase Auth) | ✅ |
| US1.1-04 | Estat pendent de verificació | Registrar un correu nou i mirar-lo a Supabase → Users | Apareix com a "Waiting for verification" fins que es confirma | ✅ |
| US1.1-05 | Correu de verificació | Registrar un correu nou | Arriba un correu amb l'enllaç; sense confirmar-lo no es pot iniciar sessió | ✅ |
| US1.1-06 | Mostrar / amagar contrasenya | Escriure una contrasenya i prémer "Mostrar" | Es veu el text; el botó passa a "Amagar" i la torna a amagar | ✅ |
| US1.1-07 | Reenviar amb espera de 60 s | A la confirmació, prémer "Reenviar correu" | El botó queda desactivat amb el compte enrere "Reenviar correu (60 s)" | ✅ |
| US1.1-08 | Tornar a l'inici | A la confirmació, prémer "Tornar a l'inici" | Porta a la pantalla d'inici de sessió | ✅ |

### US1.2 Inici i tancament de sessió

| ID | Criteri | Passos | Resultat esperat | Resultat obtingut |
|---|---|---|---|---|
| US1.2-01 | Credencials incorrectes | Iniciar sessió amb una contrasenya errònia | Es denega l'accés i es mostra l'error de credencials (vegeu [discrepància D1](#discrepàncies-detectades)) | ✅ el text és "Correu o contrasenya incorrectes." (vegeu D1) |
| US1.2-02 | Inici de sessió correcte | Iniciar sessió amb l'usuari B | Entra a l'aplicació: amb l'onboarding sense acabar passa per la pantalla de benvinguda de l'onboarding; si està acabat, va a Actius | ✅ amb la 2FA activa, abans es demana el codi |
| US1.2-03 | Sessió desada | Amb la sessió iniciada, recarregar la pàgina (F5) | Continua dins de l'aplicació, sense tornar a demanar la contrasenya | ✅ en recarregar a mig login es manté la pantalla del codi |
| US1.2-04 | Tancar sessió | Perfil → "Tanca la sessió" | Redirigeix a /login | ✅ |
| US1.2-05 | Sessió invalidada | Després de tancar sessió, prémer "Enrere" al navegador | No es pot tornar a la pàgina privada; redirigeix a /login | ✅ |
| US1.2-06 | Ruta protegida sense sessió | Sense sessió, escriure `/cartera` a la barra d'adreces | Redirigeix a /login; després d'iniciar sessió torna a /cartera (amb l'onboarding sense acabar, abans passa per l'onboarding) | ✅ /login?redirect=/cartera |

### US1.3 Recuperació de contrasenya

| ID | Criteri | Passos | Resultat esperat | Resultat obtingut |
|---|---|---|---|---|
| US1.3-01 | Correu existent | "He oblidat la contrasenya" amb el correu de B | Arriba un correu amb l'enllaç de recuperació | ✅ |
| US1.3-02 | Correu inexistent | El mateix amb un correu que no existeix | Mateix missatge genèric "Si el correu existeix al nostre sistema, rebràs un enllaç de recuperació"; no arriba cap correu | ✅ |
| US1.3-03 | Enllaç caducat o ja usat | Fer servir dues vegades el mateix enllaç | "L'enllaç de recuperació no és vàlid. Sol·licita'n un de nou." | ✅ |
| US1.3-04 | Contrasenya nova sense requisits | Posar `abc` com a contrasenya nova | "La contrasenya no compleix els requisits." | ✅ |

### US1.4 Autenticació de doble factor (2FA)

| ID | Criteri | Passos | Resultat esperat | Resultat obtingut |
|---|---|---|---|---|
| US1.4-01 | QR al perfil | Perfil → Verificació en dos passos → "Activar" | Es mostra un codi QR que l'aplicació d'autenticació pot escanejar | ✅ |
| US1.4-02 | Codi amb espais | Introduir el codi com "123 456" | S'accepta: els espais s'eliminen abans de validar | ✅ |
| US1.4-03 | Codi després del login | Iniciar sessió amb l'usuari C | Després de la contrasenya es demana el codi de 6 dígits | ✅ |
| US1.4-04 | Codi erroni | Introduir un codi inventat | "El codi d'autenticació és incorrecte." | ✅ |
| US1.4-05 | Codi caducat | Introduir un codi de fa uns minuts | "El codi ha caducat. Introdueix el codi actual de l'aplicació." | ✅ |
| US1.4-06 | Massa intents | Introduir codis erronis seguits fins que es bloquegi | "Massa intents seguits. Espera uns minuts i torna-ho a provar." | ✅ |
| US1.4-07 | Sense connexió | Desactivar la xarxa (DevTools → Offline) i enviar el codi | "No s'ha pogut connectar amb el servidor. Comprova la connexió." | ✅ |
| US1.4-08 | Altres errors | Error no previst | Missatge genèric d'error | ➖ difícil de provocar a mà; cobert pels tests |

---

## Acceptació: Sprint actual

### US2.1 Pantalla de benvinguda i progrés de l'onboarding

Els textos dels criteris són els que s'han ajustat a Trello (3 passos i estats Pendent / Completat).

| ID | Criteri | Passos | Resultat esperat | Resultat obtingut |
|---|---|---|---|---|
| US2.1-01 | Passos i estat | Iniciar sessió amb l'usuari A | Es veuen 3 passos (Dades personals, Qüestionari d'experiència inversora, Verificació del DNI i termes), tots "Pendent", i la barra marca 0 % | ✅ |
| US2.1-02 | Barra de progrés | Desar les dades personals (US2.2-05) i tornar a la benvinguda | La barra marca 33 % i el pas 1 surt com a "Completat" | ✅ |
| US2.1-03 | Redirecció en reprendre | Tancar sessió amb l'onboarding a mitges i tornar a entrar | Redirigeix a l'onboarding; el botó "Comença" (o "Continua" si n'hi ha algun de fet) porta al primer pas pendent | ✅ |
| US2.1-04 | Estat al núvol | Amb el pas 1 completat, tancar sessió i entrar des d'un altre navegador | El pas 1 continua "Completat" | ✅ |

### US2.2 Dades personals i residència fiscal

El formulari és el pas 1 de l'onboarding (`/onboarding/dades-personals`).

| ID | Criteri | Passos | Resultat esperat | Resultat obtingut |
|---|---|---|---|---|
| US2.2-01 | Camps del formulari | Obrir el pas de dades personals | Hi ha Nom, Cognoms, Data de naixement, Telèfon, NIF/NIE, Carrer i número, Codi postal, Població i un desplegable "País de residència fiscal" | ✅ |
| US2.2-02 | NIF/NIE invàlid | Omplir-ho tot amb el NIF `1234ABCD` i desar | Al camp NIF/NIE surt "El format del NIF/NIE no és vàlid." i no es desa | ✅ |
| US2.2-03 | NIF/NIE vàlid | El mateix amb el NIF `12345678Z` | No surt cap error al camp NIF/NIE | ✅ |
| US2.2-04 | Camps obligatoris | Deixar un camp buit i desar | "Camp obligatori." al camp buit i "Cal omplir tots els camps obligatoris." | ✅ |
| US2.2-05 | Dades desades | Omplir-ho tot bé i desar | Passa al pas 2 (Qüestionari); a la benvinguda el pas 1 surt "Completat" | ✅ |

### US2.3 Qüestionari d'experiència inversora

El qüestionari és el pas 2 de l'onboarding (`/onboarding/questionari-inversor`). Per
repetir-lo amb altres respostes, tornar a obrir aquesta adreça: el backend sobreescriu el perfil.

| ID | Criteri | Passos | Resultat esperat | Resultat obtingut |
|---|---|---|---|---|
| US2.3-01 | 5 preguntes tancades | Obrir el qüestionari | 5 preguntes, cadascuna amb opcions on només se'n pot triar una | ✅ |
| US2.3-02 | No es pot acabar sense respondre-ho tot | Respondre 4 preguntes | El botó "Envia les respostes" està desactivat i el comptador marca "4 de 5 respostes" | ✅ |
| US2.3-03 | Càlcul del perfil | Triar sempre la primera opció i enviar | Perfil "Principiant" | ✅ |
| US2.3-04 | Càlcul del perfil | Triar sempre la segona opció i enviar | Perfil "Intermedi" | ✅ |
| US2.3-05 | Càlcul del perfil | Triar sempre l'última opció i enviar | Perfil "Avançat" | ✅ |
| US2.3-06 | Desat al compte | Enviar, tancar sessió i tornar a entrar | A la benvinguda el pas 2 surt "Completat" i la barra marca 67 % (amb el pas 1 fet) | ✅ |

### US2.4 Validació simulada del DNI i acceptació de termes

Casos escrits a partir de Trello; cal revisar-los quan la implementació sigui a `develop`.

| ID | Criteri | Passos | Resultat esperat | Resultat obtingut |
|---|---|---|---|---|
| US2.4-01 | Només JPG o PNG | Pujar un PDF | "Només s'accepten imatges JPG o PNG." | ⏳ no és a `develop` |
| US2.4-02 | Verificació simulada | Pujar un JPG i esperar | L'estat passa a "En revisió" i, al cap de 15 s, a "Verificat" | ⏳ no és a `develop` |
| US2.4-03 | Termes acceptats | Marcar la casella de termes i continuar | Es desa la data i la versió dels termes (comprovar-ho a Supabase) | ⏳ no és a `develop` |
| US2.4-04 | Operativa restringida | Sense estar "Verificat", intentar entrar a l'operativa | No es pot operar fins que l'estat és "Verificat" | ⏳ no és a `develop` |

### US3.1 Visualitzar saldo del compte virtual

| ID | Criteri | Passos | Resultat esperat | Resultat obtingut |
|---|---|---|---|---|
| US3.1-01 | Saldo en format moneda | Iniciar sessió amb l'usuari B i obrir Actius | La targeta "Saldo del compte" mostra el saldo amb format d'euros (p. ex. 10.000,00 €); el Perfil mostra el mateix import com a patrimoni | ✅ |
| US3.1-02 | Saldo disponible i reservat | Mirar la targeta "Saldo del compte" | Es veuen "Saldo disponible" i "Saldo reservat"; el reservat és 0,00 € perquè encara no hi ha ordres (vegeu [D3](#discrepàncies-detectades)) | ✅ |
| US3.1-03 | Recàlcul després d'una operació | — | — | ➖ encara no hi ha operacions (vegeu [D3](#discrepàncies-detectades)) |
| US3.1-04 | Saldo d'un sol usuari | Tancar sessió amb B i entrar amb A | Es veu el saldo d'A, mai el de B | ✅ |

---

## Acceptació: Sprint 2 (tests automàtics)

Criteris de Trello del Sprint 2 convertits en tests que s'executen a la CI (QA 5, #133, i QA 6, #158). Cada criteri
apareix tal com està escrit a la targeta de Trello, en el mateix ordre: l'ID `USx.y-NN` és la posició del criteri a la
checklist. Els tests escriuen els missatges literals del criteri, sense importar les constants del codi, perquè un canvi
de text faci fallar el test.

On és cada test:

- **Back:** `backend/api/tests/test_acceptance_sprint2.py` (`pytest`).
- **Integració:** `frontend/src/tests/integration/sprint2.spec.js` (`npm test`): App, router i stores reals; només se
  simulen Supabase i el backend, amb un backend fals amb estat.
- **E2E:** `frontend/e2e/sprint2.spec.js` (Playwright contra DEV, amb un usuari de prova real).
- **Unitari:** test que ja existia de la mateixa US, indicat amb el fitxer de `frontend/src/tests/` o
  `backend/api/tests/`.

Cobertura: ✅ coberta per tests d'acceptació · 🟡 coberta només per tests unitaris · ➖ sense test automàtic (cas manual
per a la demo).

### US1.5 PIN de seguretat per a operacions · [Trello](https://trello.com/c/ERWCBORf)

| ID | Criteri de Trello | Test | Com ho comprova | |
|---|---|---|---|---|
| US1.5-01 | A la pantalla Perfil, l'usuari verificat té l'apartat "PIN de seguretat", des d'on pot crear un PIN de 4 dígits. Si no està verificat, l'apartat no apareix i tampoc no pot crear el PIN per cap altra via: "Cal verificar la identitat i acceptar els termes per operar". | Back: `test_unverified_user_cannot_operate[crear-pin]`. Unitari: `perfilView.spec.js` › `mostra la targeta del PIN només als usuaris verificats` | Un usuari sense verificar fa `POST /profile/pin` i rep 403 amb el text literal, sense que es desi res. Al perfil, la targeta del PIN surt amb l'usuari verificat i no surt sense verificar. | ✅ |
| US1.5-02 | Si el PIN no té exactament 4 dígits numèrics, es mostra l'error: "El PIN ha de tenir 4 dígits." | Back: `test_pin_must_have_four_digits` (`3-digits`, `5-digits`, `lletra`, `buit`). Unitari: `pinCard.spec.js` › `si el PIN no té 4 dígits mostra l'error i no l'envia` | `123`, `12345`, `12a4` i un PIN buit reben 422 amb "El PIN ha de tenir 4 dígits." i no es desa cap PIN. | ✅ |
| US1.5-03 | En crear o canviar el PIN, cal escriure el PIN nou dues vegades; si no coincideixen, es mostra l'error: "Els PIN no coincideixen." | Unitari: `pinCard.spec.js` › `si els dos PIN no coincideixen mostra l'error i no l'envia` | Amb dos PIN diferents es mostra el text i no es crida el backend. És una validació només del formulari. | 🟡 |
| US1.5-04 | Per canviar el PIN cal introduir el PIN actual; si és incorrecte, es mostra l'error: "El PIN actual és incorrecte." | Back: `test_pin_change_with_wrong_current_pin`. E2E: `canviar el PIN amb el PIN actual equivocat (US1.5)`. Unitari: `pinCard.spec.js` › `si el PIN actual és incorrecte, mostra l'error al camp i el buida` | Amb el PIN desat `1234` i el PIN actual `0000`, el backend respon 403 amb el text literal i no canvia el PIN. A DEV, el perfil mostra "El PIN actual és incorrecte." (el PIN nou és el mateix, així que l'usuari de prova no canvia encara que fallés). | ✅ |

### US3.2 Ingressar diners ficticis · [Trello](https://trello.com/c/jJzuv5ng)

| ID | Criteri de Trello | Test | Com ho comprova | |
|---|---|---|---|---|
| US3.2-01 | L'usuari verificat disposa, a la pantalla Compte d'efectiu, d'un formulari per introduir un import a ingressar en euros (€), amb dos decimals com a màxim. | Integració: `un ingrés actualitza el saldo a l'instant i apareix a l'historial`. Unitari: `deposit.spec.js` › `rebutja més de dos decimals, separadors de milers i text`; back: `test_account_deposits.py` (`three-decimals`) | L'usuari verificat entra a `/compte-efectiu`, escriu `50,25` i s'envia `{ amount: '50.25' }`. Amb tres decimals, el formulari i el backend el rebutgen. | ✅ |
| US3.2-02 | Si l'import introduït és inferior a 1 €, l'operació es rebutja amb l'error: "L'import mínim d'ingrés és d'1 €." | Back: `test_deposit_limits[US3.2-minim]`. Integració: `un ingrés de 0,99 € es rebutja amb el missatge del criteri` | `0,99` mostra el text literal, el saldo es queda a 100,00 € i no es fa cap `POST /account/deposits`. El backend respon 422 amb el mateix text i no crida la funció de la BD. | ✅ |
| US3.2-03 | Si l'import és superior a 10.000 € per operació, es rebutja amb l'error: "L'import màxim per operació és de 10.000 €." | Back: `test_deposit_limits[US3.2-maxim]`. Integració: `un ingrés de 10000,01 € es rebutja amb el missatge del criteri` | El mateix amb `10000,01`. | ✅ |
| US3.2-04 | En confirmar un ingrés vàlid, el saldo disponible s'incrementa immediatament en la quantitat dipositada. | Integració: `un ingrés actualitza el saldo a l'instant i apareix a l'historial`. E2E: `ingrés → saldo → historial (US3.2, US3.5)` | El saldo passa de 100,00 € a 150,25 € amb la resposta de l'ingrés, sense tornar a demanar el saldo (`GET /account/balance` només una vegada). A DEV, el saldo puja 1 €. | ✅ |
| US3.2-05 | Si la base de dades falla durant el procés, no s'aplica cap canvi i es mostra l'error: "No s'ha pogut processar el dipòsit. El teu saldo no ha canviat." | Back: `test_deposit_database_failure`. Integració: `si la base de dades falla, el saldo no canvia i es mostra el missatge del criteri` | La funció de la BD falla: el backend respon 500 amb el text literal; la pantalla el mostra i el saldo es queda a 100,00 €. | ✅ |
| US3.2-06 | L'usuari no verificat veu, a la pantalla Compte d'efectiu, el component per verificar-se | Integració: `l'usuari no verificat veu a /compte-efectiu l'avís per verificar-se, que porta a l'onboarding`. Back: `test_unverified_user_cannot_operate[ingres]` i `[saldo]` | Surt "Compte no verificat" sense cap formulari, no es demana res del compte i "Verifica't" porta a `/onboarding`. El backend rebutja l'ingrés i el saldo amb 403. | ✅ |

### US3.3 Retirar diners ficticis i associar IBAN · [Trello](https://trello.com/c/RLB68slx)

| ID | Criteri de Trello | Test | Com ho comprova | |
|---|---|---|---|---|
| US3.3-01 | A la pantalla Compte d'efectiu, al costat del formulari d'ingrés, l'usuari verificat té la targeta "Retirar diners". | Unitari: `compteEfectiuView.spec.js` › `amb la identitat verificada i els termes acceptats mostra el saldo i els formularis d'ingrés i de retirada` | Amb l'usuari verificat, la pantalla té els dos formularis. La posició "al costat" és visual: es comprova a la demo. | 🟡 |
| US3.3-02 | Si no té cap IBAN vinculat, la targeta li demana primer, amb l'ajuda "És una simulació: fes servir un IBAN de prova." S'accepta un IBAN espanyol (ES + 22 dígits), amb espais o sense; si el format o els dígits de control no són vàlids, es mostra l'error: "El codi IBAN no és vàlid." | Integració: `sense IBAN la targeta el demana primer, rebutja un IBAN invàlid i mostra l'emmascarat`. Back: `test_invalid_iban` | Sense IBAN surt l'ajuda literal i no hi ha camp d'import. `ES00 0000…` mostra "El codi IBAN no és vàlid." sense cridar el backend; `ES91 2100 0418 4502 0005 1332`, amb espais, s'envia sense espais. El backend també rebutja l'IBAN invàlid amb 422 i el text literal. | ✅ |
| US3.3-03 | Un cop vinculat, l'IBAN es mostra emmascarat, amb només els 4 últims dígits visibles (ES•• •••• •••• •••• •••• 1332), i el botó "Canvia", que permet introduir-ne un de nou i substitueix l'anterior directament. | Integració: `sense IBAN la targeta el demana primer, rebutja un IBAN invàlid i mostra l'emmascarat`. E2E: `retirada amb PIN incorrecte i després correcte → historial (US3.3, US1.5, US3.5)` | Després de vincular-lo es veu exactament `ES•• •••• •••• •••• •••• 1332` i el botó "Canvia". A DEV, l'IBAN emmascarat de l'usuari de prova és visible. | ✅ |
| US3.3-04 | L'import a retirar és en euros, amb dos decimals com a màxim; si és inferior a 1 €, es mostra l'error: "L'import mínim de retirada és d'1 €." | Back: `test_withdrawal_errors[minim]`. Integració: `una retirada de 0,99 € es rebutja abans de demanar el PIN`. Unitari: back `test_account_withdrawals.py` (`three-decimals`) | `0,99` mostra el text literal, no s'obre el PIN i no es fa cap `POST /account/withdrawals`. El backend respon 422 amb el mateix text i rebutja tres decimals. | ✅ |
| US3.3-05 | Si l'import supera el saldo disponible, es mostra l'error: "Saldo insuficient. Et falten X € per completar l'operació" | Back: `test_withdrawal_errors[saldo-insuficient]`. Integració: `una retirada de 150 € es rebutja abans de demanar el PIN` | Amb 100 € de saldo, 150 € mostra "Saldo insuficient. Et falten 50,00 € per completar l'operació" abans del PIN. Al backend, 80 € amb 50 € de saldo dona el mateix text amb 30,00 €. | ✅ |
| US3.3-06 | Abans de confirmar la retirada es demana el PIN de seguretat (US1.5); si és incorrecte, la retirada no s'executa i es mostra l'error: "El PIN introduït és incorrecte." | Back: `test_withdrawal_errors[pin-incorrecte]`. Integració: `amb el PIN incorrecte la retirada no es fa i es pot tornar a provar`. E2E: `retirada amb PIN incorrecte i després correcte → historial (US3.3, US1.5, US3.5)` | Amb `0000` surt el text literal, el saldo no canvia, no es registra cap moviment i el camp del PIN queda buit per tornar-ho a provar. A DEV, el saldo es manté igual amb el PIN incorrecte. | ✅ |
| US3.3-07 | Si l'usuari no té cap PIN configurat, no pot confirmar la retirada i es mostra l'error: "Cal configurar el PIN de seguretat al perfil per fer aquesta operació.", amb un enllaç al perfil. | Back: `test_withdrawal_errors[sense-pin]`. Integració: `sense PIN configurat no es pot confirmar i porta al perfil` | El diàleg mostra el text literal sense camp de PIN, no es fa la retirada i l'enllaç porta a `/perfil`. El backend respon 403 amb el mateix text. | ✅ |
| US3.3-08 | Si no es pot validar el PIN, la retirada no s'executa i es mostra l'error: "No s'ha pogut validar el PIN de seguretat. Torna-ho a provar més tard." | Integració: `si no es pot validar el PIN, la retirada no es fa` | El backend fals respon 500 en comprovar el PIN: surt el text literal i el saldo es queda a 100,00 €. | ✅ |
| US3.3-09 | En confirmar la retirada, el saldo es redueix immediatament. | Back: `test_withdrawal_with_correct_pin_returns_new_balance`. Integració: `amb el PIN correcte el saldo baixa a l'instant i la retirada apareix a l'historial`. E2E: `retirada amb PIN incorrecte i després correcte → historial (US3.3, US1.5, US3.5)` | Amb `1234` el saldo passa de 100,00 € a 70,00 € i es mostra "S'han retirat 30,00 € del compte."; el PIN viatja a la capçalera `X-PIN`. El backend retorna el saldo nou (50 → 40). A DEV, el saldo baixa 1 €. | ✅ |
| US3.3-10 | Si falla la base de dades, no s'aplica cap canvi i es mostra l'error: "No s'ha pogut processar la retirada. El teu saldo no ha canviat." | Back: `test_withdrawal_errors[fallada-bd]` | La funció de la BD falla: el backend respon 500 amb el text literal. | ✅ |

### US3.5 Historial de moviments d'efectiu · [Trello](https://trello.com/c/aBpVkQvw)

| ID | Criteri de Trello | Test | Com ho comprova | |
|---|---|---|---|---|
| US3.5-01 | A la pantalla Historial, cada moviment mostra: Data, Concepte, Import, Tipus de moviment i Saldo resultant, del més nou al més antic. | Integració: `un ingrés actualitza el saldo a l'instant i apareix a l'historial`. Unitari: `historialView.spec.js` › `mostra cada moviment amb el concepte, el tipus, l'import amb signe i el saldo resultant`; back: `test_account_movements.py` › `test_default_query_filters_by_token_subject_newest_first` | Després d'un ingrés, la fila mostra el concepte, `+50,25 €` i el saldo resultant `150,25 €`. L'ordre del més nou al més antic el comprova el test del backend. | ✅ |
| US3.5-02 | L'import es mostra en verd si suma al saldo i en vermell si en resta | Integració: `un ingrés actualitza el saldo a l'instant i apareix a l'historial` i `amb el PIN correcte el saldo baixa a l'instant i la retirada apareix a l'historial`. E2E: `retirada amb PIN incorrecte i després correcte → historial (US3.3, US1.5, US3.5)` | L'ingrés té la classe `movements__amount--in` (verd) i la retirada `movements__amount--out` (vermell), també a DEV. | ✅ |
| US3.5-03 | El concepte és "Ingrés de diners" per als ingressos i "Retirada a ES•• 1332" per a les retirades, amb els 4 últims dígits de l'IBAN de la retirada. | Integració: els mateixos dos tests. E2E: `ingrés → saldo → historial (US3.2, US3.5)` i `retirada amb PIN incorrecte i després correcte → historial (US3.3, US1.5, US3.5)` | Les files mostren exactament "Ingrés de diners" i "Retirada a ES•• 1332". A DEV, l'últim moviment conté "Ingrés de diners" o "Retirada a ES••". | ✅ |
| US3.5-04 | L'usuari pot filtrar per rang de dates (Data inici / Data fi, totes dues incloses) i per tipus (Tots, Ingrés, Retirada), i pot combinar els dos filtres. | Unitari: `movementsStore.spec.js` › `envia les dates i el tipus seleccionats`; `historialView.spec.js` › `en canviar el tipus torna a carregar des de la primera pàgina amb el filtre`; back: `test_account_movements.py` › `test_filters_reach_the_query` | Les dates i el tipus arriben junts a la consulta del backend. Vegeu [D5](#discrepàncies-detectades): ara el filtre també té Compra i Venda. | 🟡 |
| US3.5-05 | El llistat es mostra en pàgines de 20 moviments amb els botons "Anterior" i "Següent". | Unitari: `movementsStore.spec.js` › `sense filtres demana la primera pàgina de 20 sense dates ni tipus`; `historialView.spec.js` › `pagina amb Anterior i Següent segons has_more` | Es demanen 20 moviments per pàgina i els botons avancen i tornen enrere. | 🟡 |
| US3.5-06 | Si no hi ha moviments que compleixin els filtres aplicats, es mostra el missatge: "No s'han trobat moviments per als filtres seleccionats." | Integració: `sense moviments, l'historial mostra el missatge del criteri` | Sense moviments, el missatge és exactament el del criteri. | ✅ |
| US3.5-07 | Si l'usuari no està verificat, en lloc de l'historial veu l'avís "Compte no verificat" amb el botó "Verifica't", com a la pantalla Actius. | Integració: `l'usuari no verificat veu a /historial l'avís per verificar-se, que porta a l'onboarding`. Back: `test_unverified_user_cannot_operate[historial]` | Surt "Compte no verificat", no es demana l'historial i "Verifica't" porta a `/onboarding`. El backend respon 403. | ✅ |

### US5.1 Cercar actius · [Trello](https://trello.com/c/CbGe4SOe)

| ID | Criteri de Trello | Test | Com ho comprova | |
|---|---|---|---|---|
| US5.1-01 | El cercador és a la pantalla Actius i el poden fer servir tots els usuaris registrats, encara que no estiguin verificats. | Integració: tot el bloc `Acceptació Sprint 2: cercar actius (US5.1 + US5.3)` | Tots els tests de cerca, menys el de Compra i Ven, s'executen amb un usuari no verificat a `/actius`. | ✅ |
| US5.1-02 | Amb el camp de cerca buit, es mostra tot el catàleg d'actius, ordenat per nom. | Integració: `sense text mostra tot el catàleg ordenat per nom, amb ticker i tipus` | El catàleg arriba desordenat i es mostra Apple, iShares, Microsoft. | ✅ |
| US5.1-03 | A partir de 2 caràcters, la llista es filtra mentre s'escriu: coincidències parcials en el nom i el ticker, sense distingir majúscules ni tenir en compte els espais inicials i finals, i l'ISIN només complet. Els resultats es mantenen ordenats per nom. | Integració: `filtra pel nom o el ticker i, sense coincidències, mostra el missatge del criteri`. Back: `test_assets.py` › `test_query_filters_name_ticker_and_isin_and_sanitizes_input` | `"  ms "` s'envia com `q=ms` i troba iShares (nom) i Microsoft (ticker), en aquest ordre. L'ISIN complet el comprova el test del backend. | ✅ |
| US5.1-04 | Cada actiu de la llista mostra el nom, el ticker i el tipus (Acció o ETF). | Integració: `sense text mostra tot el catàleg ordenat per nom, amb ticker i tipus` | Apple mostra `AAPL` i "Acció"; iShares mostra "ETF". | ✅ |
| US5.1-05 | Si no hi ha coincidències, es mostra: "No s'han trobat actius" | Integració: `filtra pel nom o el ticker i, sense coincidències, mostra el missatge del criteri`. E2E: `cerca d'actius amb preu i sense resultats (US5.1, US5.3)` | `zzz` mostra exactament "No s'han trobat actius", també a DEV. | ✅ |

### US5.3 Consultar preu i variació diària · [Trello](https://trello.com/c/AQ7QRknI)

| ID | Criteri de Trello | Test | Com ho comprova | |
|---|---|---|---|---|
| US5.3-01 | Cada actiu de la llista del cercador mostra l'últim preu de tancament en euros (€), amb dos decimals, i la data de la cotització, tal com estan desats al catàleg. | Integració: `cada resultat mostra el preu, la variació amb signe i color i la data`. E2E: `cerca d'actius amb preu i sense resultats (US5.1, US5.3)` | `182.5` i `2026-11-20` del catàleg es mostren com `182,50 €` i `20/11/2026`. A DEV, la fila d'Apple mostra un preu en € (o "No disponible"; no es fixa el valor perquè el catàleg pot canviar). | ✅ |
| US5.3-02 | Es mostra la variació percentual diària desada al catàleg: amb el signe + i en verd si és positiva, amb el signe − i en vermell si és negativa, i de color neutre si és 0,00 %. | Integració: `cada resultat mostra el preu, la variació amb signe i color i la data` | `1.25` → `+1,25 %` amb `assets__change--up`; `-0.5` → `−0,50 %` (signe menys) amb `assets__change--down`; `0` → `0,00 %` amb `assets__change--flat`. | ✅ |
| US5.3-03 | Si falta alguna dada de la cotització, el camp afectat mostra el text: "No disponible" | Integració: `un actiu sense cotització mostra "No disponible"` | Sense preu, variació ni data, els tres camps mostren "No disponible". | ✅ |
| US5.3-04 | La pantalla indica que els preus són simulats ("Preus simulats"). | Integració: `cada resultat mostra el preu, la variació amb signe i color i la data`. E2E: `cerca d'actius amb preu i sense resultats (US5.1, US5.3)` | El text "Preus simulats" surt a la pantalla, també a DEV. | ✅ |

### Altres comprovacions

No són criteris del Sprint 2, però els tests d'acceptació també les cobreixen perquè els canvis de les US següents no
trenquin el que ja funcionava:

- US6.1 i US6.2: l'usuari verificat veu "Compra" a cada resultat i "Ven" només als actius dels quals té posició.
  Integració: `l'usuari verificat pot comprar qualsevol resultat i només pot vendre els actius de què té posició`.
- US2.4: l'usuari no verificat rep 403 amb "Cal verificar la identitat i acceptar els termes per operar" a les
  posicions, la compra i la venda. Back: `test_unverified_user_cannot_operate[posicions]`, `[compra]` i `[venda]`.

Fora d'abast: el bloqueig del PIN per intents fallits és la US1.6, al backlog.

### End-to-end (#158)

El que els mocks no veuen (migracions, `VITE_API_URL`, CORS, permisos) es prova amb Playwright contra DEV, no a mà:
ingrés → historial, retirada amb PIN incorrecte i correcte → historial, canvi de PIN amb el PIN actual equivocat i
cerca d'actius amb preu i sense resultats.

---

## Discrepàncies detectades

Diferències entre Trello i el que hi ha implementat, trobades en preparar el pla.

| ID | US | Trello diu | Implementat | Proposta |
|---|---|---|---|---|
| D1 | US1.2 | "Correu electrònic o contrasenya incorrectes" | "Correu o contrasenya incorrectes." | Unificar el text (a Trello o a `LoginView.vue`) |
| D2 | US2.1 | 4 passos i estat "En procés" | 3 passos i estats Pendent / Completat | Ajustar el text de Trello |
| D3 | US3.1 | Saldo reservat i recàlcul després d'operacions | El reservat es mostra sempre a 0,00 €: encara no existeixen ordres ni operacions | Moure aquests criteris a la US de les ordres o deixar-los per a un sprint posterior (decisió del PO) |
| D4 | US2.1 / US2.4 | En acabar els passos, l'usuari entra a l'aplicació | Els passos 1 i 2 ja es completen des del backend, però el pas 3 encara no (#70): cap usuari pot acabar l'onboarding i en iniciar sessió sempre es passa per la benvinguda | Esperar la tasca de backend de US2.4 (#70) |
| D5 | US3.5 | Filtre per tipus: Tots, Ingrés, Retirada | Amb US6.1 i US6.2 també hi ha Compra i Venda | Afegir Compra i Venda al criteri de Trello (el fora d'abast de la US ja diu que les afegeixen US6.1 i US6.2) |

## Errors trobats

Un error per fila, amb la issue que s'hi ha obert.

| Data | Cas | Descripció | Issue |
|---|---|---|---|
| 08/11/2026 | US3.1-01, US3.1-02, US2.1-01 | El backend de `develop` a Azure respon 503 a totes les rutes (el navegador ho mostra com a error de CORS). Causa probable: des de la PR #71 cal `SUPABASE_SECRET_KEY` i l'App Service no la té configurada | #89 (tancada) |

## Proves exploratòries

Sessió de 30 minuts sense guió. Objectiu: intentar trencar l'aplicació fent
servir-la com un usuari despistat (dobles clics, botó "Enrere", recarregar a
mig procés, pantalla de mòbil de 375 px, connexió lenta…).

| Data | Qui | Què s'ha provat | Troballes | Issue |
|---|---|---|---|---|
| 08/11/2026 | dvictoria23 | Registre amb correus que no coincideixen; recarregar a mig login amb 2FA; vista de mòbil a 400 px; peticions a DevTools → Network | Els correus diferents mostren "Els correus no coincideixen." i en recarregar es manté la pantalla del codi (correcte). La vista de mòbil es veu bé. A Network, la petició del saldo falla amb 503 al preflight | #89 |

## Registre d'execucions

| Data | Entorn | Qui | Casos ✅ | Casos ❌ | Observacions |
|---|---|---|---|---|---|
| 08/11/2026 | `develop` (tradeub-dev.netlify.app + Azure) | dvictoria23 | 26 | 3 | 17 ⏳ i 2 ➖ de 48 casos. Tota la regressió (US1.x) passa. Els ❌ venen del mateix error del backend (#89); cal repetir US2.1 i US3.1 quan respongui. US2.2, US2.3 i US2.4 encara no són a `develop` |
| 09/11/2026 | `develop` (tradeub-dev.netlify.app + Azure) | dvictoria23 | 43 | 0 | 4 ⏳ i 2 ➖ de 49 casos. Amb el backend ja en marxa (#89 tancada) es repeteixen els 17 casos de US2.1, US2.2, US2.3 i US3.1 i tots passen. Només queda US2.4, que encara no és a `develop` |
