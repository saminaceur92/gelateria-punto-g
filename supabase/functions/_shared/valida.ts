// Validazione LATO SERVER dell'ordine torta, prima di qualsiasi addebito.
//
// Il browser manda la configurazione scelta nel configuratore; qui la si
// confronta con il listino VERO, appena letto da Supabase (listino.ts). Ogni
// scelta deve esistere, essere accesa (attivo = true) e rispettare le stesse
// regole del configuratore. Niente correzioni silenziose: se qualcosa non va
// si lancia OrdineRifiutato con un `codice`, create-checkout lo gira al sito
// e il sito rilegge il listino e riporta il cliente al passo giusto (catch del
// pagamento in CakeConfigurator.jsx e src/lib/riallineaListino.js).
//
// Perché: prima un tipo sconosciuto valeva 0 €, una taglia spenta si pagava
// al suo prezzo, un extra spento si vendeva e una decorazione tolta dal menù
// finiva nel riepilogo del laboratorio senza essere pagata.
//
// Funzioni PURE, senza import di rete: si provano con Node (tests/) e Deno.
// ⚠️ Ogni regola qui deve essere GIÀ imposta dal sito, altrimenti si
// rifiuterebbero clienti veri: accanto a ogni regola c'è dove sta la gemella.
import { TALL_TYPE_IDS, tagliaAmmessa } from './taglie.ts';
import { formeAmmesse } from './forme.ts';

export type Riga = Record<string, unknown>;

/** Il listino come lo legge caricaListino: TUTTE le righe, anche le spente. */
export interface Listino {
  tipi_torta: Riga[];
  dimensioni: Riga[];
  forme: Riga[];
  basi: Riga[];
  crumble: Riga[];
  farciture: Riga[];
  coperture: Riga[];
  decorazioni: Riga[];
  extra: Riga[];
  scritte: Riga[];
  occasioni: Riga[];
  allergeni: Riga[];
  allergeni_prodotti: Riga[];
  gusti_torte: Riga[];
}

// ── Costanti: stessi valori del sito ─────────────────────────────────────
export const CRUMBLE_BASE_ID = 'crock'; // CRUMBLE_BASE_ID in src/data/cakeOptions.js
export const NESSUNA = 'nessuna'; // inserto "Nessuna" e card "niente decorazioni"
export const FOTO_EURO = 5; // `total` in CakeConfigurator.jsx
export const CONSEGNA_EURO = 4; // DELIVERY_FEE
export const MAX_DECORAZIONI = 5; // MAX_DECORAZIONI
export const MAX_EXTRA_QTY = 20; // MAX_EXTRA_QTY (tetto di setQty)
const MAX_EXTRA_VOCI = 20;
export const MAX_SCRITTA = 24; // MAX_MESSAGE (maxLength dell'input)
export const MAX_NOTE = 1000; // MAX_NOTE (maxLength della textarea)
export const MAX_INDIRIZZO = 300; // MAX_INDIRIZZO (maxLength della textarea)
export const RECT_MIN_PERSONE = 15; // src/lib/misureTorta.js
const DEFAULT_FONT = 'corsivo'; // DEFAULT_FONT
// Vecchi id dello stile della scritta, ancora negli ordini salvati e nel link
// "Rifai questa torta": stessa mappa di LEGACY_FONTS nel configuratore.
const LEGACY_FONTS: Record<string, string> = { inter: 'stampatello', caveat: 'corsivo', fraunces: 'corsivo-scolastico' };
// Se la tabella `scritte` non ha righe accese il sito usa la sua copia di
// sicurezza (FALLBACK_SCRITTE): qui gli stessi id, coi nomi per il riepilogo.
const SCRITTE_DI_SCORTA: Riga[] = [
  { id: 'stampatello', nome: 'Stampatello maiuscolo', attivo: true },
  { id: 'corsivo', nome: 'Corsivo', attivo: true },
  { id: 'corsivo-scolastico', nome: 'Corsivo scolastico', attivo: true },
];
// Preferenze alimentari (DIETE nel configuratore): id → nome per il riepilogo.
export const DIETE: Record<string, string> = { vegan: 'Vegan', 'senza-zucchero': 'Senza zuccheri aggiunti' };

