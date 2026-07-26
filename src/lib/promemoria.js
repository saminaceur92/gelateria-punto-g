import { supabase } from './supabase';

/**
 * Promemoria compleanno: un anno dopo un ordine con occasione "Compleanno"
 * il cliente riceve due mail (30 e 14 giorni prima) con la torta di allora e
 * il link per rifarla. Coda + invio stanno su Supabase (vedi
 * migrations/2026-07-26-promemoria-compleanno.sql): qui ci sono solo le
 * chiamate lato browser. Tutto best-effort: se qualcosa non va, il sito
 * prosegue come se la funzione non esistesse.
 */

/** Configurazione della torta dell'anno scorso, dal token del link nella mail. */
export async function tortaDaToken(token) {
  if (!supabase || !token) return null;
  try {
    const { data, error } = await supabase.rpc('torta_da_token', { p_token: token });
    if (error || !data || !data.config) return null;
    return data; // { nome, config }
  } catch {
    return null;
  }
}

/** Disiscrizione dal link "non voglio più questi promemoria". */
export async function stopPromemoria(token) {
  if (!supabase || !token) return false;
  try {
    const { data, error } = await supabase.rpc('stop_promemoria', { p_token: token });
    return !error && data === true;
  } catch {
    return false;
  }
}

/* ───────── Solo gestionale (staff loggato) ───────── */

/** Le chiavi EmailJS sono state inserite in app_config? */
export async function promemoriaConfigurato() {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.rpc('promemoria_configurato');
    return !error && data === true;
  } catch {
    return false;
  }
}

/** Elenco promemoria (più vicini prima). */
export async function listaPromemoria() {
  if (!supabase) return { data: [], error: 'Supabase non configurato' };
  const { data, error } = await supabase
    .from('promemoria_compleanno')
    .select('*')
    .order('invio_previsto', { ascending: true });
  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}

/** Annulla un promemoria ancora da inviare. */
export async function annullaPromemoria(id) {
  if (!supabase) return { error: 'Supabase non configurato' };
  const { error } = await supabase
    .from('promemoria_compleanno')
    .update({ stato: 'annullato', nota: 'annullato dal gestionale' })
    .eq('id', id);
  return { error: error?.message || null };
}

/** Rimette in coda un promemoria annullato/in errore. */
export async function riattivaPromemoria(id, invioPrevisto) {
  if (!supabase) return { error: 'Supabase non configurato' };
  const { error } = await supabase
    .from('promemoria_compleanno')
    .update({ stato: 'in_attesa', nota: null, invio_previsto: invioPrevisto })
    .eq('id', id);
  return { error: error?.message || null };
}

/**
 * Manda ADESSO il promemoria al cliente (decisione esplicita dello staff):
 * salta i controlli del job, non sposta la data prevista, e da lì in poi il
 * promemoria risulta inviato.
 */
export async function inviaPromemoriaOra(id) {
  if (!supabase) return { error: 'Supabase non configurato' };
  const { data, error } = await supabase.rpc('invia_promemoria_ora', { p_id: id });
  return { error: error?.message || null, esito: data || '' };
}

/** Manda una copia di prova a un altro indirizzo: la riga resta in coda. */
export async function provaPromemoria(id, email) {
  if (!supabase) return { error: 'Supabase non configurato' };
  const { data, error } = await supabase.rpc('prova_promemoria', { p_id: id, p_email: email });
  return { error: error?.message || null, esito: data || '' };
}
