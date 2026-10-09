// La riga ordine viaggia da create-checkout al webhook dentro i metadata
// della sessione Stripe: chiavi d0, d1, … da al massimo 500 caratteri,
// al massimo 50 chiavi in tutto (limiti di Stripe).
//
// Due guasti silenziosi che qui si evitano:
// 1. Emoji tagliate a metà. Il JSON si spezzava ogni 450 caratteri; se il
//    taglio cadeva dentro un'emoji (due "mezzi caratteri" UTF-16), la libreria
//    di Stripe la codificava male e si mangiava il carattere dopo. Il webhook
//    non riusciva più a leggere il JSON e salvava un ordine PAGATO senza nome,
//    telefono e torta (circa 2 ordini su 1000: il saluto della mail finisce
//    con 🍰). Ora il JSON è scritto in SOLO ASCII: ogni carattere speciale
//    diventa la sua sequenza \uXXXX, che JSON.parse rimette com'era. In più
//    i caratteri coincidono coi byte: niente sorprese su come Stripe conta i 500.
// 2. Spazi ai bordi di un pezzo: se un giorno venissero tolti, il testo
//    ricomposto cambierebbe. I tagli non cadono mai accanto a uno spazio.
//
// Il webhook vecchio legge questo formato senza saperlo (concatena i pezzi e
// fa JSON.parse): l'ordine di rilascio fra le due funzioni è indifferente.
// Funzioni PURE: tests/metadati.test.mjs.

export const PEZZO = 450; // caratteri per chiave (Stripe: massimo 500)
export const MAX_CHIAVI = 50; // chiavi di metadata per sessione (Stripe)

const BARRA = String.fromCharCode(92);
// Tutto ciò che non è ASCII stampabile. Costruita da una stringa con le
// sequenze di escape: niente caratteri speciali scritti letterali nel sorgente.
const NON_ASCII = new RegExp('[\\u007f-\\uffff]', 'g');

/** JSON.stringify con i soli caratteri ASCII: JSON.parse restituisce il valore identico. */
export function jsonAscii(valore: unknown): string {
  return JSON.stringify(valore).replace(NON_ASCII, (ch) => `${BARRA}u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/** Pezzi da al massimo `max` caratteri, mai tagliati accanto a uno spazio. */
export function spezza(testo: string, max = PEZZO): string[] {
  const pezzi: string[] = [];
  let i = 0;
  while (i < testo.length) {
    let j = Math.min(i + max, testo.length);
    // Si arretra di poco finché il taglio non tocca uno spazio (né in fondo a
    // questo pezzo né in testa al prossimo). Spazi in fila, in un JSON, non ce
    // ne sono: i testi del cliente li riducono a uno (valida.ts).
    const limite = Math.max(i + 1, j - 40);
    while (j < testo.length && j > limite && (testo[j - 1] === ' ' || testo[j] === ' ')) j--;
    pezzi.push(testo.slice(i, j));
    i = j;
  }
  return pezzi;
}

export class TroppoTestoPerStripe extends Error {
  constructor() {
    super("L'ordine contiene troppo testo per il pagamento: accorcia le note o l'indirizzo e conferma di nuovo.");
    this.name = 'TroppoTestoPerStripe';
  }
}

/**
 * I metadata della sessione Stripe per una riga ordine scritta dal server.
 *   v             '2' = riga scritta dal server (questa versione)
 *   importo_cent  l'importo deciso dal server, per il controllo nel webhook
 *   chunks, d0…dN la riga in JSON ASCII, a pezzi
 *   sconto_codice / sconto_euro            lo sconto DAVVERO applicato
 *   foto_cialda_url / torta_configurata_url
 *       ridondanti (le foto sono già nella riga): servono al webhook vecchio,
 *       che le rimette in `dettagli` da qui, se il rilascio è a metà.
 */
export function metadatiOrdine(
  riga: Record<string, unknown>,
  importoCent: number,
  sconto: { codice: string; euro: number } | null,
): Record<string, string> {
  const pezzi = spezza(jsonAscii(riga));
  const md: Record<string, string> = { v: '2', importo_cent: String(importoCent), chunks: String(pezzi.length) };
  if (sconto && sconto.euro > 0) {
    md.sconto_codice = sconto.codice;
    md.sconto_euro = sconto.euro.toFixed(2);
  }
  const det = (riga.dettagli && typeof riga.dettagli === 'object' ? riga.dettagli : {}) as Record<string, unknown>;
  if (typeof det.fotoCialdaUrl === 'string' && det.fotoCialdaUrl) md.foto_cialda_url = det.fotoCialdaUrl.slice(0, 500);
  if (typeof det.tortaConfigurataUrl === 'string' && det.tortaConfigurataUrl) {
    md.torta_configurata_url = det.tortaConfigurataUrl.slice(0, 500);
  }
  if (Object.keys(md).length + pezzi.length > MAX_CHIAVI) throw new TroppoTestoPerStripe();
  pezzi.forEach((p, k) => { md['d' + k] = p; });
  return md;
}

/**
 * Dal webhook: ricompone la riga dai pezzi d0…dN. `null` se i pezzi mancano o
 * il JSON non si legge (il webhook salva allora una riga ridotta, mai vuota).
 */
export function ricomponi(md: Record<string, unknown>): Record<string, unknown> | null {
  const n = Number.parseInt(String(md.chunks ?? '0'), 10);
  if (!Number.isFinite(n) || n <= 0 || n > MAX_CHIAVI) return null;
  let testo = '';
  for (let i = 0; i < n; i++) {
    const p = md['d' + i];
    if (typeof p !== 'string') return null;
    testo += p;
  }
  try {
    const v = JSON.parse(testo);
    return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;
  } catch {
    return null;
  }
}
