// Lettura "live" dei contenuti da Supabase, a runtime (nel browser).
// Usata dai componenti pubblici per riflettere subito le modifiche della
// dashboard. Restituisce null in caso di problema: il componente tiene i
// dati di sicurezza (fallback) e il sito non si rompe mai.

import { supabase } from '../lib/supabase';
import * as fbCake from './fallback/cakeOptions';

// Gli allergeni restano gestiti da codice (dato tecnico/di sicurezza): li
// sovrapponiamo ai dati live cercandoli nel fallback per nome (gusti) o id.
const allergMap = (arr, key) => Object.fromEntries(arr.map((x) => [x[key], x.allergeni || []]));
const FLAV_ALLERG = allergMap(fbCake.cakeFlavors, 'name');
const BASE_ALLERG = allergMap(fbCake.cakeBases, 'id');
const FILL_ALLERG = allergMap(fbCake.cakeFillings, 'id');
const COV_ALLERG = allergMap(fbCake.cakeCoverings, 'id');
const DECO_ALLERG = allergMap(fbCake.cakeDecorations, 'id');

// Categorie del menu = quelle della lista unica "Gusti e allergeni" (allergeni_prodotti).
const MENU_CATS = [
  { key: 'crema', name: 'Creme' },
  { key: 'golosone', name: 'Golosoni' },
  { key: 'frutta-vegan', name: 'Frutta e Vegan' },
  { key: 'base', name: 'Basi' },
];

export async function fetchMenu() {
  if (!supabase) return null;
  try {
    // Lista unica: la stessa tabella alimenta la carta del gelato e la pagina /allergeni.
    const { data, error } = await supabase
      .from('allergeni_prodotti')
      .select('*')
      .eq('attivo', true)
      .order('ordine');
    if (error || !data) return null;
    const dietOf = (r) => [
      r.vegan && { short: 'VEG', label: 'Vegan' },
      r.senza_glutine && { short: 'SG', label: 'Senza glutine' },
      r.senza_lattosio && { short: 'SL', label: 'Senza lattosio' },
    ].filter(Boolean);
    return MENU_CATS
      .map((c) => ({
        id: c.key,
        name: c.name,
        description: '',
        flavors: data
          .filter((r) => r.categoria === c.key)
          .map((r) => ({
            name: r.gusto,
            color: r.colore || '#f5d97a',
            tag: r.tag ?? null,
            diet: dietOf(r),
          })),
      }))
      .filter((c) => c.flavors.length > 0);
  } catch {
    return null;
  }
}

export async function fetchHours() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('orari').select('*').eq('attivo', true).order('ordine');
    if (error || !data) return null;
    return data.map((o) => ({ day: o.giorno, hours: o.orario })).filter((o) => o.day);
  } catch {
    return null;
  }
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Opzioni del configuratore torte, live da Supabase (forme, tipi, dimensioni,
// gusti torte, basi, farciture, coperture, decorazioni, occasioni).
// Le ricette "Sorprendimi" restano statiche (gestite dal codice).
export async function fetchCakeOptions() {
  if (!supabase) return null;
  try {
    const names = [
      'forme', 'tipi_torta', 'dimensioni', 'gusti_torte', 'basi',
      'farciture', 'coperture', 'decorazioni', 'occasioni',
    ];
    const results = await Promise.all(
      names.map((n) => supabase.from(n).select('*').eq('attivo', true).order('ordine'))
    );
    if (results.some((r) => r.error)) return null;
    const [forme, tipi, dim, gt, basi, farc, cop, dec, occ] = results.map((r) => r.data || []);
    // Allergeni: tabella opzionale. Se manca (o errore) si usa la copia di sicurezza,
    // così il resto del menù non si rompe finché la tabella non viene creata.
    const { data: allerg, error: eAll } = await supabase
      .from('allergeni').select('*').eq('attivo', true).order('ordine');
    const cakeAllergens = (!eAll && allerg && allerg.length)
      ? allerg.map((a) => ({ id: a.id, name: a.nome, emoji: a.emoji || '' }))
      : fbCake.cakeAllergens;
    // Gusti torte: dalla lista unica "Gusti e allergeni" (flag per_torte). Colore e
    // allergeni presi da lì. Fallback ai vecchi gusti_torte finché nessuno è spuntato.
    const { data: apRows } = await supabase
      .from('allergeni_prodotti').select('*').eq('attivo', true).order('ordine');
    const splitLower = (s) => (s || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    // Tipi di crumble: tabella opzionale (come `allergeni`). Se manca — o è vuota —
    // si usa la copia di sicurezza, così il configuratore funziona anche prima
    // della migrazione 2026-07-26-crumble.sql.
    const { data: crumbleRows, error: eCrumble } = await supabase
      .from('crumble').select('*').eq('attivo', true).order('ordine');
    const cakeCrumbles = (!eCrumble && crumbleRows && crumbleRows.length)
      ? crumbleRows.map((c) => ({
        id: c.id,
        name: c.nome,
        desc: c.descrizione || '',
        priceDelta: num(c.supplemento),
        color: c.colore || null,
        allergeni: splitLower(c.allergeni),
      }))
      : fbCake.cakeCrumbles;
    const perTorte = (apRows || []).filter((r) => r.per_torte);
    const cakeFlavors = perTorte.length
      ? perTorte.map((r) => ({ name: r.gusto, color: r.colore || '#f5d97a', allergeni: splitLower(r.allergeni_certi) }))
      : gt.map((f) => ({ name: f.nome, color: f.colore, tags: f.tags || [], allergeni: FLAV_ALLERG[f.nome] || [] }));
    return {
      cakeShapes: forme.map((s) => ({ id: s.id, name: s.nome, desc: s.descrizione || '', emoji: s.emoji || '', priceDelta: num(s.supplemento) })),
      cakeTypes: tipi.map((t) => ({ id: t.id, name: t.nome, desc: t.descrizione || '', basePrice: num(t.prezzo_base), img: t.immagine || '/torte.jpg', color: t.colore, allergeni: splitLower(t.allergeni) })),
      cakeSizes: dim.map((s) => {
        const o = { id: s.id, label: s.etichetta, diameter: num(s.diametro), priceDelta: num(s.supplemento) };
        if (s.popolare) o.popular = true;
        return o;
      }),
      cakeFlavors,
      cakeBases: basi.map((b) => ({ id: b.id, name: b.nome, desc: b.descrizione || '', priceDelta: num(b.supplemento), color: b.colore, allergeni: b.allergeni != null ? splitLower(b.allergeni) : (BASE_ALLERG[b.id] || []) })),
      cakeCrumbles,
      cakeFillings: farc.map((f) => ({ id: f.id, name: f.nome, desc: f.descrizione || '', priceDelta: num(f.supplemento), color: f.colore ?? null, allergeni: f.allergeni != null ? splitLower(f.allergeni) : (FILL_ALLERG[f.id] || []) })),
      cakeCoverings: cop.map((c) => ({ id: c.id, name: c.nome, desc: c.descrizione || '', priceDelta: num(c.supplemento), color: c.colore ?? null, allergeni: c.allergeni != null ? splitLower(c.allergeni) : (COV_ALLERG[c.id] || []) })),
      cakeDecorations: dec.map((d) => ({ id: d.id, name: d.nome, desc: d.descrizione || '', emoji: d.emoji || '', allergeni: d.allergeni != null ? splitLower(d.allergeni) : (DECO_ALLERG[d.id] || []) })),
      cakeOccasions: occ.map((o) => o.nome).filter(Boolean),
      cakeAllergens,
    };
  } catch {
    return null;
  }
}
