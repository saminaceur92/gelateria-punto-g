// Note di un ordine, nella scheda 📦 Ordini della dashboard.
//
// Tre testi diversi, da non confondere:
//  - `note`        → scritte dal CLIENTE nel configuratore («Note aggiuntive»);
//  - `note_lab`    → note di laboratorio dello staff (interne);
//  - `note_future` → «Note future»: appunti dello staff su QUESTO ordine, per
//                    la volta dopo (interne: il cliente non le vede, non vanno
//                    né su Telegram né nella mail né sullo scontrino).
//
// Qui stanno solo le regole, senza React né Supabase, così si provano da sole:
//   node --test src/lib/noteOrdine.test.mjs

/**
 * Le note del cliente di un ordine ('' se non ce ne sono).
 * Prima la colonna `note`, poi la copia dentro `dettagli` (lo stesso testo,
 * salvato insieme alla torta): il riquadro compare anche se una delle due
 * manca. Una nota di soli spazi conta come vuota; gli a capo restano.
 */
export function noteClienteDi(ordine) {
  const colonna = String(ordine?.note ?? '').trim();
  if (colonna) return colonna;
  return String(ordine?.dettagli?.notes ?? '').trim();
}

/**
 * Un aggiornamento in tempo reale fuso nell'ordine che la pagina ha già.
 * I payload possono arrivare PARZIALI: Postgres non rimanda le colonne grandi
 * rimaste uguali (i `dettagli`, la miniatura). Si sovrappone quello che
 * arriva senza cancellare il resto, e `dettagli` si fonde chiave per chiave:
 * altrimenti salvare una nota farebbe sparire gusti e foto dalla card.
 */
export function fondiAggiornamento(ordine, nuovo) {
  return {
    ...ordine,
    ...nuovo,
    dettagli: { ...(ordine?.dettagli || {}), ...(nuovo?.dettagli || {}) },
  };
}

/**
 * Il valore da salvare per una nota dello staff: il testo così come è
 * scritto, oppure `vuota` se è vuoto o di soli spazi (null per le note
 * future; '' per le note di laboratorio, che si sono sempre salvate così).
 */
export function notaDaSalvare(testo, vuota = null) {
  const t = String(testo ?? '');
  return t.trim() ? t : vuota;
}

/**
 * Una bozza è "superata" quando, mentre la si scriveva, da un altro
 * dispositivo è stato salvato un testo diverso da quello da cui era partita.
 * `bozza` = { testo, base }: `base` è il testo salvato al primo tasto.
 * Salvando, vince l'ultimo: meglio dirlo prima di sovrascrivere.
 */
export function bozzaSuperata(bozza, salvato) {
  if (!bozza) return false;
  return (bozza.base ?? '') !== (salvato ?? '');
}
