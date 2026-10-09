// La riga `ordini` di un ordine pagato dal sito, scritta DAL SERVER.
//
// create-checkout la costruisce dalla configurazione già validata (valida.ts)
// e dall'importo davvero addebitato, la mette nei metadata della sessione
// Stripe (metadati.ts) e il webhook la salva quando il pagamento è riuscito.
// Dal browser si prendono solo gli URL delle foto già caricate su Storage
// (controllati qui sotto) e il "ho visto l'avviso dei promemoria".
//
// Funzioni PURE: si provano con Node (tests/riepilogo.test.mjs).
import {
  CONSEGNA_EURO, CRUMBLE_BASE_ID, DIETE, NESSUNA, round2,
  type OrdineValidato, type Prezzo, type Riga,
} from './valida.ts';
import { parametriEmail, testoRiepilogo, type DatiRiepilogo } from './riepilogo.ts';

// ── Misure della torta (porting di src/lib/misureTorta.js) ───────────────
// ⚠️ Stessa logica di misureDi/misuraTesto/dimensioneTesto del sito: la riga
// "Dimensione:" deve dire la stessa cosa al banco e online. Il test confronta
// le due versioni su tutte le taglie e le forme.
const MISURA_FORMA: Record<string, { tipo: 'diametro' | 'lato' | 'lati'; lati: number }> = {
  tonda: { tipo: 'diametro', lati: 1 },
  cuore: { tipo: 'diametro', lati: 1 },
  quadrata: { tipo: 'lato', lati: 1 },
  rettangolare: { tipo: 'lati', lati: 2 },
};
const positivo = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const cm = (n: number) => String(n).replace('.', ',');

/** "10 persone · Ø 24 cm" da una riga di `dimensioni` (solo l'etichetta se la misura non c'è). */
export function dimensioneTesto(size: Riga, formaId: string): string {
  const { tipo, lati } = MISURA_FORMA[formaId] || MISURA_FORMA.tonda;
  const tonda = positivo(size.diametro);
  let m: number[] = [];
  if (!formaId || formaId === 'tonda') {
    m = tonda ? [tonda] : [];
  } else {
    const misure = (size.misure && typeof size.misure === 'object' ? size.misure : {}) as Record<string, unknown>;
    const scritte = (Array.isArray(misure[formaId]) ? misure[formaId] as unknown[] : []).slice(0, lati).map(positivo);
    if (scritte.length === lati && scritte.every((x) => x !== null)) m = scritte as number[];
    else m = tipo === 'diametro' && tonda ? [tonda] : [];
  }
  const misura = !m.length
    ? ''
    : tipo === 'diametro' ? `Ø ${cm(m[0])} cm` : tipo === 'lato' ? `${cm(m[0])}×${cm(m[0])} cm` : `${cm(m[0])}×${cm(m[1])} cm`;
  return [String(size.etichetta ?? ''), misura].filter(Boolean).join(' · ');
}

// ── Foto caricate dal browser ────────────────────────────────────────────
export interface Foto {
  cialda: string | null; // foto del cliente per la cialda
  anteprima: string | null; // render 3D per la lista ordini
  originale: string | null; // foto intera, se un giorno il sito la carica a parte
}

/**
 * Gli URL delle foto si prendono dal browser SOLO se sono file pubblici del
 * bucket `torte` di QUESTO progetto, col percorso che crea src/lib/cakePhoto.js
 * ("2026-10/<id>-cialda.jpg"). Qualsiasi altro indirizzo diventa null: nessun
 * link esterno finisce su Telegram o in dashboard. `basi` sono gli inizi
 * ammessi, uno per indirizzo del progetto (vedi create-checkout).
 */
