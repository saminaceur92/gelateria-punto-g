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

export async function fetchMenu() {
  if (!supabase) return null;
  try {
    const [{ data: cats, error: e1 }, { data: gusti, error: e2 }] = await Promise.all([
      supabase.from('categorie').select('*').eq('attivo', true).order('ordine'),
      supabase.from('gusti').select('*').eq('attivo', true).order('ordine'),
    ]);
    if (e1 || e2 || !cats || !gusti) return null;
    return cats
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
    return {
      cakeShapes: forme.map((s) => ({ id: s.id, name: s.nome, desc: s.descrizione || '', emoji: s.emoji || '', priceDelta: num(s.supplemento) })),
      cakeTypes: tipi.map((t) => ({ id: t.id, name: t.nome, desc: t.descrizione || '', basePrice: num(t.prezzo_base), img: t.immagine || '/torte.jpg', color: t.colore })),
      cakeSizes: dim.map((s) => {
        const o = { id: s.id, label: s.etichetta, diameter: num(s.diametro), priceDelta: num(s.supplemento) };
        if (s.popolare) o.popular = true;
        return o;
      }),
      cakeFlavors: gt.map((f) => ({ name: f.nome, color: f.colore, tags: f.tags || [], allergeni: FLAV_ALLERG[f.nome] || [] })),
      cakeBases: basi.map((b) => ({ id: b.id, name: b.nome, desc: b.descrizione || '', priceDelta: num(b.supplemento), color: b.colore, allergeni: BASE_ALLERG[b.id] || [] })),
      cakeFillings: farc.map((f) => ({ id: f.id, name: f.nome, desc: f.descrizione || '', priceDelta: num(f.supplemento), color: f.colore ?? null, allergeni: FILL_ALLERG[f.id] || [] })),
      cakeCoverings: cop.map((c) => ({ id: c.id, name: c.nome, desc: c.descrizione || '', priceDelta: num(c.supplemento), color: c.colore ?? null, allergeni: COV_ALLERG[c.id] || [] })),
      cakeDecorations: dec.map((d) => ({ id: d.id, name: d.nome, desc: d.descrizione || '', emoji: d.emoji || '' })),
      cakeOccasions: occ.map((o) => o.nome).filter(Boolean),
      cakeAllergens,
    };
  } catch {
    return null;
  }
}
