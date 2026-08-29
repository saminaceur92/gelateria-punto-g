// Catalogo opzioni configuratore torte — COPIA DI SICUREZZA (fallback)
// Usati solo se Supabase non è raggiungibile/configurato. Vedi GESTIONE-MENU.md.
// Include i dati della torta 3D (forme, farciture, coperture, ricette).
// Prezzi e testi: scheda dati compilata dai titolari (ago 2026).

export const cakeShapes = [
  { id: 'tonda', name: 'Tonda', desc: 'Classica, perfetta per ogni occasione', emoji: '⬤', priceDelta: 0 },
  { id: 'cuore', name: 'Cuore', desc: 'Romantica, per dichiarazioni e ricorrenze', emoji: '❤', priceDelta: 4 },
  { id: 'quadrata', name: 'Quadrata', desc: 'Moderna, ideale per più persone', emoji: '◼', priceDelta: 2 },
  { id: 'rettangolare', name: 'Rettangolare', desc: 'Per buffet e tagli generosi', emoji: '▭', priceDelta: 2 },
];

export const cakeTypes = [
  {
    id: 'semifreddo',
    name: 'Semifreddo',
    desc: 'Torta semifreddo adatta alla conservazione in frigorifero. Ideale per lunghi spostamenti o se non hai voglia di aspettare che scongeli.',
    basePrice: 28,
    img: '/torte.jpg',
    color: '#b651e4',
    allergeni: [],
  },
  {
    id: 'gelato',
    name: 'Torta Gelato',
    desc: 'Classica torta gelato da conservare in congelatore. Fresca, golosa e unica',
    basePrice: 28,
    img: '/gelato.jpg',
    color: '#602e9e',
    allergeni: [],
  },
  {
    id: 'crock',
    name: 'Torta gelato con base Salame al cioccolato',
    desc: 'Golosissima torta gelato con alla base il nostro mitico salame al cioccolato',
    basePrice: 28,
    img: '/semifreddi.jpg',
    color: '#eb911e',
    allergeni: [],
  },
  {
    id: 'piani',
    name: 'Alta semifreddo',
    desc: 'Una torta semifreddo che farà sì che tutti ricordino il tuo evento. Alta, decorata con panna anche colorata',
    basePrice: 30,
    img: '/torte.jpg',
    color: '#a5cdcb',
    allergeni: [],
  },
  {
    id: 'alta-gelato',
    name: 'Alta Gelato',
    desc: 'Una torta gelato che farà sì che tutti ricordino il tuo evento. Alta, decorata con panna anche colorata',
    basePrice: 30,
    img: '/gelato.jpg',
    color: '#7e5bbd',
    allergeni: [],
  },
];

export const cakeSizes = [
  { id: '6', label: '6 persone', diameter: 19, priceDelta: 0 },
  { id: '8', label: '8 persone', diameter: 21, priceDelta: 8 },
  { id: '10', label: '10 persone', diameter: 24, priceDelta: 16, popular: true },
  { id: '12', label: '12 persone', diameter: 26, priceDelta: 24 },
  { id: '16', label: '16 persone', diameter: 30, priceDelta: 40 },
  { id: '20', label: '20 persone', diameter: 31, priceDelta: 56 },
];

// Gusti selezionabili per le torte: sono le righe di `allergeni_prodotti`
// con `per_torte = true`. Colore e allergeni arrivano da lì (allergeni_certi).
// Ricopiati dal listino vero (ago 2026): erano rimasti indietro a 16 gusti su
// 29, e le ricette del "Sorprendimi" che ne nominano uno dei mancanti — Nero
// Nero, Cocco, Mango, Pesca, Yogurt Bianco… — sarebbero state completate a
// caso proprio nel momento in cui serve la copia di sicurezza, cioè quando
// Supabase non risponde.
export const cakeFlavors = [
  { name: 'Fior di Latte', color: '#fff8e6', allergeni: ['latte'] },
  { name: 'Yogurt Bianco', color: '#fafafa', allergeni: ['latte'] },
  { name: 'Crema', color: '#f5d97a', allergeni: ['latte', 'uova'] },
  { name: 'Cioccolato', color: '#4a2c1a', allergeni: ['latte'] },
  { name: 'Pistacchio', color: '#7ea15a', allergeni: ['latte', 'frutta a guscio'] },
  { name: 'Nocciola', color: '#8a5a3b', allergeni: ['latte', 'frutta a guscio'] },
  { name: 'Caffè', color: '#4a2e1f', allergeni: ['latte'] },
  { name: 'Stracciatella', color: '#f5f0dd', allergeni: ['latte'] },
  { name: 'Cheesecake ai frutti rossi', color: '#c94a6b', allergeni: ['latte', 'frutta a guscio', 'soia'] },
  { name: 'Spagnola', color: '#d9b384', allergeni: ['latte'] },
  { name: 'Pino Pinguino', color: '#3a2418', allergeni: ['latte', 'frutta a guscio'] },
  { name: 'Nutella', color: '#3d2114', allergeni: ['latte', 'frutta a guscio'] },
  { name: 'Kinder', color: '#e6c79c', allergeni: ['latte', 'glutine', 'frutta a guscio', 'soia'] },
  { name: 'Caramello Salato', color: '#c8842b', allergeni: ['latte', 'frutta a guscio'] },
  { name: 'Bacio', color: '#3a2519', allergeni: ['latte', 'frutta a guscio'] },
  { name: 'Biscotto', color: '#c89968', allergeni: ['latte', 'frutta a guscio'] },
  { name: 'Punto Gi', color: '#b651e4', allergeni: ['latte', 'frutta a guscio', 'arachidi', 'soia'] },
  { name: 'Mentaciock', color: '#8fd1a0', allergeni: ['latte'] },
  { name: 'Duplo', color: '#7a4a2e', allergeni: ['latte', 'glutine', 'frutta a guscio', 'soia'] },
  { name: 'Giovanna', color: '#e8c79e', allergeni: ['latte', 'frutta a guscio'] },
  { name: 'Limone', color: '#f5e26a', allergeni: [], vegan: true },
  { name: 'Fragola', color: '#e84a6e', allergeni: [], vegan: true },
  { name: 'Nero Nero', color: '#1a1008', allergeni: ['soia'], vegan: true },
  { name: 'Cocco', color: '#fafafa', allergeni: [], vegan: true },
  { name: 'Mango', color: '#f3a72d', allergeni: [], vegan: true },
  { name: 'Nocciola e Gianduia', color: '#6b4226', allergeni: ['frutta a guscio'], vegan: true, senzaZucchero: true },
  { name: 'Pistacchio Salato', color: '#9bbf6a', allergeni: ['frutta a guscio'], vegan: true, senzaZucchero: true },
  { name: 'Yogurt con Mango e Passion fruit', color: '#f7c25a', allergeni: [], vegan: true, senzaZucchero: true },
  { name: 'Pesca', color: '#f7b878', allergeni: [], vegan: true },
];

