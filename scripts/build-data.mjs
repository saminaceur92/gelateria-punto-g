// Scarica i dati da Airtable in fase di build e li salva in src/data/generated/.
// Viene lanciato automaticamente da "npm run build" (prima di Vite).
//
// Comportamento a prova di guasto:
//  - se mancano le credenziali (AIRTABLE_TOKEN / AIRTABLE_BASE_ID) NON fa nulla
//    ed esce con successo: il sito usa i dati già presenti (generati o di sicurezza).
//  - se Airtable risponde con un errore, lo segnala ma NON blocca la build:
//    restano validi gli ultimi dati salvati. Il sito non resta mai senza menù.

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { resolveColor } from './palette.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const genDir = resolve(__dirname, '..', 'src/data/generated');

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

// Nomi delle tabelle in Airtable (devono coincidere con quelli del tuo base)
const T = {
  categorie: 'Categorie',
  gusti: 'Gusti',
  gustiTorte: 'Gusti Torte',
  tipiTorta: 'Tipi Torta',
  dimensioni: 'Dimensioni',
  forme: 'Forme',
  basi: 'Basi',
  farciture: 'Farciture',
  coperture: 'Coperture',
  decorazioni: 'Decorazioni',
  occasioni: 'Occasioni',
};

const DEFAULT_COLOR = '#d9b384';
const ALLOWED_TAGS = new Set(['firma', 'vegan', 'stagione']);

if (!TOKEN || !BASE_ID) {
  console.log('[build-data] AIRTABLE_TOKEN/AIRTABLE_BASE_ID non impostati: uso i dati esistenti (nessuna sincronizzazione).');
  process.exit(0);
}

// ─────────── helper ───────────

