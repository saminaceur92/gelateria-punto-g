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
// Colori selezionabili delle decorazioni (colonna `colori`): come per gli allergeni,
// se il dato non c'è ancora si ripiega sulla copia di sicurezza.
const DECO_COLORS = Object.fromEntries(
  (fbCake.cakeDecorations || []).map((d) => [d.id, d.colors || []])
);

// Le tabelle nuove (scritte, extra) potrebbero non essere ancora nella copia di
// sicurezza: qui garantiamo comunque un array, così nessun componente si rompe.
const safeList = (v) => (Array.isArray(v) ? v : []);

// Categorie del menu = quelle della lista unica "Gusti e allergeni" (allergeni_prodotti).
const MENU_CATS = [
  { key: 'crema', name: 'Creme' },
  { key: 'golosone', name: 'Golosoni' },
  { key: 'frutta-vegan', name: 'Frutta e Vegan' },
  { key: 'base', name: 'Basi' },
  { key: 'leccornie', name: 'Altre Leccornie' },
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
            // Descrizione scritta dai titolari, mostrata sotto il nome del gusto.
            desc: r.descrizione || '',
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
// gusti torte, basi, crumble, farciture, coperture, decorazioni, scritte, extra,
// occasioni).
// Le ricette "Sorprendimi" restano statiche (gestite dal codice).
export async function fetchCakeOptions() {
  if (!supabase) return null;
  try {
    const names = [
      'forme', 'tipi_torta', 'dimensioni', 'basi',
      'farciture', 'coperture', 'decorazioni', 'occasioni',
    ];
    const results = await Promise.all(
      names.map((n) => supabase.from(n).select('*').eq('attivo', true).order('ordine'))
    );
    if (results.some((r) => r.error)) return null;
    const [forme, tipi, dim, basi, farc, cop, dec, occ] = results.map((r) => r.data || []);
    // `gusti_torte` è la vecchia tabella dei gusti torta, sostituita dalla lista
    // unica `allergeni_prodotti` (flag "per torte"). Serve solo come ripiego finché
    // nessun gusto è spuntato, quindi la leggiamo a parte: se un giorno viene
    // eliminata NON deve far fallire tutto il configuratore.
    const { data: gtRows } = await supabase
      .from('gusti_torte').select('*').eq('attivo', true).order('ordine');
    const gt = gtRows || [];
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
    // Come splitLower ma senza minuscolizzare: per i colori delle decorazioni, che
    // sono etichette da mostrare così come sono ("Rosa", "Arcobaleno", ...).
    const splitList = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);
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
    // Scritte ed extra: tabelle NUOVE, entrambe opzionali (stesso pattern di
    // `crumble`). Le leggiamo insieme e, se mancano o sono vuote, si usa la copia
    // di sicurezza: il sito funziona anche PRIMA che la migrazione venga eseguita.
    const [rScritte, rExtra] = await Promise.all([
      supabase.from('scritte').select('*').eq('attivo', true).order('ordine'),
      supabase.from('extra').select('*').eq('attivo', true).order('ordine'),
    ]);
    const cakeScritte = (!rScritte.error && rScritte.data && rScritte.data.length)
      ? rScritte.data.map((s) => ({
        id: s.id,
        name: s.nome,
        family: s.font_family || '',
        sample: s.esempio || '',
        uppercase: !!s.maiuscolo,
        italic: !!s.corsivo,
      }))
      : safeList(fbCake.cakeScritte);
    // `step` = incremento della quantità: il salame si vende al kg (mezzo kg alla
    // volta), i cabaret a pezzo intero. Se la colonna non c'è lo deduciamo dall'unità.
    const cakeExtras = (!rExtra.error && rExtra.data && rExtra.data.length)
      ? rExtra.data.map((e) => ({
        id: e.id,
        name: e.nome,
        desc: e.descrizione || '',
        price: num(e.prezzo),
        unit: e.unita || '',
        allergeni: splitLower(e.allergeni),
        step: num(e.passo ?? e.step) || (/kg/i.test(e.unita || '') ? 0.5 : 1),
      }))
      : safeList(fbCake.cakeExtras);
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
      // Le colonne `supplemento`, `scelta_colore` e `colori` sono nuove: se non
      // esistono ancora si ottengono 0 / false / lista dal fallback, mai un errore.
      cakeDecorations: dec.map((d) => ({
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
      cakeOccasions: occ.map((o) => o.nome).filter(Boolean),
      cakeAllergens,
    };
  } catch {
    return null;
  }
}
