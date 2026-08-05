// Scarica i contenuti da Supabase in fase di build e li salva in src/data/generated/.
// Viene lanciato automaticamente da "npm run build" (prima di Vite).
//
// Deve restare allineato a src/data/live.js: i due file producono la STESSA forma
// di dati (stesse chiavi, stessi campi). Se cambia uno, cambia anche l'altro,
// altrimenti il sito mostra prezzi diversi prima e dopo il caricamento live.
//
// Comportamento a prova di guasto:
//  - se mancano le variabili (VITE_SUPABASE_URL / VITE_SUPABASE_KEY) NON fa nulla
//    ed esce con successo: il sito usa i dati già presenti (generati o di sicurezza).
//  - se una tabella dà errore, la salta e usa il fallback statico per quella sezione,
//    senza bloccare il resto. Il sito non resta mai senza contenuti.

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import * as fbCake from '../src/data/fallback/cakeOptions.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const genDir = resolve(__dirname, '..', 'src/data/generated');

// Allergeni e colori di sicurezza: usati solo se la colonna corrispondente non
// esiste ancora su Supabase (migrazione non ancora eseguita).
const allergMap = (arr, key) => Object.fromEntries(arr.map((x) => [x[key], x.allergeni || []]));
const FLAV_ALLERG = allergMap(fbCake.cakeFlavors, 'name');
const BASE_ALLERG = allergMap(fbCake.cakeBases, 'id');
const FILL_ALLERG = allergMap(fbCake.cakeFillings, 'id');
const COV_ALLERG = allergMap(fbCake.cakeCoverings, 'id');
const DECO_ALLERG = allergMap(fbCake.cakeDecorations, 'id');
const DECO_COLORS = Object.fromEntries(
  (fbCake.cakeDecorations || []).map((d) => [d.id, d.colors || []])
);

// Categorie della carta del gelato: stesse (e nello stesso ordine) di live.js.
const MENU_CATS = [
  { key: 'crema', name: 'Creme' },
  { key: 'golosone', name: 'Golosoni' },
  { key: 'frutta-vegan', name: 'Frutta e Vegan' },
  { key: 'base', name: 'Basi' },
  { key: 'leccornie', name: 'Altre Leccornie' },
];

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.log('[build-data] VITE_SUPABASE_URL/KEY non impostati: uso i dati esistenti (nessuna sincronizzazione).');
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const splitLower = (s) => (s || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
// Come splitLower ma senza minuscolizzare: i colori sono etichette da mostrare
// così come sono ("Rosa", "Arcobaleno", ...).
const splitList = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);

// Legge una tabella (solo righe attive, ordinate). Resiliente: in caso di errore
// restituisce [] così quella sezione usa il fallback statico.
async function table(name) {
  const { data, error } = await supabase
    .from(name)
    .select('*')
    .eq('attivo', true)
    .order('ordine', { ascending: true });
  if (error) {
    console.warn(`[build-data] Tabella "${name}": ${error.message} — la salto (uso il fallback).`);
    return [];
  }
  return data || [];
}

// Come sopra, ma per le tabelle che potrebbero non esistere ancora (create da una
// migrazione non ancora eseguita): se mancano o sono vuote si usa il fallback.
async function optionalTable(name, fallbackList, map) {
  const rows = await table(name);
  if (!rows.length) return Array.isArray(fallbackList) ? fallbackList : [];
  return rows.map(map);
}

