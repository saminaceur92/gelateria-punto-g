// Ordine dei bottoni delle liste del configuratore (gusti, decorazioni,
// coperture, …), deciso dai titolari con le frecce ▲ ▼ della dashboard:
// ogni scheda ha «↕ Cambia ordine» (vedi src/admin/OrdinaLista.jsx).
//
// Qui stanno solo le regole, senza React né Supabase, così si provano da sole:
//   node --test src/lib/riordina.test.mjs
//
// Come si numera. Una lista è ordinata come la mostra il sito: per `ordine`
// (vuoto = in fondo) e, a pari numero, per id. Una freccia sposta la voce
// accanto alla vicina e rinumera TUTTA la lista 10, 20, 30…: così i numeri
// restano puliti, mai due uguali, e dopo la prima mossa ogni tocco cambia
// solo 2-4 righe.
//
// Le gemelle vegetali della panna (stesso id + "-veg", vedi conPannaVeg nel
// configuratore) prendono sempre il numero dell'originale e si spostano con
// lei: a chi è vegano la vegetale compare AL POSTO di quella col latte, quindi
// deve stare nello stesso punto della lista.

const SUFFISSO_VEG = '-veg';

/** Un numero di posizione come lo tratta il database: vuoto = null. */
export const numero = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

// Per ordinare: le voci senza numero vanno in fondo.
const posizione = (v) => numero(v) ?? Infinity;

// A pari numero conta l'id, come fa il sito (`.order('id')`). Gli id del menù
// sono parole minuscole con trattini o uuid: confrontarli carattere per
// carattere dà lo stesso ordine del database.
const perId = (a, b) => {
  const x = String(a.id);
  const y = String(b.id);
  return x < y ? -1 : x > y ? 1 : 0;
};

function confronta(a, b, chiave) {
  const pa = posizione(a[chiave]);
  const pb = posizione(b[chiave]);
  if (pa !== pb) return pa < pb ? -1 : 1;
  // Per un ordine "proprio" (es. i gusti nel configuratore torte), a pari
  // numero (o tutti e due vuoti) vale l'ordine generale della tabella.
  if (chiave !== 'ordine') {
    const oa = posizione(a.ordine);
    const ob = posizione(b.ordine);
    if (oa !== ob) return oa < ob ? -1 : 1;
  }
  return perId(a, b);
}

/** Le righe nell'ordine in cui le mostra il sito (copia, l'originale non si tocca). */
export function ordinaComeIlSito(righe, chiave = 'ordine') {
  return [...(righe || [])].sort((a, b) => confronta(a, b, chiave));
}

/**
 * I gusti nel configuratore torte: per `ordine_torte` (l'ordine scelto per le
 * torte, separato da quello della carta del gelato), vuoti in fondo, poi per
 * `ordine`, poi per id. Prima della migrazione `ordine_torte` non c'è e vale
 * l'ordine della carta, cioè come prima.
 */
export const ordinaGustiTorte = (righe) => ordinaComeIlSito(righe, 'ordine_torte');

/** L'id della voce "capofila": la gemella vegetale segue l'originale, se c'è. */
export function capofila(id, ids) {
  const s = String(id);
  if (s.endsWith(SUFFISSO_VEG)) {
    const originale = s.slice(0, -SUFFISSO_VEG.length);
    if (ids.has(originale)) return originale;
  }
  return s;
}

/**
 * Le voci della lista nell'ordine del sito: ognuna è una riga oppure una
 * coppia originale + gemella vegetale. La coppia sta dove sta l'originale
 * (`riga`), come nella pulizia della migrazione 2026-10-09-dashboard-ottobre.
 */
