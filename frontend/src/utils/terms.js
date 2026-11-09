// Text dels termes i condicions del pas de verificació (US2.4). És un text inventat per a un projecte acadèmic.
// La versió la decideix el backend (TERMS_VERSION a core/verification.py): si es canvia aquest text,
// cal pujar-la perquè els usuaris els tornin a acceptar
export const TERMS_SECTIONS = [
  {
    title: '1. Naturalesa del servei',
    paragraphs: [
      "TradeUB és un projecte acadèmic de la Universitat de Barcelona que simula l'experiència d'una plataforma d'inversió. No és una entitat financera, no té cap llicència bancària ni d'inversió i no presta cap servei financer real.",
      "Tots els saldos, cotitzacions, ordres i rendiments que es mostren són simulats. No es pot ingressar, retirar ni invertir diners reals, i res del que hi apareix té valor econòmic.",
    ],
  },
  {
    title: '2. Compte i verificació de la identitat',
    paragraphs: [
      "Per accedir a les funcions simulades del compte cal completar l'onboarding: dades personals, qüestionari d'experiència inversora i verificació del document d'identitat.",
      "La verificació del document és simulada. La imatge del DNI no surt del teu navegador i no es desa enlloc: només es registra el moment en què l'has enviat.",
      'Ets responsable de mantenir la confidencialitat de les teves credencials i de la verificació en dos passos, si la tens activada.',
    ],
  },
  {
    title: '3. Compte virtual i operativa simulada',
    paragraphs: [
      "El compte virtual disposa d'un saldo fictici que serveix per provar l'aplicació. Les operacions simulades no generen cap obligació, ni per a tu ni per als autors del projecte.",
      "Les dades de mercat poden ser fictícies, endarrerides o incompletes, i no s'han de fer servir per prendre cap decisió real.",
    ],
  },
  {
    title: '4. Cap assessorament financer',
    paragraphs: [
      "Res del que es mostra a TradeUB constitueix assessorament financer, fiscal o jurídic, ni una recomanació per comprar o vendre cap instrument financer.",
      "El perfil d'inversor que surt del qüestionari és orientatiu i només serveix per adaptar l'experiència de la simulació.",
    ],
  },
  {
    title: '5. Riscos de la inversió',
    paragraphs: [
      "Invertir en mercats reals comporta riscos, inclosa la pèrdua total del capital invertit. Les rendibilitats passades no garanteixen les futures, ni en la realitat ni en la simulació.",
      "Si mai inverteixes diners reals, fes-ho a través d'una entitat autoritzada i informa't bé dels productes i dels seus costos.",
    ],
  },
  {
    title: '6. Dades personals',
    paragraphs: [
      "Les dades que introdueixes es fan servir només per al funcionament de l'aplicació dins del projecte acadèmic. No es cedeixen a tercers ni es fan servir amb finalitats comercials.",
      "Pots demanar a l'equip del projecte que esborri el teu compte i les dades associades en qualsevol moment.",
    ],
  },
  {
    title: '7. Canvis en els termes',
    paragraphs: [
      "Aquests termes poden canviar. Si canvien, et demanarem que acceptis la nova versió abans de continuar fent servir les funcions simulades del compte.",
      "En acceptar-los confirmes que els has llegit i que entens que TradeUB és una simulació sense diners reals.",
    ],
  },
]
