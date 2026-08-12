import { supabase } from './supabase';

/**
 * Codici personali dello staff.
 *
 * Ogni persona che lavora in gelateria ha un codice. Serve a firmare le azioni
 * che contano (creare un ordine al banco, eliminarlo, segnarlo Pronto) e a
 * gestire i codici degli altri, se si è amministratori.
 *
 * Il codice non viaggia mai "in chiaro" nel senso che conta: in banca dati c'è
 * solo la sua impronta, e a decidere se è giusto è sempre il database — non
 * questo file. Qui dentro non c'è nessun controllo che si possa aggirare
 * aprendo la console del browser.
 *
 * Serve la migrazione migrations/2026-08-11-codici-staff.sql.
 */

// Il codice di chi sta usando il gestionale adesso, tenuto solo per la scheda
// dei codici (per non richiederlo a ogni clic dentro la stessa schermata).
// Sta in sessionStorage: si cancella chiudendo la scheda del browser.
const CHIAVE = 'puntogi.codice';

export const ricordaCodice = (pin) => {
  try { sessionStorage.setItem(CHIAVE, pin); } catch { /* modalità privata */ }
};
export const codiceRicordato = () => {
  try { return sessionStorage.getItem(CHIAVE) || ''; } catch { return ''; }
};
export const dimenticaCodice = () => {
  try { sessionStorage.removeItem(CHIAVE); } catch { /* no-op */ }
};

/** La migrazione non è ancora stata eseguita. */
export const daConfigurare = (msg) => !!msg && /(does not exist|schema cache|function .* not found)/i.test(msg);

async function chiama(nome, args) {
  if (!supabase) return { ok: false, motivo: 'Supabase non configurato' };
  const { data, error } = await supabase.rpc(nome, args);
  if (error) {
    return {
      ok: false,
      motivo: daConfigurare(error.message)
        ? 'Codici non ancora attivi: va eseguita la migrazione 2026-08-11-codici-staff.sql.'
        : error.message,
    };
  }
  return data || { ok: false, motivo: 'Nessuna risposta' };
}

/** Chi sei? Torna { ok, nome, ruolo } oppure { ok:false, motivo }. */
export const verificaCodice = (pin) => chiama('verifica_codice', { p_pin: pin });

/**
 * Verifica il codice E registra l'azione nello storico, in un colpo solo.
 * Farlo lato database è il punto: il browser non può scrivere "l'ha fatto
 * Anna" senza conoscere davvero il codice di Anna.
 */
export const registraAttivita = (pin, azione, dettaglio = null) =>
  chiama('registra_attivita', { p_pin: pin, p_azione: azione, p_dettaglio: dettaglio });

/** Elenco delle persone (solo per chi ha un codice da amministratore). */
export const codiciElenco = (pin) => chiama('codici_elenco', { p_pin: pin });

export const codiceCrea = (pin, nome, ruolo, nuovoPin) =>
  chiama('codice_crea', { p_pin: pin, p_nome: nome, p_ruolo: ruolo, p_nuovo_pin: nuovoPin });

export const codiceElimina = (pin, id) => chiama('codice_elimina', { p_pin: pin, p_id: id });

/** Ultime attività registrate (chi ha fatto cosa). */
export async function ultimeAttivita(limite = 100) {
  if (!supabase) return { data: [], error: null };
  const { data, error } = await supabase
    .from('attivita')
    .select('*')
    .order('quando', { ascending: false })
    .limit(limite);
  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}
