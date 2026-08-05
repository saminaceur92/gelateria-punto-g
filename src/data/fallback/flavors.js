// Catalogo gusti — COPIA DI SICUREZZA (fallback)
// Questi dati vengono usati solo se Supabase non è raggiungibile o non è ancora
// configurato. La fonte normale dei dati è la tabella `allergeni_prodotti`
// (vedi GESTIONE-MENU.md): categorie, colori, descrizioni e diciture dietetiche
// sono le stesse che produce fetchMenu() in ../live.js.
// Fonte dei contenuti: scheda dati compilata dai titolari (ago 2026).
//
// Forma di ogni gusto: { name, color, desc, diet:[{ short, label }], tag? }
// `diet` rispecchia dietOf() di live.js: Vegan, Senza glutine, Senza lattosio.

const VEG = { short: 'VEG', label: 'Vegan' };
const SG = { short: 'SG', label: 'Senza glutine' };
const SL = { short: 'SL', label: 'Senza lattosio' };

export const flavorCategories = [
  {
    id: 'crema',
    name: 'Creme',
    description: 'I grandi classici reinterpretati con la nostra ricetta',
    flavors: [
      {
        name: 'Fior di Latte',
        color: '#fff8e6',
        desc: 'il gusto più puro, il nostro fior di latte: corposo, saporito e pieno',
        diet: [SG],
      },
      {
        name: 'Yogurt Bianco',
        color: '#fafafa',
        desc: 'Il nostro Yogurt: leggermente acido, saporito e cremoso.',
        diet: [SG],
      },
      {
        name: 'Crema',
        color: '#f5d97a',
        desc: 'Il gelao al gusto crema pasticcera, con infusione di scorze di limone',
        diet: [SG],
      },
      {
        name: 'Cioccolato',
        color: '#4a2c1a',
        desc: 'Ispirato dal budino al cioccolato della nonna. Una base di cioccolato finissimo, con un retro sapore di panna',
        diet: [SG],
      },
      {
        name: 'Pistacchio',
        color: '#7ea15a',
        desc: 'Classico dei classici, fatto con pistacchi che ci facciamo spedire dalla Sicilia',
        diet: [SG],
      },
      {
        name: 'Nocciola',
        color: '#8a5a3b',
        desc: 'Classico intramontabile. Il gelato fatto con le nocciole tostate trilobate italiane',
        diet: [SG],
      },
      { name: 'Caffè', color: '#4a2e1f', desc: '', diet: [SG] },
    ],
  },
  {
    id: 'golosone',
    name: 'Golosoni',
    description: 'Variegati, croccanti, irresistibili',
    flavors: [
      {
        name: 'Stracciatella',
        color: '#f5f0dd',
        desc: 'Uno dei nostri gusti più ricercati: una base di panna, con pezzetti croccanti di cioccolato',
        diet: [SG],
      },
      {
        name: 'Cheesecake ai frutti rossi',
        color: '#c94a6b',
        desc: 'Freschissima base al formaggio spalmabile, con biscotti croccanti al caramello e frutti rossi',
        diet: [SG],
      },
      {
        name: 'Spagnola',
        color: '#d9b384',
        desc: 'sua maestà la crema impreziosita da una variegatura con le amarene di Vignola',
        diet: [SG],
      },
      {
        name: 'Pino Pinguino',
        color: '#3a2418',
        desc: 'Ispirato al Pinguì,base di panna con strati di Nutella morbida',
        diet: [SG],
      },
      {
        name: 'Nutella',
        color: '#3d2114',
        desc: 'Ispirato alla crema spalmabile più famosa al mondo. Base di Nutella con pezzetti di Nutella',
        diet: [SG],
      },
      {
        name: 'Kinder',
        color: '#e6c79c',
        desc: 'Una base di nocciola e cioccolato bianco, coi famosi waferini glassati alla nocciola',
        diet: [],
      },
      {
        name: 'Caramello Salato',
        color: '#c8842b',
        desc: 'Base di mandorla, con un caramello con piccoli fiocchi di sale di Cervia',
        diet: [SG],
      },
      {
        name: 'Bacio',
        color: '#3a2519',
        desc: "L'inconfondibile gusto della gianduia che incontra le nocciole intere tostate.",
        diet: [SG],
      },
      {
        name: 'Biscotto',
        color: '#c89968',
        desc: 'Il nostro biscotto con pepite di biscotto glassato al cioccolato.',
        diet: [SG],
      },
      {
        name: 'Punto Gi',
        color: '#b651e4',
        desc: 'Che dire… una pasta di mandorla, con stracciatella e croccante alla mandorla',
        diet: [SG],
        tag: 'firma',
      },
      {
        name: 'Mentaciock',
        color: '#8fd1a0',
        desc: 'Una base di menta verde con stracciatella',
        diet: [SG],
      },
      {
        name: 'Duplo',
        color: '#7a4a2e',
        desc: 'Una base cremosa di nocciola, con pezzi di cialda, nocciole e cioccolato',
        diet: [],
      },
      {
        name: 'Giovanna',
        color: '#e8c79e',
        desc: 'SEMIFREDDO Panna montata con croccante alla mandorla',
        diet: [SG],
      },
    ],
  },
  {
    id: 'frutta-vegan',
    name: 'Frutta e Vegan',
    description: 'Sorbetti alla frutta e gusti senza derivati del latte',
    flavors: [
      {
        name: 'Limone',
        color: '#f5e26a',
        desc: 'Il limone, fatto con polpa di limone di Sorrento',
        diet: [VEG, SG, SL],
      },
      {
        name: 'Fragola',
        color: '#e84a6e',
        desc: 'La fragola….cosa dovrei dirti??',
        diet: [VEG, SG, SL],
      },
      {
        name: 'Nero Nero',
        color: '#1a1008',
        desc: 'Cioccolato fondente con la percentuale più alta di cacao: 80%',
        diet: [VEG, SG, SL],
      },
      { name: 'Cocco', color: '#fafafa', desc: 'Il nostro cocco SENZA latte', diet: [VEG, SG, SL] },
      {
        name: 'Mango',
        color: '#f3a72d',
        desc: 'il gusto frutta più inaspettato, fatto con percentuali altissime di purea pura di mango',
        diet: [VEG, SG, SL],
      },
      {
        name: 'Nocciola e Gianduia',
        color: '#6b4226',
        desc: 'Nocciola con gianduia e nocciole intere',
        diet: [VEG, SG, SL],
      },
      {
        name: 'Pistacchio Salato',
        color: '#9bbf6a',
        desc: 'Pistacchio fatto con pesto di pistacchio. Salato per natura',
        diet: [VEG, SG, SL],
      },
      {
        name: 'Yogurt con Mango e Passion fruit',
        color: '#f7c25a',
        desc: 'Yogurt senza derivati animali, con mango e passion fruit. Da giù di testa',
        diet: [VEG, SG, SL],
      },
      // Gusti già in vetrina che i titolari non hanno citato nella scheda:
      // restano in carta con i dati che abbiamo (scelta esplicita dei titolari).
      { name: 'Granita Pistacchio', color: '#9ab36a', desc: '', diet: [VEG, SG] },
      { name: 'Granita Mandorla', color: '#e8dcc0', desc: '', diet: [VEG, SG] },
      { name: 'Pompelmo', color: '#f28ca0', desc: '', diet: [VEG, SG] },
      { name: 'Pesca', color: '#f7b878', desc: '', diet: [VEG, SG] },
      { name: 'Melone', color: '#f0d98a', desc: '', diet: [VEG, SG] },
    ],
  },
  {
    // Le tre basi da cui parte ogni gusto: live.js le mostra come categoria a sé
    // (MENU_CATS), quindi devono esserci anche qui, altrimenti la copia di
    // sicurezza mostrerebbe una categoria in meno del sito vero.
    id: 'base',
    name: 'Basi',
    description: 'Ogni nostro gusto parte da una di queste tre basi',
    flavors: [
      { name: 'Base Bianca', color: '#f3f3f1', desc: '', diet: [SG] },
      { name: 'Base Vegan', color: '#dbd1ad', desc: '', diet: [VEG, SG] },
      { name: 'Base Frutta', color: '#ecacb9', desc: '', diet: [VEG, SG] },
    ],
  },
  {
    id: 'leccornie',
    name: 'Altre Leccornie',
    description: 'Pasticceria a freddo, torte e prelibatezze',
    flavors: [
      { name: 'Pasticcini', color: '#f3a3c2', desc: '', diet: [] },
      { name: 'Salame dolce', color: '#5a3520', desc: '', diet: [] },
      { name: 'Torte gelato', color: '#b651e4', desc: '', diet: [] },
      { name: 'Torte semifreddo', color: '#a5cdcb', desc: '', diet: [] },
      { name: 'Monoporzioni', color: '#eb911e', desc: '', diet: [] },
      { name: 'Prodotti stagionali', color: '#7ea15a', desc: '', diet: [], tag: 'stagione' },
    ],
  },
];