// ── Il rifiuto ───────────────────────────────────────────────────────────
// Una sola classe per tutti i "no" del server. Il sito guarda `codice` e
// `campo` (il passo del configuratore da cui ripartire) e mostra `message`.
//   409 taglia_non_valida        la taglia (codice già noto ai siti vecchi)
//   409 forma_non_valida         la forma (spenta, di un altro gruppo, rettangolare piccola)
//   409 opzione_non_disponibile  una voce sparita o spenta dal listino
//   422 scelta_non_valida        una regola del configuratore non rispettata
//   400 dati_incompleti          nome, telefono o email non validi
// `voce` dice QUALE scelta (id o nome): il sito la toglie anche se il suo
// listino, magari vecchio, la mostra ancora. Mai dati personali qui dentro:
// finisce nei log della funzione.
export class OrdineRifiutato extends Error {
  status: number;
  codice: string;
  campo: string;
  voce: string | null;
  constructor(codice: string, campo: string, messaggio: string, voce: string | null = null, status = 409) {
    super(messaggio);
    this.name = 'OrdineRifiutato';
    this.codice = codice;
    this.campo = campo;
    this.voce = voce;
    this.status = status;
  }
}

// `chi`: il nome della voce fra «», se il listino la conosce ancora; se non la
// conosce più (o non l'ha mai conosciuta) una frase come "Il tipo di torta
// scelto". Mai l'id grezzo davanti al cliente.
const nonDisponibile = (campo: string, chi: string, voce: string): never => {
  throw new OrdineRifiutato(
    'opzione_non_disponibile', campo,
    `${chi} non è più disponibile: il listino è appena cambiato. Fai un'altra scelta e conferma di nuovo.`,
    voce,
  );
};
const nonValida = (campo: string, messaggio: string, voce: string | null = null): never => {
  throw new OrdineRifiutato('scelta_non_valida', campo, messaggio, voce, 422);
};

// ── Piccoli aiuti ────────────────────────────────────────────────────────
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
export const round2 = (n: number) => Math.round(n * 100) / 100;
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const acceso = (r: Riga | undefined): boolean => !!r && r.attivo === true;
const perId = (righe: Riga[], id: unknown) =>
  (typeof id === 'string' && id ? righe.find((r) => r.id === id) : undefined);
const nomeDi = (r: Riga | undefined, ripiego: string) =>
  String((r && (r.nome ?? r.etichetta)) || ripiego);
// «Nome» se la riga c'è, altrimenti la frase generica.
const chiE = (r: Riga | undefined, generico: string) => {
  const nome = r ? nomeDi(r, '') : '';
  return nome ? `«${nome}»` : generico;
};

// ── Testi liberi del cliente ─────────────────────────────────────────────
// Caratteri di controllo e "invisibili" (direzione del testo, a capo Unicode,
// spazi di larghezza zero): non servono a nessuno e possono far sembrare un
// testo diverso da com'è. Costruita da una stringa con le sequenze di escape:
// un U+2028 scritto letterale dentro una regex rompe il parsing in Node e Deno.
const INVISIBILI = new RegExp(
  '[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F\\u200B-\\u200F\\u2028\\u2029\\u202A-\\u202E\\u2060\\u2066-\\u2069\\uFEFF]',
  'g',
);

