// Ricalcolo prezzo LATO SERVER dell'ordine torta, leggendo i prezzi dalle tabelle
// Supabase. Il frontend manda solo la configurazione: il totale NON si fida mai del client.
//
// Deve restare allineato alla logica del frontend (CakeConfigurator `total`):
//   prezzo_base(tipo)
//   + supplemento(dimensione) + supplemento(forma) + supplemento(base)
//   + supplemento(crumble)      → solo con la base croccante (CRUMBLE_BASE_ID)
//   + supplemento(farcitura) + supplemento(copertura)
//   + Σ supplemento(decorazione)  → le decorazioni si scelgono in più di una
//                                   (max MAX_DECORAZIONI): si sommano tutte
//   + 2€ per ogni gusto oltre il primo
//   + 1€ candelina + 5€ foto + 4€ consegna a domicilio
//   + Σ (extra.prezzo × quantità)   → salame dolce, cabaret di pasticcini
// La scritta (tabella `scritte`) non incide sul prezzo: si salva soltanto nell'ordine.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Il crumble si sceglie (e si paga) solo con la base croccante: stessa costante
// del frontend, CRUMBLE_BASE_ID in src/data/cakeOptions.js.
const CRUMBLE_BASE_ID = 'crock';

// Tetti di sicurezza sugli extra: quantità e numero di voci arrivano dal client
// e non ci si fida (né di quantità assurde né di mappe lunghissime).
// Tetto di sicurezza sulla quantità di un extra: deve coincidere con
// MAX_EXTRA_QTY del frontend (CakeConfigurator.jsx), altrimenti un ordine al
// limite verrebbe addebitato più di quanto mostrato.
const MAX_EXTRA_QTY = 20;
const MAX_EXTRA_ITEMS = 20;

// Quante decorazioni si possono mettere su una torta: stessa costante del
// frontend (MAX_DECORAZIONI in CakeConfigurator.jsx). Oltre, la torta diventa
// illeggibile — e un client "creativo" non deve poter allungare la lista.
const MAX_DECORAZIONI = 5;
// Id dell'opzione "niente decorazioni": si scarta dal conteggio e dal riepilogo
// (supplemento 0, non è una decorazione vera). Stesso id della tabella
// `decorazioni` e della copia di sicurezza src/data/fallback/cakeOptions.js.
const NESSUNA_DECORAZIONE_ID = 'nessuna';
// I due vecchi topping di panna sono stati sostituiti dalle due file standard
// presenti su ogni torta. Un client vecchio non deve più farli pagare.
const DECORAZIONI_RIMOSSE = new Set(['panna-deco', 'panna-colorata']);

export interface CakeConfig {
  type?: string;
  shape?: string;
  sizeId?: string;
  baseId?: string;
  crumbleId?: string; // tipo di crumble: conta solo se baseId === CRUMBLE_BASE_ID
  fillingId?: string;
  coveringId?: string;
  // Decorazioni: si sceglie in più di una (al massimo MAX_DECORAZIONI).
  decorations?: string[]; // id delle decorazioni scelte, in ordine di scelta
  decorationColors?: Record<string, string>; // { idDecorazione: colore } (nessun costo)
  // Campi vecchi, UNA sola decorazione: non li manda più il configuratore, ma
  // arrivano ancora dagli ordini salvati prima della scelta multipla e dal link
  // "Rifai questa torta" dei promemoria compleanno. Si leggono, non si scrivono.
  decoration?: string;
  decorationColor?: string; // colore scelto per la decorazione (nessun costo)
  flavors?: { name: string; color?: string }[];
  candle?: boolean;
  photo?: unknown; // url o flag: se presente, +5€
  delivery?: boolean; // consegna a domicilio +4€
  // Codice sconto scritto dal cliente: qui è solo una richiesta, la validità la
  // decide il database (funzione `verifica_sconto`), non il browser.
  scontoCodice?: string | null;
  message?: string;
  messageFont?: string; // id della tabella `scritte` (nessun costo)
  extras?: Record<string, number>; // { idExtra: quantità }
  occasion?: string;
}

// Numeri dal database: `numeric` può arrivare come stringa, come in live.js (num()).
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function priceOf(
  supabase: SupabaseClient,
  table: string,
  column: string,
  id?: string,
): Promise<number> {
  if (!id) return 0;
  const { data } = await supabase.from(table).select(column).eq('id', id).maybeSingle();
  return data ? num((data as Record<string, unknown>)[column]) : 0;
}

async function nameOf(
  supabase: SupabaseClient,
  table: string,
  id?: string,
  col = 'nome',
): Promise<string> {
  if (!id) return '';
  const { data } = await supabase.from(table).select(col).eq('id', id).maybeSingle();
  return data ? String((data as Record<string, unknown>)[col] ?? '') : '';
}

