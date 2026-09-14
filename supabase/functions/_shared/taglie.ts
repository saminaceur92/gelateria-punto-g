// Taglie delle torte ALTE, lato server.
//
// Le alte (Alta semifreddo, Alta Gelato) sono in pratica una torta doppia e
// hanno taglie loro, a prezzo doppio (colonna `alta` della tabella
// `dimensioni`). Qui c'è solo la regola, senza import: si prova con Node
// senza bisogno di Supabase né di Deno.
//
// ⚠️ Stessa regola lato sito: taglieDelTipo in src/lib/misureTorta.js.
// ⚠️ Stessi id di TALL_TYPE_IDS in src/data/cakeOptions.js.
export const TALL_TYPE_IDS = ['piani', 'alta-gelato'];

export function tagliaAmmessa(
  { tortaAlta, tagliaAlta, alteAttive }: { tortaAlta: boolean; tagliaAlta: boolean; alteAttive: number },
): boolean {
  if (tortaAlta === tagliaAlta) return true;
  // Taglia delle alte su una torta normale: mai.
  if (!tortaAlta) return false;
  // Torta alta con una taglia normale: si pagherebbe circa metà. Si accetta
  // solo finché nessuna taglia alta è accesa, cioè nel periodo di passaggio
  // in cui anche il sito propone alle alte le taglie normali.
  return alteAttive === 0;
}
