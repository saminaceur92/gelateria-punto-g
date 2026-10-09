// Testo del riepilogo che legge il laboratorio (riga `riepilogo` dell'ordine:
// Telegram, pannello Ordini, futura stampa) e parametri della mail di
// conferma, per gli ordini PAGATI DAL SITO.
//
// Prima li scriveva il browser e il server li passava intatti fino al
// database: il prezzo era giusto, la descrizione poteva non esserlo. Ora li
// scrive il server partendo da ciò che è stato davvero pagato.
//
// Funzioni PURE e senza import: ricevono valori già risolti (nomi del
// listino, importi) e restituiscono le stringhe.
// ⚠️ Le etichette ("*Tipo:*", "*Forma:*", "💰 *Importo pagato:*"…) sono
// IDENTICHE a quelle che il configuratore scrive per gli ordini presi al
// banco (CakeConfigurator.jsx, `msg` e `ordineEmail`): la funzione SQL
// order_telegram_msg le cerca per stringa esatta. Se ne cambi una, cambiala
// in tutti e tre i posti. tests/riepilogo.test.mjs controlla il testo esatto.
//
// Differenze volute rispetto al testo del browser, solo per i testi liberi
// del cliente:
// - note e indirizzo stanno fra «»; nelle note ogni riga in più comincia con
//   "> ". Così nessuna riga scritta dal cliente può sembrare scritta dal
//   sistema (per esempio un finto "💰 Importo pagato: €200");
// - nome, telefono ed email arrivano già su una riga sola (valida.ts);
// - foto pagata ma non arrivata su Storage: lo dice, invece di promettere
//   una foto "inviata a parte" che non esiste da nessuna parte.

export interface DatiRiepilogo {
  allergeni: string[]; // nomi
  preferenze: string[]; // nomi (Vegan, Senza zuccheri aggiunti)
  tipo: string;
  forma: string;
  dimensione: string; // "10 persone · Ø 24 cm"
  base: string;
  baseDescrizione: string; // vuota con la base croccante (vedi ordine.ts)
  crumble: string;
  gusti: string[];
  farcitura: string; // vuota con l'inserto "Nessuna"
  copertura: string;
  decorazioni: { nome: string; colore: string }[];
  extra: { nome: string; quantita: number; unita: string; totale: number }[];
  scritta: string;
  scrittaStile: string;
  foto: boolean; // pagata (+5 €)
  fotoArrivata: boolean; // l'URL della foto c'è davvero
  candelina: boolean;
  occasione: string;
  sconto: { codice: string; euro: number } | null;
  sorpresa: boolean;
  regalo: boolean;
  consegna: boolean;
  data: string; // AAAA-MM-GG
  ora: string; // HH:MM
  indirizzo: string;
  costoConsegna: number;
  doveSiMangia: string;
  cliente: string;
  telefono: string;
  email: string;
  note: string;
  totale: number; // importo addebitato
}

const eur = (n: number) => n.toFixed(2);
// Quantità all'italiana: 1,5 e non 1.5 (come toLocaleString('it-IT') nel sito).
const fmtQty = (q: number) => {
  const r = Math.round(q * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r).replace('.', ',');
};
const decorazioniTesto = (d: DatiRiepilogo['decorazioni']) =>
  (d.length ? d.map((x) => `${x.nome}${x.colore ? ` (colore ${x.colore})` : ''}`).join(' · ') : 'Nessuna');
const extraTesto = (e: DatiRiepilogo['extra'][number]) =>
  `${e.nome} ×${fmtQty(e.quantita)}${e.unita ? ` (${e.unita})` : ''} — €${eur(e.totale)}`;
const attenzione = (d: DatiRiepilogo) =>
  [d.sorpresa && 'è una sorpresa', d.regalo && 'è un regalo'].filter(Boolean).join(' · ');

/** Testo del cliente fra «»; se va a capo, ogni riga in più comincia con "> ". */
export function testoCliente(s: string): string {
  return s ? `«${s.split('\n').join('\n> ')}»` : '';
}

