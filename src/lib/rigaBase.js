// Riga della base nella scheda della torta: di solito «su base classica
// vaniglia». Due nomi però si leggevano male con «su base» davanti: la base di
// partenza usciva «su base senza base», quella croccante «su base base
// croccante».
//
// Si guarda come comincia il NOME, non l'id, perché i nomi li cambiano i
// titolari dalla dashboard. Ma solo un nome che dice che la base NON c'è
// («Senza base», «Nessuna base», «Niente base») si scrive da solo: una base
// «Senza glutine» o «Senza lattosio», scritta da sola, farebbe sembrare senza
// glutine tutta la torta, inserto compreso.
//   node --test src/lib/rigaBase.test.mjs

const NESSUNA_BASE = /^(senza|nessuna|niente)\s+base\b/;

/** «su base …», «su base croccante», oppure «senza base». '' se manca il nome. */
export function descriviBase(nome) {
  const n = String(nome ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  if (!n) return '';
  if (NESSUNA_BASE.test(n)) return n;
  if (/^base\b/.test(n)) return `su ${n}`;
  return `su base ${n}`;
}
