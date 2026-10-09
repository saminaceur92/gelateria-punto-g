// Dal pagamento Stripe alla riga `ordini`: la parte PURA del webhook
// (stripe-webhook/index.ts fa solo firma, letture e scritture).
//
// Regole:
// - Dai metadata si prendono SOLO le colonne della torta e del cliente
//   (COLONNE_DAL_METADATA). Prima il webhook faceva `{ ...insert }` con quello
//   che aveva mandato il browser: una richiesta "creativa" poteva scrivere
//   note_lab, creato_da, promemoria_ok, id, stato, totale… Ora quelle colonne
//   o le scrive il webhook (stato, totale, sconto, Stripe) o restano ai loro
//   valori di partenza.
// - v = '2': riga scritta dal server (create-checkout nuovo). Senza `v` la
//   sessione l'ha aperta la funzione vecchia, al massimo nelle 24 ore dopo il
//   rilascio (le sessioni Stripe scadono in 24 h): si salva come prima, ma
//   con la stessa whitelist e con dettagli.autore = 'browser'.
// - Metadata illeggibili: mai un ordine vuoto, una riga ridotta che lo dice.
// Funzioni PURE: tests/webhook.test.mjs.
import { ricomponi } from './metadati.ts';

/** Le uniche colonne che arrivano dai metadata della sessione. */
export const COLONNE_DAL_METADATA = [
  'tipo', 'riepilogo', 'dettagli', 'email_params', 'note',
  'cliente_nome', 'cliente_telefono', 'cliente_email', 'ritiro_data', 'ritiro_ora', 'immagine',
] as const;
const TESTI = new Set(['tipo', 'riepilogo', 'note', 'cliente_nome', 'cliente_telefono', 'cliente_email', 'ritiro_data', 'ritiro_ora', 'immagine']);

/** Gli eventi che possono creare un ordine (il secondo per i metodi di pagamento differiti). */
export const EVENTI_ORDINE = ['checkout.session.completed', 'checkout.session.async_payment_succeeded'];

export interface Sessione {
  id: string;
  metadata?: Record<string, string> | null;
  amount_total?: number | null;
  payment_intent?: unknown;
  payment_status?: string | null;
  customer_details?: { email?: string | null } | null;
}

/**
 * I soldi sono incassati? Con le carte `checkout.session.completed` arriva
 * già 'paid'. Con un metodo differito (bonifico, SEPA…) arriva 'unpaid': si
 * aspetta `checkout.session.async_payment_succeeded`, altrimenti l'ordine
 * nascerebbe "pagato" quando non lo è ancora.
 */
export const pagamentoIncassato = (s: Sessione) =>
  s.payment_status === 'paid' || s.payment_status === 'no_payment_required';

const oggetto = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v);
const euro = (cent: number) => (cent / 100).toFixed(2);
const intentDi = (s: Sessione) => (typeof s.payment_intent === 'string' ? s.payment_intent : null);

/** Le colonne che scrive SOLO il webhook. */
function colonneDelWebhook(s: Sessione, adesso: Date) {
  const md = s.metadata || {};
  const scontoEuro = md.sconto_euro ? Number(md.sconto_euro) : 0;
  return {
    stato: 'da_fare',
    totale: (s.amount_total ?? 0) / 100,
    // Lo sconto è quello DECISO DAL SERVER quando ha preparato il pagamento.
    sconto_codice: md.sconto_codice || null,
    sconto_euro: Number.isFinite(scontoEuro) && scontoEuro > 0 ? scontoEuro : null,
    stripe_session_id: s.id,
    stripe_payment_intent: intentDi(s),
    pagato_il: adesso.toISOString(),
  };
}

/**
 * La riga completa da salvare. `avvisi` va nei log (mai dati personali:
 * solo cosa è successo, l'id della sessione lo aggiunge chi chiama).
 */
