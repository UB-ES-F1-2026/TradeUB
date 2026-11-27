<script setup>
import { nextTick, ref, useId } from 'vue'

// Pestanyes subratllades (US5.2): tria una opció d'una llista curta, com el tipus d'actiu a Actius o el rang d'un
// gràfic (US10.2). Segueix el patró de pestanyes de WAI-ARIA: només la pestanya triada entra amb el tabulador, i les
// fletxes, Inici i Fi canvien de pestanya. Amb `controls`, cada pestanya apunta al panell que canvia (aria-controls)
const props = defineProps({
  modelValue: { type: [String, Number], required: true },
  // [{ value, label }]
  options: { type: Array, required: true },
  // Nom accessible del grup de pestanyes
  label: { type: String, required: true },
  // id de l'element que mostra el contingut de la pestanya triada
  controls: { type: String, default: undefined },
})
const emit = defineEmits(['update:modelValue'])

const id = useId()
const tabs = ref([])

const tabId = (value) => `${id}-${value}`

async function select(index) {
  const option = props.options[index]
  if (option.value !== props.modelValue) emit('update:modelValue', option.value)
  await nextTick()
  tabs.value[index]?.focus()
}

function onKeydown(event, index) {
  const last = props.options.length - 1
  const keys = {
    ArrowRight: index === last ? 0 : index + 1,
    ArrowLeft: index === 0 ? last : index - 1,
    Home: 0,
    End: last,
  }
  if (!(event.key in keys)) return
  event.preventDefault()
  select(keys[event.key])
}

defineExpose({ tabId })
</script>

<template>
  <div
    class="ui-tabs"
    role="tablist"
    :aria-label="label"
  >
    <button
      v-for="(option, index) in options"
      :id="tabId(option.value)"
      :key="option.value"
      ref="tabs"
      type="button"
      role="tab"
      class="ui-tabs__tab"
      :class="{ 'ui-tabs__tab--selected': option.value === modelValue }"
      :aria-selected="option.value === modelValue ? 'true' : 'false'"
      :aria-controls="controls"
      :tabindex="option.value === modelValue ? 0 : -1"
      @click="select(index)"
      @keydown="onKeydown($event, index)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.ui-tabs {
  display: flex;
  gap: var(--tub-space-3);
  /* Les pestanyes tenen marge interior perquè el focus i el subratllat no quedin retallats; el marge negatiu
     manté el text alineat amb la resta de la targeta */
  margin-inline: calc(-1 * var(--tub-space-2));
  /* Línia de base amb una ombra interior: un contenidor amb overflow-x retalla el que sobresurt, i una vora amb
     marge negatiu a la pestanya deixava el subratllat de 2 px en 1 px */
  box-shadow: inset 0 -1px 0 var(--tub-border);
  /* A pantalles estretes, si no hi caben, es desplacen de costat en lloc de saltar de línia */
  overflow-x: auto;
  scrollbar-width: none;
}
.ui-tabs::-webkit-scrollbar {
  display: none;
}
.ui-tabs__tab {
  position: relative;
  flex: none;
  padding: var(--tub-space-2);
  border: 0;
  background: none;
  color: var(--tub-text-muted);
  font: inherit;
  font-size: var(--tub-text-sm);
  font-weight: 600;
  cursor: pointer;
}
.ui-tabs__tab:hover {
  color: var(--tub-text);
}
/* Subratllat de l'amplada del text, per sobre de la línia de base */
.ui-tabs__tab--selected::after {
  content: '';
  position: absolute;
  right: var(--tub-space-2);
  bottom: 0;
  left: var(--tub-space-2);
  height: 2px;
  background: var(--tub-primary);
}
.ui-tabs__tab--selected {
  color: var(--tub-text);
}
/* El contorn va per dins: per fora, el contenidor el retallaria */
.ui-tabs__tab:focus-visible {
  outline: 2px solid var(--tub-primary);
  outline-offset: -2px;
  border-radius: var(--tub-radius-sm);
}

@media (max-width: 900px) {
  .ui-tabs {
    gap: var(--tub-space-2);
  }
}
</style>