// Scarica una tabella. È resiliente: se la tabella non esiste ancora o dà errore,
// segnala un avviso e restituisce [] (così quella sezione usa il fallback statico)
// senza far fallire l'intera sincronizzazione (es. il menù resta aggiornato).
async function fetchTable(table) {
  try {
    const records = [];
    let offset;
    do {
      const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}`);
      url.searchParams.set('pageSize', '100');
      if (offset) url.searchParams.set('offset', offset);
      const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
      if (!res.ok) {
        console.warn(`[build-data] Tabella "${table}": HTTP ${res.status} ${res.statusText} — la salto (uso il fallback).`);
        return [];
      }
      const data = await res.json();
      records.push(...data.records.map((r) => r.fields || {}));
      offset = data.offset;
    } while (offset);
    return records;
  } catch (e) {
    console.warn(`[build-data] Tabella "${table}" non raggiungibile: ${e.message} — la salto (uso il fallback).`);
    return [];
  }
}

const truthy = (v) => v === true || v === 'true' || v === 1;
// Il campo si chiama "In vetrina" in Airtable (accetta anche "Attivo" per compatibilità).
const isActive = (f) => truthy(f['In vetrina']) || truthy(f.Attivo);
const byOrder = (a, b) => (num(a.Ordine, 1e9) - num(b.Ordine, 1e9));

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// Accetta un nome di palette (es. "Pistacchio") o un codice esadecimale.
function color(v) {
  return resolveColor(v) || DEFAULT_COLOR;
}

// Come color() ma può restituire null (per farciture/coperture senza colore, es. "Naked").
function colorNullable(v) {
  return resolveColor(v);
}

function tag(v) {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return ALLOWED_TAGS.has(s) ? s : null;
}

// Tag multipli dei gusti torta (campo multi-select di Airtable -> array di stringhe).
function tagsList(v) {
  const arr = Array.isArray(v)
    ? v
    : typeof v === 'string' && v.trim()
    ? v.split(',')
    : [];
  return arr.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
}

function slug(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // toglie gli accenti
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function text(v) {
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v);
}

// Un campo immagine può essere un allegato Airtable (array) o un testo (URL/percorso).
// Per gli allegati preferiamo la miniatura "large" già ridimensionata da Airtable:
// così le foto caricate dal telefono (anche da molti MB) restano leggere sul sito.
function image(v, fallbackImg) {
  if (Array.isArray(v) && v[0]) {
    const att = v[0];
    return att.thumbnails?.large?.url || att.url || fallbackImg;
  }
  const s = text(v);
  return s || fallbackImg;
}

// ─────────── main ───────────

try {
  const [
    categorie,
    gusti,
    gustiTorte,
    tipiTorta,
    dimensioni,
    forme,
    basi,
    farciture,
    coperture,
    decorazioni,
    occasioni,
  ] = await Promise.all([
    fetchTable(T.categorie),
    fetchTable(T.gusti),
    fetchTable(T.gustiTorte),
    fetchTable(T.tipiTorta),
    fetchTable(T.dimensioni),
    fetchTable(T.forme),
    fetchTable(T.basi),
    fetchTable(T.farciture),
    fetchTable(T.coperture),
    fetchTable(T.decorazioni),
    fetchTable(T.occasioni),
  ]);

  // MENU: ricostruisce le categorie con dentro i gusti attivi
  const activeGusti = gusti.filter(isActive).sort(byOrder);
  const menu = categorie
    .filter(isActive)
    .sort(byOrder)
    .map((c) => ({
      id: text(c.Id) || slug(c.Nome),
      name: text(c.Nome),
      description: text(c.Descrizione),
      flavors: activeGusti
        .filter((f) => text(f.Categoria) === text(c.Nome))
        .map((f) => ({ name: text(f.Nome), color: color(f.Colore), tag: tag(f.Tag) })),
    }))
    .filter((c) => c.flavors.length > 0); // niente sezioni vuote nel menù

  const cake = {
    cakeShapes: forme.filter(isActive).sort(byOrder).map((s) => ({
      id: text(s.Id) || slug(s.Nome),
      name: text(s.Nome),
      desc: text(s.Descrizione),
      emoji: text(s.Emoji),
      priceDelta: num(s.Supplemento),
    })),
    cakeTypes: tipiTorta.filter(isActive).sort(byOrder).map((t) => ({
      id: text(t.Id) || slug(t.Nome),
      name: text(t.Nome),
      desc: text(t.Descrizione),
      basePrice: num(t.PrezzoBase),
      img: image(t.Immagine, '/torte.jpg'),
      color: color(t.Colore),
    })),
    cakeSizes: dimensioni.filter(isActive).sort(byOrder).map((s) => {
      const o = {
        id: text(s.Id) || slug(s.Etichetta),
        label: text(s.Etichetta),
        diameter: num(s.Diametro),
        priceDelta: num(s.Supplemento),
      };
      if (truthy(s.Popolare)) o.popular = true;
      return o;
    }),
    cakeFlavors: gustiTorte.filter(isActive).sort(byOrder).map((f) => ({
      name: text(f.Nome),
      color: color(f.Colore),
      tags: tagsList(f.Tag),
    })),
    cakeBases: basi.filter(isActive).sort(byOrder).map((b) => ({
      id: text(b.Id) || slug(b.Nome),
      name: text(b.Nome),
      desc: text(b.Descrizione),
      priceDelta: num(b.Supplemento),
      color: color(b.Colore),
    })),
    cakeFillings: farciture.filter(isActive).sort(byOrder).map((f) => ({
      id: text(f.Id) || slug(f.Nome),
      name: text(f.Nome),
      desc: text(f.Descrizione),
      priceDelta: num(f.Supplemento),
      color: colorNullable(f.Colore),
    })),
    cakeCoverings: coperture.filter(isActive).sort(byOrder).map((c) => ({
      id: text(c.Id) || slug(c.Nome),
      name: text(c.Nome),
      desc: text(c.Descrizione),
      priceDelta: num(c.Supplemento),
      color: colorNullable(c.Colore),
    })),
    cakeDecorations: decorazioni.filter(isActive).sort(byOrder).map((d) => ({
      id: text(d.Id) || slug(d.Nome),
      name: text(d.Nome),
      desc: text(d.Descrizione),
      emoji: text(d.Emoji),
    })),
    cakeOccasions: occasioni.filter(isActive).sort(byOrder).map((o) => text(o.Nome)).filter(Boolean),
  };

  mkdirSync(genDir, { recursive: true });

  // Salva il menù solo se valido (almeno una categoria con gusti),
  // altrimenti lascia intatti gli ultimi dati buoni.
  if (menu.length > 0) {
    writeFileSync(resolve(genDir, 'menu.json'), JSON.stringify(menu, null, 2) + '\n');
    console.log(`[build-data] Menù aggiornato: ${menu.length} categorie, ${menu.reduce((n, c) => n + c.flavors.length, 0)} gusti.`);
  } else {
    console.warn('[build-data] Nessun gusto attivo trovato: mantengo i dati precedenti del menù.');
  }

  writeFileSync(resolve(genDir, 'cake.json'), JSON.stringify(cake, null, 2) + '\n');
  console.log(`[build-data] Torte aggiornate: ${cake.cakeTypes.length} tipi, ${cake.cakeFlavors.length} gusti, ${cake.cakeBases.length} basi, ${cake.cakeDecorations.length} decorazioni.`);
  console.log('[build-data] Sincronizzazione da Airtable completata.');
} catch (err) {
  console.warn('[build-data] Sincronizzazione da Airtable FALLITA, uso i dati precedenti. Dettaglio:', err.message);
  process.exit(0); // non blocca la build: il sito resta online con gli ultimi dati validi
}