export function fotoDalBrowser(insert: unknown, basi: string[]): Foto {
  const ins = (insert && typeof insert === 'object' ? insert : {}) as Riga;
  const det = (ins.dettagli && typeof ins.dettagli === 'object' ? ins.dettagli : {}) as Riga;
  const prefissi = basi.filter(Boolean).map((b) => `${b.replace(/\/+$/, '')}/storage/v1/object/public/torte/`);
  const buono = (u: unknown): string | null => {
    if (typeof u !== 'string' || u.length > 500) return null;
    const p = prefissi.find((x) => u.startsWith(x));
    if (!p) return null;
    return /^\d{4}-\d{2}\/[A-Za-z0-9-]{8,64}-[a-z]{3,20}\.(jpg|jpeg|png|webp)$/.test(u.slice(p.length)) ? u : null;
  };
  return {
    cialda: buono(det.fotoCialdaUrl),
    anteprima: buono(det.tortaConfigurataUrl) ?? buono(ins.immagine),
    originale: buono(det.fotoOriginaleUrl),
  };
}

/**
 * "Il cliente ha visto l'avviso dei promemoria" (punto 3): lo può dire solo
 * il browser, che l'avviso lo mostra. Senza, l'Anniversario non crea
 * promemoria (i siti vecchi non mostravano l'avviso). Vale solo `true`.
 */
export function avvisoPromemoriaDalBrowser(insert: unknown, config: unknown): boolean {
  const ins = (insert && typeof insert === 'object' ? insert : {}) as Riga;
  const det = (ins.dettagli && typeof ins.dettagli === 'object' ? ins.dettagli : {}) as Riga;
  const cfg = (config && typeof config === 'object' ? config : {}) as Riga;
  return det.promemoriaAvviso === true || cfg.promemoriaAvviso === true;
}

export interface Sconto {
  codice: string;
  euro: number;
}

/** Testo del pagamento su Stripe ("Torta personalizzata — …"), con i nomi del listino. */
export function riassuntoStripe(v: OrdineValidato): string {
  const r = v.righe;
  const fmt = (q: number) => (Number.isInteger(q) ? String(q) : String(q).replace('.', ','));
  const testo = [
    String(r.tipo.nome ?? ''),
    r.forma.nome ? `forma ${String(r.forma.nome).toLowerCase()}` : '',
    String(r.taglia.etichetta ?? ''),
    r.gusti.length ? `gusti: ${r.gusti.map((g) => g.nome).join(', ')}` : '',
    r.decorazioni.length
      ? `decorazioni: ${r.decorazioni.map((d) => `${d.riga.nome}${d.colore ? ` (${d.colore})` : ''}`).join(', ')}`
      : '',
    r.extra.length ? `extra: ${r.extra.map((e) => `${e.riga.nome} ×${fmt(e.q)}`).join(', ')}` : '',
  ].filter(Boolean).join(' · ');
  return testo.length > 500 ? `${testo.slice(0, 499)}…` : testo;
}

/**
 * La riga da salvare in `ordini`: SOLO le colonne che il webhook accetta dai
 * metadata (vedi COLONNE_DAL_METADATA in webhook.ts). Stato, totale, sconto
 * e campi Stripe li aggiunge il webhook a pagamento avvenuto.
 */
