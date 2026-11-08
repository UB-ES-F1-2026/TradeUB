# Pla de proves d'acceptació i regressió

Casos de prova manuals construïts a partir dels criteris d'acceptació de Trello.
Serveixen per comprovar a **producció** (Netlify + Azure) que cada user story fa
el que promet abans de cada demo.

- **Proves d'acceptació:** les user stories del sprint actual (US2.x, US3.1).
- **Proves de regressió:** les user stories ja lliurades (US1.x). Es tornen a
  executar a cada demo per comprovar que els canvis nous no han trencat res.
- **Proves exploratòries:** sessió lliure de 30 minuts per trobar errors que els
  casos escrits no cobreixen (secció final).

Els resultats esperats corresponen a l'estat de `develop` del 08/11/2026.

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
| **B**: compte sense 2FA (de moment cap pas de l'onboarding es pot completar, vegeu [D4](#discrepàncies-detectades)) | US1.2, US1.3, US3.1 |
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
| US2.1-01 | Passos i estat | Iniciar sessió amb l'usuari A | Es veuen 3 passos (Dades personals, Qüestionari d'experiència inversora, Verificació del DNI i termes), tots "Pendent", i la barra marca 0 % | ❌ es veuen els 3 passos, però l'estat no es pot carregar: el backend respon 503 (#89) |
| US2.1-02 | Barra de progrés | Completar un pas i tornar a l'onboarding | La barra marca 33 % i el pas surt com a "Completat" | ⏳ cap pas es pot completar encara (vegeu [D4](#discrepàncies-detectades)) |
| US2.1-03 | Redirecció en reprendre | Tancar sessió amb l'onboarding a mitges i tornar a entrar | Redirigeix a l'onboarding; el botó "Comença" (o "Continua" si n'hi ha algun de fet) porta al primer pas pendent | ✅ redirigeix a l'onboarding encara que el backend no respongui |
| US2.1-04 | Estat al núvol | Completar un pas, tancar sessió i entrar des d'un altre navegador | El pas continua "Completat" | ⏳ cap pas es pot completar encara (vegeu [D4](#discrepàncies-detectades)) |

### US2.2 Dades personals i residència fiscal

Casos escrits a partir de Trello; cal revisar-los quan la implementació sigui a `develop`.

| ID | Criteri | Passos | Resultat esperat | Resultat obtingut |
|---|---|---|---|---|
| US2.2-01 | Camps del formulari | Obrir el pas de dades personals | Hi ha Nom, Data de naixement, Adreça i un desplegable de País de residència fiscal | ⏳ no és a `develop` |
| US2.2-02 | NIF/NIE invàlid | Escriure `1234ABCD` | "El format del NIF/NIE no és vàlid." | ⏳ no és a `develop` |
| US2.2-03 | NIF/NIE vàlid | Escriure `12345678Z` | No surt cap error | ⏳ no és a `develop` |
| US2.2-04 | Camps obligatoris | Deixar un camp buit | El botó de desar està desactivat o surt "Cal omplir tots els camps obligatoris." | ⏳ no és a `develop` |

### US2.3 Qüestionari d'experiència inversora

El qüestionari s'obre des del pas 2 de l'onboarding o des de /questionari.

| ID | Criteri | Passos | Resultat esperat | Resultat obtingut |
|---|---|---|---|---|
| US2.3-01 | 5 preguntes tancades | Obrir el qüestionari | 5 preguntes, cadascuna amb opcions on només se'n pot triar una | ⏳ no és a `develop` (és a `feature/US2.3`) |
| US2.3-02 | No es pot acabar sense respondre-ho tot | Respondre 4 preguntes | El botó "Envia les respostes" està desactivat i el comptador marca "4 de 5 respostes" | ⏳ no és a `develop` (és a `feature/US2.3`) |
| US2.3-03 | Càlcul del perfil | Triar sempre la primera opció i enviar | Perfil "Principiant" | ⏳ no és a `develop` (és a `feature/US2.3`) |
| US2.3-04 | Càlcul del perfil | Triar sempre la segona opció i enviar | Perfil "Intermedi" | ⏳ no és a `develop` (és a `feature/US2.3`) |
| US2.3-05 | Càlcul del perfil | Triar sempre l'última opció i enviar | Perfil "Avançat" | ⏳ no és a `develop` (és a `feature/US2.3`) |
| US2.3-06 | Desat al compte | Enviar, tancar sessió, tornar a entrar i obrir el qüestionari | Es mostra el perfil desat sense tornar a respondre | ⏳ no és a `develop` (és a `feature/US2.3`) |

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
| US3.1-01 | Saldo en format moneda | Iniciar sessió amb l'usuari B i obrir Actius | La targeta "Saldo del compte" mostra el saldo amb format d'euros (p. ex. 10.000,00 €); el Perfil mostra el mateix import com a patrimoni | ❌ "No s'ha pogut carregar el saldo. Torna-ho a provar.": el backend d'Azure respon 503 (#89) |
| US3.1-02 | Saldo disponible i reservat | Mirar la targeta "Saldo del compte" | Es veuen "Saldo disponible" i "Saldo reservat"; el reservat és 0,00 € perquè encara no hi ha ordres (vegeu [D3](#discrepàncies-detectades)) | ❌ no es mostra cap saldo pel mateix error (#89) |
| US3.1-03 | Recàlcul després d'una operació | — | — | ➖ encara no hi ha operacions (vegeu [D3](#discrepàncies-detectades)) |
| US3.1-04 | Saldo d'un sol usuari | Tancar sessió amb B i entrar amb A | Es veu el saldo d'A, mai el de B | ⏳ no es pot comprovar fins que el backend respongui (#89) |

---

## Discrepàncies detectades

Diferències entre Trello i el que hi ha implementat, trobades en preparar el pla.

| ID | US | Trello diu | Implementat | Proposta |
|---|---|---|---|---|
| D1 | US1.2 | "Correu electrònic o contrasenya incorrectes" | "Correu o contrasenya incorrectes." | Unificar el text (a Trello o a `LoginView.vue`) |
| D2 | US2.1 | 4 passos i estat "En procés" | 3 passos i estats Pendent / Completat | Ajustar el text de Trello |
| D3 | US3.1 | Saldo reservat i recàlcul després d'operacions | El reservat es mostra sempre a 0,00 €: encara no existeixen ordres ni operacions | Moure aquests criteris a la US de les ordres o deixar-los per a un sprint posterior (decisió del PO) |
| D4 | US2.1 / US2.3 | Els passos es marquen "Completat" en acabar-los | El backend dedueix l'estat de `profiles` i cap pas hi té dades encara: tots surten "Pendent". El qüestionari desa el perfil, però el pas no es completarà fins a la #69 | Esperar les tasques de backend de US2.2 (#58), US2.3 (#69) i US2.4 (#70); fins llavors, marcar US2.1-02 i US2.1-04 com a ⏳ |

## Errors trobats

Un error per fila, amb la issue que s'hi ha obert.

| Data | Cas | Descripció | Issue |
|---|---|---|---|
| 08/11/2026 | US3.1-01, US3.1-02, US2.1-01 | El backend de `develop` a Azure respon 503 a totes les rutes (el navegador ho mostra com a error de CORS). Causa probable: des de la PR #71 cal `SUPABASE_SECRET_KEY` i l'App Service no la té configurada | #89 |

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