// Basi: le due "Classiche" sono senza lattosio (nota dei titolari).
export const cakeBases = [
  { id: 'cacao', name: 'Senza base', desc: 'Gelato direttamente sul piatto', priceDelta: 0, color: '#efe7da', allergeni: [], vegan: true, senzaZucchero: true },
  { id: 'classica', name: 'Classica Vaniglia', desc: 'Pan di Spagna sottile con bagna vaniglia', priceDelta: 1, color: '#e8d2a8', allergeni: ['glutine', 'uova'] },
  { id: 'classica-cioccolato', name: 'Classica Cioccolato', desc: 'Pan di Spagna sottile con bagna cioccolato', priceDelta: 1, color: '#8a5a3b', allergeni: ['glutine', 'uova'] },
  { id: 'glutenfree', name: 'Salame al cioccolato', desc: 'Il nostro inconfondibile salame per una base super golosa', priceDelta: 3, color: '#5a3520', allergeni: ['latte', 'soia', 'frutta a guscio', 'glutine'] },
  { id: 'crock', name: 'Base croccante', desc: 'Biscotto croccante: scegli sotto il gusto del crumble', priceDelta: 0, color: '#b88c5a', allergeni: [], vegan: true },
];

// Tipi di crumble: si scelgono SOLO se la base è la "Base croccante"
// (base id `crock`, vedi CRUMBLE_BASE_ID in ../cakeOptions.js). Gestibili dalla
// dashboard nella scheda "Crumble" (tabella Supabase `crumble`).
// La base `crock` non costa nulla: il prezzo lo porta il singolo crumble.
// Sono tutti GLUTEN FREE; il crumble caramello è anche vegan e senza lattosio.
export const cakeCrumbles = [
  { id: 'cacao', name: 'Crumble cacao', desc: 'Base biscotto croccante al cacao', priceDelta: 2, color: '#5a3520', allergeni: ['latte', 'frutta a guscio'] },
  { id: 'caramello', name: 'Crumble caramello', desc: 'Base biscotto croccante al caramello', priceDelta: 2, color: '#c8842b', allergeni: ['frutta a guscio'], vegan: true },
  { id: 'pistacchio', name: 'Crumble pistacchio', desc: 'Base biscotto croccante al pistacchio', priceDelta: 4, color: '#7ea15a', allergeni: ['latte', 'frutta a guscio'] },
  { id: 'fruttato', name: 'Crumble fruttato', desc: 'Base biscotto croccante con sapore fruttato adatto per torte con frutta', priceDelta: 2, color: '#e2a06a', allergeni: ['latte', 'frutta a guscio'] },
  { id: 'cereali-cacao', name: 'Crumble cereali e fave di cacao', desc: 'Base biscotto croccante con cereali senza glutine e fave di cacao', priceDelta: 2, color: '#6b4226', allergeni: ['latte', 'frutta a guscio'] },
];

// Farciture (variegato/cuore tra gli strati)
export const cakeFillings = [
  { id: 'nessuna', name: 'Nessuna', desc: 'Strati puri', priceDelta: 0, color: null, allergeni: [], vegan: true, senzaZucchero: true },
  { id: 'cremino', name: 'Variegato Nocciola e Gianduia', desc: 'Nocciola e cioccolato', priceDelta: 2, color: '#5a3520', allergeni: ['frutta a guscio', 'soia'], senzaZucchero: true },
  { id: 'caramello', name: 'Salsa caramello salato', desc: 'Dolce e sapida', priceDelta: 2, color: '#c8842b', allergeni: ['latte'] },
  { id: 'frutti-rossi', name: 'Cuore frutti rossi', desc: 'Salsa ai frutti rossi', priceDelta: 2, color: '#c93060', allergeni: [], vegan: true },
  { id: 'amarena', name: 'Salsa di amarene', desc: 'Classica, intensa', priceDelta: 2, color: '#8c1e3a', allergeni: [], vegan: true },
  { id: 'nutella', name: 'Nutella', desc: 'Nutella… cosa devo spiegarti??', priceDelta: 2, color: '#3d2114', allergeni: ['latte', 'soia', 'frutta a guscio'] },
  { id: 'kinder', name: 'Crema Kinder', desc: 'Farcitura golosa con pezzettini di wafer', priceDelta: 2, color: '#e6c79c', allergeni: ['glutine', 'soia', 'latte'] },
  { id: 'biscotto', name: 'Biscotto', desc: 'Croccante salsa con pezzetti di biscotti', priceDelta: 2, color: '#b88c5a', allergeni: ['latte', 'frutta a guscio'] },
  { id: 'granella', name: 'Granella di nocciole', desc: 'Croccante', priceDelta: 1, color: '#8a5a3b', allergeni: ['frutta a guscio'], vegan: true },
  { id: 'granella-pistacchi', name: 'Granella di Pistacchi', desc: 'Croccante', priceDelta: 1, color: '#9bbf6a', allergeni: ['frutta a guscio'], vegan: true },
  { id: 'pistacchio', name: 'Crema di pistacchi', desc: 'Con pistacchi interi cristallizzati', priceDelta: 2, color: '#7ea15a', allergeni: ['frutta a guscio'], vegan: true },
];

