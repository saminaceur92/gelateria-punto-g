// Catalogo opzioni configuratore torte — COPIA DI SICUREZZA (fallback)
// Usati solo se Airtable non è raggiungibile/configurato. Vedi GESTIONE-MENU.md.
// Include i dati della torta 3D (forme, farciture, coperture, ricette).
// Prezzi indicativi: vanno confermati con il proprietario.

export const cakeShapes = [
  { id: 'tonda', name: 'Tonda', desc: 'Classica, perfetta per ogni occasione', emoji: '⬤', priceDelta: 0 },
  { id: 'cuore', name: 'Cuore', desc: 'Romantica, per dichiarazioni e ricorrenze', emoji: '❤', priceDelta: 4 },
  { id: 'quadrata', name: 'Quadrata', desc: 'Moderna, ideale per più persone', emoji: '◼', priceDelta: 2 },
  { id: 'rettangolare', name: 'Rettangolare', desc: 'Per buffet e tagli generosi', emoji: '▭', priceDelta: 3 },
];

export const cakeTypes = [
  {
    id: 'semifreddo',
    name: 'Semifreddo',
    desc: 'Soffice, vellutato, perfetto a fine pasto',
    basePrice: 24,
    img: '/torte.jpg',
    color: '#b651e4',
  },
  {
    id: 'gelato',
    name: 'Torta Gelato',
    desc: 'Strati di gelato artigianale dei tuoi gusti preferiti',
    basePrice: 26,
    img: '/gelato.jpg',
    color: '#602e9e',
  },
  {
    id: 'crock',
    name: 'CROCK',
    desc: 'Base croccante + semifreddo: la nostra firma',
    basePrice: 28,
    img: '/semifreddi.jpg',
    color: '#eb911e',
  },
  {
    id: 'piani',
    name: 'A piani',
    desc: 'Per occasioni speciali — scenografica e golosa',
    basePrice: 38,
    img: '/torte.jpg',
    color: '#a5cdcb',
  },
];

export const cakeSizes = [
  { id: '6', label: '6 persone', diameter: 18, priceDelta: 0 },
  { id: '8', label: '8 persone', diameter: 20, priceDelta: 6, popular: true },
  { id: '10', label: '10 persone', diameter: 22, priceDelta: 12 },
  { id: '12', label: '12 persone', diameter: 24, priceDelta: 18 },
  { id: '16', label: '16 persone', diameter: 28, priceDelta: 28 },
  { id: '20', label: '20 persone', diameter: 30, priceDelta: 38 },
];

// tags possibili: 'gelato' | 'semifreddo' | 'sorbetto' | 'vegano' | 'sg'
// allergeni: indicativi, da confermare con le schede tecniche del laboratorio
export const cakeFlavors = [
  { name: 'Fior di latte', color: '#fff8e6', tags: ['gelato'], allergeni: ['latte'] },
  { name: 'Crema', color: '#f5d97a', tags: ['gelato'], allergeni: ['latte', 'uova'] },
  { name: 'Stracciatella', color: '#f5f0dd', tags: ['gelato'], allergeni: ['latte', 'soia'] },
  { name: 'Yogurt bianco', color: '#fafafa', tags: ['gelato', 'sg'], allergeni: ['latte'] },
  { name: 'Cheesecake frutti rossi', color: '#c94a6b', tags: ['semifreddo'], allergeni: ['latte', 'glutine'] },
  { name: 'Pistacchio', color: '#7ea15a', tags: ['gelato', 'sg'], allergeni: ['latte', 'frutta a guscio'] },
  { name: 'Nocciola', color: '#8a5a3b', tags: ['gelato'], allergeni: ['latte', 'frutta a guscio'] },
  { name: 'Cioccolato fondente', color: '#2a160e', tags: ['gelato', 'vegano'], allergeni: ['soia'] },
  { name: 'Cioccolato al latte', color: '#6b4226', tags: ['gelato'], allergeni: ['latte', 'soia'] },
  { name: 'Nutella', color: '#3d2114', tags: ['gelato'], allergeni: ['latte', 'frutta a guscio', 'soia'] },
  { name: 'Bacio', color: '#3a2519', tags: ['gelato'], allergeni: ['latte', 'frutta a guscio', 'soia'] },
  { name: 'Caffè', color: '#4a2e1f', tags: ['gelato'], allergeni: ['latte'] },
  { name: 'Caramello salato', color: '#c8842b', tags: ['gelato'], allergeni: ['latte'] },
  { name: 'Pino pinguino', color: '#3a2418', tags: ['gelato'], allergeni: ['latte', 'frutta a guscio', 'soia'] },
  { name: 'Punto Gi', color: '#b651e4', tags: ['gelato'], allergeni: ['latte', 'frutta a guscio'] },
  { name: 'Fragola', color: '#e84a6e', tags: ['sorbetto', 'vegano', 'sg'], allergeni: [] },
  { name: 'Limone', color: '#f5e26a', tags: ['sorbetto', 'vegano', 'sg'], allergeni: [] },
  { name: 'Mango', color: '#f3a72d', tags: ['sorbetto', 'vegano', 'sg'], allergeni: [] },
  { name: 'Cocco', color: '#fafafa', tags: ['gelato', 'sg'], allergeni: ['latte'] },
  { name: 'After Eight', color: '#1e3a2b', tags: ['gelato'], allergeni: ['latte', 'soia'] },
];

