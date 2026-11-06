# Pla de proves d'acceptació i regressió

Casos de prova manuals construïts a partir dels criteris d'acceptació de Trello.
Serveixen per comprovar a **producció** (Netlify + Azure) que cada user story fa
el que promet abans de cada demo.

- **Proves d'acceptació:** les user stories del sprint actual (US2.x, US3.1).
- **Proves de regressió:** les user stories ja lliurades (US1.x). Es tornen a
  executar a cada demo per comprovar que els canvis nous no han trencat res.
- **Proves exploratòries:** sessió lliure de 30 minuts per trobar errors que els
  casos escrits no cobreixen (secció final).

## Com fer-lo servir

1. Obrir l'aplicació desplegada (la de `develop`) en una finestra d'incògnit.
2. Seguir els passos de cada cas i comparar amb el resultat esperat.
3. Apuntar el resultat a la columna **Resultat**: ✅ compleix · ❌ no compleix ·
   ⏳ encara no desplegat · ➖ no aplicable aquest sprint.
4. Per cada ❌, crear una issue a GitHub amb el número del cas (p. ex. `US1.2-03`).
5. Afegir una fila al [registre d'execucions](#registre-dexecucions).

## Dades de prova

Només dades simulades. No fer servir dades personals reals.

| Usuari | Per a què |
|---|---|
| **A**: compte nou, sense onboarding fet | US1.1, US2.x |
| **B**: compte amb l'onboarding complet i sense 2FA | US1.2, US1.3, US3.1 |
| **C**: compte amb la 2FA activa i una aplicació d'autenticació configurada | US1.4 |

- NIF de prova amb format vàlid: `12345678Z`. NIF amb format invàlid: `1234ABCD`.
- Contrasenya vàlida: com a mínim la longitud i els tipus de caràcters que
  demana el registre. Contrasenya invàlida: `abc`.

---

## Regressió: Sprint 0

### US1.1 Registre i verificació del correu

| ID | Criteri | Passos | Resultat esperat | Resultat |
|---|---|---|---|---|
| US1.1-01 | Correu ja registrat | Registrar-se amb el correu de l'usuari B | Error "Aquest correu ja està registrat." | |
| US1.1-02 | Contrasenya sense els requisits | Registrar-se amb la contrasenya `abc` | Error "La contrasenya no compleix els requisits." | |
| US1.1-03 | Contrasenya xifrada | Supabase → Authentication → Users → obrir l'usuari | La contrasenya no es veu enlloc (la gestiona Supabase Auth) | |
| US1.1-04 | Estat pendent de verificació | Registrar un correu nou i mirar-lo a Supabase → Users | Apareix com a "Waiting for verification" fins que es confirma | |
| US1.1-05 | Correu de verificació | Registrar un correu nou | Arriba un correu amb l'enllaç; sense confirmar-lo no es pot iniciar sessió | |
| US1.1-06 | Mostrar / amagar contrasenya | Escriure una contrasenya i prémer "Mostrar" | Es veu el text; el botó passa a "Amagar" i la torna a amagar | |
| US1.1-07 | Reenviar amb espera de 60 s | A la confirmació, prémer "Reenviar correu" | El botó queda desactivat amb el compte enrere "Reenviar correu (60 s)" | |
| US1.1-08 | Tornar a l'inici | A la confirmació, prémer "Tornar a l'inici" | Porta a la pantalla d'inici de sessió | |

### US1.2 Inici i tancament de sessió

| ID | Criteri | Passos | Resultat esperat | Resultat |
|---|---|---|---|---|
| US1.2-01 | Credencials incorrectes | Iniciar sessió amb una contrasenya errònia | Es denega l'accés i es mostra l'error de credencials (vegeu [discrepància D1](#discrepàncies-detectades)) | |
| US1.2-02 | Inici de sessió correcte | Iniciar sessió amb l'usuari B | Entra a l'aplicació (Actius) | |
| US1.2-03 | Sessió desada | Amb la sessió iniciada, recarregar la pàgina (F5) | Continua dins de l'aplicació, sense tornar a demanar la contrasenya | |
| US1.2-04 | Tancar sessió | Perfil → "Tanca la sessió" | Redirigeix a /login | |
| US1.2-05 | Sessió invalidada | Després de tancar sessió, prémer "Enrere" al navegador | No es pot tornar a la pàgina privada; redirigeix a /login | |
| US1.2-06 | Ruta protegida sense sessió | Sense sessió, escriure `/cartera` a la barra d'adreces | Redirigeix a /login; després d'iniciar sessió torna a /cartera | |

### US1.3 Recuperació de contrasenya

| ID | Criteri | Passos | Resultat esperat | Resultat |
|---|---|---|---|---|
| US1.3-01 | Correu existent | "He oblidat la contrasenya" amb el correu de B | Arriba un correu amb l'enllaç de recuperació | |
| US1.3-02 | Correu inexistent | El mateix amb un correu que no existeix | Mateix missatge genèric "Si el correu existeix al nostre sistema, rebràs un enllaç de recuperació"; no arriba cap correu | |
| US1.3-03 | Enllaç caducat o ja usat | Fer servir dues vegades el mateix enllaç | "L'enllaç de recuperació no és vàlid. Sol·licita'n un de nou." | |
| US1.3-04 | Contrasenya nova sense requisits | Posar `abc` com a contrasenya nova | "La contrasenya no compleix els requisits." | |

### US1.4 Autenticació de doble factor (2FA)

| ID | Criteri | Passos | Resultat esperat | Resultat |
|---|---|---|---|---|
| US1.4-01 | QR al perfil | Perfil → Verificació en dos passos → "Activar" | Es mostra un codi QR que l'aplicació d'autenticació pot escanejar | |
| US1.4-02 | Codi amb espais | Introduir el codi com "123 456" | S'accepta: els espais s'eliminen abans de validar | |
| US1.4-03 | Codi després del login | Iniciar sessió amb l'usuari C | Després de la contrasenya es demana el codi de 6 dígits | |
| US1.4-04 | Codi erroni | Introduir un codi inventat | "El codi d'autenticació és incorrecte." | |
| US1.4-05 | Codi caducat | Introduir un codi de fa uns minuts | "El codi ha caducat. Introdueix el codi actual de l'aplicació." | |
| US1.4-06 | Massa intents | Introduir codis erronis seguits fins que es bloquegi | "Massa intents seguits. Espera uns minuts i torna-ho a provar." | |
| US1.4-07 | Sense connexió | Desactivar la xarxa (DevTools → Offline) i enviar el codi | "No s'ha pogut connectar amb el servidor. Comprova la connexió." | |
| US1.4-08 | Altres errors | Error no previst | Missatge genèric d'error | ➖ difícil de provocar a mà; cobert pels tests |

---

## Acceptació: Sprint actual

### US2.1 Pantalla de benvinguda i progrés de l'onboarding

Els textos dels criteris són els que s'han ajustat a Trello (3 passos i estats Pendent / Completat).

| ID | Criteri | Passos | Resultat esperat | Resultat |
|---|---|---|---|---|
| US2.1-01 | Passos i estat | Iniciar sessió amb l'usuari A | Es veuen 3 passos (Dades personals, Qüestionari d'experiència inversora, Verificació del DNI i termes), tots "Pendent" | |
| US2.1-02 | Barra de progrés | Completar un pas i tornar a l'onboarding | La barra marca 33 % i el pas surt com a "Completat" | |
| US2.1-03 | Redirecció en reprendre | Tancar sessió amb l'onboarding a mitges i tornar a entrar | Redirigeix a l'onboarding; "Continua" porta al primer pas pendent | |
| US2.1-04 | Estat al núvol | Completar un pas, tancar sessió i entrar des d'un altre navegador | El pas continua "Completat" | |

### US2.2 Dades personals i residència fiscal

Casos escrits a partir de Trello; cal revisar-los quan la implementació sigui a `develop`.

| ID | Criteri | Passos | Resultat esperat | Resultat |
|---|---|---|---|---|
| US2.2-01 | Camps del formulari | Obrir el pas de dades personals | Hi ha Nom, Data de naixement, Adreça i un desplegable de País de residència fiscal | |
| US2.2-02 | NIF/NIE invàlid | Escriure `1234ABCD` | "El format del NIF/NIE no és vàlid." | |
| US2.2-03 | NIF/NIE vàlid | Escriure `12345678Z` | No surt cap error | |
| US2.2-04 | Camps obligatoris | Deixar un camp buit | El botó de desar està desactivat o surt "Cal omplir tots els camps obligatoris." | |

### US2.3 Qüestionari d'experiència inversora

| ID | Criteri | Passos | Resultat esperat | Resultat |
|---|---|---|---|---|
| US2.3-01 | 5 preguntes tancades | Obrir /questionari | 5 preguntes, cadascuna amb opcions on només se'n pot triar una | |
| US2.3-02 | No es pot acabar sense respondre-ho tot | Respondre 4 preguntes | El botó "Envia les respostes" està desactivat i el comptador marca "4 de 5 respostes" | |
| US2.3-03 | Càlcul del perfil | Triar sempre la primera opció i enviar | Perfil "Principiant" | |
| US2.3-04 | Càlcul del perfil | Triar sempre la segona opció i enviar | Perfil "Intermedi" | |
| US2.3-05 | Càlcul del perfil | Triar sempre l'última opció i enviar | Perfil "Avançat" | |
| US2.3-06 | Desat al compte | Enviar, tancar sessió, tornar a entrar i obrir /questionari | Es mostra el perfil desat sense tornar a respondre | |

### US2.4 Validació simulada del DNI i acceptació de termes

Casos escrits a partir de Trello; cal revisar-los quan la implementació sigui a `develop`.

| ID | Criteri | Passos | Resultat esperat | Resultat |
|---|---|---|---|---|
| US2.4-01 | Només JPG o PNG | Pujar un PDF | "Només s'accepten imatges JPG o PNG." | |
| US2.4-02 | Verificació simulada | Pujar un JPG i esperar | L'estat passa a "En revisió" i, al cap de 15 s, a "Verificat" | |
| US2.4-03 | Termes acceptats | Marcar la casella de termes i continuar | Es desa la data i la versió dels termes (comprovar-ho a Supabase) | |
| US2.4-04 | Operativa restringida | Sense estar "Verificat", intentar entrar a l'operativa | No es pot operar fins que l'estat és "Verificat" | |

### US3.1 Visualitzar saldo del compte virtual

| ID | Criteri | Passos | Resultat esperat | Resultat |
|---|---|---|---|---|
| US3.1-01 | Saldo en format moneda | Iniciar sessió amb l'usuari B | El saldo es veu a la pantalla principal amb format d'euros (p. ex. 10.000,00 €) | |
| US3.1-02 | Saldo disponible i reservat | — | — | ➖ encara no hi ha ordres (vegeu [D3](#discrepàncies-detectades)) |
| US3.1-03 | Recàlcul després d'una operació | — | — | ➖ encara no hi ha operacions (vegeu [D3](#discrepàncies-detectades)) |
| US3.1-04 | Saldo d'un sol usuari | Tancar sessió amb B i entrar amb A | Es veu el saldo d'A, mai el de B | |

---

## Discrepàncies detectades

Diferències entre Trello i el que hi ha implementat, trobades en preparar el pla.

| ID | US | Trello diu | Implementat | Proposta |
|---|---|---|---|---|
| D1 | US1.2 | "Correu electrònic o contrasenya incorrectes" | "Correu o contrasenya incorrectes." | Unificar el text (a Trello o a `LoginView.vue`) |
| D2 | US2.1 | 4 passos i estat "En procés" | 3 passos i estats Pendent / Completat | Ajustar el text de Trello |
| D3 | US3.1 | Saldo reservat i recàlcul després d'operacions | Encara no existeixen ordres ni operacions | Moure aquests criteris a la US de les ordres o deixar-los per a un sprint posterior (decisió del PO) |

## Proves exploratòries

Sessió de 30 minuts sense guió. Objectiu: intentar trencar l'aplicació fent
servir-la com un usuari despistat (dobles clics, botó "Enrere", recarregar a
mig procés, pantalla de mòbil de 375 px, connexió lenta…).

| Data | Qui | Què s'ha provat | Troballes | Issue |
|---|---|---|---|---|
| | | | | |

## Registre d'execucions

| Data | Entorn | Qui | Casos ✅ | Casos ❌ | Observacions |
|---|---|---|---|---|---|
| | | | | | |
