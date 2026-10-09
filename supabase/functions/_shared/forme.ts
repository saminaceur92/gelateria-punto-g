// Forme ammesse per gruppo di torta, lato server (punto 17 dei titolari).
//
// Dalla scheda Dimensioni ogni forma si accende e si spegne a parte per le
// torte normali e per le torte alte: colonne `per_normali` e `per_alte` della
// tabella `forme`. L'interruttore della scheda Forme (`attivo`) resta quello
// generale: se è spento la forma non la vede nessuno. Il gruppo lo decide il
// TIPO di torta (TALL_TYPE_IDS), non la taglia.
//
// Qui c'è solo la regola, senza import: si prova con Node senza Supabase.
// ⚠️ Stessa regola lato sito: le forme mostrate al passo della forma (punto
// 17, formeDelTipo) e formeDelSito in src/lib/riallineaListino.js, che
// sistema la torta dopo un rifiuto del server.

export interface FormaRiga {
  id?: unknown;
  attivo?: unknown;
  per_normali?: unknown;
  per_alte?: unknown;
}

/**
 * Gli id delle forme che si possono scegliere per una torta normale
 * (`tortaAlta` false) o alta (true).
 * - Accese = `attivo === true`, come il sito, che legge solo quelle.
 * - Prima della migrazione le colonne per gruppo non esistono: la chiave manca
 *   e la forma vale per tutti, come prima.
 * - Rete di sicurezza, uguale al sito: se per un gruppo fossero spente tutte,
 *   valgono tutte le forme accese. Meglio una forma in più che un cliente
 *   bloccato al passo della forma.
 */
export function formeAmmesse(forme: FormaRiga[], tortaAlta: boolean): string[] {
  const accese = (forme || []).filter((f) => f && f.attivo === true);
  const ammesse = accese.filter((f) => (tortaAlta ? f.per_alte !== false : f.per_normali !== false));
  return (ammesse.length ? ammesse : accese).map((f) => String(f.id));
}