// Quantità leggibile: 1 → "1", 0.5 → "0,5" (virgola, come si scrive in italiano).
const fmtQty = (q: number) => (Number.isInteger(q) ? String(q) : String(q).replace('.', ','));

// Colore di una decorazione: è testo libero che arriva dal client e finisce nel
// riepilogo di Stripe/Telegram, quindi si ripulisce e si accorcia.
const colorLabel = (v: unknown) =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 30) : '';

// Decorazioni scelte: una torta può averne più di una (max MAX_DECORAZIONI) e
// ognuna può avere il suo colore. Si sommano i supplementi di TUTTE.
// Due forme accettate:
//   nuova   config.decorations = ['fiocchi', 'macarons']
//           config.decorationColors = { fiocchi: 'Rosso', macarons: 'Verde' }
//   vecchia config.decoration = 'macarons' + config.decorationColor = 'Rosa'
//           (ordini salvati prima della scelta multipla e link "Rifai questa torta")
// Una sola query legge nome e supplemento di tutte le decorazioni insieme.
async function decorationsOf(
  supabase: SupabaseClient,
  config: CakeConfig,
): Promise<{ euros: number; labels: string[] }> {
  const vuoto = { euros: 0, labels: [] as string[] };

  // Se `decorations` c'è (anche vuoto: vuol dire "nessuna decorazione") comanda
  // lui; solo se manca del tutto si ripiega sul vecchio campo singolo.
  const nuovo = Array.isArray(config.decorations);
  const scelte: unknown[] = Array.isArray(config.decorations)
    ? config.decorations
    : [config.decoration];
  const colori: Record<string, unknown> =
    config.decorationColors && typeof config.decorationColors === 'object' &&
    !Array.isArray(config.decorationColors)
      ? config.decorationColors
      : (!nuovo && config.decoration ? { [config.decoration]: config.decorationColor } : {});

  // Id ripuliti: niente vuoti, niente doppioni (che raddoppierebbero il
  // supplemento), niente 'nessuna', mai più di MAX_DECORAZIONI.
  const ids: string[] = [];
  for (const raw of scelte) {
    const id = typeof raw === 'string' ? raw.trim() : '';
    if (
      !id ||
      id === NESSUNA_DECORAZIONE_ID ||
      DECORAZIONI_RIMOSSE.has(id) ||
      ids.includes(id)
    ) continue;
    ids.push(id);
    if (ids.length >= MAX_DECORAZIONI) break;
  }
  if (ids.length === 0) return vuoto; // lista vuota = torta senza decorazioni

  // `decorazioni.supplemento` è una colonna nuova: se il database non ce l'ha
  // ancora si rilegge senza, così i nomi arrivano lo stesso nel riepilogo e il
  // supplemento vale 0 (come faceva priceOf prima della scelta multipla).
  const conSupplemento = await supabase
    .from('decorazioni')
    .select('id, nome, supplemento')
    .eq('attivo', true)
    .in('id', ids);
  const res = conSupplemento.error
    ? await supabase.from('decorazioni').select('id, nome').eq('attivo', true).in('id', ids)
    : conSupplemento;
  if (res.error || !res.data) return vuoto;

  const righe = new Map(
    (res.data as { id: string; nome?: string; supplemento?: unknown }[]).map((r) => [r.id, r]),
  );

  let euros = 0;
  const labels: string[] = [];
  for (const id of ids) { // si scorre l'ordine di scelta, non quello del database
    const row = righe.get(id);
    if (!row) continue; // id sconosciuto (listino cambiato): non si fa pagare nulla
    euros += num(row.supplemento);
    const colore = colorLabel(colori[id]);
    labels.push(`${row.nome || id}${colore ? ` (${colore})` : ''}`);
  }
  return { euros, labels };
}

