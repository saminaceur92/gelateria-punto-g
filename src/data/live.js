// Lettura "live" dei contenuti da Supabase, a runtime (nel browser).
// Usata dai componenti pubblici per riflettere subito le modifiche della
// dashboard. Restituisce null in caso di problema: il componente tiene i
// dati di sicurezza (fallback) e il sito non si rompe mai.

import { supabase } from '../lib/supabase';

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
