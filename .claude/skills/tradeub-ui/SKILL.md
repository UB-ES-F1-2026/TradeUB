---
name: tradeub-ui
description: Sistema de disseny del frontend de TradeUB (Vue 3 + Vite). Usa-la sempre que es creï o modifiqui una vista o component del frontend, es toquin colors, tipografia, botons, formularis, alertes o la marca, o algú pregunti "quin color/estil fem servir". També per canviar l'estil global de l'app. Trigger /tradeub-ui.
---

# /tradeub-ui — estil unificat del frontend

Tot el frontend ha de tenir el mateix aspecte sense que cada vista reinventi colors i mides. Per això hi ha **una sola font de veritat** i aquesta skill explica com usar-la i com canviar-la.

## On viu cada cosa

| Què | Fitxer | Regla |
|---|---|---|
| Colors, tipografia, espais, radis, ombres | `frontend/src/styles/tokens.css` | Variables CSS `--tub-*`. **L'únic lloc on hi ha valors hex.** |
| Reset i estils globals (body, headings, links) | `frontend/src/styles/base.css` | Només consumeix tokens. Classes utilitàries: `.tabular`, `.eyebrow`, `.tub-on-dark`. |
| Components base | `frontend/src/components/ui/` | `UiButton`, `UiInput`, `UiCard`, `UiAlert`, `UiBadge`, `UiLogo`. Import des de `@/components/ui` (`import { UiButton } from '../components/ui'`). |
| Logotip oficial | `frontend/public/brand/` | `logo.svg`, `logo-white.svg` (per a fons fosc), `mark.svg` (només la icona). Vectorials: no afegir PNG. Sempre via `UiLogo`, no amb `<img>` solts. Favicon a `public/favicon.svg`. |
| Mostra de tot plegat | ruta `/ui` (`frontend/src/views/StyleguideView.vue`) | Per veure com queda abans de fer una vista. |

## Regles (per a persones i per a Claude)

1. **Cap color hardcodejat a les vistes.** Si necessites un color, fas servir `var(--tub-...)`. Si no existeix el token que et cal, l'afegeixes a `tokens.css` amb nom semàntic (`--tub-warning-bg`, no `--tub-yellow`) i l'uses.
2. **Abans de fer un botó/input/card/alerta a mà, usa el component `Ui*`.** Si no cobreix el cas, amplia el component amb una prop o variant (i actualitza la secció d'API d'aquí sota), no facis una còpia local.
3. **Estils scoped a cada vista només per layout** (grid, gaps, amplades). Colors, radis i mides de text venen de tokens.
4. **Tipografia:** Inter (carregada a `index.html`). Titulars amb `letter-spacing` negatiu (ja ve de `base.css`); preus i percentatges amb la classe `.tabular`; etiquetes de secció amb `.eyebrow`. Sempre Inter: no afegeixis altres fonts.
5. **Primari vs. verd semàntic:** accions principals, links i focus usen `--tub-primary*` (el verd del logotip). Pujades, èxit i gràfiques usen `--tub-green*`. Són semblants ara, però no els barregis: si un dia canvia el color de marca, les pujades han de seguir sent verdes. Blau marí `--tub-navy` → `--tub-navy-2` (gradient `--tub-gradient-brand`) per a panells de marca i fons foscos; text sobre fosc amb `--tub-text-on-dark*`. Vermell `--tub-danger*` només per a errors i baixades. Un contenidor sobre fons fosc porta la classe `tub-on-dark` (text clar i primari invertit si el tema ho necessita).
6. **Idioma de la UI: català.** Textos d'etiquetes, errors i botons en català.
7. **Responsive:** les vistes han de funcionar a 900px i menys (el panell de marca del registre s'amaga per sota de 900px; segueix aquest patró).

## API dels components

```vue
<UiButton variant="primary|secondary|ghost|dark" size="sm|md|lg" type="submit" :loading="bool" :disabled="bool" block>Text</UiButton>

<UiInput v-model="email" label="Correu electrònic" type="email" autocomplete="email"
         placeholder="nom@exemple.com" :error="errors.email" hint="Opcional">
  <template #trailing><UiButton variant="ghost">Mostrar</UiButton></template>
</UiInput>

<UiCard variant="default|glass" padding="sm|md|lg">...</UiCard>   <!-- glass: sobre fons fosc -->

<UiAlert variant="info|success|warning|error">Missatge</UiAlert>

<UiBadge variant="neutral|success|danger|info|on-dark">+4,82 %</UiBadge>

<UiLogo to="/" size="sm|md|lg" :mark-only="bool" />   <!-- logotip oficial de public/brand/; dins de .tub-on-dark usa la versió blanca -->
```

`UiInput` passa qualsevol altre atribut a l'`<input>` (`@paste.prevent`, `maxlength`, etc.).

## Com canviar l'estil de tota l'app

- **Canviar un color/mida global:** edita només `tokens.css`. No cal tocar cap vista.
- **Proposar un canvi d'estil gran (tema sencer):** fes una branca, canvia `tokens.css` i ensenya `/ui` al grup abans del PR. No cal tocar components. Aquest tema ("Mercat") es va triar l'11/10/2026 entre tres propostes.
- **Canviar com es veu un botó/input a tot arreu:** edita el component a `components/ui/`.
- **Afegir un component nou reutilitzable:** crea `components/ui/UiNom.vue` amb prefix `Ui`, classes BEM `ui-nom__part`, només tokens dins del CSS, exporta'l a `components/ui/index.js`, afegeix-lo a la vista `/ui` i a la taula d'API d'aquesta skill.
- Qualsevol d'aquests canvis va per PR normal (branca des d'un issue, PR a `develop`) i la revisa algú de front. Així tothom pot modificar l'estil i el canvi queda registrat.

## Què ha de fer Claude quan toca el frontend

1. Llegir `tokens.css` i `components/ui/index.js` abans d'escriure CSS o markup.
2. Construir la vista amb `Ui*` i tokens; només layout als estils scoped.
3. Si afegeix un token o un component, actualitzar aquesta skill (taula d'API) i la vista `/ui` en el mateix canvi.
4. No introduir cap llibreria d'UI (Tailwind, Vuetify, etc.) sense decisió del grup al xat.