/** Il riepilogo per il laboratorio (Telegram, pannello Ordini). */
export function testoRiepilogo(d: DatiRiepilogo): string {
  const quando = `${d.data}${d.ora ? ` alle ${d.ora}` : ''}`;
  const nota = attenzione(d);
  return [
    '🎂 *Nuova richiesta torta — Punto Gi*',
    d.allergeni.length ? `⚠️ *ALLERGENI:* ${d.allergeni.join(', ').toUpperCase()}` : '',
    d.preferenze.length ? `🌱 *PREFERENZE:* ${d.preferenze.join(', ').toUpperCase()}` : '',
    `*Tipo:* ${d.tipo}`,
    `*Forma:* ${d.forma}`,
    `*Dimensione:* ${d.dimensione}`,
    `*Base:* ${d.base}${d.baseDescrizione ? ` (${d.baseDescrizione})` : ''}`,
    d.crumble ? `*Tipo di crumble:* ${d.crumble}` : '',
    `*Strati / Gusti:* ${d.gusti.join(', ')}`,
    d.farcitura ? `*Farcitura:* ${d.farcitura}` : '',
    d.copertura ? `*Copertura:* ${d.copertura}` : '',
    `*${d.decorazioni.length > 1 ? 'Decorazioni' : 'Decorazione'}:* ${decorazioniTesto(d.decorazioni)}`,
    d.extra.length ? `*Extra:* ${d.extra.map(extraTesto).join(' · ')}` : '',
    d.scritta ? `*Scritta:* "${d.scritta}"${d.scrittaStile ? ` (${d.scrittaStile})` : ''}` : '',
    d.foto
      ? (d.fotoArrivata
        ? '*Foto su cialda:* sì (verrà inviata a parte)'
        : '*Foto su cialda:* sì — ⚠️ la foto NON è arrivata: chiedila al cliente')
      : '',
    d.candelina ? '*Candelina:* sì' : '',
    d.occasione ? `*Occasione:* ${d.occasione}` : '',
    d.sconto && d.sconto.euro > 0 ? `*Sconto:* ${d.sconto.codice} (−€${eur(d.sconto.euro)})` : '',
    nota ? `*Attenzione:* ${nota}` : '',
    d.consegna ? `*Consegna a domicilio:* ${quando}` : `*Da ritirare:* ${quando}`,
    d.consegna ? `*Indirizzo:* ${testoCliente(d.indirizzo)}` : '',
    d.consegna ? `*Sovrapprezzo consegna:* €${d.costoConsegna}` : '',
    d.doveSiMangia ? `*Dove si mangia:* ${d.doveSiMangia}` : '',
    `*Cliente:* ${d.cliente}`,
    `*Telefono:* ${d.telefono}`,
    d.email ? `*Email:* ${d.email}` : '',
    d.note ? `*Note:* ${testoCliente(d.note)}` : '',
    `💰 *Importo pagato:* €${eur(d.totale)}`,
    '_Richiesta inviata dal sito gelateriapuntogcarpi_',
  ].filter(Boolean).join('\n');
}

/** I parametri della mail di conferma (la spedisce il database, trigger notify_order_email). */
export function parametriEmail(d: DatiRiepilogo) {
  if (!d.email) return null;
  const quando = d.data ? `${d.data.split('-').reverse().join('/')}${d.ora ? ` alle ${d.ora}` : ''}` : '';
  const nota = attenzione(d);
  const ordine = [
    d.allergeni.length ? `ALLERGENI: ${d.allergeni.join(', ').toUpperCase()}` : '',
    d.preferenze.length ? `PREFERENZE: ${d.preferenze.join(', ').toUpperCase()}` : '',
    `Tipo: ${d.tipo}`,
    `Forma: ${d.forma}`,
    `Dimensione: ${d.dimensione}`,
    `Base: ${d.base}`,
    d.crumble ? `Tipo di crumble: ${d.crumble}` : '',
    `Gusti: ${d.gusti.join(', ')}`,
    d.farcitura ? `Farcitura: ${d.farcitura}` : '',
    d.copertura ? `Copertura: ${d.copertura}` : '',
    `${d.decorazioni.length > 1 ? 'Decorazioni' : 'Decorazione'}: ${decorazioniTesto(d.decorazioni)}`,
    d.extra.length ? `Extra: ${d.extra.map(extraTesto).join(', ')}` : '',
    d.scritta ? `Scritta: "${d.scritta}"${d.scrittaStile ? ` (${d.scrittaStile})` : ''}` : '',
    d.foto ? 'Foto su cialda: sì' : '',
    d.candelina ? 'Candelina: sì' : '',
    d.occasione ? `Occasione: ${d.occasione}` : '',
    d.sconto && d.sconto.euro > 0 ? `Sconto ${d.sconto.codice}: -€${eur(d.sconto.euro)}` : '',
    nota ? `Attenzione: ${nota}` : '',
    d.consegna ? `Consegna a domicilio (+€${d.costoConsegna}) — ${testoCliente(d.indirizzo)}` : '',
    quando ? `${d.consegna ? 'Consegna' : 'Ritiro'}: ${quando}` : '',
    d.doveSiMangia ? `Dove si mangia: ${d.doveSiMangia}` : '',
    d.note ? `Note: ${testoCliente(d.note)}` : '',
  ].filter(Boolean).join(' · ');
  return {
    email: d.email,
    cliente: d.cliente,
    ordine,
    ritiro: d.consegna ? `Consegna a domicilio${quando ? ` il ${quando}` : ''} — ${d.indirizzo}` : quando,
    modalita: (d.consegna ? '🛵 Consegna a domicilio' : '📅 Ritiro in gelateria') + (quando ? ` — ${quando}` : ''),
    saluto: d.consegna
      ? 'Ti consegneremo la torta all’indirizzo e all’orario indicato 🛵'
      : 'Ti aspettiamo in gelateria per il ritiro 🍰',
    importo: eur(d.totale),
  };
}
