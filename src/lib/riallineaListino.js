// Dopo un "no" del server al pagamento, la torta del cliente si rimette in riga.
//
// create-checkout controlla ogni scelta contro il listino vero e, se qualcosa
// non va (una copertura spenta mentre il cliente sceglieva, una taglia
// cambiata…), risponde con { codice, campo, voce } (vedi OrdineRifiutato in
// supabase/functions/_shared/valida.ts). Il configuratore rilegge il listino
// e chiama riallineaConfig: qui si toglie quello che non c'è più e si sceglie
// il passo da cui ripartire. Funzioni PURE, provate in tests/riallinea.test.mjs.
//
// Due fonti, insieme:
// - il listino appena riletto: sparisce tutto ciò che non c'è più;
// - la `voce` rifiutata dal server, tolta ANCHE se il listino del sito la
//   mostra ancora (copia di sicurezza, lettura fallita, cache): altrimenti il
//   cliente riproverebbe all'infinito la stessa scelta.
import { personeOf, RECT_MIN_PERSONE, tagliaEquivalente } from './misureTorta.js';

/** I codici con cui il server chiede di rifare una scelta. */
export const CODICI_RIFIUTO = new Set([
  'taglia_non_valida', 'forma_non_valida', 'opzione_non_disponibile', 'scelta_non_valida', 'dati_incompleti',
]);

// Ordine dei passi: lo stesso di STEPS in CakeConfigurator.jsx.
const PASSI = [
  'type', 'size', 'allergies', 'shape', 'base', 'crumble', 'flavors',
  'filling', 'covering', 'decoration', 'message', 'details', 'review',
];

// Il passo da cui ripartire per ogni `campo` del server. Gli extra si
// propongono a ordine finito: si torna al riepilogo.
export const PASSO_DEL_CAMPO = {
  type: 'type', size: 'size', shape: 'shape', base: 'base', crumble: 'crumble',
  flavors: 'flavors', filling: 'filling', covering: 'covering', decoration: 'decoration',
  message: 'message', details: 'details', extras: 'review', review: 'review',
};

const NESSUNA = 'nessuna';

/**
 * Le forme che il sito propone per una torta normale o alta. ⚠️ Stessa
 * regola di formeAmmesse (supabase/functions/_shared/forme.ts): i flag
 * perNormali/perAlte (punto 17) se il listino li porta, altrimenti tutte; se
 * per un gruppo fossero spente tutte, tutte (rete di sicurezza).
 */
export function formeDelSito(cakeShapes, alta) {
  const tutte = cakeShapes || [];
  const ammesse = tutte.filter((s) => (alta ? s.perAlte !== false : s.perNormali !== false));
  return ammesse.length ? ammesse : tutte;
}

const chiave = (s) => String(s ?? '').trim().toLowerCase();
const coloriDi = (d) => (d?.colorChoice ? d.colors || [] : []);

/**
 * @param config   la torta inviata (quella del pagamento rifiutato)
 * @param listino  dati del configuratore riletti: cakeTypes, cakeSizes,
 *                 cakeShapes, cakeBases, cakeCrumbles, cakeFlavors,
 *                 cakeFillings, cakeCoverings, cakeDecorations, cakeExtras,
 *                 cakeScritte (già con la copia di sicurezza), cakeOccasions
 * @param rifiuto  la risposta del server: { codice, campo, voce }
 * @param opzioni  { isTall(typeId), maxGusti(typeId), normalizeFont(id) }
 * @returns { patch, passo }  patch da applicare alla config (vuota se nulla
 *          da cambiare) e passo da cui ripartire (null = resta dov'è)
 */
