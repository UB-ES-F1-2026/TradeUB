# 2FA (US1.4, issue #20): decisions i relació amb els endpoints del README

Document auxiliar de la branca `feature/US1.4-2FA-Activacio-Verificacio`. Recull les decisions preses en implementar la verificació en dos passos (TOTP) al frontend i què caldria canviar si al final el backend exposa els endpoints que descriu el README.

## Resum

La configuració i la verificació de TOTP es fan directament amb
`supabase.auth.mfa` des de l'store d'autenticació del frontend. Supabase
conserva el factor i el secret TOTP; el backend no els desa ni exposa
endpoints propis d'enrolament o verificació.

Les rutes protegides del backend validen la signatura del JWT i exigeixen que
la seva claim `aal` sigui `aal2`. Per tant, el frontend només ha de cridar
l'API després que `supabase.auth.mfa.challengeAndVerify()` hagi completat el
segon pas. Una sessió `aal1` rep `403` amb el missatge
`Cal completar la verificació en dos passos`.

## Com funciona

1. **Activació** (secció "Verificació en dos passos" del perfil, `components/TwoFactorCard.vue`): `mfa.enroll({ factorType: 'totp' })` retorna un QR (SVG en data URI) i el secret. L'usuari l'escaneja amb una aplicació d'autenticació i confirma el primer codi amb `mfa.challengeAndVerify()`.
2. **Inici de sessió**: després de `signInWithPassword()` la sessió és `aal1`. Si l'usuari té un factor verificat (`nextLevel` = `aal2`), `LoginView` el porta a `/mfa` (`views/MfaVerifyView.vue`). En introduir el codi correcte la sessió passa a `aal2`.
3. **Guard del router**: amb la sessió a `aal1` i la 2FA activa (`authStore.needsMfa`), qualsevol ruta privada o `/login` porta a `/mfa`. `/mfa` només és accessible quan hi ha un segon pas pendent.