try {
  const [
    prodotti,
    gustiTorte,
    tipiTorta,
    dimensioni,
    forme,
    basi,
    farciture,
    coperture,
    decorazioni,
    occasioni,
    allergeni,
    orari,
  ] = await Promise.all(
    [
      'allergeni_prodotti',
      'gusti_torte',
      'tipi_torta',
      'dimensioni',
      'forme',
      'basi',
      'farciture',
      'coperture',
      'decorazioni',
      'occasioni',
      'allergeni',
      'orari',
    ].map(table)
  );

  // Tabelle opzionali: crumble (dal 26-07), scritte ed extra (dal 04-08).
  const cakeCrumbles = await optionalTable('crumble', fbCake.cakeCrumbles, (c) => ({
    id: c.id,
    name: c.nome,
    desc: c.descrizione || '',
    priceDelta: num(c.supplemento),
    color: c.colore || null,
    allergeni: splitLower(c.allergeni),
  }));
  const cakeScritte = await optionalTable('scritte', fbCake.cakeScritte, (s) => ({
    id: s.id,
    name: s.nome,
    family: s.font_family || '',
    sample: s.esempio || '',
    uppercase: !!s.maiuscolo,
    italic: !!s.corsivo,
  }));
  const cakeExtras = await optionalTable('extra', fbCake.cakeExtras, (e) => ({
    id: e.id,
    name: e.nome,
    desc: e.descrizione || '',
    price: num(e.prezzo),
    unit: e.unita || '',
    allergeni: splitLower(e.allergeni),
    step: num(e.passo ?? e.step) || (/kg/i.test(e.unita || '') ? 0.5 : 1),
  }));

  mkdirSync(genDir, { recursive: true });

  // ── MENU ──
  // Come live.js: la carta del gelato esce dalla lista unica "Gusti e allergeni".
  const dietOf = (r) => [
    r.vegan && { short: 'VEG', label: 'Vegan' },
    r.senza_glutine && { short: 'SG', label: 'Senza glutine' },
    r.senza_lattosio && { short: 'SL', label: 'Senza lattosio' },
  ].filter(Boolean);

  const menu = MENU_CATS
    .map((c) => ({
      id: c.key,
      name: c.name,
      description: '',
      flavors: prodotti
        .filter((r) => r.categoria === c.key)
        .map((r) => ({
          name: r.gusto,
          desc: r.descrizione || '',
          color: r.colore || '#f5d97a',
          tag: r.tag ?? null,
          diet: dietOf(r),
        })),
    }))
    .filter((c) => c.flavors.length > 0);

  if (menu.length > 0) {
    writeFileSync(resolve(genDir, 'menu.json'), JSON.stringify(menu, null, 2) + '\n');
    console.log(`[build-data] Menù aggiornato: ${menu.length} categorie, ${menu.reduce((n, c) => n + c.flavors.length, 0)} gusti.`);
  } else {
    console.warn('[build-data] Nessun gusto attivo: mantengo i dati precedenti del menù.');
  }

  // ── TORTE ──
  // Gusti selezionabili per le torte: quelli spuntati "per torte" nella lista unica.
  // Finché nessuno è spuntato si ripiega sulla vecchia tabella `gusti_torte`.
  const perTorte = prodotti.filter((r) => r.per_torte);
  const cakeFlavors = perTorte.length
    ? perTorte.map((r) => ({
      name: r.gusto,
      color: r.colore || '#f5d97a',
      allergeni: splitLower(r.allergeni_certi),
    }))
    : gustiTorte.map((f) => ({
      name: f.nome,
      color: f.colore,
      allergeni: FLAV_ALLERG[f.nome] || [],
    }));

  const cake = {
    cakeShapes: forme.map((s) => ({
      id: s.id, name: s.nome, desc: s.descrizione || '', emoji: s.emoji || '', priceDelta: num(s.supplemento),
    })),
    cakeTypes: tipiTorta.map((t) => ({
      id: t.id, name: t.nome, desc: t.descrizione || '', basePrice: num(t.prezzo_base), img: t.immagine || '/torte.jpg', color: t.colore, allergeni: splitLower(t.allergeni),
    })),
    cakeSizes: dimensioni.map((s) => {
      const o = { id: s.id, label: s.etichetta, diameter: num(s.diametro), priceDelta: num(s.supplemento) };
      if (s.popolare) o.popular = true;
      return o;
    }),
    cakeFlavors,
    cakeBases: basi.map((b) => ({
      id: b.id, name: b.nome, desc: b.descrizione || '', priceDelta: num(b.supplemento), color: b.colore, allergeni: b.allergeni != null ? splitLower(b.allergeni) : (BASE_ALLERG[b.id] || []),
    })),
    cakeCrumbles,
    cakeFillings: farciture.map((f) => ({
      id: f.id, name: f.nome, desc: f.descrizione || '', priceDelta: num(f.supplemento), color: f.colore ?? null, allergeni: f.allergeni != null ? splitLower(f.allergeni) : (FILL_ALLERG[f.id] || []),
    })),
    cakeCoverings: coperture.map((c) => ({
      id: c.id, name: c.nome, desc: c.descrizione || '', priceDelta: num(c.supplemento), color: c.colore ?? null, allergeni: c.allergeni != null ? splitLower(c.allergeni) : (COV_ALLERG[c.id] || []),
    })),
    // `supplemento`, `scelta_colore` e `colori` arrivano con la migrazione del 04-08:
    // finché non c'è si ottengono 0 / false / lista di sicurezza, mai un errore.
    cakeDecorations: decorazioni.map((d) => ({
      id: d.id,
      name: d.nome,
      desc: d.descrizione || '',
      emoji: d.emoji || '',
      priceDelta: num(d.supplemento),
      allergeni: d.allergeni != null ? splitLower(d.allergeni) : (DECO_ALLERG[d.id] || []),
      colorChoice: !!d.scelta_colore,
      colors: d.colori != null ? splitList(d.colori) : (DECO_COLORS[d.id] || []),
    })),
    cakeScritte,
    cakeExtras,
    cakeOccasions: occasioni.map((o) => o.nome).filter(Boolean),
    cakeAllergens: allergeni.length
      ? allergeni.map((a) => ({ id: a.id, name: a.nome, emoji: a.emoji || '' }))
      : fbCake.cakeAllergens,
  };
  writeFileSync(resolve(genDir, 'cake.json'), JSON.stringify(cake, null, 2) + '\n');
  console.log(`[build-data] Torte aggiornate: ${cake.cakeTypes.length} tipi, ${cake.cakeFlavors.length} gusti, ${cake.cakeBases.length} basi, ${cake.cakeCrumbles.length} crumble, ${cake.cakeDecorations.length} decorazioni, ${cake.cakeScritte.length} scritte, ${cake.cakeExtras.length} extra.`);

  // ── ORARI ──
  const openingHours = orari.map((o) => ({ day: o.giorno, hours: o.orario })).filter((o) => o.day);
  if (openingHours.length > 0) {
    writeFileSync(resolve(genDir, 'hours.json'), JSON.stringify({ openingHours }, null, 2) + '\n');
    console.log(`[build-data] Orari aggiornati: ${openingHours.length} giorni.`);
  } else {
    console.warn('[build-data] Nessun orario attivo: mantengo i dati precedenti degli orari.');
  }

  console.log('[build-data] Sincronizzazione da Supabase completata.');
} catch (err) {
  console.warn('[build-data] Sincronizzazione da Supabase FALLITA, uso i dati precedenti. Dettaglio:', err.message);
  process.exit(0);
}
