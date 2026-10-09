import { supabase } from './supabase';

/**
 * Promemoria compleanno e anniversario: un anno dopo un ordine con occasione
 * "Compleanno" o "Anniversario" il cliente riceve due mail (30 e 14 giorni
 * prima) con la torta di allora e il link per rifarla. Coda + invio stanno su
 * Supabase (migrations/2026-07-26-promemoria-compleanno.sql e
 * 2026-10-09-promemoria-ricorrenze.sql): qui ci sono solo le chiamate lato
 * browser. Tutto best-effort: se qualcosa non va, il sito prosegue come se la
 * funzione non esistesse.
 *
 * Il sito deve funzionare anche PRIMA che il titolare lanci la migrazione del
 * 09/10/2026 (le migrazioni si lanciano a mano, in un altro momento del
 * deploy): le funzioni nuove, se mancano, rispondono "non ancora attivo"
 * invece di rompersi.
 */

// La funzione chiesta non esiste ancora sul database (migrazione non lanciata).
function manca(error) {
  if (!error) return false;
  return error.code === 'PGRST202' || error.code === '42883'
    || /could not find the function|schema cache/i.test(error.message || '');
}

const NON_ATTIVO = 'Funzione non ancora attiva: va eseguita su Supabase la migrazione migrations/2026-10-09-promemoria-ricorrenze.sql.';

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

/* ───────── Dal link nella mail (cliente, senza login) ───────── */

/**
 * Cosa sa il database di questo promemoria, da mostrare PRIMA di chiedere
 * conferma: { stato: 'ok', info } con info = { occasione, anniversario, nome,
 * in_coda, tolto, disiscritto }; oppure 'non_valido' (token sconosciuto),
 * 'non_attivo' (migrazione non lanciata) o 'errore' (rete).
 */
export async function infoPromemoria(token) {
  if (!supabase || !token) return { stato: 'errore' };
  try {
    const { data, error } = await supabase.rpc('info_promemoria', { p_token: token });
    if (manca(error)) return { stato: 'non_attivo' };
    if (error) return { stato: 'errore' };
    if (!data) return { stato: 'non_valido' };
    return { stato: 'ok', info: data };
  } catch {
    return { stato: 'errore' };
  }
}

/**
 * «Non ricordarmi più questa ricorrenza»: ferma solo quella festa, senza
 * disiscrivere l'indirizzo. → { ok, tolti, occasione, anniversario }
 */
export async function togliPromemoria(token) {
  if (!supabase || !token) return { ok: false };
  try {
    const { data, error } = await supabase.rpc('togli_promemoria', { p_token: token });
    if (error || !data) return { ok: false };
    return { ...data, ok: data.ok === true };
  } catch {
    return { ok: false };
  }
}

/** Disiscrizione da tutti i promemoria (link «non voglio più nessun promemoria»). */
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

/**
 * La migrazione del 09/10/2026 è stata lanciata? E il template EmailJS è già
 * pronto per l'anniversario? Una sola chiamata risponde a entrambe.
 */
