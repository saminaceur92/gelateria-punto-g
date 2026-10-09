import { supabase } from './supabase';
import { impacchetta, spacchetta } from './codiciRegole';

/**
 * Codici personali dello staff.
 *
 * Ogni persona che lavora in gelateria ha un codice. Serve a firmare le azioni
 * che contano (creare un ordine al banco, eliminarlo, segnarlo Pronto) e a
 * gestire i codici degli altri, se si è amministratori.
 *
 * A decidere se un codice è giusto è sempre il database, sull'impronta del
 * codice (bcrypt): qui dentro non c'è nessun controllo che si possa aggirare
 * aprendo la console del browser. Dalla migrazione 2026-10-09-codici-visibili
 * accanto all'impronta c'è anche una copia cifrata, che gli amministratori
 * possono far MOSTRARE (codici_rivela) mettendo il loro codice: ogni volta
 * resta scritto nello storico.
 *
 * Servono le migrazioni 2026-08-11-codici-staff.sql e
 * 2026-10-09-codici-visibili.sql.
 */

// Il codice di chi sta usando il gestionale adesso, tenuto solo per la scheda
// dei codici (per non richiederlo a ogni clic dentro la stessa schermata).
// Sta in sessionStorage e scade dopo 10 minuti: al banco il tablet resta
// acceso tutto il giorno. MOSTRARE i codici lo richiede comunque ogni volta.
const CHIAVE = 'puntogi.codice';

export const ricordaCodice = (pin) => {
  try { sessionStorage.setItem(CHIAVE, impacchetta(pin)); } catch { /* modalità privata */ }
};
export const codiceRicordato = () => {
  try { return spacchetta(sessionStorage.getItem(CHIAVE)); } catch { return ''; }
};
export const dimenticaCodice = () => {
  try { sessionStorage.removeItem(CHIAVE); } catch { /* no-op */ }
};

/** La migrazione non è ancora stata eseguita. */
export const daConfigurare = (msg) => !!msg && /(does not exist|schema cache|function .* not found|could not find the function)/i.test(msg);

const MIGRAZIONE_BASE = '2026-08-11-codici-staff.sql';
const MIGRAZIONE_VISIBILI = '2026-10-09-codici-visibili.sql';

async function chiama(nome, args, migrazione = MIGRAZIONE_BASE) {
  if (!supabase) return { ok: false, motivo: 'Supabase non configurato' };
  const { data, error } = await supabase.rpc(nome, args);
  if (error) {
    return {
      ok: false,
      motivo: daConfigurare(error.message)
        ? `Funzione non ancora attiva: va eseguita la migrazione ${migrazione}.`
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

/**
 * Elenco delle persone (solo per chi ha un codice da amministratore).
 * Ogni riga dice anche se il codice si può già mostrare (`visibile`) e se è
 * la persona che sta usando la scheda (`sei_tu`). Il codice non c'è mai.
 */
export const codiciElenco = (pin) => chiama('codici_elenco', { p_pin: pin });

export const codiceCrea = (pin, nome, ruolo, nuovoPin) =>
  chiama('codice_crea', { p_pin: pin, p_nome: nome, p_ruolo: ruolo, p_nuovo_pin: nuovoPin });

export const codiceElimina = (pin, id) => chiama('codice_elimina', { p_pin: pin, p_id: id });

/**
 * Mostra il codice di una persona (`id`) o di tutti (`id` null). Va chiamata
 * con un codice da amministratore appena digitato, non con quello ricordato.
 * Torna { ok, codici: [{ id, nome, codice | null }] }.
 */
export const codiciRivela = (pin, id = null) =>
  chiama('codici_rivela', { p_pin: pin, p_id: id }, MIGRAZIONE_VISIBILI);

/**
 * L'amministratore dà un codice a qualcuno (stessa persona, stesso storico).
 * Torna { ok, esito: 'uguale' | 'cambiato' }: 'uguale' = era già il suo
 * codice, per lei non cambia niente e da ora si può mostrare.
 */
export const codiceReimposta = (pin, id, nuovoPin) =>
  chiama('codice_reimposta', { p_pin: pin, p_id: id, p_nuovo_pin: nuovoPin }, MIGRAZIONE_VISIBILI);

/** Ognuno cambia il proprio codice, sapendo quello di adesso. */
export const codiceCambia = (pin, nuovoPin) =>
  chiama('codice_cambia', { p_pin: pin, p_nuovo_pin: nuovoPin }, MIGRAZIONE_VISIBILI);

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
