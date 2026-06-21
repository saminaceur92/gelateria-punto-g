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
  cakeShapes,
  cakeTypes,
  cakeSizes,
  cakeFlavors,
  cakeBases,
  cakeFillings,
  cakeCoverings,
  cakeDecorations,
  cakeOccasions,
  cakeRecipes,
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

// Nota: cakeRecipes ("Sorprendimi") resta gestito da codice (presets fragili che
// referenziano gli altri elementi) e quindi NON va in Airtable; il loader lo prende
// sempre dal fallback. Per questo non lo includiamo qui in cake.json.
const cake = {
  cakeShapes,
  cakeTypes,
  cakeSizes,
  cakeFlavors,
  cakeBases,
  cakeFillings,
  cakeCoverings,
  cakeDecorations,
  cakeOccasions,
};

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
// Tag = multi-select (gelato/semifreddo/sorbetto/vegano/sg); più valori separati da virgola
write(
  'gusti-torte.csv',
  csv(
    ['Nome', 'Colore', 'Tag', 'In vetrina', 'Ordine'],
    cakeFlavors.map((f, i) => [f.name, colorName(f.color), (f.tags || []).join(', '), 'true', order(i)])
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

// Forme (legate al rendering 3D: l'Id non va cambiato)
write(
  'forme.csv',
  csv(
    ['Id', 'Nome', 'Descrizione', 'Emoji', 'Supplemento', 'In vetrina', 'Ordine'],
    cakeShapes.map((s, i) => [s.id, s.name, s.desc, s.emoji, s.priceDelta, 'true', order(i)])
  )
);

// Basi — Colore (codice esadecimale) usato per la torta 3D
write(
  'basi.csv',
  csv(
    ['Id', 'Nome', 'Descrizione', 'Supplemento', 'Colore', 'In vetrina', 'Ordine'],
    cakeBases.map((b, i) => [b.id, b.name, b.desc, b.priceDelta, colorName(b.color), 'true', order(i)])
  )
);

// Farciture
write(
  'farciture.csv',
  csv(
    ['Id', 'Nome', 'Descrizione', 'Supplemento', 'Colore', 'In vetrina', 'Ordine'],
    cakeFillings.map((f, i) => [f.id, f.name, f.desc, f.priceDelta, colorName(f.color), 'true', order(i)])
  )
);

// Coperture (legate al rendering 3D: l'Id non va cambiato)
write(
  'coperture.csv',
  csv(
    ['Id', 'Nome', 'Descrizione', 'Supplemento', 'Colore', 'In vetrina', 'Ordine'],
    cakeCoverings.map((c, i) => [c.id, c.name, c.desc, c.priceDelta, colorName(c.color), 'true', order(i)])
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
