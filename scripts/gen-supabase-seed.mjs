// Genera il seed SQL per Supabase a partire dai dati di sicurezza (src/data/fallback/).
// Produce src/data/generated/supabase-seed.sql (INSERT per tutte le tabelle dei contenuti).
//   npm run seed:supabase

import { writeFileSync } from 'node:fs';
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
} from '../src/data/fallback/cakeOptions.js';
import { openingHours } from '../src/data/fallback/hours.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outFile = resolve(__dirname, '..', 'src/data/generated/supabase-seed.sql');

const order = (i) => (i + 1) * 10;

// ── helper SQL ──
const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const b = (v) => (v ? 'true' : 'false');
const arr = (a) =>
  a && a.length ? `'{${a.map((x) => `"${String(x).replace(/"/g, '\\"')}"`).join(',')}}'` : `'{}'`;

const rows = (table, cols, data) => {
  if (!data.length) return '';
  const values = data.map((r) => `  (${cols.map((c) => r[c]).join(', ')})`).join(',\n');
  return `insert into ${table} (${cols.map((c) => c.replace(/:.*/, '')).join(', ')}) values\n${values};\n\n`;
};

let sql = '-- Seed contenuti Gelateria Punto Gi (generato da scripts/gen-supabase-seed.mjs)\n';
sql += '-- Esecuzione idempotente: svuota e ricarica le tabelle dei contenuti.\n';
sql += 'truncate categorie, gusti, gusti_torte, tipi_torta, dimensioni, forme, basi, farciture, coperture, decorazioni, occasioni, orari restart identity cascade;\n\n';

// categorie
sql += rows('categorie', ['id', 'nome', 'descrizione', 'attivo', 'ordine'],
  flavorCategories.map((c, i) => ({ id: q(c.id), nome: q(c.name), descrizione: q(c.description), attivo: 'true', ordine: order(i) })));

// gusti (menu)
sql += rows('gusti', ['nome', 'categoria_id', 'colore', 'tag', 'attivo', 'ordine'],
  flavorCategories.flatMap((c) =>
    c.flavors.map((f, i) => ({ nome: q(f.name), categoria_id: q(c.id), colore: q(f.color), tag: q(f.tag ?? null), attivo: 'true', ordine: order(i) }))));

// gusti_torte
sql += rows('gusti_torte', ['nome', 'colore', 'tags', 'attivo', 'ordine'],
  cakeFlavors.map((f, i) => ({ nome: q(f.name), colore: q(f.color), tags: arr(f.tags), attivo: 'true', ordine: order(i) })));

// tipi_torta
sql += rows('tipi_torta', ['id', 'nome', 'descrizione', 'prezzo_base', 'immagine', 'colore', 'attivo', 'ordine'],
  cakeTypes.map((t, i) => ({ id: q(t.id), nome: q(t.name), descrizione: q(t.desc), prezzo_base: n(t.basePrice), immagine: q(t.img), colore: q(t.color), attivo: 'true', ordine: order(i) })));

// dimensioni
sql += rows('dimensioni', ['id', 'etichetta', 'diametro', 'supplemento', 'popolare', 'attivo', 'ordine'],
  cakeSizes.map((s, i) => ({ id: q(s.id), etichetta: q(s.label), diametro: n(s.diameter), supplemento: n(s.priceDelta), popolare: b(s.popular), attivo: 'true', ordine: order(i) })));

// forme
sql += rows('forme', ['id', 'nome', 'descrizione', 'emoji', 'supplemento', 'attivo', 'ordine'],
  cakeShapes.map((s, i) => ({ id: q(s.id), nome: q(s.name), descrizione: q(s.desc), emoji: q(s.emoji), supplemento: n(s.priceDelta), attivo: 'true', ordine: order(i) })));

// basi
sql += rows('basi', ['id', 'nome', 'descrizione', 'supplemento', 'colore', 'attivo', 'ordine'],
  cakeBases.map((x, i) => ({ id: q(x.id), nome: q(x.name), descrizione: q(x.desc), supplemento: n(x.priceDelta), colore: q(x.color), attivo: 'true', ordine: order(i) })));

// farciture
sql += rows('farciture', ['id', 'nome', 'descrizione', 'supplemento', 'colore', 'attivo', 'ordine'],
  cakeFillings.map((x, i) => ({ id: q(x.id), nome: q(x.name), descrizione: q(x.desc), supplemento: n(x.priceDelta), colore: q(x.color), attivo: 'true', ordine: order(i) })));

// coperture
sql += rows('coperture', ['id', 'nome', 'descrizione', 'supplemento', 'colore', 'attivo', 'ordine'],
  cakeCoverings.map((x, i) => ({ id: q(x.id), nome: q(x.name), descrizione: q(x.desc), supplemento: n(x.priceDelta), colore: q(x.color), attivo: 'true', ordine: order(i) })));

// decorazioni
sql += rows('decorazioni', ['id', 'nome', 'descrizione', 'emoji', 'attivo', 'ordine'],
  cakeDecorations.map((d, i) => ({ id: q(d.id), nome: q(d.name), descrizione: q(d.desc), emoji: q(d.emoji), attivo: 'true', ordine: order(i) })));

// occasioni
sql += rows('occasioni', ['nome', 'attivo', 'ordine'],
  cakeOccasions.map((o, i) => ({ nome: q(o), attivo: 'true', ordine: order(i) })));

// orari
sql += rows('orari', ['giorno', 'orario', 'attivo', 'ordine'],
  openingHours.map((o, i) => ({ giorno: q(o.day), orario: q(o.hours), attivo: 'true', ordine: order(i) })));

writeFileSync(outFile, sql);
console.log('Seed SQL scritto in src/data/generated/supabase-seed.sql (' + sql.length + ' caratteri)');