// Copertura / glassa esterna
export const cakeCoverings = [
  { id: 'panna', name: 'Panna montata a CIUFFI INTORNO', desc: 'Ciuffi di panna tutt’intorno alla torta e ghirlanda sul bordo', priceDelta: 2, color: '#fff8e6', allergeni: ['latte'] },
  { id: 'panna-spatolata', name: 'Panna montata SPATOLATA INTORNO', desc: 'Panna liscia, spianata col coltello tutt’intorno alla torta', priceDelta: 2, color: '#fff8e6', allergeni: ['latte'] },
  { id: 'panna-sopra', name: 'Panna montata SOLO SOPRA', desc: 'Filo di panna solo sopra alla torta, con intorno un nastro trasparente non edibile', priceDelta: 0, color: '#fff8e6', allergeni: ['latte'] },
  { id: 'panna-sotto-sopra', name: 'Panna montata SOTTO E SOPRA', desc: 'Filo di panna sul bordo inferiore e superiore della torta', priceDelta: 1, color: '#fff8e6', allergeni: ['latte'] },
  // Panna VEGETALE: le gemelle vegane delle quattro coperture di panna qui
  // sopra, stesso id + "-veg". Nel configuratore compaiono AL POSTO loro a chi
  // sceglie Vegan o evita il latte (vedi conPannaVeg in CakeConfigurator) e la
  // torta 3D le disegna identiche (vedi senzaVeg in Cake3D): cambia
  // l'ingrediente, non l'aspetto. Stesso prezzo delle versioni con latte,
  // modificabile dalla dashboard. Gli allergeni della panna vegetale (es. soia)
  // li confermano i titolari dalla scheda Coperture: qui non si indovina.
  { id: 'panna-veg', name: 'Panna VEGETALE a CIUFFI INTORNO', desc: 'Ciuffi di panna vegetale al sapore di vaniglia tutt’intorno alla torta e ghirlanda sul bordo', priceDelta: 2, color: '#fff8e6', allergeni: [], vegan: true },
  { id: 'panna-spatolata-veg', name: 'Panna VEGETALE SPATOLATA INTORNO', desc: 'Panna vegetale al sapore di vaniglia, liscia e spianata col coltello tutt’intorno alla torta', priceDelta: 2, color: '#fff8e6', allergeni: [], vegan: true },
  { id: 'panna-sopra-veg', name: 'Panna VEGETALE SOLO SOPRA', desc: 'Filo di panna vegetale al sapore di vaniglia solo sopra alla torta, con intorno un nastro trasparente non edibile', priceDelta: 0, color: '#fff8e6', allergeni: [], vegan: true },
  { id: 'panna-sotto-sopra-veg', name: 'Panna VEGETALE SOTTO E SOPRA', desc: 'Filo di panna vegetale al sapore di vaniglia sul bordo inferiore e superiore della torta', priceDelta: 1, color: '#fff8e6', allergeni: [], vegan: true },
  { id: 'cioccolato-cop', name: 'Copertura morbida al cioccolato', desc: 'Copertura morbida al cioccolato al latte', priceDelta: 2, color: '#6b4226', allergeni: ['latte', 'soia', 'frutta a guscio'] },
  { id: 'pistacchio-cop', name: 'Copertura al pistacchio', desc: 'Effetto wow', priceDelta: 4, color: '#7ea15a', allergeni: ['frutta a guscio'], vegan: true },
  { id: 'frutta-cop', name: 'Copertura di frutta', desc: 'Fresca, di stagione', priceDelta: 3, color: '#e84a6e', allergeni: [], vegan: true },
  { id: 'naked', name: 'Naked cake', desc: 'Bordi a vista, rustica', priceDelta: 0, color: null, allergeni: [], vegan: true, senzaZucchero: true },
  { id: 'cioccolato-bianco-cop', name: 'Copertura cioccolato bianco', desc: 'Copertura morbida al cioccolato bianco', priceDelta: 2, color: '#f5f0dd', allergeni: ['latte', 'soia'] },
  { id: 'nocciola-cop', name: 'Copertura Nocciola', desc: 'Copertura morbida al gusto nocciola', priceDelta: 2, color: '#8a5a3b', allergeni: ['frutta a guscio', 'latte', 'soia'] },
];

// Colori selezionabili per le decorazioni con `colorChoice`.
// Si propongono SOLO i colori davvero disponibili: ogni lista è quella che i
// titolari hanno scritto nella descrizione della decorazione, non una tavolozza
// generica uguale per tutte.
// Nota dei titolari: le sfumature non sono garantite, ma si possono chiedere
// nelle note della torta.
// ⚠️ Le liste qui sotto devono restare identiche, parola per parola, alla colonna
// `colori` della tabella `decorazioni`
// (migrations/2026-08-04-scheda-dati-titolari.sql, sezione 8): sono lette dallo
// stesso codice (src/data/live.js) e questo file fa anche da default se la
// colonna `colori` non c'è ancora.

