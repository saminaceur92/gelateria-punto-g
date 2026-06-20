// Catalogo opzioni configuratore torte — COPIA DI SICUREZZA (fallback)
// Usati solo se Airtable non è raggiungibile/configurato. Vedi GESTIONE-MENU.md.
// Prezzi indicativi: vanno confermati con il proprietario.

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

// Selezione gusti — riusiamo gli stessi colori del menù
export const cakeFlavors = [
  { name: 'Fior di latte', color: '#fff8e6' },
  { name: 'Crema', color: '#f5d97a' },
  { name: 'Stracciatella', color: '#f5f0dd' },
  { name: 'Yogurt bianco', color: '#fafafa' },
  { name: 'Cheesecake frutti rossi', color: '#c94a6b' },
  { name: 'Pistacchio', color: '#7ea15a' },
  { name: 'Nocciola', color: '#8a5a3b' },
  { name: 'Cioccolato fondente', color: '#2a160e' },
  { name: 'Cioccolato al latte', color: '#6b4226' },
  { name: 'Nutella', color: '#3d2114' },
  { name: 'Bacio', color: '#3a2519' },
  { name: 'Caffè', color: '#4a2e1f' },
  { name: 'Caramello salato', color: '#c8842b' },
  { name: 'Pino pinguino', color: '#3a2418' },
  { name: 'Punto Gi', color: '#b651e4' },
  { name: 'Fragola', color: '#e84a6e' },
  { name: 'Limone', color: '#f5e26a' },
  { name: 'Mango', color: '#f3a72d' },
  { name: 'Cocco', color: '#fafafa' },
  { name: 'After Eight', color: '#1e3a2b' },
];

export const cakeBases = [
  { id: 'classica', name: 'Classica', desc: 'Pan di Spagna sottile', priceDelta: 0 },
  { id: 'crock', name: 'Crock croccante', desc: 'Base biscottata e croccante', priceDelta: 3 },
  { id: 'cacao', name: 'Frolla al cacao', desc: 'Friabile, intensa', priceDelta: 3 },
  { id: 'glutenfree', name: 'Senza glutine', desc: 'Per intolleranze', priceDelta: 4 },
];

export const cakeDecorations = [
  { id: 'minimal', name: 'Minimal', desc: 'Pulita ed elegante', emoji: '✻' },
  { id: 'frutta', name: 'Frutta fresca', desc: 'Colorata e di stagione', emoji: '🍓' },
  { id: 'cioccolato', name: 'Cioccolato', desc: 'Riccioli e gocce', emoji: '🍫' },
  { id: 'panna', name: 'Ciuffi di panna', desc: 'Classica, romantica', emoji: '🌸' },
  { id: 'fantasy', name: 'Fantasy', desc: 'Colori, glassa, sprinkles', emoji: '🌈' },
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
