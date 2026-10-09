// Prezzo LATO SERVER dell'ordine torta: l'importo addebitato nasce qui, mai
// dal browser. Il frontend manda solo le scelte (la configurazione).
//
// I passi, tutti obbligati:
//   1. caricaListino   il listino vero, appena letto (listino.ts);
//   2. validaOrdine    ogni scelta esiste, è accesa e rispetta le regole del
//                      configuratore, altrimenti OrdineRifiutato (valida.ts);
//   3. prezzoOrdine    la stessa formula di `total` nel configuratore;
//   4. codice sconto   lo decide il database (verifica_sconto), su QUESTO totale.
// Un errore di lettura ferma il pagamento (ListinoNonDisponibile): prima un
// pezzo di torta che non si riusciva a leggere valeva 0 €.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { caricaListino, ListinoNonDisponibile } from './listino.ts';
import { riassuntoStripe } from './ordine.ts';
import { oggiARoma, prezzoOrdine, round2, validaOrdine } from './valida.ts';

// Mai sotto il minimo addebitabile da Stripe (~0,50 €): uno sconto che porta
// il totale a zero farebbe fallire il pagamento con un errore incomprensibile.
const MINIMO = 0.5;

export async function computeOrder(supabase: SupabaseClient, config: unknown, oggi: string = oggiARoma()) {
  const listino = await caricaListino(supabase);
  const validato = validaOrdine(config, listino, oggi);
  const prezzo = prezzoOrdine(validato);
  const lordo = prezzo.lordo;

  // ── Codice sconto ────────────────────────────────────────────────────
  // Il codice che arriva dal browser NON è preso per buono: si chiede al
  // database se vale, adesso, su questo totale (scadenza, utilizzi, minimo di
  // spesa). Chi scrivesse un codice a mano nella console non pagherebbe meno.
  // Se il controllo non risponde si ferma il pagamento: addebitare in
  // silenzio il prezzo pieno a chi ha un codice valido non va bene.
  const richiesto = (config as { scontoCodice?: unknown } | null)?.scontoCodice;
  let sconto = 0;
  let scontoCodice: string | null = null;
  if (typeof richiesto === 'string' && richiesto.trim()) {
    const { data, error } = await supabase.rpc('verifica_sconto', { p_codice: richiesto, p_totale: lordo });
    if (error) throw new ListinoNonDisponibile(`verifica_sconto: ${error.message}`);
    if (data && data.valido) {
      sconto = Number(data.sconto) || 0;
      scontoCodice = String(data.codice);
    }
  }
  if (lordo - sconto < MINIMO) sconto = Math.max(0, round2(lordo - MINIMO));
  const totale = round2(lordo - sconto);

  return {
    amountCents: Math.round(totale * 100),
    totale,
    lordo,
    // Lo sconto DAVVERO applicato (null se nessuno): finisce sull'ordine e
    // nel conteggio degli utilizzi del codice, a pagamento avvenuto.
    sconto: scontoCodice && sconto > 0 ? { codice: scontoCodice, euro: round2(sconto) } : null,
    // Riassunto per la pagina di pagamento di Stripe, coi nomi del listino.
    summary: riassuntoStripe(validato),
    validato,
    prezzo,
  };
}
