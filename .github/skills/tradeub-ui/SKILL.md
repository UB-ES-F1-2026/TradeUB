---
name: tradeub-ui
description: Aplica el sistema visual de TradeUB quan es modifica una vista, component, formulari, alerta, color o marca.
---

---
name: tradeub-ui
description: Sistema de disseny del frontend de TradeUB (Vue 3 + Vite). Usa-la quan es modifiqui una vista, component, formulari, alerta, color o marca.
---

# /tradeub-ui — estil unificat del frontend

Tot el frontend ha de tenir el mateix aspecte sense que cada vista reinventi
colors i mides. Aquesta skill explica la font de veritat visual i com
modificar-la.

## On viu cada cosa

| Què | Fitxer | Regla |
|---|---|---|
| Colors, tipografia, espais, radis, ombres | `frontend/src/styles/tokens.css` | Variables CSS `--tub-*`; únic lloc amb valors hex |
| Reset i estils globals | `frontend/src/styles/base.css` | Només consumeix tokens |
| Components base | `frontend/src/components/ui/` | `UiButton`, `UiInput`, `UiCard`, `UiAlert`, `UiBadge`, `UiLogo` |
| Mostra visual | `frontend/src/views/StyleguideView.vue` | Ruta `/ui` |

## Regles

1. No hardcodegis colors a les vistes. Si falta un color, afegeix un token
   semàntic `--tub-*` a `tokens.css`.
2. Abans de crear un botó, input, card o alerta, usa el component `Ui*`
   existent. Si no cobreix el cas, amplia'l amb una prop o variant.
3. Els estils scoped de les vistes són només per layout. Colors, radis i mides
   de text venen dels tokens.
4. Usa Inter, `.tabular`, `.eyebrow` i `.tub-on-dark` quan correspongui.
5. Accions, links i focus usen `--tub-primary*`; pujades, èxit i gràfiques
   usen `--tub-green*`; errors i baixades usen `--tub-danger*`.
6. L'idioma de la UI és el català.
7. Les vistes han de funcionar a 900 px i menys.

## API dels components

```vue
<UiButton variant="primary|secondary|ghost|dark" size="sm|md|lg" type="submit" :loading="bool" :disabled="bool" block>Text</UiButton>

<UiInput v-model="email" label="Correu electrònic" type="email" autocomplete="email"
         placeholder="nom@exemple.com" :error="errors.email" hint="Opcional" />

<UiCard variant="default|glass" padding="sm|md|lg">...</UiCard>
<UiAlert variant="info|success|warning|error">Missatge</UiAlert>
<UiBadge variant="neutral|success|danger|info|on-dark">+4,82 %</UiBadge>
<UiLogo to="/" size="sm|md|lg" :mark-only="bool" />
```

## Com canviar l'estil de tota l'app

- Per canviar un color o mida global, edita només `tokens.css`.
- Per canviar un component compartit, edita `frontend/src/components/ui/`.
- Per afegir un component, usa el prefix `Ui`, classes BEM, tokens CSS,
  exporta'l a `components/ui/index.js` i afegeix-lo a `/ui`.
- Els canvis grans de tema o de components compartits requereixen una branca,
  revisió visual i PR cap a `develop`.

## Procediment abans d'editar frontend

1. Llegeix aquesta skill, `tokens.css` i `components/ui/index.js`.
2. Construeix la vista amb components `Ui*` i tokens.
3. Si afegeixes tokens o components, actualitza aquesta skill i `/ui`.
4. No introdueixis Tailwind, Vuetify ni cap llibreria visual nova sense acord
   explícit de l'equip.