// Panna montata colorata: gli 8 colori indicati dai titolari (l'unica
// decorazione con "tutti i colori").
const COLORI_PANNA = ['Rosa', 'Rossa', 'Azzurra', 'Blu', 'Verde', 'Nera', 'Gialla', 'Arcobaleno'];
// Perline: «placcate oro o argento o rosa o bianco».
const COLORI_PERLINE = ['Oro', 'Argento', 'Rosa', 'Bianco'];
// Fiocchi: «in colore nero, rosa, rosso e oro».
const COLORI_FIOCCHI = ['Nero', 'Rosa', 'Rosso', 'Oro'];
// Spumini: «Rosa o blu».
const COLORI_SPUMINI = ['Rosa', 'Blu'];
// Si sceglie il colore SOLO per le quattro decorazioni qui sopra, cioè quelle per
// cui i titolari hanno detto quali colori fanno davvero. Zuccherini, macarons e
// fiori (eleganti e in ostia) arrivano già colorati misti: nessuna scelta.

// Decorazioni: granelle, confettini, fiori, panna… Ora incidono sul prezzo
// (`priceDelta`) e alcune permettono di scegliere il colore (`colorChoice`).
export const cakeDecorations = [
  { id: 'nessuna', name: 'Nessuna', desc: 'Top liscio', emoji: '∅', priceDelta: 0, allergeni: [], colorChoice: false, colors: [], vegan: true, senzaZucchero: true },
  { id: 'granella-nocciola', name: 'Granella NOCCIOLA', desc: 'Croccante e tostata', emoji: '🌰', priceDelta: 0, allergeni: ['frutta a guscio'], colorChoice: false, colors: [] },
  { id: 'granella-pistacchio', name: 'Granella PISTACCHIO', desc: 'Croccante e tostata', emoji: '🥜', priceDelta: 0, allergeni: ['frutta a guscio'], colorChoice: false, colors: [] },
  // Gli zuccherini sono già colorati misti: non si sceglie il colore (titolari).
  { id: 'zuccherini', name: 'Zuccherini colorati', desc: 'Zuccheri colorati misti', emoji: '🌈', priceDelta: 1, allergeni: [], colorChoice: false, colors: [] },
  { id: 'smarties', name: 'Smarties', desc: 'I famosi confettini colorati ripieni di cioccolato', emoji: '🍬', priceDelta: 2, allergeni: ['latte', 'frutta a guscio', 'soia'], colorChoice: false, colors: [] },
  { id: 'perline', name: 'Perline colorate', desc: 'Perline placcate oro, argento, rosa o bianco', emoji: '⚪', priceDelta: 3, allergeni: [], colorChoice: true, colors: COLORI_PERLINE },
  { id: 'fiocchi', name: 'Fiocchi colorati', desc: 'In colore nero, rosa, rosso e oro', emoji: '🎀', priceDelta: 4, allergeni: [], colorChoice: true, colors: COLORI_FIOCCHI },
  { id: 'cioccolato-fondente-deco', name: 'Decorazioni cioccolato fondente', desc: 'Allegri e golosi', emoji: '🍫', priceDelta: 2, allergeni: [], colorChoice: false, colors: [], vegan: true },
  { id: 'macarons', name: 'Macarons', desc: 'Colorati assortiti', emoji: '🧁', priceDelta: 2, allergeni: ['uova', 'frutta a guscio', 'latte'], colorChoice: false, colors: [] },
  { id: 'spumini', name: 'Spumini', desc: 'Rosa o blu', emoji: '☁️', priceDelta: 1, allergeni: ['uova'], colorChoice: true, colors: COLORI_SPUMINI },
  { id: 'marshmallow', name: 'Marshmallow', desc: 'Morbidi e colorati', emoji: '🍡', priceDelta: 3, allergeni: [], colorChoice: false, colors: [] },
  { id: 'fiori-eleganti', name: 'Fiori eleganti', desc: 'In zucchero duro, in colori diversi', emoji: '🌸', priceDelta: 5, allergeni: [], colorChoice: false, colors: [] },
  { id: 'fiori-ostia', name: 'Fiori ostia colorati', desc: 'Delicati fiori in ostia, in colori diversi', emoji: '🌼', priceDelta: 2, allergeni: [], colorChoice: false, colors: [] },
  { id: 'cioccolato-deco', name: 'Decorazioni cioccolato', desc: 'Decorazioni in cioccolato bianco, latte e fondente', emoji: '🍫', priceDelta: 2, allergeni: ['latte', 'frutta a guscio', 'soia'], colorChoice: false, colors: [] },
  { id: 'drip', name: 'Drip cake', desc: 'Colature di glassa che scendono dal bordo', emoji: '🍫', priceDelta: 2, allergeni: [], colorChoice: false, colors: [] },
  { id: 'frutta-fresca', name: 'Frutta fresca', desc: 'Ribes, more, lamponi…', emoji: '🫐', priceDelta: 4, allergeni: [], colorChoice: false, colors: [], vegan: true },
  { id: 'panna-deco', name: 'Panna montata', desc: 'Panna montata spatolata intorno e decorazione con ciuffi', emoji: '🍦', priceDelta: 2, allergeni: ['latte'], colorChoice: false, colors: [] },
  { id: 'panna-colorata', name: 'Panna montata colorata', desc: 'Colore a scelta tra rosa, rossa, azzurra, blu, verde, nera, gialla e arcobaleno', emoji: '🎨', priceDelta: 2, allergeni: ['latte'], colorChoice: true, colors: COLORI_PANNA },
  // Panna VEGETALE: gemelle vegane delle due decorazioni di panna, stesso id +
  // "-veg" (stessa regola delle coperture: compaiono al posto loro a chi
  // sceglie Vegan o evita il latte, e nel 3D sono identiche).
  { id: 'panna-deco-veg', name: 'Panna VEGETALE montata', desc: 'Panna vegetale al sapore di vaniglia, spatolata intorno e decorazione con ciuffi', emoji: '🍦', priceDelta: 2, allergeni: [], colorChoice: false, colors: [], vegan: true },
  { id: 'panna-colorata-veg', name: 'Panna VEGETALE montata colorata', desc: 'Panna vegetale al sapore di vaniglia, colore a scelta tra rosa, rossa, azzurra, blu, verde, nera, gialla e arcobaleno', emoji: '🎨', priceDelta: 2, allergeni: [], colorChoice: true, colors: COLORI_PANNA, vegan: true },
  { id: 'fantasia', name: 'Fantasia del gelataio', desc: 'Renderemo bella la torta per il tuo evento usando la nostra fantasia e il nostro estro', emoji: '✨', priceDelta: 3, allergeni: [], colorChoice: false, colors: [] },
  { id: 'colorate', name: 'Decorazioni colorate e divertenti', desc: 'Lasciati stupire dalle nostre decorazioni colorate e simpatiche!', emoji: '🎉', priceDelta: 3, allergeni: [], colorChoice: false, colors: [] },
];