// Extra dell'ordine (salame dolce al kg, cabaret di pasticcini): la config manda
// una mappa { idExtra: quantità } e i prezzi si leggono dalla tabella `extra`.
// La tabella è OPZIONALE: se non esiste ancora si considera "nessun extra" e non
// si somma nulla, così il pagamento non si rompe mai.
async function extrasOf(
  supabase: SupabaseClient,
  extras?: Record<string, number>,
): Promise<{ euros: number; labels: string[] }> {
  const vuoto = { euros: 0, labels: [] as string[] };
  if (!extras || typeof extras !== 'object' || Array.isArray(extras)) return vuoto;

  // Quantità ripulite: solo positive e finite (mai negative, che scalerebbero il totale).
  const qty = new Map<string, number>();
  for (const [id, raw] of Object.entries(extras)) {
    const q = num(raw);
    if (!id || q <= 0) continue;
    qty.set(id, Math.min(q, MAX_EXTRA_QTY));
    if (qty.size >= MAX_EXTRA_ITEMS) break;
  }
  if (qty.size === 0) return vuoto;

  const { data, error } = await supabase
    .from('extra')
    .select('id, nome, prezzo')
    .in('id', [...qty.keys()]);
  if (error || !data) return vuoto; // tabella non ancora creata: nessun extra

  let euros = 0;
  const labels: string[] = [];
  for (const row of data as { id: string; nome?: string; prezzo?: unknown }[]) {
    const q = qty.get(row.id) ?? 0;
    if (!q) continue;
    euros += num(row.prezzo) * q;
    labels.push(`${row.nome || row.id} ×${fmtQty(q)}`);
  }
  return { euros, labels };
}

export async function computeOrder(supabase: SupabaseClient, config: CakeConfig) {
  // Il crumble si conteggia solo con la base croccante, esattamente come nel frontend.
  const crumbleId = config.baseId === CRUMBLE_BASE_ID ? config.crumbleId : undefined;

  const [tipoBase, dim, forma, base, crumble, farc, cop, deco, extra] = await Promise.all([
    priceOf(supabase, 'tipi_torta', 'prezzo_base', config.type),
    priceOf(supabase, 'dimensioni', 'supplemento', config.sizeId),
    priceOf(supabase, 'forme', 'supplemento', config.shape),
    priceOf(supabase, 'basi', 'supplemento', config.baseId),
    priceOf(supabase, 'crumble', 'supplemento', crumbleId),
    priceOf(supabase, 'farciture', 'supplemento', config.fillingId),
    priceOf(supabase, 'coperture', 'supplemento', config.coveringId),
    // Decorazioni: si sommano i supplementi di tutte quelle scelte.
    decorationsOf(supabase, config),
    extrasOf(supabase, config.extras),
  ]);

  let euros = tipoBase + dim + forma + base + crumble + farc + cop + deco.euros + extra.euros;
  // I gusti sono TUTTI compresi nel prezzo della torta (nessun supplemento per gli
  // strati in più) e la candelina è un regalo della gelateria.
  // ⚠️ Stessa regola lato sito: `total` in src/components/CakeConfigurator.jsx.
  if (config.photo) euros += 5;
  if (config.delivery) euros += 4; // consegna a domicilio (DELIVERY_FEE)

  // ── Codice sconto ────────────────────────────────────────────────────
  // Qui è l'unico posto che conta: l'importo addebitato nasce da questa riga.
  // Il codice che arriva dal browser NON è preso per buono — si richiede al
  // database se vale, adesso, su QUESTO totale (scadenza, utilizzi, minimo di
  // spesa). Chi scrivesse un codice a mano nella console non pagherebbe meno.
  const lordo = Math.round(euros * 100) / 100;
  let sconto = 0;
  let scontoCodice: string | null = null;
  if (config.scontoCodice) {
    const { data } = await supabase.rpc('verifica_sconto', {
      p_codice: config.scontoCodice,
      p_totale: lordo,
    });
    if (data && data.valido) {
      sconto = Number(data.sconto) || 0;
      scontoCodice = data.codice as string;
    }
  }
  // Mai sotto il minimo addebitabile da Stripe (~0,50 €): uno sconto che porta
  // il totale a zero farebbe fallire il pagamento con un errore incomprensibile.
  const MINIMO = 0.5;
  if (lordo - sconto < MINIMO) sconto = Math.max(0, Math.round((lordo - MINIMO) * 100) / 100);
  euros = lordo - sconto;

  const amountCents = Math.round(euros * 100);

  // Riepilogo leggibile per Stripe e per la notifica Telegram
  const [tipoNome, sizeEt, formaNome] = await Promise.all([
    nameOf(supabase, 'tipi_torta', config.type),
    nameOf(supabase, 'dimensioni', config.sizeId, 'etichetta'),
    nameOf(supabase, 'forme', config.shape),
  ]);
  const flavorNames = (config.flavors ?? []).map((f) => f.name).join(', ');
  const summary = [
    tipoNome && `${tipoNome}`,
    formaNome && `forma ${formaNome.toLowerCase()}`,
    sizeEt && sizeEt,
    flavorNames && `gusti: ${flavorNames}`,
    deco.labels.length && `decorazioni: ${deco.labels.join(', ')}`,
    extra.labels.length && `extra: ${extra.labels.join(', ')}`,
  ].filter(Boolean).join(' · ');

  return { amountCents, summary, sconto, scontoCodice, lordo };
}