export function gruppiDi(righe, chiave = 'ordine') {
  const ordinate = ordinaComeIlSito(righe, chiave);
  const ids = new Set(ordinate.map((r) => String(r.id)));
  const gruppi = [];
  const perCapo = new Map();
  for (const r of ordinate) {
    if (capofila(r.id, ids) !== String(r.id)) continue;
    const g = { id: String(r.id), riga: r, righe: [r] };
    perCapo.set(g.id, g);
    gruppi.push(g);
  }
  for (const r of ordinate) {
    const capo = capofila(r.id, ids);
    if (capo !== String(r.id)) perCapo.get(capo).righe.push(r);
  }
  return gruppi;
}

/**
 * Sposta la voce `id` di un posto (delta -1 = su, +1 = giù).
 *  - righe: TUTTE le righe della lista (anche quelle che la scheda non
 *    mostra, es. le taglie alte quando si ordinano le normali);
 *  - visibile(riga): la riga si vede nella lista su cui si è premuto;
 *  - stessoAmbito(a, b): le due voci sono vicine possibili (es. stessa
 *    categoria della carta del gelato).
 * Restituisce { cambi: { id: numero }, ordine: [id…] } con SOLO le righe
 * il cui numero cambia, oppure null se la voce non si può spostare.
 */
export function riordina(righe, id, delta, { chiave = 'ordine', visibile = () => true, stessoAmbito = () => true } = {}) {
  if (delta !== -1 && delta !== 1) return null;
  const gruppi = gruppiDi(righe, chiave);
  const ids = new Set(gruppi.flatMap((g) => g.righe.map((r) => String(r.id))));
  const mio = gruppi.find((g) => g.id === capofila(id, ids));
  if (!mio) return null;
  const candidati = gruppi.filter((g) => g === mio || (g.righe.some(visibile) && stessoAmbito(mio.riga, g.riga)));
  const vicino = candidati[candidati.indexOf(mio) + delta];
  if (!vicino) return null;
  // La voce si toglie e si rimette subito prima (su) o subito dopo (giù) la
  // vicina, nella lista COMPLETA: le voci che qui non si vedono restano dove
  // sono una rispetto all'altra.
  const nuovi = gruppi.filter((g) => g !== mio);
  const j = nuovi.indexOf(vicino);
  nuovi.splice(delta < 0 ? j : j + 1, 0, mio);
  const cambi = {};
  nuovi.forEach((g, k) => {
    const n = (k + 1) * 10;
    for (const r of g.righe) if (numero(r[chiave]) !== n) cambi[String(r.id)] = n;
  });
  return { cambi, ordine: nuovi.flatMap((g) => g.righe.map((r) => String(r.id))) };
}

/** Le righe coi numeri nuovi, già nell'ordine del sito. */
export function applica(righe, cambi, chiave = 'ordine') {
  return ordinaComeIlSito(
    (righe || []).map((r) => (cambi[String(r.id)] !== undefined ? { ...r, [chiave]: cambi[String(r.id)] } : r)),
    chiave
  );
}

/** id → numero (null se vuoto): la fotografia di com'è la lista nel database. */
export function numeriDi(righe, chiave = 'ordine') {
  return new Map((righe || []).map((r) => [String(r.id), numero(r[chiave])]));
}

/**
 * Le righe da scrivere: quelle il cui numero in pagina è diverso da quello
 * che ha il database (`base`). Su e poi giù = niente da scrivere.
 */
export function daScrivere(righe, base, chiave = 'ordine') {
  return (righe || [])
    .filter((r) => numero(r[chiave]) !== (base.get(String(r.id)) ?? null))
    .map((r) => ({ id: r.id, numero: numero(r[chiave]) }));
}

/**
 * Il database è ancora come l'avevamo letto (stesse voci, stessi numeri)?
 * Se no, un altro dispositivo ha toccato la lista: meglio ricaricare che
 * scrivere numeri calcolati su una lista che non c'è più.
 */
export function listaCambiata(fresche, base, chiave = 'ordine') {
  if ((fresche || []).length !== base.size) return true;
  return fresche.some((r) => !base.has(String(r.id)) || numero(r[chiave]) !== base.get(String(r.id)));
}