// Stile della scritta sulla torta (tabella Supabase `scritte`).
// `family` è il font CSS usato dall'anteprima 2D e dalla torta 3D.
// Nessuna scritta ha supplemento: sono tutte comprese nel prezzo.
export const cakeScritte = [
  { id: 'stampatello', name: 'Stampatello maiuscolo', family: "'Inter', sans-serif", sample: 'AUGURI!', uppercase: true, italic: false },
  { id: 'corsivo', name: 'Corsivo', family: "'Caveat', cursive", sample: 'Auguri!', uppercase: false, italic: false },
  { id: 'corsivo-scolastico', name: 'Corsivo scolastico', family: "'Fraunces', serif", sample: 'Auguri!', uppercase: false, italic: true },
];

// Prodotti extra che si possono aggiungere all'ordine prima del pagamento
// (tabella Supabase `extra`). `step` è l'incremento della quantità: il salame
// si vende al kg (mezzi chili), i cabaret a pezzo intero.
export const cakeExtras = [
  { id: 'salame-dolce', name: 'Salame dolce', desc: 'Il nostro mitico salame al cioccolato', price: 35, unit: 'al kg', allergeni: ['latte', 'soia', 'frutta a guscio', 'glutine'], step: 0.5 },
  { id: 'cabaret-10', name: 'Cabaret pasticcini — 10 pezzi', desc: 'Pasticcini mignon assortiti', price: 15, unit: 'a cabaret', allergeni: ['glutine', 'latte', 'uova', 'soia', 'frutta a guscio', 'arachidi'], step: 1 },
  { id: 'cabaret-15', name: 'Cabaret pasticcini — 15 pezzi', desc: 'Pasticcini mignon assortiti', price: 20, unit: 'a cabaret', allergeni: ['glutine', 'latte', 'uova', 'soia', 'frutta a guscio', 'arachidi'], step: 1 },
  { id: 'cabaret-20', name: 'Cabaret pasticcini — 20 pezzi', desc: 'Pasticcini mignon assortiti', price: 25, unit: 'a cabaret', allergeni: ['glutine', 'latte', 'uova', 'soia', 'frutta a guscio', 'arachidi'], step: 1 },
];

export const cakeOccasions = [
  'Compleanno',
  'Anniversario',
  'Laurea',
  'Battesimo',
  'Comunione',
  'Gender reveal',
  'Nessuna',
];

// Allergeni ufficiali (Reg. UE 1169/2011) selezionabili nel configuratore.
// L'`id` coincide con le chiavi usate negli `allergeni` di gusti/basi/ecc.
// (per l'ingrigimento a cascata): NON cambiarlo per glutine/latte/uova/soia/frutta a guscio.
export const cakeAllergens = [
  { id: 'glutine', name: 'Glutine', emoji: '🌾' },
  { id: 'latte', name: 'Latte', emoji: '🥛' },
  { id: 'uova', name: 'Uova', emoji: '🥚' },
  { id: 'soia', name: 'Soia', emoji: '🌱' },
  { id: 'arachidi', name: 'Arachidi', emoji: '🥜' },
  { id: 'frutta a guscio', name: 'Frutta a guscio', emoji: '🌳' },
  { id: 'solfiti', name: 'Solfiti', emoji: '🍷' },
];