/** Testo su UNA riga: a capo e tabulazioni diventano spazi. Taglio con "…". */
export function rigaSingola(v: unknown, max: number): string {
  const s = str(v).normalize('NFC').replace(/[\r\n\t]+/g, ' ').replace(INVISIBILI, '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

/** Testo su più righe (le note): gli a capo restano, al massimo una riga vuota di fila. */
export function testoMultiriga(v: unknown, max: number): string {
  const s = str(v).normalize('NFC').replace(/\r\n?/g, '\n').replace(INVISIBILI, '')
    .split('\n').map((r) => r.replace(/[\t ]+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n').trim();
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

// Lunghezza come la conta il `maxLength` del browser: in unità UTF-16 (JS
// .length) e con gli a capo normalizzati a uno solo.
const lunghezza = (v: unknown) => str(v).replace(/\r\n?/g, '\n').length;

/** N° persone di una taglia: stessa regola di personeOf in src/lib/misureTorta.js. */
export const personeOf = (size: Riga | undefined): number => {
  if (!size) return 0;
  const inEtichetta = String(size.etichetta ?? '').match(/\d+/);
  if (inEtichetta) return Number(inEtichetta[0]);
  return /^\d+$/.test(String(size.id ?? '')) ? Number(size.id) : 0;
};

// Stesse regole del passo "I tuoi dati" (emailOk e phoneOk nel configuratore).
export const emailOk = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());
export const phoneOk = (s: string) => {
  let d = s.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('39')) d = d.slice(2);
  if (d.length === 14 && d.startsWith('0039')) d = d.slice(4);
  return d.length === 10;
};

/**
 * "AAAA-MM-GG" di oggi a Roma: un ordine all'una di notte non è nel passato.
 * Anno, mese e giorno si prendono a pezzi (formatToParts): il formato di una
 * lingua, anche di 'en-CA', è cambiato fra una versione e l'altra di ICU.
 */
export function oggiARoma(adesso: Date = new Date()): string {
  const parti: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(adesso)) parti[p.type] = p.value;
  return `${parti.year}-${parti.month}-${parti.day}`;
}

// Oggetti piccoli "di presentazione" (photoTransform, scrittaSuFoto): non
// cambiano il prezzo e nel riepilogo non si stampano, ma servono all'anteprima
// e al laboratorio. Si tengono numeri finiti, vero/falso e parole brevi (es.
// orient: 'verticale'), al massimo 12 chiavi; il resto si scarta. Generico di
// proposito: un campo nuovo dell'editor della foto non va perso per strada.
function oggettoPiccolo(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>).slice(0, 12)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,30}$/.test(k)) continue;
    if (typeof x === 'number' && Number.isFinite(x)) out[k] = Math.max(-10000, Math.min(10000, x));
    else if (typeof x === 'boolean') out[k] = x;
    else if (typeof x === 'string' && /^[A-Za-z0-9 _.-]{0,40}$/.test(x)) out[k] = x;
  }
  return out;
}

/**
 * Una scelta singola da un elenco: deve esserci (altrimenti 422 con `manca`),
 * esistere ed essere accesa (altrimenti 409; `generico` è la frase da usare
 * se il listino quella voce non la conosce, es. "La copertura scelta").
 */
function scelta(righe: Riga[], id: unknown, campo: string, manca: string, generico: string): Riga {
  if (typeof id !== 'string' || !id.trim()) nonValida(campo, manca);
  const r = perId(righe, id);
  if (!r || !acceso(r)) nonDisponibile(campo, chiE(r, generico), String(id));
  return r as Riga;
}

/** I gusti per torte: come live.js, dalla lista unica (per_torte) o dai vecchi gusti_torte. */
export function gustiPerTorte(L: Listino): { nome: string; colore: string }[] {
  const perTorte = L.allergeni_prodotti.filter((r) => acceso(r) && r.per_torte === true);
  return perTorte.length
    ? perTorte.map((r) => ({ nome: String(r.gusto ?? ''), colore: str(r.colore) || '#f5d97a' }))
    : L.gusti_torte.filter(acceso).map((r) => ({ nome: String(r.nome ?? ''), colore: str(r.colore) }));
}

const listaColori = (r: Riga): string[] | null =>
  (r.colori == null ? null : str(r.colori).split(',').map((x) => x.trim()).filter(Boolean));

export interface OrdineValidato {
  /** La config ripulita: va in `dettagli`, con le stesse chiavi del configuratore. */
  canon: Record<string, unknown>;
  /** Le righe di listino trovate: nomi e prezzi del giorno dell'ordine. */
  righe: {
    tipo: Riga;
    taglia: Riga;
    forma: Riga;
    base: Riga;
    crumble: Riga | null;
    farcitura: Riga;
    copertura: Riga;
    decorazioni: { riga: Riga; colore: string }[];
    extra: { riga: Riga; q: number }[];
    scritta: Riga | null;
    gusti: { nome: string; colore: string }[];
    allergeni: string[]; // nomi, per il riepilogo
  };
}

/**
 * Controlla la configurazione che arriva dal browser contro il listino.
 * Lancia OrdineRifiutato alla prima cosa che non va (nell'ordine dei passi,
 * così il cliente riparte dal primo passo da sistemare).
 * `oggi` = data di oggi a Roma (oggiARoma), passata da fuori per i test.
 */
