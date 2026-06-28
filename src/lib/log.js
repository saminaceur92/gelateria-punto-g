import { supabase } from './supabase';

// Registra un'azione nello storico attività. Fire-and-forget: non blocca
// e non rompe mai la UI (un eventuale errore viene ignorato silenziosamente).
// Lato DB la funzione log_activity ignora i non-staff e deduplica i doppioni.
export function logAction(action, dettagli = null) {
  if (!supabase) return;
  try {
    const p = supabase.rpc('log_activity', { p_action: action, p_dettagli: dettagli });
    if (p && typeof p.then === 'function') p.then(() => {}, () => {});
  } catch {
    /* no-op */
  }
}
