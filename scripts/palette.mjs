// Palette colori della gelateria.
// In Airtable il proprietario sceglie un COLORE PER NOME da un menù a tendina
// (es. "Pistacchio", "Cioccolato fondente") invece di scrivere un codice come
// "#7ea15a". Qui mappiamo ogni nome al suo codice esadecimale reale.
//
// - PALETTE: l'elenco mostrato come opzioni del menù a tendina in Airtable.
// - nameToHex: usata in build-data.mjs per convertire il nome scelto nel codice.
// - hexToName: usata da seed-from-fallback.mjs per convertire i colori attuali
//   nei nomi della palette quando si generano i CSV di importazione.

export const PALETTE = [
  { name: 'Panna', hex: '#fff8e6' },
  { name: 'Bianco', hex: '#fafafa' },
  { name: 'Stracciatella', hex: '#f5f0dd' },
  { name: 'Crema', hex: '#f5d97a' },
  { name: 'Crema chiara', hex: '#e6c79c' },
  { name: 'Limone', hex: '#f5e26a' },
  { name: 'Sabbia', hex: '#d9b384' },
  { name: 'Biscotto', hex: '#c89968' },
  { name: 'Caramello', hex: '#c8842b' },
  { name: 'Arancio', hex: '#eb911e' },
  { name: 'Mango', hex: '#f3a72d' },
  { name: 'Pistacchio', hex: '#7ea15a' },
  { name: 'Pistacchio chiaro', hex: '#9bb678' },
  { name: 'Verde acqua', hex: '#a5cdcb' },
  { name: 'Verde menta scuro', hex: '#1e3a2b' },
  { name: 'Nocciola', hex: '#8a5a3b' },
  { name: 'Nocciola scura', hex: '#7a4a2e' },
  { name: 'Cioccolato al latte', hex: '#6b4226' },
  { name: 'Gianduia', hex: '#5a3520' },
  { name: 'Caffè', hex: '#4a2e1f' },
  { name: 'Cioccolato scuro', hex: '#3a2418' },
  { name: 'Cioccolato fondente', hex: '#2a160e' },
  { name: 'Frutti rossi', hex: '#c94a6b' },
  { name: 'Fragola', hex: '#e84a6e' },
  { name: 'Rosa', hex: '#f3a3c2' },
  { name: 'Viola Punto G', hex: '#b651e4' },
  { name: 'Viola scuro', hex: '#602e9e' },
];

export const nameToHex = Object.fromEntries(PALETTE.map((p) => [p.name.toLowerCase(), p.hex]));

// Colori esatti usati oggi -> nome di palette.
// Alcuni toni quasi identici sono accorpati (differenza impercettibile) per
// tenere il menù a tendina ordinato.
export const hexToName = {
  '#fff8e6': 'Panna',
  '#fff2d6': 'Panna',
  '#fafafa': 'Bianco',
  '#f5f0dd': 'Stracciatella',
  '#f5d97a': 'Crema',
  '#e6c79c': 'Crema chiara',
  '#e8c79e': 'Crema chiara',
  '#f5e26a': 'Limone',
  '#d9b384': 'Sabbia',
  '#c89968': 'Biscotto',
  '#c8842b': 'Caramello',
  '#eb911e': 'Arancio',
  '#f3a72d': 'Mango',
  '#7ea15a': 'Pistacchio',
  '#9bb678': 'Pistacchio chiaro',
  '#a5cdcb': 'Verde acqua',
  '#1e3a2b': 'Verde menta scuro',
  '#8a5a3b': 'Nocciola',
  '#7a4a2e': 'Nocciola scura',
  '#6b4226': 'Cioccolato al latte',
  '#5a3520': 'Gianduia',
  '#4a2e1f': 'Caffè',
  '#3a2418': 'Cioccolato scuro',
  '#3a2519': 'Cioccolato scuro',
  '#3d2114': 'Cioccolato scuro',
  '#2a160e': 'Cioccolato fondente',
  '#c94a6b': 'Frutti rossi',
  '#e84a6e': 'Fragola',
  '#f3a3c2': 'Rosa',
  '#b651e4': 'Viola Punto G',
  '#602e9e': 'Viola scuro',
};

// Converte un valore del campo "Colore" (nome di palette o codice esadecimale)
// nel codice esadecimale finale. Restituisce null se non riconosciuto.
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
export function resolveColor(value) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return null;
  if (HEX_RE.test(s)) return s;
  const byName = nameToHex[s.toLowerCase()];
  return byName || null;
}