export function validaOrdine(config: unknown, L: Listino, oggi: string): OrdineValidato {
  const c = (config && typeof config === 'object' && !Array.isArray(config) ? config : {}) as Riga;

  // ── Tipo ──
  const tipo = scelta(L.tipi_torta, c.type, 'type', 'Manca il tipo di torta: torna al primo passo e sceglilo.', 'Il tipo di torta scelto');
  const tortaAlta = TALL_TYPE_IDS.includes(String(tipo.id));

  // ── Taglia: accesa e della lista giusta per il tipo ──
  // ⚠️ Sito: canNext 'size' con taglieDelTipo (src/lib/misureTorta.js) sulle
  // sole taglie accese. Codice taglia_non_valida: lo capiscono anche i siti
  // rimasti aperti da prima di questa versione.
  const taglia = perId(L.dimensioni, c.sizeId);
  const alteAccese = L.dimensioni.filter((s) => acceso(s) && s.alta === true).length;
  if (!taglia || !acceso(taglia) ||
      !tagliaAmmessa({ tortaAlta, tagliaAlta: taglia.alta === true, alteAttive: alteAccese })) {
    throw new OrdineRifiutato(
      'taglia_non_valida', 'size',
      'La taglia scelta non vale per questo tipo di torta: torna al passo "Per quante persone?" e sceglila di nuovo.',
      typeof c.sizeId === 'string' ? c.sizeId : null,
    );
  }

  // ── Forma: accesa, ammessa per il gruppo (punto 17), rettangolare da 15 persone ──
  // ⚠️ Sito: StepShape e canNext 'shape' (rettangolare solo da RECT_MIN_PERSONE).
  const forma = perId(L.forme, c.shape);
  const formaId = typeof c.shape === 'string' ? c.shape : '';
  if (!forma || !acceso(forma)) {
    throw new OrdineRifiutato('forma_non_valida', 'shape',
      `${chiE(forma, 'La forma scelta')} non è più disponibile: scegli un'altra forma e conferma di nuovo.`,
      formaId || null);
  }
  if (!formeAmmesse(L.forme, tortaAlta).includes(String(forma.id))) {
    throw new OrdineRifiutato('forma_non_valida', 'shape',
      `La forma «${nomeDi(forma, formaId)}» non si fa per questo tipo di torta: scegline un'altra e conferma di nuovo.`,
      formaId);
  }
  if (forma.id === 'rettangolare' && personeOf(taglia) < RECT_MIN_PERSONE) {
    throw new OrdineRifiutato('forma_non_valida', 'shape',
      `La forma rettangolare si fa da ${RECT_MIN_PERSONE} persone in su: scegli un'altra forma o una taglia più grande.`,
      formaId);
  }

  // ── Base e crumble ──
  // ⚠️ Sito: il passo del crumble compare solo con la base croccante e se c'è
  // almeno un crumble acceso (showCrumble); lì la scelta è obbligatoria.
  const base = scelta(L.basi, c.baseId, 'base', 'Manca la base della torta: torna al passo e sceglila.', 'La base scelta');
  let crumble: Riga | null = null;
  if (base.id === CRUMBLE_BASE_ID && L.crumble.some(acceso)) {
    crumble = scelta(L.crumble, c.crumbleId, 'crumble', 'Manca il tipo di crumble: torna al passo e sceglilo.', 'Il crumble scelto');
  }

  // ── Gusti: per NOME, come li legge il sito (live.js) ──
  // ⚠️ Sito: almeno 1 (canNext 'flavors'), al massimo 2 o 4 per le alte
  // (maxFlavorsFor). Gli strati si possono ripetere.
  const elencoGusti = gustiPerTorte(L);
  const flavors = Array.isArray(c.flavors) ? c.flavors : [];
  const maxGusti = tortaAlta ? 4 : 2;
  if (flavors.length < 1) nonValida('flavors', 'Scegli almeno un gusto per gli strati.');
  if (flavors.length > maxGusti) {
    nonValida('flavors', `Questa torta può avere al massimo ${maxGusti} gusti: togline qualcuno e conferma di nuovo.`);
  }
  const gusti = flavors.map((f) => {
    const nome = rigaSingola(typeof f === 'string' ? f : (f as Riga)?.name, 80);
    const g = elencoGusti.find((x) => x.nome.trim().toLowerCase() === nome.toLowerCase());
    if (!g) nonDisponibile('flavors', nome ? `Il gusto «${nome}»` : 'Uno dei gusti scelti', nome);
    return g as { nome: string; colore: string };
  });

  // ── Inserto e copertura ──
  const farcitura = scelta(L.farciture, c.fillingId ?? NESSUNA, 'filling', "Manca l'inserto: torna al passo e sceglilo.", "L'inserto scelto");
  const copertura = scelta(L.coperture, c.coveringId, 'covering', 'Manca la copertura: torna al passo e sceglila.', 'La copertura scelta');

  // ── Decorazioni e colori ──
  // ⚠️ Sito: StepDecoration (al massimo MAX_DECORAZIONI) e canNext
  // 'decoration' (colore obbligatorio, uno di quelli della decorazione).
  // Formato vecchio a decorazione singola (decoration/decorationColor): lo
  // mandano ancora "Rifai questa torta" e gli ordini salvati prima.
  const nuovo = Array.isArray(c.decorations);
  const grezze: unknown[] = nuovo ? (c.decorations as unknown[]) : (c.decoration ? [c.decoration] : []);
  const coloriIn: Riga = c.decorationColors && typeof c.decorationColors === 'object' && !Array.isArray(c.decorationColors)
    ? c.decorationColors as Riga
    : (!nuovo && typeof c.decoration === 'string' ? { [c.decoration]: c.decorationColor } : {});
  const ids: string[] = [];
  for (const raw of grezze) {
    const id = typeof raw === 'string' ? raw.trim() : '';
    if (!id || id === NESSUNA || ids.includes(id)) continue;
    ids.push(id);
  }
  if (ids.length > MAX_DECORAZIONI) {
    nonValida('decoration', `Puoi scegliere al massimo ${MAX_DECORAZIONI} decorazioni: togline qualcuna e conferma di nuovo.`);
  }
  const decorazioni = ids.map((id) => {
    const riga = scelta(L.decorazioni, id, 'decoration', 'Manca una decorazione.', 'Una delle decorazioni scelte');
    const lista = listaColori(riga);
    const voluto = rigaSingola(coloriIn[id], 30);
    let colore = '';
    if (riga.scelta_colore === true && lista && lista.length) {
      colore = lista.find((x) => x.toLowerCase() === voluto.toLowerCase()) || '';
      if (!colore && !voluto) nonValida('decoration', `Scegli il colore di «${nomeDi(riga, id)}».`, id);
      if (!colore) nonDisponibile('decoration', `Il colore «${voluto}» di «${nomeDi(riga, id)}»`, id);
    } else if (riga.scelta_colore === true && lista === null) {
      // Colonna `colori` assente: il sito usa i colori della sua copia di
      // sicurezza, qui si accetta il testo ripulito.
      colore = voluto;
    }
    return { riga, colore };
  });

  // ── Scritta, stile e occasione ──
  // ⚠️ Sito: maxLength MAX_MESSAGE sull'input (StepMessage); stili dalla
  // tabella `scritte` o dalla copia di sicurezza; occasioni accese.
  if (lunghezza(c.message) > MAX_SCRITTA) {
    nonValida('message', `La scritta può avere al massimo ${MAX_SCRITTA} caratteri: accorciala e conferma di nuovo.`);
  }
  const message = rigaSingola(c.message, MAX_SCRITTA);
  let scritta: Riga | null = null;
  let messageFont = DEFAULT_FONT;
  if (message) {
    const font = LEGACY_FONTS[str(c.messageFont)] || str(c.messageFont) || DEFAULT_FONT;
    const stili = L.scritte.some(acceso) ? L.scritte : SCRITTE_DI_SCORTA;
    scritta = scelta(stili, font, 'message', 'Manca lo stile della scritta.', 'Lo stile della scritta scelto');
    messageFont = font;
  }
  const occasioneIn = rigaSingola(c.occasion, 80);
  const occasione = occasioneIn ? L.occasioni.find((o) => acceso(o) && String(o.nome ?? '').trim() === occasioneIn) : null;
  if (occasioneIn && !occasione) nonDisponibile('message', `L'occasione «${occasioneIn}»`, occasioneIn);

  // ── Allergie (mai scartate: sono sicurezza) e preferenze ──
  const allergies = (Array.isArray(c.allergies) ? c.allergies : []).slice(0, 30)
    .map((a) => rigaSingola(a, 40)).filter(Boolean);
  const diets = (Array.isArray(c.diets) ? c.diets : []).map(String).filter((d) => d in DIETE);
  const nomeAllergene = (id: string) => String(L.allergeni.find((a) => a.id === id)?.nome || id);

  // ── Consegna, data e ora, dati del cliente ──
  // ⚠️ Sito: canNext 'details' (nome non vuoto, telefono e email validi,
  // indirizzo con la consegna, "dove si mangia" risposto, data e ora scelte).
  const delivery = c.delivery === true;
  if (delivery && lunghezza(c.deliveryAddress) > MAX_INDIRIZZO) {
    nonValida('details', `L'indirizzo può avere al massimo ${MAX_INDIRIZZO} caratteri: accorcialo e conferma di nuovo.`);
  }
  const deliveryAddress = delivery ? rigaSingola(c.deliveryAddress, MAX_INDIRIZZO) : '';
  if (delivery && !deliveryAddress) nonValida('details', "Manca l'indirizzo di consegna.");
  if (c.inLocale !== true && c.inLocale !== false) nonValida('details', 'Indica dove verrà mangiata la torta.');
  const pickupDate = str(c.pickupDate);
  const pickupTime = str(c.pickupTime);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pickupDate) || Number.isNaN(Date.parse(`${pickupDate}T00:00:00Z`))) {
    nonValida('details', 'Manca il giorno di ritiro: torna al passo dei dati e sceglilo.');
  }
  if (pickupDate < oggi) nonValida('details', 'Il giorno scelto è già passato: scegline un altro e conferma di nuovo.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(pickupTime)) nonValida('details', "Manca l'ora: torna al passo dei dati e sceglila.");

  const name = rigaSingola(c.name, 120);
  const phone = rigaSingola(c.phone, 40);
  const email = rigaSingola(c.email, 254).toLowerCase();
  if (!name || !phoneOk(str(c.phone)) || !emailOk(email) || str(c.email).trim().length > 254) {
    throw new OrdineRifiutato('dati_incompleti', 'details', 'Controlla nome, telefono ed email e conferma di nuovo.', null, 400);
  }
  if (lunghezza(c.notes) > MAX_NOTE) {
    nonValida('details', `Le note possono avere al massimo ${MAX_NOTE} caratteri: accorciale e conferma di nuovo.`);
  }
  const notes = testoMultiriga(c.notes, MAX_NOTE);

  // ── Extra (si propongono a ordine finito, quindi per ultimi) ──
  // ⚠️ Sito: ProposteExtra (setQty: passo dell'extra, tetto MAX_EXTRA_QTY).
  const extraIn = c.extras && typeof c.extras === 'object' && !Array.isArray(c.extras) ? c.extras as Riga : {};
  const voci = Object.entries(extraIn).filter(([, q]) => num(q) !== 0);
  if (voci.length > MAX_EXTRA_VOCI) nonValida('extras', 'Troppi extra nello stesso ordine.');
  const extra = voci.map(([id, qRaw]) => {
    const riga = scelta(L.extra, id, 'extras', "Manca l'extra.", 'Uno degli extra scelti');
    const q = num(qRaw);
    // Passo: colonna `passo`; se manca, mezzo kg per chi si vende al kg,
    // altrimenti 1 (stessa deduzione di live.js).
    const passo = num(riga.passo ?? riga.step) || (/kg/i.test(str(riga.unita)) ? 0.5 : 1);
    const multiplo = Math.abs(q / passo - Math.round(q / passo)) < 1e-9;
    if (q <= 0 || q > MAX_EXTRA_QTY || !multiplo) {
      nonValida('extras', `Quantità non valida per «${nomeDi(riga, id)}»: controlla gli extra e conferma di nuovo.`, id);
    }
    return { riga, q };
  });

  const photoTransform = { zoom: 1, posX: 50, posY: 50, ...(oggettoPiccolo(c.photoTransform) || {}) };

  // La configurazione ripulita, con le STESSE chiavi di oggi: la leggono la
  // dashboard, i promemoria e "Rifai questa torta" (PREFILL_KEYS).
  const canon: Record<string, unknown> = {
    type: tipo.id,
    sizeId: taglia.id,
    shape: forma.id,
    allergies,
    noAllergies: c.noAllergies === true && allergies.length === 0,
    diets,
    flavors: gusti.map((g) => ({ name: g.nome, color: g.colore })),
    baseId: base.id,
    crumbleId: crumble ? crumble.id : '',
    fillingId: farcitura.id,
    coveringId: copertura.id,
    decorations: decorazioni.map((d) => d.riga.id),
    decorationColors: Object.fromEntries(decorazioni.filter((d) => d.colore).map((d) => [d.riga.id, d.colore])),
    extras: Object.fromEntries(extra.map((e) => [e.riga.id, e.q])),
    message,
    messageFont,
    candle: c.candle === true,
    occasion: occasione ? String(occasione.nome).trim() : '',
    surprise: c.surprise === true,
    gift: c.gift === true,
    photoTransform,
    conFoto: !!c.photo,
    pickupDate,
    pickupTime,
    delivery,
    deliveryAddress,
    inLocale: c.inLocale,
    name,
    phone,
    email,
    notes,
  };
  // Campi nuovi di altri punti, tenuti solo se hanno la forma prevista: il
  // server riscrive `dettagli` da zero, e senza questa riga si perderebbero.
  //   promemoria   (punto 3)  vero/falso: promemoria fra un anno sì o no
  //   consigliata  (punto 19) id della torta già composta scelta
  //   scrittaSuFoto (punto 11) colore/posizione della scritta sopra la foto
  // ⚠️ Un campo nuovo della configurazione va aggiunto QUI, altrimenti il
  // server lo scarta.
  if (typeof c.promemoria === 'boolean') canon.promemoria = c.promemoria;
  if (typeof c.consigliata === 'string' && /^[a-z0-9-]{1,40}$/.test(c.consigliata)) canon.consigliata = c.consigliata;
  const scrittaSuFoto = oggettoPiccolo(c.scrittaSuFoto);
  if (scrittaSuFoto) canon.scrittaSuFoto = scrittaSuFoto;

  return {
    canon,
    righe: {
      tipo, taglia, forma, base, crumble, farcitura, copertura, decorazioni, extra, scritta,
      gusti, allergeni: allergies.map(nomeAllergene),
    },
  };
}