export function rigaDaSessione(s: Sessione, adesso: Date) {
  const md = s.metadata || {};
  const versione = md.v === '2' ? '2' : '1';
  const avvisi: string[] = [];
  const grezza = ricomponi(md);
  if (!grezza) {
    avvisi.push('metadata della sessione illeggibili: salvo una riga ridotta');
    return { riga: rigaRidotta(s, {}, adesso), scontoCodice: md.sconto_codice || null, versione, avvisi };
  }

  // Whitelist: solo le colonne previste, e solo col tipo giusto.
  const riga: Record<string, unknown> = {};
  for (const col of COLONNE_DAL_METADATA) {
    const v = grezza[col];
    if (v === null) riga[col] = null;
    else if (TESTI.has(col) ? typeof v === 'string' : oggetto(v)) riga[col] = v;
  }

  const dettagli = (oggetto(riga.dettagli) ? riga.dettagli : {}) as Record<string, unknown>;
  if (versione !== '2') {
    // Formato vecchio: le due foto viaggiavano anche fuori dal JSON, si
    // rimettono come faceva il webhook di prima.
    if (md.foto_cialda_url) dettagli.fotoCialdaUrl = md.foto_cialda_url;
    if (md.torta_configurata_url) dettagli.tortaConfigurataUrl = md.torta_configurata_url;
    dettagli.autore = 'browser';
  }
  riga.dettagli = dettagli;

  // Mail di conferma: se il payload (vecchio) non ha i parametri, si
  // ricostruiscono almeno quelli essenziali con l'indirizzo confermato da
  // Stripe, come prima.
  const email = String(riga.cliente_email || s.customer_details?.email || '').trim();
  if (email && !oggetto(riga.email_params)) {
    const testo = String(riga.riepilogo || '').replace(/[*_]/g, '').trim();
    const data = String(riga.ritiro_data || '');
    const ora = String(riga.ritiro_ora || '');
    const quando = [data, ora && `alle ${ora}`].filter(Boolean).join(' ');
    riga.cliente_email = email;
    riga.email_params = {
      email,
      cliente: String(riga.cliente_nome || 'Cliente'),
      ordine: testo,
      ritiro: quando,
      modalita: `📅 Ritiro in gelateria${quando ? ` — ${quando}` : ''}`,
      saluto: 'Ti aspettiamo in gelateria per il ritiro 🍰',
      importo: euro(s.amount_total ?? 0),
    };
  }

  // Riga del server: l'importo nel riepilogo è quello deciso in
  // create-checkout. Se Stripe ha incassato una cifra diversa (oggi non può:
  // un solo articolo, niente tasse né promozioni Stripe) vince quella vera, e
  // il laboratorio lo vede scritto.
  const previsto = Number(md.importo_cent);
  const incassato = s.amount_total ?? 0;
  if (versione === '2' && Number.isFinite(previsto) && previsto !== incassato) {
    avvisi.push(`importo diverso: previsti ${previsto} centesimi, incassati ${incassato}`);
    if (typeof riga.riepilogo === 'string') {
      riga.riepilogo = riga.riepilogo.replace(
        /(\*Importo pagato:\* €)[0-9]+(?:\.[0-9]+)?/,
        `$1${euro(incassato)}\n⚠️ *Importo incassato diverso dal previsto* (previsti €${euro(previsto)}): controlla il pagamento su Stripe`,
      );
    }
    if (oggetto(riga.email_params)) (riga.email_params as Record<string, unknown>).importo = euro(incassato);
  }

  return {
    riga: { ...riga, ...colonneDelWebhook(s, adesso) },
    scontoCodice: md.sconto_codice || null,
    versione,
    avvisi,
  };
}

/**
 * Riga di riserva, quando quella completa non si salva (o non si legge):
 * l'ordine è PAGATO e non deve sparire. Contatti, importo e il riepilogo se
 * c'è, preceduto da un avviso che dice di controllare il pagamento su Stripe.
 */
export function rigaRidotta(s: Sessione, riga: Record<string, unknown>, adesso: Date) {
  // Taglio che non spezza un'emoji: mezza coppia surrogata fa rifiutare al
  // database tutta la riga, e questa è proprio quella che deve salvarsi.
  const testo = (v: unknown, max: number) => {
    if (typeof v !== 'string') return '';
    const t = v.slice(0, max);
    return t.length === max && /[\uD800-\uDBFF]$/.test(t) ? t.slice(0, -1) : t;
  };
  const riepilogo = testo(riga.riepilogo, 6000);
  return {
    cliente_nome: testo(riga.cliente_nome, 200) || 'Cliente',
    cliente_telefono: testo(riga.cliente_telefono, 60) || null,
    cliente_email: testo(riga.cliente_email, 254) || s.customer_details?.email || null,
    riepilogo: `⚠️ Ordine PAGATO ma salvato in forma ridotta: controlla il pagamento ${s.id} su Stripe.`
      + (riepilogo ? `\n${riepilogo}` : ''),
    ...colonneDelWebhook(s, adesso),
  };
}
