// Scarica i contenuti da Supabase in fase di build e li salva in src/data/generated/.
// Viene lanciato automaticamente da "npm run build" (prima di Vite).
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const genDir = resolve(__dirname, '..', 'src/data/generated');

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
    orari,
  ] = await Promise.all(
    [
      'categorie',
      'gusti',
      'gusti_torte',
      'tipi_torta',
      'dimensioni',
      'forme',
      'basi',
      'farciture',
      'coperture',
      'decorazioni',
      'occasioni',
      'orari',
    ].map(table)
  );

  mkdirSync(genDir, { recursive: true });

  // ── MENU ──
  const menu = categorie
    .map((c) => ({
      id: c.id,
      name: c.nome,
      description: c.descrizione || '',
      flavors: gusti
        .filter((g) => g.categoria_id === c.id)
        .map((g) => ({
          name: g.nome,
          color: g.colore,
          tag: g.tag ?? null,
          diet: [
            g.vegan && { short: 'VEG', label: 'Vegan' },
            g.senza_glutine && { short: 'SG', label: 'Senza glutine' },
            g.senza_lattosio && { short: 'SL', label: 'Senza lattosio' },
          ].filter(Boolean),
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
  const cake = {
    cakeShapes: forme.map((s) => ({
      id: s.id, name: s.nome, desc: s.descrizione || '', emoji: s.emoji || '', priceDelta: num(s.supplemento),
    })),
    cakeTypes: tipiTorta.map((t) => ({
      id: t.id, name: t.nome, desc: t.descrizione || '', basePrice: num(t.prezzo_base), img: t.immagine || '/torte.jpg', color: t.colore,
    })),
    cakeSizes: dimensioni.map((s) => {
      const o = { id: s.id, label: s.etichetta, diameter: num(s.diametro), priceDelta: num(s.supplemento) };
      if (s.popolare) o.popular = true;
      return o;
    }),
    cakeFlavors: gustiTorte.map((f) => ({ name: f.nome, color: f.colore, tags: f.tags || [] })),
    cakeBases: basi.map((b) => ({
      id: b.id, name: b.nome, desc: b.descrizione || '', priceDelta: num(b.supplemento), color: b.colore,
    })),
    cakeFillings: farciture.map((f) => ({
      id: f.id, name: f.nome, desc: f.descrizione || '', priceDelta: num(f.supplemento), color: f.colore ?? null,
    })),
    cakeCoverings: coperture.map((c) => ({
      id: c.id, name: c.nome, desc: c.descrizione || '', priceDelta: num(c.supplemento), color: c.colore ?? null,
    })),
    cakeDecorations: decorazioni.map((d) => ({
      id: d.id, name: d.nome, desc: d.descrizione || '', emoji: d.emoji || '',
    })),
    cakeOccasions: occasioni.map((o) => o.nome).filter(Boolean),
  };
  writeFileSync(resolve(genDir, 'cake.json'), JSON.stringify(cake, null, 2) + '\n');
  console.log(`[build-data] Torte aggiornate: ${cake.cakeTypes.length} tipi, ${cake.cakeFlavors.length} gusti, ${cake.cakeBases.length} basi, ${cake.cakeDecorations.length} decorazioni.`);

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