export function rigaOrdine(
  v: OrdineValidato,
  prezzo: Prezzo,
  sconto: Sconto | null,
  totale: number,
  dalBrowser: { foto: Foto; promemoriaAvviso: boolean },
) {
  const c = v.canon;
  const r = v.righe;
  const { foto } = dalBrowser;
  const dimensione = dimensioneTesto(r.taglia, String(r.forma.id));
  const scrittaStile = r.scritta ? String(r.scritta.nome ?? '') : '';
  const extra = r.extra.map((e) => ({
    id: String(e.riga.id),
    nome: String(e.riga.nome ?? ''),
    quantita: e.q,
    unita: String(e.riga.unita ?? ''),
    prezzo: Number(e.riga.prezzo) || 0,
    totale: round2((Number(e.riga.prezzo) || 0) * e.q),
  }));
  const dati: DatiRiepilogo = {
    allergeni: r.allergeni,
    preferenze: (c.diets as string[]).map((d) => DIETE[d] || d),
    tipo: String(r.tipo.nome ?? ''),
    forma: String(r.forma.nome ?? ''),
    dimensione,
    base: String(r.base.nome ?? ''),
    // Con la base croccante la descrizione ("scegli sotto il gusto del
    // crumble") è un'istruzione per chi ordina, non per il laboratorio: come
    // nel configuratore, la si toglie (la riga del crumble dice già quale).
    baseDescrizione: r.base.id !== CRUMBLE_BASE_ID ? String(r.base.descrizione ?? '') : '',
    crumble: r.crumble ? String(r.crumble.nome ?? '') : '',
    gusti: r.gusti.map((g) => g.nome),
    farcitura: r.farcitura.id !== NESSUNA ? String(r.farcitura.nome ?? '') : '',
    copertura: String(r.copertura.nome ?? ''),
    decorazioni: r.decorazioni.map((d) => ({ nome: String(d.riga.nome ?? ''), colore: d.colore })),
    extra: extra.map((e) => ({ nome: e.nome, quantita: e.quantita, unita: e.unita, totale: e.totale })),
    scritta: String(c.message ?? ''),
    scrittaStile,
    foto: c.conFoto === true,
    fotoArrivata: !!foto.cialda,
    candelina: c.candle === true,
    occasione: String(c.occasion ?? ''),
    sconto,
    sorpresa: c.surprise === true,
    regalo: c.gift === true,
    consegna: c.delivery === true,
    data: String(c.pickupDate ?? ''),
    ora: String(c.pickupTime ?? ''),
    indirizzo: String(c.deliveryAddress ?? ''),
    costoConsegna: CONSEGNA_EURO,
    doveSiMangia: c.inLocale === true ? 'in un locale (ristorante, pizzeria…)' : c.inLocale === false ? 'a casa' : '',
    cliente: String(c.name ?? ''),
    telefono: String(c.phone ?? ''),
    email: String(c.email ?? ''),
    note: String(c.notes ?? ''),
    totale,
  };
  const primaDeco = r.decorazioni[0];
  const dettagli: Record<string, unknown> = {
    // (a) la configurazione ripulita, con le chiavi di sempre
    ...c,
    // (b) i campi derivati che il configuratore scrive anche per gli ordini al
    // banco: li leggono dashboard, Telegram (foto) e "Rifai questa torta"
    fotoCialdaUrl: foto.cialda,
    tortaConfigurataUrl: foto.anteprima,
    pagamentoStaff: null,
    scrittaStile: scrittaStile || null,
    // compatibilità: la decorazione "singola" di una volta = la prima scelta
    decoration: primaDeco ? primaDeco.riga.id : NESSUNA,
    decorationColor: primaDeco ? primaDeco.colore : '',
    coloreDecorazione: primaDeco && primaDeco.colore ? primaDeco.colore : null,
    decorazioniScelte: r.decorazioni.map((d) => ({ id: d.riga.id, nome: d.riga.nome, colore: d.colore })),
    extraScelti: extra,
    // (c) novità: chi ha scritto il riepilogo e su quali dati
    autore: 'server',
    versione: 2,
    nomi: {
      tipo: r.tipo.nome ?? null,
      forma: r.forma.nome ?? null,
      dimensione,
      base: r.base.nome ?? null,
      crumble: r.crumble ? r.crumble.nome ?? null : null,
      farcitura: r.farcitura.nome ?? null,
      copertura: r.copertura.nome ?? null,
    },
    // La scomposizione del prezzo: spiega perché il cliente ha pagato quella cifra.
    prezzi: { lordo: prezzo.lordo, sconto: sconto?.euro ?? 0, totale, voci: prezzo.voci },
  };
  if (foto.originale) dettagli.fotoOriginaleUrl = foto.originale;
  if (dalBrowser.promemoriaAvviso) dettagli.promemoriaAvviso = true;

  return {
    tipo: String(r.tipo.nome ?? '') || null,
    riepilogo: testoRiepilogo(dati),
    email_params: parametriEmail(dati),
    note: String(c.notes ?? '') || null,
    cliente_nome: String(c.name ?? ''),
    cliente_telefono: String(c.phone ?? ''),
    cliente_email: String(c.email ?? '') || null,
    ritiro_data: String(c.pickupDate ?? '') || null,
    ritiro_ora: String(c.pickupTime ?? '') || null,
    immagine: foto.anteprima,
    dettagli,
  };
}