export const cakeBases = [
  { id: 'classica', name: 'Classica', desc: 'Pan di Spagna sottile', priceDelta: 0, color: '#e8d2a8', allergeni: ['glutine', 'uova'] },
  { id: 'crock', name: 'Crock croccante', desc: 'Base biscottata e croccante', priceDelta: 3, color: '#b88c5a', allergeni: ['glutine', 'soia'] },
  { id: 'cacao', name: 'Frolla al cacao', desc: 'Friabile, intensa', priceDelta: 3, color: '#5a3520', allergeni: ['glutine', 'uova'] },
  { id: 'glutenfree', name: 'Senza glutine', desc: 'Per intolleranze', priceDelta: 4, color: '#d8c098', allergeni: [] },
];

// Farciture (variegato/cuore tra gli strati)
export const cakeFillings = [
  { id: 'nessuna', name: 'Nessuna', desc: 'Strati puri', priceDelta: 0, color: null, allergeni: [] },
  { id: 'cremino', name: 'Variegato cremino', desc: 'Nocciola e cioccolato', priceDelta: 2, color: '#5a3520', allergeni: ['latte', 'frutta a guscio', 'soia'] },
  { id: 'caramello', name: 'Salsa caramello salato', desc: 'Dolce e sapida', priceDelta: 2, color: '#c8842b', allergeni: ['latte'] },
  { id: 'frutti-rossi', name: 'Cuore frutti rossi', desc: 'Lampone e ribes', priceDelta: 2, color: '#c93060', allergeni: [] },
  { id: 'amarena', name: 'Amarena', desc: 'Classica, intensa', priceDelta: 2, color: '#8c1e3a', allergeni: [] },
  { id: 'ganache', name: 'Ganache fondente', desc: 'Cioccolato puro', priceDelta: 2, color: '#2a160e', allergeni: ['latte', 'soia'] },
  { id: 'biscotto', name: 'Biscotto sbriciolato', desc: 'Croccantezza extra', priceDelta: 2, color: '#b88c5a', allergeni: ['glutine'] },
  { id: 'granella', name: 'Granella di nocciole', desc: 'Tostate del Piemonte', priceDelta: 2, color: '#8a5a3b', allergeni: ['frutta a guscio'] },
  { id: 'pistacchio', name: 'Crema pistacchio', desc: 'Bronte, vellutata', priceDelta: 3, color: '#7ea15a', allergeni: ['latte', 'frutta a guscio'] },
];

// Copertura / glassa esterna
export const cakeCoverings = [
  { id: 'panna', name: 'Panna montata', desc: 'Soffice, classica', priceDelta: 0, color: '#fff8e6', allergeni: ['latte'] },
  { id: 'meringa', name: 'Meringa fiammeggiata', desc: 'Effetto scenografico', priceDelta: 4, color: '#fffaf0', allergeni: ['uova'] },
  { id: 'ganache-cop', name: 'Ganache fondente', desc: 'Lucida e intensa', priceDelta: 3, color: '#2a160e', allergeni: ['latte', 'soia'] },
  { id: 'glassa-specchio', name: 'Glassa a specchio', desc: 'Effetto wow', priceDelta: 5, color: '#b651e4', allergeni: ['latte'] },
  { id: 'frutta-cop', name: 'Copertura di frutta', desc: 'Fresca, di stagione', priceDelta: 4, color: '#e84a6e', allergeni: [] },
  { id: 'naked', name: 'Naked cake', desc: 'Bordi a vista, rustica', priceDelta: 0, color: null, allergeni: [] },
  { id: 'cioccolato-cop', name: 'Copertura cioccolato', desc: 'Fondente o latte', priceDelta: 3, color: '#3d2114', allergeni: ['latte', 'soia'] },
];

// Topping: granelle croccanti sopra la torta
export const cakeDecorations = [
  { id: 'nessuna', name: 'Nessuna', desc: 'Top liscio, senza granella', emoji: '∅' },
  { id: 'granella-nocciola-pistacchio', name: 'Granella nocciola e pistacchio', desc: 'Croccante e tostata', emoji: '🌰' },
  { id: 'zuccherini', name: 'Zuccherini colorati', desc: 'Allegri e golosi', emoji: '🌈' },
  { id: 'granella-frutta-secca', name: 'Granella di frutta secca', desc: 'Mandorla, nocciola, noce', emoji: '🥜' },
];

export const cakeOccasions = [
  'Compleanno',
  'Anniversario',
  'Laurea',
  'Battesimo',
  'Comunione',
  'Festa di famiglia',
  'Solo per coccolarmi',
];

// Ricette suggerite ("Sorprendimi!")
export const cakeRecipes = [
  {
    name: 'Estate piena',
    shape: 'tonda',
    flavors: ['Limone', 'Fragola'],
    filling: 'frutti-rossi',
    covering: 'frutta-cop',
    decoration: 'zuccherini',
  },
  {
    name: 'Cioccolato lover',
    shape: 'tonda',
    flavors: ['Cioccolato fondente', 'Nocciola'],
    filling: 'ganache',
    covering: 'ganache-cop',
    decoration: 'granella-nocciola-pistacchio',
  },
  {
    name: 'Romantica',
    shape: 'cuore',
    flavors: ['Cheesecake frutti rossi', 'Yogurt bianco'],
    filling: 'amarena',
    covering: 'panna',
    decoration: 'granella-frutta-secca',
  },
  {
    name: 'Classica',
    shape: 'tonda',
    flavors: ['Crema', 'Nocciola'],
    filling: 'cremino',
    covering: 'panna',
    decoration: 'granella-nocciola-pistacchio',
  },
  {
    name: 'Punto G! signature',
    shape: 'tonda',
    flavors: ['Pistacchio', 'Punto Gi'],
    filling: 'pistacchio',
    covering: 'meringa',
    decoration: 'zuccherini',
  },
];
