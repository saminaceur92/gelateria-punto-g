/**
 * Lettura delle statistiche, per la sola scheda Statistiche della dashboard.
 *
 * Sta separato da src/lib/analytics.js di proposito, e la separazione non è
 * estetica: analytics.js finisce nel bundle che scarica OGNI visitatore del
 * sito, questo file no. Tenerli insieme vorrebbe dire spedire a tutti il
 * codice che legge i numeri del negozio.
 *
 * Qui non si fanno conti: il database restituisce già tutto pronto (sintesi,
 * andamento, totali per evento, provenienze, pagine) con una sola chiamata a
 * `statistiche_riepilogo`. Vedi migrations/2026-08-12-statistiche-sito.sql.
 */

import { supabase } from './supabase';

/**
 * Riepilogo del periodo.
 *
 * @param {number} giorni 1, 7, 30 o 90. Un valore diverso il database lo
 *   riporta a 30 da solo: la lista è chiusa anche là, non ci si fida del client.
 * @returns {Promise<{data: object|null, error: string}>} `error` è già un
 *   messaggio da mostrare, mai un oggetto: chi chiama non deve conoscere la
 *   forma degli errori di Supabase.
 */
export async function riepilogo(giorni) {
  if (!supabase) return { data: null, error: 'Configurazione Supabase mancante.' };

  const { data, error } = await supabase.rpc('statistiche_riepilogo', {
    p_giorni: Number(giorni) || 30,
  });

  if (error) return { data: null, error: error.message || 'Non riesco a leggere le statistiche.' };

  // `null` non è un errore: la funzione risponde così a chi non è del
  // personale (vedi il controllo `is_staff()` dentro la migrazione). In
  // dashboard non dovrebbe mai capitare — ci si arriva solo da loggati — ma se
  // capita è meglio dirlo che mostrare una scheda vuota e lasciar credere che
  // il sito non abbia visite.
  if (data === null) {
    return { data: null, error: 'Il tuo utente non ha i permessi per vedere le statistiche.' };
  }

  return { data, error: '' };
}

/**
 * Distingue "la migrazione non è ancora stata eseguita" da un errore vero.
 *
 * Serve perché è l'unico errore che ha una soluzione, e la soluzione è una
 * riga sola: lanciare il file .sql su Supabase. Senza questo controllo la
 * scheda mostrerebbe un errore Postgres in inglese e chi lo legge penserebbe
 * che è rotta.
 *
 * PostgREST risponde `PGRST202` quando la funzione non esiste; il testo lo
 * guardiamo lo stesso perché il codice non arriva fin qui (riepilogo()
 * restituisce già solo il messaggio).
 */
export function daConfigurare(error) {
  if (!error) return false;
  const t = String(error).toLowerCase();
  return (
    t.includes('pgrst202') ||
    t.includes('statistiche_riepilogo') ||
    (t.includes('function') && t.includes('does not exist')) ||
    t.includes('schema cache')
  );
}