export function riallineaConfig(config, listino, rifiuto = {}, opzioni = {}) {
  const { isTall = () => false, maxGusti = () => 2, normalizeFont = (id) => id } = opzioni;
  const { codice = '', campo = '', voce = null } = rifiuto || {};
  const L = listino || {};
  const c = config || {};
  const patch = {};
  const toccati = new Set();
  const cambia = (k, v, passo) => {
    patch[k] = v;
    if (passo) toccati.add(passo);
  };
  const ha = (lista, id) => (lista || []).some((x) => x.id === id);
  // La voce che il server ha rifiutato, per quel campo.
  const rifiutata = (perCampo, valore) => campo === perCampo && voce != null && String(voce) === String(valore);

  // ── Tipo ──
  let type = c.type || '';
  if (type && (!ha(L.cakeTypes, type) || rifiutata('type', type))) {
    type = '';
    cambia('type', '', 'type');
  }
  const alta = isTall(type);

  // ── Taglia: come l'effetto su tagliaEquivalente del configuratore ──
  // Stessa taglia se vale ancora, altrimenti quella con lo stesso numero di
  // persone dell'altra lista, altrimenti da scegliere di nuovo.
  let sizeId = c.sizeId || '';
  if (sizeId) {
    let giusta = tagliaEquivalente(L.cakeSizes, sizeId, alta);
    if (giusta === sizeId && rifiutata('size', sizeId)) giusta = '';
    if (giusta !== sizeId) {
      sizeId = giusta;
      // Taglia sostituita con una equivalente: si resta dove si è (il prezzo
      // nuovo si vede subito). Taglia sparita: si torna a sceglierla.
      cambia('sizeId', giusta, giusta ? null : 'size');
    }
  }

  // ── Forma: del gruppo giusto, rettangolare solo da RECT_MIN_PERSONE ──
  const size = (L.cakeSizes || []).find((s) => s.id === sizeId);
  const forme = formeDelSito(L.cakeShapes, alta);
  const formaOk = (id) =>
    forme.some((s) => s.id === id) &&
    (id !== 'rettangolare' || !sizeId || personeOf(size) >= RECT_MIN_PERSONE) &&
    !rifiutata('shape', id);
  if (c.shape && !formaOk(c.shape)) {
    const nuova = ['tonda', ...forme.map((s) => s.id)].find(formaOk) || '';
    cambia('shape', nuova, 'shape');
  }

  // ── Base e crumble ──
  let baseId = c.baseId || '';
  if (baseId && (!ha(L.cakeBases, baseId) || rifiutata('base', baseId))) {
    baseId = '';
    cambia('baseId', '', 'base');
  }
  if (c.crumbleId) {
    if (!baseId) cambia('crumbleId', '', null);
    else if (!ha(L.cakeCrumbles, c.crumbleId) || rifiutata('crumble', c.crumbleId)) cambia('crumbleId', '', 'crumble');
  }

  // ── Gusti: per nome, senza maiuscole (come il server), al massimo quanti il tipo ne vuole ──
  const vecchi = Array.isArray(c.flavors) ? c.flavors : [];
  const gusti = [];
  for (const f of vecchi) {
    const n = chiave(f?.name);
    if (campo === 'flavors' && voce != null && chiave(voce) === n) continue;
    const g = (L.cakeFlavors || []).find((x) => chiave(x.name) === n);
    if (g) gusti.push(g);
  }
  const tenuti = gusti.slice(0, maxGusti(type));
  if (tenuti.length !== vecchi.length || tenuti.some((g, i) => chiave(g.name) !== chiave(vecchi[i]?.name))) {
    cambia('flavors', tenuti, 'flavors');
  }

  // ── Inserto e copertura ──
  if (c.fillingId && (!ha(L.cakeFillings, c.fillingId) || rifiutata('filling', c.fillingId))) {
    cambia('fillingId', ha(L.cakeFillings, NESSUNA) && !rifiutata('filling', NESSUNA) ? NESSUNA : '', 'filling');
  }
  if (c.coveringId && (!ha(L.cakeCoverings, c.coveringId) || rifiutata('covering', c.coveringId))) {
    cambia('coveringId', '', 'covering');
  }

  // ── Decorazioni e colori ──
  // Decorazione sparita: si toglie. Decorazione rifiutata dal server ma
  // ancora nel listino: se il suo colore non è più fra quelli possibili si
  // toglie solo il colore (lo si risceglie), altrimenti si toglie lei.
  const deco = [];
  const colori = { ...(c.decorationColors || {}) };
  let decoCambiate = false;
  for (const id of Array.isArray(c.decorations) ? c.decorations : []) {
    const d = (L.cakeDecorations || []).find((x) => x.id === id);
    if (d && !rifiutata('decoration', id)) { deco.push(id); continue; }
    decoCambiate = true;
    const lista = coloriDi(d);
    const coloreBuono = lista.some((x) => chiave(x) === chiave(colori[id]));
    // Il problema è il colore (sparito dalla lista, o mai scelto): resta la
    // decorazione, il colore si risceglie. Altrimenti se ne va lei.
    if (d && lista.length && !coloreBuono) deco.push(id);
    delete colori[id];
  }
  if (decoCambiate) {
    cambia('decorations', deco, 'decoration');
    cambia('decorationColors', Object.fromEntries(Object.entries(colori).filter(([id]) => deco.includes(id))), 'decoration');
  }

  // ── Extra ──
  const extra = {};
  let extraCambiati = false;
  for (const [id, q] of Object.entries(c.extras || {})) {
    if (!ha(L.cakeExtras, id) || rifiutata('extras', id)) { extraCambiati = true; continue; }
    extra[id] = q;
  }
  if (extraCambiati) cambia('extras', extra, 'review');

  // ── Stile della scritta e occasione ──
  const stili = L.cakeScritte || [];
  if (c.message && stili.length) {
    const font = normalizeFont(c.messageFont);
    if (!stili.some((s) => s.id === font) || rifiutata('message', font) || rifiutata('message', c.messageFont)) {
      const nuovo = (stili.find((s) => s.id === 'corsivo' && !rifiutata('message', s.id)) ||
        stili.find((s) => !rifiutata('message', s.id)))?.id || '';
      if (nuovo !== c.messageFont) cambia('messageFont', nuovo, 'message');
    }
  }
  if (c.occasion && (!(L.cakeOccasions || []).includes(c.occasion) || rifiutata('message', c.occasion))) {
    cambia('occasion', '', 'message');
  }

  // ── Da dove ripartire ──
  // Il primo passo toccato (i passi dopo dipendono da quelli prima), oppure
  // quello del campo rifiutato. "Taglia non valida" con una taglia
  // equivalente trovata: si resta al riepilogo, come sempre.
  const candidati = [...toccati];
  const delCampo = PASSO_DEL_CAMPO[campo];
  if (delCampo && !(codice === 'taglia_non_valida' && sizeId)) candidati.push(delCampo);
  const passo = candidati.length
    ? candidati.reduce((a, b) => (PASSI.indexOf(b) < PASSI.indexOf(a) ? b : a))
    : null;
  return { patch, passo };
}

/**
 * L'indice di `passo` fra i passi della torta NUOVA. Se quel passo non c'è
 * (es. la base, quando la decide il tipo), il primo passo che c'è prima.
 */
export function indicePasso(passi, passo) {
  if (!passo) return -1;
  const i = passi.indexOf(passo);
  if (i >= 0) return i;
  for (let k = PASSI.indexOf(passo) - 1; k >= 0; k--) {
    const j = passi.indexOf(PASSI[k]);
    if (j >= 0) return j;
  }
  return 0;
}