// Ricette suggerite ("Sorprendimi!")
// Usano solo gusti e id ancora in listino: se un nome cambia, il configuratore
// completa da solo la ricetta con altri gusti disponibili.
// La FORMA la dichiara solo chi ce l'ha nel tema (le ricette col cuore):
// per le altre la pesca il configuratore, alla pari fra le forme in listino.
// Quando era scritta qui su tutte — 13 tonde su 16 — quadrata e rettangolare
// non uscivano MAI.
export const cakeRecipes = [
  {
    name: 'Estate piena',
    flavors: ['Limone', 'Fragola'],
    filling: 'frutti-rossi',
    covering: 'frutta-cop',
    decoration: 'frutta-fresca',
  },
  {
    name: 'Amanti del cioccolato',
    flavors: ['Cioccolato', 'Nocciola'],
    filling: 'nutella',
    covering: 'cioccolato-cop',
    decoration: 'granella-nocciola',
  },
  {
    name: 'Romantica',
    shape: 'cuore',
    flavors: ['Fragola', 'Fior di Latte'],
    filling: 'amarena',
    covering: 'panna',
    decoration: 'fiori-eleganti',
  },
  {
    name: 'Classica della domenica',
    flavors: ['Crema', 'Nocciola'],
    filling: 'cremino',
    covering: 'panna-sotto-sopra',
    decoration: 'granella-nocciola',
  },
  {
    name: 'La firma Punto Gi',
    flavors: ['Pistacchio', 'Bacio'],
    filling: 'pistacchio',
    covering: 'pistacchio-cop',
    decoration: 'granella-pistacchio',
  },
  {
    name: 'Festa dei bambini',
    flavors: ['Nutella', 'Stracciatella'],
    filling: 'kinder',
    covering: 'panna',
    decoration: 'smarties',
  },
  {
    name: 'Merenda golosa',
    flavors: ['Duplo', 'Nocciola'],
    filling: 'biscotto',
    covering: 'nocciola-cop',
    decoration: 'cioccolato-deco',
  },
  {
    name: 'Fresca al limone',
    flavors: ['Limone', 'Fior di Latte'],
    filling: 'frutti-rossi',
    covering: 'panna-sopra',
    decoration: 'fiori-ostia',
  },
  {
    name: 'Caffè e cioccolato',
    flavors: ['Caffè', 'Cioccolato'],
    filling: 'cremino',
    covering: 'cioccolato-cop',
    decoration: 'cioccolato-fondente-deco',
  },
  {
    name: 'Menta e cioccolato',
    shape: 'cuore',
    flavors: ['Mentaciock', 'Stracciatella'],
    filling: 'nessuna',
    covering: 'cioccolato-bianco-cop',
    decoration: 'perline',
  },
  {
    name: 'Caramello croccante',
    flavors: ['Caramello Salato', 'Fior di Latte'],
    filling: 'caramello',
    covering: 'panna-sotto-sopra',
    decoration: 'marshmallow',
  },
  {
    name: 'Elegante in bianco',
    flavors: ['Fior di Latte', 'Crema'],
    filling: 'granella',
    covering: 'cioccolato-bianco-cop',
    decoration: 'macarons',
  },
  {
    name: 'Doppio pistacchio',
    flavors: ['Pistacchio', 'Punto Gi'],
    filling: 'granella-pistacchi',
    covering: 'pistacchio-cop',
    decoration: 'spumini',
  },
  {
    name: 'Cuore di fragola',
    shape: 'cuore',
    flavors: ['Fragola', 'Crema'],
    filling: 'amarena',
    covering: 'panna',
    decoration: 'fiocchi',
  },
  {
    name: 'Tre cioccolati',
    flavors: ['Cioccolato', 'Bacio', 'Pino Pinguino'],
    filling: 'nutella',
    covering: 'cioccolato-cop',
    decoration: 'granella-nocciola',
  },
  {
    // Non "Fragola + Limone": è già la coppia di "Estate piena", e sulle torte
    // normali contano solo i primi due gusti — sarebbe uscita la stessa torta.
    name: 'Tutta frutta',
    flavors: ['Mango', 'Fragola', 'Fior di Latte'],
    filling: 'frutti-rossi',
    covering: 'frutta-cop',
    decoration: 'frutta-fresca',
  },
  {
    name: 'Compleanno a colori',
    flavors: ['Crema', 'Stracciatella'],
    filling: 'cremino',
    covering: 'panna',
    decoration: 'zuccherini',
  },
  // --- Ricette pensate per le torte grandi e per le forme squadrate. ---
  // Le due rettangolari dichiarano la forma: sulle torte piccole (sotto le
  // 15 persone) il configuratore la sostituisce da solo, come per tutte.
  {
    name: 'Drip cake al cioccolato',
    shape: 'rettangolare',
    flavors: ['Cioccolato', 'Fior di Latte', 'Nocciola'],
    filling: 'nutella',
    covering: 'panna-spatolata',
    decoration: 'drip',
  },
  {
    name: 'Maxi festa',
    shape: 'rettangolare',
    flavors: ['Fragola', 'Stracciatella', 'Fior di Latte'],
    filling: 'frutti-rossi',
    covering: 'panna-spatolata',
    decoration: 'colorate',
  },
  {
    name: 'Rustica del bosco',
    shape: 'quadrata',
    flavors: ['Fior di Latte', 'Nocciola'],
    filling: 'granella',
    covering: 'naked',
    decoration: 'frutta-fresca',
  },
  {
    name: 'Arcobaleno di panna',
    shape: 'quadrata',
    flavors: ['Crema', 'Bacio'],
    filling: 'nessuna',
    covering: 'panna-spatolata',
    decoration: 'panna-colorata',
  },
  // --- Ricettario esteso, fino a 50 ricette in tutto. Decorazioni, coperture
  // e farciture sono distribuite a quote fisse: cosi' escono tutte con la
  // stessa frequenza invece di girare sempre sulle solite tre. La forma la
  // dichiara solo chi ce l'ha nel tema (cuore romantico, tonda classica);
  // per le altre la pesca il configuratore, alla pari fra le forme rimaste. ---
  {
    name: 'Tentazione al gianduia',
    shape: 'cuore',
    flavors: ['Nocciola e Gianduia', 'Bacio'],
    filling: 'nutella',
    covering: 'nocciola-cop',
    decoration: 'cioccolato-fondente-deco',
  },
  {
    name: 'Amore al caramello',
    shape: 'cuore',
    flavors: ['Caramello Salato', 'Cioccolato'],
    filling: 'caramello',
    covering: 'panna-spatolata',
    decoration: 'cioccolato-fondente-deco',
  },
  {
    name: 'Nocciola e biscotto',
    flavors: ['Biscotto', 'Nocciola'],
    filling: 'granella',
    covering: 'nocciola-cop',
    decoration: 'drip',
  },
  {
    name: 'Cioccolato e marshmallow',
    flavors: ['Cioccolato', 'Kinder'],
    filling: 'caramello',
    covering: 'cioccolato-cop',
    decoration: 'marshmallow',
  },
  {
    name: 'Dopocena al caffè',
    shape: 'tonda',
    flavors: ['Pino Pinguino', 'Caffè'],
    filling: 'caramello',
    covering: 'nocciola-cop',
    decoration: 'fantasia',
  },
  {
    name: 'Stracciatella e nocciola',
    flavors: ['Stracciatella', 'Nocciola'],
    filling: 'biscotto',
    covering: 'nocciola-cop',
    decoration: 'panna-deco',
  },
  {
    name: 'Nero al caramello',
    flavors: ['Nero Nero', 'Caramello Salato'],
    filling: 'caramello',
    covering: 'cioccolato-cop',
    decoration: 'fantasia',
  },
  {
    name: 'Rosa di pesca',
    shape: 'cuore',
    flavors: ['Pesca', 'Yogurt Bianco'],
    filling: 'nessuna',
    covering: 'panna-sopra',
    decoration: 'panna-colorata',
  },
  {
    name: 'Cuore alla Nutella',
    shape: 'cuore',
    flavors: ['Nutella', 'Crema'],
    filling: 'kinder',
    covering: 'panna-sotto-sopra',
    decoration: 'spumini',
  },
  {
    name: 'Coriandoli di cioccolato',
    flavors: ['Cioccolato', 'Crema'],
    filling: 'kinder',
    covering: 'panna-sopra',
    decoration: 'smarties',
  },
  {
    name: 'Girandola di fragola',
    flavors: ['Fragola', 'Cocco'],
    filling: 'nessuna',
    covering: 'panna-sotto-sopra',
    decoration: 'zuccherini',
  },
  {
    name: 'Nuvola di biscotto',
    flavors: ['Biscotto', 'Crema'],
    filling: 'kinder',
    covering: 'panna-sopra',
    decoration: 'zuccherini',
  },
  {
    name: 'Allegria di Duplo',
    flavors: ['Duplo', 'Fior di Latte'],
    filling: 'kinder',
    covering: 'panna-sopra',
    decoration: 'colorate',
  },
  {
    name: 'Nutella e confettini',
    flavors: ['Nutella', 'Fior di Latte'],
    filling: 'nessuna',
    covering: 'panna-sotto-sopra',
    decoration: 'smarties',
  },
  {
    name: 'Verde e nero',
    flavors: ['Pistacchio Salato', 'Nero Nero'],
    filling: 'granella-pistacchi',
    covering: 'pistacchio-cop',
    decoration: 'granella-pistacchio',
  },
  {
    name: 'Pistacchio e cocco',
    flavors: ['Pistacchio', 'Cocco'],
    filling: 'pistacchio',
    covering: 'pistacchio-cop',
    decoration: 'macarons',
  },
  {
    name: 'Verde d\'amore',
    shape: 'cuore',
    flavors: ['Pistacchio', 'Fior di Latte'],
    filling: 'cremino',
    covering: 'pistacchio-cop',
    decoration: 'fiori-eleganti',
  },
  {
    name: 'Frutti rossi e pistacchio',
    shape: 'cuore',
    flavors: ['Pistacchio', 'Cheesecake ai frutti rossi'],
    filling: 'pistacchio',
    covering: 'cioccolato-bianco-cop',
    decoration: 'fiori-eleganti',
  },
  {
    name: 'Bacio d\'oro',
    shape: 'cuore',
    flavors: ['Bacio', 'Fior di Latte'],
    filling: 'pistacchio',
    covering: 'cioccolato-bianco-cop',
    decoration: 'perline',
  },
  {
    name: 'Nevicata di pistacchio',
    flavors: ['Pistacchio', 'Stracciatella'],
    filling: 'pistacchio',
    covering: 'cioccolato-bianco-cop',
    decoration: 'granella-pistacchio',
  },
  {
    name: 'Cappuccino',
    shape: 'tonda',
    flavors: ['Caffè', 'Fior di Latte'],
    filling: 'cremino',
    covering: 'panna',
    decoration: 'macarons',
  },
  {
    name: 'Giovanna e pistacchio',
    flavors: ['Giovanna', 'Pistacchio'],
    filling: 'granella-pistacchi',
    covering: 'panna-spatolata',
    decoration: 'perline',
  },
  {
    name: 'Pesca in fiore',
    flavors: ['Pesca', 'Crema'],
    filling: 'granella',
    covering: 'naked',
    decoration: 'fiori-ostia',
  },
  {
    name: 'Sole di mango',
    flavors: ['Mango', 'Cocco'],
    filling: 'biscotto',
    covering: 'frutta-cop',
    decoration: 'panna-deco',
  },
  {
    name: 'Fragole e yogurt',
    flavors: ['Fragola', 'Yogurt Bianco'],
    filling: 'biscotto',
    covering: 'frutta-cop',
    decoration: 'panna-colorata',
  },
  {
    name: 'Batticuore ai frutti rossi',
    shape: 'cuore',
    flavors: ['Fior di Latte', 'Cheesecake ai frutti rossi'],
    filling: 'amarena',
    covering: 'frutta-cop',
    decoration: 'fiocchi',
  },
  {
    name: 'Fondente e amarena',
    shape: 'cuore',
    flavors: ['Nero Nero', 'Crema'],
    filling: 'amarena',
    covering: 'naked',
    decoration: 'fiocchi',
  },
  {
    name: 'Nocciole di campagna',
    flavors: ['Nocciola', 'Yogurt Bianco'],
    filling: 'granella',
    covering: 'naked',
    decoration: 'cioccolato-deco',
  },
  {
    name: 'Cocco e cioccolato',
    flavors: ['Cocco', 'Cioccolato'],
    filling: 'biscotto',
    covering: 'naked',
    decoration: 'marshmallow',
  },
];