export async function statoPromemoria() {
  if (!supabase) return { migrata: false, templatePronto: false };
  try {
    const { data, error } = await supabase.rpc('promemoria_template_ricorrenze');
    if (manca(error)) return { migrata: false, templatePronto: false };
    return { migrata: true, templatePronto: !error && data === true };
  } catch {
    return { migrata: true, templatePronto: false };
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

/**
 * «Non mandare questa»: annulla UNA mail ancora in coda (l'altra mail della
 * stessa festa resta). Solo se è ancora in coda: se nel frattempo è partita,
 * lo si dice invece di far finta di niente.
 */
export async function annullaPromemoria(id) {
  if (!supabase) return { error: 'Supabase non configurato' };
  const { data, error } = await supabase
    .from('promemoria_compleanno')
    .update({ stato: 'annullato', nota: 'annullato dal gestionale' })
    .eq('id', id)
    .eq('stato', 'in_attesa')
    .select('id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: 'Questa mail non era più in coda (forse è appena partita): la scheda è stata ricaricata.' };
  }
  return { error: null, esito: 'Fatto: questa mail non partirà.' };
}

/**
 * «Rimetti in coda» una mail annullata o in errore. Il database rifiuta le
 * mail già partite e quelle che il cliente ha chiesto di togliere.
 */
export async function rimettiInCoda(id) {
  if (!supabase) return { error: 'Supabase non configurato' };
  const { data, error } = await supabase.rpc('rimetti_in_coda_promemoria', { p_id: id });
  if (!manca(error)) return { error: error?.message || null, esito: data || '' };

  // Migrazione non ancora lanciata: si fa come prima, ma MAI su una mail già
  // partita (prima si poteva, e il cliente la riceveva due volte).
  const { data: righe, error: e2 } = await supabase
    .from('promemoria_compleanno')
    .update({ stato: 'in_attesa', nota: null })
    .eq('id', id)
    .or('stato.eq.errore,and(stato.eq.annullato,inviato_il.is.null)')
    .select('id');
  if (e2) return { error: e2.message };
  if (!righe || righe.length === 0) return { error: 'Questa mail è già partita: non la rimetto in coda.' };
  return { error: null, esito: 'Rimesso in coda.' };
}

/**
 * Manda ADESSO il promemoria al cliente (decisione esplicita dello staff). Il
 * database rifiuta le mail già partite, i disiscritti e gli ordini annullati.
 */
export async function inviaPromemoriaOra(id) {
  if (!supabase) return { error: 'Supabase non configurato' };
  const { data, error } = await supabase.rpc('invia_promemoria_ora', { p_id: id });
  return { error: error?.message || null, esito: data || '' };
}

/**
 * Manda una copia di prova a un altro indirizzo: la riga resta com'è e i link
 * «smetti» della copia sono finti. `occasione` = 'Anniversario' prova le
 * parole dell'anniversario anche partendo da un promemoria di compleanno.
 */
export async function provaPromemoria(id, email, occasione) {
  if (!supabase) return { error: 'Supabase non configurato' };
  const args = { p_id: id, p_email: email };
  if (occasione) args.p_occasione = occasione;
  const { data, error } = await supabase.rpc('prova_promemoria', args);
  if (occasione && manca(error)) return { error: NON_ATTIVO };
  return { error: error?.message || null, esito: data || '' };
}

/**
 * «Togli questa ricorrenza»: nessuna mail di questa festa partirà più (anche
 * quelle di un altro ordine per la stessa festa). NON disiscrive l'indirizzo.
 */
export async function togliRicorrenza(id) {
  if (!supabase) return { error: 'Supabase non configurato' };
  const { data, error } = await supabase.rpc('togli_ricorrenza_staff', { p_id: id });
  if (manca(error)) return { error: NON_ATTIVO };
  return { error: error?.message || null, esito: data || '' };
}

/** Indirizzi disiscritti da tutti i promemoria (più recenti prima). */
export async function listaDisiscritti() {
  if (!supabase) return { data: [], error: null };
  const { data, error } = await supabase
    .from('promemoria_stop')
    .select('email, creato_il')
    .order('creato_il', { ascending: false });
  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}

/** Disiscrive un indirizzo da tutti i promemoria (es. richiesta al telefono). */
export async function disiscriviEmail(email) {
  if (!supabase) return { error: 'Supabase non configurato' };
  const { data, error } = await supabase.rpc('disiscrivi_email_promemoria', { p_email: email });
  if (manca(error)) return { error: NON_ATTIVO };
  return { error: error?.message || null, esito: data || '' };
}

/** Riattiva i promemoria per un indirizzo che si era disiscritto. */
export async function riattivaEmail(email) {
  if (!supabase) return { error: 'Supabase non configurato' };
  const { data, error } = await supabase.rpc('riattiva_email_promemoria', { p_email: email });
  if (manca(error)) return { error: NON_ATTIVO };
  return { error: error?.message || null, esito: data || '' };
}
