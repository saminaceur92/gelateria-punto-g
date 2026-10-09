import { supabase } from './supabase';
import { NON_INVIATA as KO } from './collaboraRegole';

/**
 * «Collabora con noi»: le chiamate a Supabase. Le regole del modulo stanno
 * in collaboraRegole.js; il database (migrations/2026-10-09-collabora-con-noi.sql)
 * le rifà tutte e applica i freni anti-spam.
 *
 * Il sito pubblico chiama SOLO inviaCollaborazione: la tabella non la legge
 * e non ci scrive (non potrebbe: la migrazione gliela chiude). Il resto lo
 * usa la scheda "🤝 Collaborazioni" della dashboard, che vedono i titolari.
 */

/**
 * Manda la proposta. Non lancia mai: risponde sempre
 * { ok, gia_ricevuta, campo, motivo }.
 * Prima della migrazione la funzione non esiste (PostgREST risponde 404):
 * qui diventa il messaggio generico, e il modulo propone WhatsApp.
 */
export async function inviaCollaborazione(parametri) {
  const ko = { ok: false, gia_ricevuta: false, campo: null, motivo: KO };
  if (!supabase) return ko;
  try {
    const { data, error } = await supabase.rpc('invia_collaborazione', parametri);
    if (error || !data || typeof data !== 'object') return ko;
    if (data.ok === true) return { ok: true, gia_ricevuta: data.gia_ricevuta === true, campo: null, motivo: '' };
    return {
      ok: false,
      gia_ricevuta: false,
      campo: typeof data.campo === 'string' ? data.campo : null,
      motivo: typeof data.motivo === 'string' && data.motivo ? data.motivo : KO,
    };
  } catch {
    return ko;
  }
}

/* ───────── Solo dashboard (titolari) ───────── */

export const MIGRAZIONE_MANCANTE =
  'Scheda non ancora attiva: esegui su Supabase la migrazione migrations/2026-10-09-collabora-con-noi.sql.';

/**
 * "La tabella non c'è" è l'unico errore con una soluzione di una riga:
 * lanciare la migrazione. Si riconosce dal codice (Postgres 42P01, PostgREST
 * PGRST205) o dal testo, perché supabase-js non passa sempre il codice.
 */
export function tabellaMancante(error) {
  if (!error) return false;
  const codice = String(error.code || '');
  if (codice === '42P01' || codice === 'PGRST205') return true;
  const t = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
  return t.includes('collaborazioni') && (t.includes('does not exist') || t.includes('schema cache') || t.includes('could not find'));
}

const messaggio = (error, base) => (tabellaMancante(error) ? MIGRAZIONE_MANCANTE : error?.message || base);

/** Le ultime 300 proposte, le più recenti prima. */
export async function listaCollaborazioni() {
  if (!supabase) return { data: [], error: 'Configurazione Supabase mancante.' };
  try {
    const { data, error } = await supabase
      .from('collaborazioni')
      .select('id, created_at, tipo, nome, azienda, email, telefono, messaggio, stato, nota_staff, silenziata, privacy_il, aggiornata_il')
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) return { data: [], error: messaggio(error, 'Non riesco a leggere le proposte.') };
    return { data: data || [], error: '' };
  } catch {
    return { data: [], error: 'Non riesco a leggere le proposte.' };
  }
}

/**
 * Quante proposte aspettano di essere lette. `null` = non si sa (migrazione
 * non lanciata, utente senza permessi, rete giù): la dashboard non mostra
 * nessun numero invece di uno sbagliato.
 */
export async function contaNuoveCollaborazioni() {
  if (!supabase) return null;
  try {
    const { count, error } = await supabase
      .from('collaborazioni')
      .select('id', { count: 'exact', head: true })
      .eq('stato', 'nuova');
    if (error) return null;
    return typeof count === 'number' ? count : 0;
  } catch {
    return null;
  }
}

/**
 * Cambia stato e/o nota. Si mandano SOLO queste due colonne: la migrazione
 * concede l'aggiornamento solo su di loro (la data la mette il database).
 * Risponde la riga aggiornata, così la scheda mostra quello che c'è davvero.
 */
export async function aggiornaCollaborazione(id, { stato, nota_staff: nota } = {}) {
  if (!supabase) return { data: null, error: 'Configurazione Supabase mancante.' };
  const modifiche = {};
  if (stato !== undefined) modifiche.stato = stato;
  if (nota !== undefined) {
    // Salvata già ripulita: così la scheda, che confronta il testo ripulito,
    // dopo il salvataggio non crede che ci sia ancora qualcosa da salvare.
    const t = String(nota ?? '').trim();
    modifiche.nota_staff = t ? t.slice(0, 2000) : null;
  }
  try {
    const { data, error } = await supabase
      .from('collaborazioni')
      .update(modifiche)
      .eq('id', id)
      .select('id, stato, nota_staff, aggiornata_il');
    if (error) return { data: null, error: messaggio(error, 'Non riesco a salvare.') };
    // Nessuna riga toccata: la RLS l'ha nascosta (non titolare) o è già stata cancellata.
    if (!data || !data.length) return { data: null, error: 'Proposta non trovata: forse è stata cancellata. Ricarica la scheda.' };
    return { data: data[0], error: '' };
  } catch {
    return { data: null, error: 'Non riesco a salvare.' };
  }
}

/** Cancella per sempre (serve anche quando qualcuno chiede di cancellare i suoi dati). */
export async function eliminaCollaborazione(id) {
  if (!supabase) return { error: 'Configurazione Supabase mancante.' };
  try {
    const { data, error } = await supabase.from('collaborazioni').delete().eq('id', id).select('id');
    if (error) return { error: messaggio(error, 'Non riesco a cancellare.') };
    if (!data || !data.length) return { error: 'Non è stato cancellato niente: ricarica la scheda e riprova.' };
    return { error: '' };
  } catch {
    return { error: 'Non riesco a cancellare.' };
  }
}
