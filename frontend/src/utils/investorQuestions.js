// Preguntes del qüestionari d'experiència inversora (US2.3).
// Cada pregunta és de resposta tancada; les opcions van de menys a més experiència
export const INVESTOR_QUESTIONS = [
  {
    id: 'experiencia',
    text: 'Quina experiència tens invertint?',
    options: [
      { id: 'cap', label: 'Mai no he invertit' },
      { id: 'poca', label: 'He fet alguna inversió puntual' },
      { id: 'habitual', label: 'Inverteixo de manera habitual' },
    ],
  },
  {
    id: 'coneixement',
    text: 'Com valores el teu coneixement sobre accions i ETFs?',
    options: [
      { id: 'baix', label: 'No sé ben bé què són' },
      { id: 'mitja', label: 'Conec el funcionament bàsic' },
      { id: 'alt', label: 'Entenc bé els riscos i com es comporten' },
    ],
  },
  {
    id: 'seguiment',
    text: 'Amb quina freqüència seguiries el mercat?',
    options: [
      { id: 'mai', label: 'Gairebé mai' },
      { id: 'setmanal', label: 'Un cop per setmana' },
      { id: 'diari', label: 'Cada dia' },
    ],
  },
  {
    id: 'caiguda',
    text: 'Si la teva cartera caigués un 20 % en un mes, què faries?',
    options: [
      { id: 'vendre', label: 'Ho vendria tot per no perdre més' },
      { id: 'esperar', label: 'Esperaria que es recuperés' },
      { id: 'comprar', label: 'Aprofitaria per comprar-ne més' },
    ],
  },
  {
    id: 'horitzo',
    text: 'Durant quant de temps mantindries una inversió?',
    options: [
      { id: 'curt', label: "Menys d'un any" },
      { id: 'mitja', label: "D'un a cinc anys" },
      { id: 'llarg', label: 'Més de cinc anys' },
    ],
  },
]