Supabase desa el factor i el secret TOTP; el frontend no en guarda res (restricció d'`AGENTS.md`).

## Decisions

| Tema | Decisió | Motiu |
|---|---|---|
| On es fa la 2FA | Directament amb `supabase.auth.mfa` des del frontend, tot encapsulat a `stores/auth.js` | És el que demana l'issue #20 i els endpoints del README no existeixen (vegeu més avall) |
| Nivell AAL a l'store | `aal` i `needsMfa` són `computed` que llegeixen la claim `aal` del JWT i els factors verificats de `session.user` | Mateix criteri que `mfa.getAuthenticatorAssuranceLevel()`, però síncron i sense xarxa: el guard el pot fer servir directament i no cal cridar Supabase dins d'`onAuthStateChange` (la documentació avisa que pot bloquejar-se) |
| Desactivar | Es demana el codi actual (`challengeAndVerify`) i després `mfa.unenroll()` | Supabase exigeix `aal2` per esborrar un factor verificat, i així algú amb la sessió oberta no la pot treure sense el mòbil |
| Activacions a mitges | Abans de cada `enroll` s'esborren els factors TOTP `unverified` de l'usuari | Si es genera el QR i no es confirma, el factor queda a Supabase i hi ha un límit de factors per usuari |
| Sessió `aal1` pendent | Només es pot estar a `/mfa`, que té un botó "Cancel·lar" que tanca la sessió. En verificar es torna al `redirect` original (o `/actius`) | Evita que l'usuari quedi atrapat i conserva on volia anar |
| Pèrdua del mòbil | Fora d'abast | Supabase no té codis de recuperació per a TOTP. En un cas real, un administrador esborraria el factor des del panell de Supabase |
| Errors del backend per falta de segon factor (#23) | De moment no es tracten al frontend | El guard ja impedeix arribar a rutes privades sense `aal2`. Quan el #23 fixi el format de l'error, s'afegirà la redirecció a `/mfa` |

## Els endpoints del README

La secció "API de doble factor (2FA)" del `README.md` (afegida al commit `306c7c2`, PR #27) documenta:

1. `POST /api/v1/users/2fa/enroll` → retorna `factor_id` i una URI `otpauth://` que el frontend converteix en QR.
2. `POST /api/v1/users/2fa/verify` amb el codi i `factor_id`.
3. Si el codi és incorrecte, `400` amb `El codi d'autenticació és incorrecte`.

Aquests endpoints **no existeixen** a cap branca del repositori i **no formen part de cap issue**: el #23 (backend de US1.4) tracta les polítiques RLS amb `aal2` i la comprovació de la claim `aal` a `get_current_user`, no l'activació. Per això s'ha seguit l'issue #20 i s'ha deixat el README sense tocar fins que l'equip ho confirmi. Cal decidir:

- **Si no es faran**: treure o reescriure la secció del README perquè descrigui el flux real (aquest document).
- **Si es faran**: vegeu l'apartat següent.

### Què canviaria si els endpoints arriben a existir

Les vistes, el router i el guard **no canvien**: només criden l'store. Els canvis es limiten a `stores/auth.js` i als seus tests:

| Funció de l'store | Ara | Amb els endpoints |
|---|---|---|
| `enrollTotp()` | `mfa.listFactors()` + `mfa.unenroll()` dels pendents + `mfa.enroll()` | `fetch('POST /api/v1/users/2fa/enroll')` amb `Authorization: Bearer <access_token>`. La neteja de factors pendents l'hauria de fer el backend |
| QR | Supabase ja el retorna com a SVG (`totp.qr_code`) | El README diu que el backend només retorna la URI `otpauth://`: caldria una **dependència nova** per generar el QR (p. ex. `qrcode`) o que el backend retorni també el SVG de Supabase. Recomanable el segon |
| `verifyTotp()` (confirmar l'activació) | `mfa.challengeAndVerify()`: la sessió del client passa a `aal2` automàticament | `fetch('POST /api/v1/users/2fa/verify')`. **Problema**: els tokens nous (`aal2`) els rep el backend, no el client. El backend els hauria de retornar i el frontend fer `supabase.auth.setSession()`; si no, el client es queda amb un token `aal1` |
| `verifyMfaLogin()` (segon pas del login) | `mfa.challengeAndVerify()` | El mateix problema dels tokens. Recomanació: **mantenir-lo amb supabase-js** encara que existeixin els endpoints |
| `unenrollTotp()` | `challengeAndVerify()` + `mfa.unenroll()` | El README no documenta cap endpoint de desactivació: o es manté amb supabase-js o cal un `DELETE /api/v1/users/2fa/{factor_id}` |
| Errors | `mfaErrorMessage()` (`utils/mfaErrors.js`) tradueix els codis de Supabase | Afegir el cas `400` de l'API amb el seu missatge |
| Tests | `authMfa.spec.js` simula `supabase.auth.mfa` | Simular `fetch` en lloc de `supabase.auth.mfa`. Els tests de vistes i del guard no canvien |

En resum: passar a l'API és reescriure l'interior de 3 funcions de l'store, però el segon pas del login té més sentit fer-lo sempre amb supabase-js perquè és el client qui ha de guardar la sessió `aal2`.

## Limitacions conegudes i coses a comprovar

- **Recuperació de contrasenya amb 2FA activa** (resolt): l'enllaç del correu crea una sessió `aal1` i Supabase no deixa canviar la contrasenya d'un usuari amb 2FA sense `aal2` (`insufficient_aal`). Per això `/reset-password` té `meta.requiresAal2`: el guard porta primer a `/mfa?redirect=/reset-password` i, amb el codi correcte, es torna al formulari amb la sessió a `aal2`. Conseqüència: sense el mòbil tampoc es pot recuperar la contrasenya (vegeu "Pèrdua del mòbil").
- **Configuració de Supabase**: la MFA TOTP ha d'estar activada al projecte (Authentication → MFA). Si no, l'activació retorna `mfa_totp_enroll_not_enabled` i es mostra "La verificació en dos passos no està disponible ara mateix."
- **Proves manuals**: cal una aplicació d'autenticació al mòbil (Google Authenticator, Microsoft Authenticator, Authy…).
