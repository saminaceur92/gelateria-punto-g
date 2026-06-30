// Catalogo gusti — COPIA DI SICUREZZA (fallback)
// Questi dati vengono usati solo se Airtable non è raggiungibile o non è ancora
// configurato. La fonte normale dei dati è Airtable (vedi GESTIONE-MENU.md).
// Fonte originale: brochure ufficiale Gelateria Punto Gi! Carpi.

export const flavorCategories = [
  {
    id: 'creme',
    name: 'Creme',
    description: 'I grandi classici reinterpretati con la nostra ricetta',
    flavors: [
      { name: 'Fior di latte', color: '#fff8e6' },
      { name: 'Crema', color: '#f5d97a' },
      { name: 'After Eight', color: '#1e3a2b', tag: null },
      { name: 'Yogurt bianco', color: '#fafafa' },
      { name: 'Stracciatella', color: '#f5f0dd' },
      { name: 'Cheesecake ai frutti rossi', color: '#c94a6b' },
      { name: 'Spagnola', color: '#d9b384' },
      { name: 'Pino pinguino', color: '#3a2418' },
      { name: 'Nocciola', color: '#8a5a3b' },
      { name: 'Rocher', color: '#5a3520' },
      { name: 'Nutella', color: '#3d2114' },
      { name: 'Cioccolato al latte', color: '#6b4226' },
      { name: 'Caramello salato', color: '#c8842b' },
      { name: 'Super Kinder', color: '#e6c79c' },
      { name: 'Bacio', color: '#3a2519' },
      { name: 'Caffè', color: '#4a2e1f' },
      { name: 'Biscotto', color: '#c89968' },
      { name: 'Pistacchio', color: '#7ea15a' },
      { name: 'Punto Gi', color: '#b651e4', tag: 'firma' },
      { name: 'Duplo', color: '#7a4a2e' },
      { name: 'Cremino al Pistacchio', color: '#9bb678' },
      { name: 'Cioccolato fondente', color: '#2a160e' },
    ],
  },
  {
    id: 'frutta',
    name: 'Frutta & Veggy',
    description: 'Solo frutta, niente latte. Naturalmente vegan',
    flavors: [
      { name: 'Fragola', color: '#e84a6e' },
      { name: 'Limone', color: '#f5e26a' },
      { name: 'Mango', color: '#f3a72d' },
      { name: 'Cocco', color: '#fafafa' },
      { name: 'Pistacchio Veg', color: '#7ea15a', tag: 'vegan' },
      { name: 'Nocciola Veg', color: '#8a5a3b', tag: 'vegan' },
    ],
  },
  {
    id: 'semifreddi',
    name: 'Semifreddi',
    description: 'Eleganza tra cucchiaio e morso',
    flavors: [
      { name: 'Giovanna', color: '#e8c79e' },
      { name: 'Millefoglie', color: '#fff2d6' },
    ],
  },
  {
    id: 'leccornie',
    name: 'Altre Leccornie',
    description: 'Pasticceria a freddo, torte e prelibatezze',
    flavors: [
      { name: 'Pasticcini', color: '#f3a3c2' },
      { name: 'Salame dolce', color: '#5a3520' },
      { name: 'Torte gelato', color: '#b651e4' },
      { name: 'Torte semifreddo', color: '#a5cdcb' },
      { name: 'Monoporzioni', color: '#eb911e' },
      { name: 'Prodotti stagionali', color: '#7ea15a', tag: 'stagione' },
    ],
  },
];
