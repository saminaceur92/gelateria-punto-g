// Utility una-tantum: genera i dati iniziali del sito (src/data/generated/*.json)
// e i file CSV pronti da importare in Airtable (airtable-import/*.csv),
// partendo dalla copia di sicurezza in src/data/fallback/.
//
// Si rilancia con:  npm run seed
// È utile se vuoi rigenerare i CSV o ripartire dai dati di base.

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { flavorCategories } from '../src/data/fallback/flavors.js';
import {
  cakeTypes,
  cakeSizes,
  cakeFlavors,
  cakeBases,
  cakeDecorations,
  cakeOccasions,
} from '../src/data/fallback/cakeOptions.js';
import { hexToName, PALETTE } from './palette.mjs';

// Nei CSV scriviamo il NOME del colore (palette), non il codice esadecimale:
// così in Airtable il proprietario sceglie da un menù a tendina con i colori.
const colorName = (hex) => hexToName[String(hex || '').toLowerCase()] || hex;

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const genDir = resolve(root, 'src/data/generated');
const csvDir = resolve(root, 'airtable-import');
mkdirSync(genDir, { recursive: true });
mkdirSync(csvDir, { recursive: true });

const order = (i) => (i + 1) * 10;

// ─────────── Dati iniziali del sito (stessa forma usata dai componenti) ───────────

const menu = flavorCategories.map((c) => ({
  id: c.id,
  name: c.name,
  description: c.description,
  flavors: c.flavors.map((f) => ({ name: f.name, color: f.color, tag: f.tag ?? null })),
}));

const cake = { cakeTypes, cakeSizes, cakeFlavors, cakeBases, cakeDecorations, cakeOccasions };

writeFileSync(resolve(genDir, 'menu.json'), JSON.stringify(menu, null, 2) + '\n');
writeFileSync(resolve(genDir, 'cake.json'), JSON.stringify(cake, null, 2) + '\n');

// ─────────── CSV per Airtable ───────────

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
};
const csv = (headers, rows) =>
  [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';

const write = (name, content) => {
  writeFileSync(resolve(csvDir, name), content);
  console.log('  ✓', `airtable-import/${name}`);
};

// Categorie
write(
  'categorie.csv',
  csv(
    ['Id', 'Nome', 'Descrizione', 'In vetrina', 'Ordine'],
    flavorCategories.map((c, i) => [c.id, c.name, c.description, 'true', order(i)])
  )
);

// Gusti (menu) — la colonna Categoria contiene il NOME della categoria
write(
  'gusti.csv',
  csv(
    ['Nome', 'Categoria', 'Colore', 'Tag', 'In vetrina', 'Ordine'],
    flavorCategories.flatMap((c) =>
      c.flavors.map((f, i) => [f.name, c.name, colorName(f.color), f.tag ?? '', 'true', order(i)])
    )
  )
);

// Gusti selezionabili per le torte (lista separata)
write(
  'gusti-torte.csv',
  csv(
    ['Nome', 'Colore', 'In vetrina', 'Ordine'],
    cakeFlavors.map((f, i) => [f.name, colorName(f.color), 'true', order(i)])
  )
);

// Tipi di torta
write(
  'tipi-torta.csv',
  csv(
    ['Id', 'Nome', 'Descrizione', 'PrezzoBase', 'Immagine', 'Colore', 'In vetrina', 'Ordine'],
    cakeTypes.map((t, i) => [t.id, t.name, t.desc, t.basePrice, t.img, colorName(t.color), 'true', order(i)])
  )
);

// Dimensioni
write(
  'dimensioni.csv',
  csv(
    ['Id', 'Etichetta', 'Diametro', 'Supplemento', 'Popolare', 'In vetrina', 'Ordine'],
    cakeSizes.map((s, i) => [s.id, s.label, s.diameter, s.priceDelta, s.popular ? 'true' : '', 'true', order(i)])
  )
);

// Basi
write(
  'basi.csv',
  csv(
    ['Id', 'Nome', 'Descrizione', 'Supplemento', 'In vetrina', 'Ordine'],
    cakeBases.map((b, i) => [b.id, b.name, b.desc, b.priceDelta, 'true', order(i)])
  )
);

// Decorazioni (topping)
write(
  'decorazioni.csv',
  csv(
    ['Id', 'Nome', 'Descrizione', 'Emoji', 'In vetrina', 'Ordine'],
    cakeDecorations.map((d, i) => [d.id, d.name, d.desc, d.emoji, 'true', order(i)])
  )
);

// Occasioni
write(
  'occasioni.csv',
  csv(
    ['Nome', 'In vetrina', 'Ordine'],
    cakeOccasions.map((o, i) => [o, 'true', order(i)])
  )
);

// Riferimento palette colori (per impostare i colori dei chip in Airtable)
write(
  'colori-palette.csv',
  csv(
    ['Nome colore', 'Codice'],
    PALETTE.map((p) => [p.name, p.hex])
  )
);

console.log('\nFatto. Dati iniziali in src/data/generated/, CSV in airtable-import/.');