export interface Prezzo {
  lordo: number;
  voci: { voce: string; euro: number }[];
}

/**
 * Il prezzo dalle righe già validate, con la scomposizione voce per voce.
 * ⚠️ Stessa formula di `total` in CakeConfigurator.jsx:
 *   prezzo_base(tipo) + supplementi di taglia, forma, base, crumble (solo con
 *   la base croccante), inserto, copertura e di OGNI decorazione
 *   + 5 € foto + 4 € consegna + Σ (prezzo extra × quantità).
 * I gusti sono tutti compresi e la candelina è un regalo; la scritta non
 * cambia il prezzo. tests/pagamenti.test.mjs controlla la parità su migliaia
 * di torte a caso.
 */
export function prezzoOrdine(v: OrdineValidato): Prezzo {
  const r = v.righe;
  const voci: { voce: string; euro: number }[] = [];
  const add = (voce: string, euro: number) => { if (euro) voci.push({ voce, euro: round2(euro) }); };
  add(`Tipo: ${r.tipo.nome}`, num(r.tipo.prezzo_base));
  add(`Taglia: ${r.taglia.etichetta}`, num(r.taglia.supplemento));
  add(`Forma: ${r.forma.nome}`, num(r.forma.supplemento));
  add(`Base: ${r.base.nome}`, num(r.base.supplemento));
  if (r.crumble) add(`Crumble: ${r.crumble.nome}`, num(r.crumble.supplemento));
  add(`Inserto: ${r.farcitura.nome}`, num(r.farcitura.supplemento));
  add(`Copertura: ${r.copertura.nome}`, num(r.copertura.supplemento));
  for (const d of r.decorazioni) add(`Decorazione: ${d.riga.nome}`, num(d.riga.supplemento));
  if (v.canon.conFoto === true) add('Foto su cialda', FOTO_EURO);
  if (v.canon.delivery === true) add('Consegna a domicilio', CONSEGNA_EURO);
  for (const e of r.extra) add(`Extra: ${e.riga.nome} ×${String(e.q).replace('.', ',')}`, num(e.riga.prezzo) * e.q);
  return { lordo: round2(voci.reduce((s, x) => s + x.euro, 0)), voci };
}