// "Le nostre consigliate": torte già composte dai titolari, proposte nel passo
// della forma per chi non sa cosa scegliere. Toccarne una compila TUTTA la
// torta (tipo, base, gusti, farcitura, copertura, decorazioni) e porta dritti
// al passo di scritta, foto e candelina; la forma resta quella selezionata.
// I gusti sono per NOME (come nelle ricette del Sorprendimi), il resto per id
// del listino. Se un ingrediente sparisce dal listino la carta si nasconde da
// sola; se è in conflitto con le intolleranze dichiarate resta visibile ma
// sbarrata, col perché.
export const torteConsigliate = [
  // ---- Torte gelato ----
  {
    id: 'golosa',
    gruppo: 'gelato',
    name: 'La Golosa',
    type: 'gelato',
    baseId: 'crock',
    crumbleId: 'cereali-cacao',
    flavors: ['Nutella', 'Kinder'],
    fillingId: 'nessuna',
    coveringId: 'panna-sotto-sopra',
    decorations: ['cioccolato-deco', 'granella-nocciola', 'fantasia'],
    desc: 'Base crumble cereali e fave di cacao, gelato Nutella e Kinder, filo di panna montata sopra e sotto, decorazioni in cioccolato, granella di nocciola e decorazioni Ferrero in base alla disponibilità',
  },
  {
    id: 'delicata',
    gruppo: 'gelato',
    name: 'La Delicata',
    type: 'gelato',
    baseId: 'classica',
    crumbleId: '',
    flavors: ['Crema', 'Fior di Latte'],
    fillingId: 'nessuna',
    coveringId: 'panna',
    decorations: ['zuccherini', 'fiori-ostia'],
    desc: 'Base di pan di Spagna morbido alla vaniglia, gelato crema e fior di latte, panna montata a ciuffi intorno e decorazioni colorate in zucchero e ostia',
  },
  {
    id: 'fresca',
    gruppo: 'gelato',
    name: 'La Fresca',
    type: 'gelato',
    baseId: 'crock',
    crumbleId: 'fruttato',
    flavors: ['Fragola', 'Limone'],
    fillingId: 'nessuna',
    coveringId: 'frutta-cop',
    decorations: [],
    desc: 'Base crumble alla frutta, gelato fragola e limone, sopra glassa alla frutta',
  },
  {
    // Il "crumble alla vaniglia" non è a listino ("Crumble bianco" esiste ma è
    // spento): si usa il caramello, il più vicino. Se i titolari riaccendono
    // il bianco dalla dashboard basta cambiare l'id qui sotto.
    id: 'classicissima',
    gruppo: 'gelato',
    name: 'La Classicissima',
    type: 'gelato',
    baseId: 'crock',
    crumbleId: 'caramello',
    flavors: ['Nocciola', 'Crema'],
    fillingId: 'nessuna',
    coveringId: 'panna-sotto-sopra',
    decorations: ['granella-nocciola'],
    desc: 'Base crumble al caramello, gelato nocciola e crema, filo di panna montata sopra e sotto, granella di nocciola',
  },
  {
    // La "panna vegan plant based" non è (ancora) fra le coperture del
    // listino: la torta esce coi bordi a vista, che vegan lo sono di sicuro.
    // Quando i titolari aggiungeranno la copertura vegan si collega qui.
    id: 'vegan',
    gruppo: 'gelato',
    name: 'La Vegan',
    type: 'gelato',
    baseId: 'crock',
    crumbleId: 'caramello',
    flavors: ['Pistacchio Salato', 'Nocciola e Gianduia'],
    fillingId: 'nessuna',
    coveringId: 'naked',
    decorations: ['cioccolato-fondente-deco'],
    desc: 'Base crumble al caramello, gelato pistacchio salato e nocciola variegata alla gianduia, bordi a vista e decorazioni in cioccolato fondente: tutta vegan',
  },
  // ---- Semifreddi ----
  {
    id: 'nutellona',
    gruppo: 'semifreddo',
    name: 'La Nutellona',
    type: 'semifreddo',
    baseId: 'crock',
    crumbleId: 'cacao',
    flavors: ['Fior di Latte'],
    fillingId: 'nutella',
    coveringId: 'nocciola-cop',
    decorations: ['fantasia'],
    desc: 'Semifreddo alla panna (fior di latte), inserto alla Nutella, crumble al cacao, copertura alla nocciola e decorazioni Ferrero in base alla disponibilità',
  },
  {
    id: 'cheesecake',
    gruppo: 'semifreddo',
    name: 'La Cheesecake',
    type: 'semifreddo',
    baseId: 'crock',
    crumbleId: 'caramello',
    flavors: ['Cheesecake ai frutti rossi'],
    fillingId: 'frutti-rossi',
    coveringId: 'frutta-cop',
    decorations: ['frutta-fresca'],
    desc: 'Semifreddo cheesecake, cuore ai frutti rossi, crumble al caramello, copertura di frutta e frutta fresca sopra',
  },
  {
    id: 'biscottona',
    gruppo: 'semifreddo',
    name: 'La Biscottona',
    type: 'semifreddo',
    baseId: 'crock',
    crumbleId: 'cereali-cacao',
    flavors: ['Crema'],
    fillingId: 'biscotto',
    coveringId: 'cioccolato-bianco-cop',
    decorations: ['cioccolato-deco'],
    desc: 'Semifreddo alla crema, inserto al biscotto, crumble ai cereali e fave di cacao, copertura al cioccolato bianco e decorazioni in cioccolato',
  },
  {
    // Il gusto "mascarpone" non è fra i gusti per torte: si usa il fior di
    // latte, il più vicino. L'inserto Rocher è reso col variegato nocciola e
    // gianduia.
    id: 'rocher',
    gruppo: 'semifreddo',
    name: 'La Rocher',
    type: 'semifreddo',
    baseId: 'crock',
    crumbleId: 'cereali-cacao',
    flavors: ['Fior di Latte'],
    fillingId: 'cremino',
    coveringId: 'cioccolato-cop',
    decorations: ['fantasia'],
    desc: 'Semifreddo al fior di latte, variegato nocciola e gianduia, crumble ai cereali e fave di cacao, copertura al cioccolato e decorazioni Ferrero Rocher in base alla disponibilità',
  },
];
