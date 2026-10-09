// La torta del cliente dopo un "no" del server (src/lib/riallineaListino.js).
// node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { riallineaConfig, indicePasso, formeDelSito, CODICI_RIFIUTO } from '../src/lib/riallineaListino.js';
import { validaOrdine } from '../supabase/functions/_shared/valida.ts';
import { listino, listinoDelSito, OGGI, tortaBase } from './aiuti.mjs';

const ALTE = ['piani', 'alta-gelato'];
const opzioni = {
  isTall: (t) => ALTE.includes(t),
  maxGusti: (t) => (ALTE.includes(t) ? 4 : 2),
  normalizeFont: (id) => ({ inter: 'stampatello', caveat: 'corsivo', fraunces: 'corsivo-scolastico' })[id] || id || 'corsivo',
};
const S = listinoDelSito();
const torta = (patch = {}) => {
  const c = { ...tortaBase(), ...patch };
  c.flavors = c.flavors.map((f) => S.cakeFlavors.find((x) => x.name === f.name) || f);
  return c;
};
const rialli = (patch, rifiuto, L = S) => riallineaConfig(torta(patch), L, rifiuto, opzioni);

test('niente da cambiare: patch vuota, si va al passo del campo rifiutato', () => {
  assert.deepEqual(rialli({}, { codice: 'scelta_non_valida', campo: 'details', voce: null }), { patch: {}, passo: 'details' });
  assert.deepEqual(rialli({}, { codice: 'dati_incompleti', campo: 'details' }), { patch: {}, passo: 'details' });
  assert.ok(CODICI_RIFIUTO.has('forma_non_valida') && !CODICI_RIFIUTO.has('listino_non_disponibile'));
});

test('copertura spenta mentre il cliente sceglieva', () => {
  const L = listinoDelSito((() => { const x = listino(); x.coperture.find((c) => c.id === 'panna').attivo = false; return x; })());
  assert.deepEqual(rialli({}, { codice: 'opzione_non_disponibile', campo: 'covering', voce: 'panna' }, L), { patch: { coveringId: '' }, passo: 'covering' });
  // Listino del sito vecchio (la mostra ancora): si toglie lo stesso, niente giri a vuoto.
  assert.deepEqual(rialli({}, { codice: 'opzione_non_disponibile', campo: 'covering', voce: 'panna' }), { patch: { coveringId: '' }, passo: 'covering' });
});

test('taglia: equivalente trovata (si resta al riepilogo) o da riscegliere', () => {
  const x = listino();
  x.dimensioni.find((s) => s.id === 'alta-16').attivo = true;
  const L = listinoDelSito(x);
  const alta = { type: 'piani', sizeId: '16', flavors: [{ name: 'Crema' }] };
  assert.deepEqual(rialli(alta, { codice: 'taglia_non_valida', campo: 'size', voce: '16' }, L), { patch: { sizeId: 'alta-16' }, passo: null });
  // Nessuna taglia alta da 10 persone: si torna a sceglierla.
  assert.deepEqual(rialli({ ...alta, sizeId: '10' }, { codice: 'taglia_non_valida', campo: 'size', voce: '10' }, L), { patch: { sizeId: '' }, passo: 'size' });
  // Il server dice no ma il listino del sito (vecchio) dice sì: si risceglie.
  assert.deepEqual(rialli({}, { codice: 'taglia_non_valida', campo: 'size', voce: '10' }), { patch: { sizeId: '' }, passo: 'size' });
});

test('forma: del gruppo giusto e rettangolare solo da 15 persone (punto 17)', () => {
  const conFlag = { ...S, cakeShapes: S.cakeShapes.map((s) => ({ ...s, perNormali: true, perAlte: s.id !== 'cuore' })) };
  const alta = { type: 'piani', sizeId: '16', shape: 'cuore', flavors: [{ name: 'Crema' }] };
  assert.deepEqual(rialli(alta, { codice: 'forma_non_valida', campo: 'shape', voce: 'cuore' }, conFlag), { patch: { shape: 'tonda' }, passo: 'shape' });
  assert.deepEqual(formeDelSito(conFlag.cakeShapes, true).map((s) => s.id).sort(), ['quadrata', 'rettangolare', 'tonda']);
  assert.equal(formeDelSito(S.cakeShapes, true).length, 4, 'senza flag: tutte');
  const tutteSpente = conFlag.cakeShapes.map((s) => ({ ...s, perAlte: false }));
  assert.equal(formeDelSito(tutteSpente, true).length, 4, 'rete di sicurezza');
  assert.deepEqual(rialli({ shape: 'rettangolare', sizeId: '10' }, { codice: 'forma_non_valida', campo: 'shape', voce: 'rettangolare' }), { patch: { shape: 'tonda' }, passo: 'shape' });
  // Tonda rifiutata: la prima altra forma ammessa.
  assert.equal(rialli({}, { codice: 'forma_non_valida', campo: 'shape', voce: 'tonda' }).patch.shape, S.cakeShapes.find((s) => s.id !== 'tonda' && s.id !== 'rettangolare').id);
});

test('base sparita: si toglie anche il crumble; crumble spento: solo lui', () => {
  const x = listino();
  x.basi.find((b) => b.id === 'crock').attivo = false;
  assert.deepEqual(rialli({ baseId: 'crock', crumbleId: 'cacao' }, { codice: 'opzione_non_disponibile', campo: 'base', voce: 'crock' }, listinoDelSito(x)),
    { patch: { baseId: '', crumbleId: '' }, passo: 'base' });
  assert.deepEqual(rialli({ baseId: 'crock', crumbleId: 'cacao' }, { codice: 'opzione_non_disponibile', campo: 'crumble', voce: 'cacao' }),
    { patch: { crumbleId: '' }, passo: 'crumble' });
});

// "Torta gelato con base Salame al cioccolato" (tipo crock): la base la
// decide il tipo (BASE_OBBLIGATA nel configuratore) e il passo della base
// non c'è. Se il salame si spegne, togliere solo la base non basta: il
// configuratore la rimetteva da sé e il pagamento veniva rifiutato a ogni giro.
const conBaseNelNome = { ...opzioni, baseObbligata: (t) => (t === 'crock' ? 'glutenfree' : '') };
const salameSpento = () => {
  const x = listino();
  x.basi.find((b) => b.id === 'glutenfree').attivo = false;
  return x;
};

test('tipo con la base nel nome: base spenta o rifiutata, se ne va anche il tipo', () => {
  const crock = torta({ type: 'crock', baseId: 'glutenfree' });
  const rifiuto = { codice: 'opzione_non_disponibile', campo: 'base', voce: 'glutenfree' };
  const atteso = { patch: { type: '', baseId: '' }, passo: 'type' };
  assert.deepEqual(riallineaConfig(crock, listinoDelSito(salameSpento()), rifiuto, conBaseNelNome), atteso);
  // Listino del sito vecchio (il salame ancora acceso): conta il rifiuto del server.
  assert.deepEqual(riallineaConfig(crock, S, rifiuto, conBaseNelNome), atteso);
  // Rifiutata un'altra cosa, ma nel listino riletto il salame non c'è più.
  assert.deepEqual(
    riallineaConfig(crock, listinoDelSito(salameSpento()), { codice: 'opzione_non_disponibile', campo: 'covering', voce: 'panna' }, conBaseNelNome),
    { patch: { type: '', baseId: '', coveringId: '' }, passo: 'type' },
  );
  // Salame acceso: il tipo resta, si sistema solo quello che il server ha rifiutato.
  assert.deepEqual(
    riallineaConfig(crock, S, { codice: 'opzione_non_disponibile', campo: 'covering', voce: 'panna' }, conBaseNelNome),
    { patch: { coveringId: '' }, passo: 'covering' },
  );
  // Crock con un'altra base (scelta per un'intolleranza) e salame acceso: il tipo resta.
  assert.deepEqual(
    riallineaConfig(torta({ type: 'crock', baseId: 'classica' }), S, { codice: 'opzione_non_disponibile', campo: 'base', voce: 'classica' }, conBaseNelNome),
    { patch: { baseId: '' }, passo: 'base' },
  );
  // Gli altri tipi non hanno basi nel nome: una base rifiutata si risceglie e basta.
  assert.deepEqual(
    riallineaConfig(torta({ baseId: 'glutenfree' }), listinoDelSito(salameSpento()), rifiuto, conBaseNelNome),
    { patch: { baseId: '' }, passo: 'base' },
  );
});

test('crock col salame spento: dal "no" del server a un pagamento che passa', () => {
  const L = salameSpento();
  const crock = torta({ type: 'crock', baseId: 'glutenfree' });
  let rifiuto = null;
  try { validaOrdine(crock, L, OGGI); } catch (e) { rifiuto = { codice: e.codice, campo: e.campo, voce: e.voce }; }
  assert.deepEqual(rifiuto, { codice: 'opzione_non_disponibile', campo: 'base', voce: 'glutenfree' });
  const { patch, passo } = riallineaConfig(crock, listinoDelSito(L), rifiuto, conBaseNelNome);
  assert.equal(passo, 'type');
  // Il cliente sceglie un altro tipo e, al passo della base che ora c'è, una base accesa.
  const rifatta = { ...crock, ...patch, type: 'gelato', baseId: 'cacao' };
  assert.equal(validaOrdine(rifatta, L, OGGI).canon.type, 'gelato');
});

test('gusti: tolti quelli spenti o rifiutati, mai più del massimo', () => {
  const pesca = rialli({ flavors: [{ name: 'Crema' }, { name: 'Pesca' }] }, { codice: 'opzione_non_disponibile', campo: 'flavors', voce: 'Pesca' });
  assert.deepEqual(pesca.patch.flavors.map((f) => f.name), ['Crema']);
  assert.equal(pesca.passo, 'flavors');
  const tre = rialli({ flavors: [{ name: 'Crema' }, { name: 'Bacio' }, { name: 'Kinder' }] }, { codice: 'scelta_non_valida', campo: 'flavors' });
  assert.deepEqual(tre.patch.flavors.map((f) => f.name), ['Crema', 'Bacio']);
  // Stessi nomi con altre maiuscole: nessun cambio.
  assert.deepEqual(rialli({ flavors: [{ name: 'crema' }] }, { codice: 'scelta_non_valida', campo: 'details' }).patch, {});
});

test('inserto: torna "Nessuna"; decorazioni: sparite, colore da riscegliere, rifiutate', () => {
  assert.deepEqual(rialli({ fillingId: 'ganache' }, { codice: 'opzione_non_disponibile', campo: 'filling', voce: 'ganache' }), { patch: { fillingId: 'nessuna' }, passo: 'filling' });
  const sparita = rialli({ decorations: ['granella-frutta-secca', 'fiocchi'] }, { codice: 'opzione_non_disponibile', campo: 'decoration', voce: 'granella-frutta-secca' });
  assert.deepEqual(sparita, { patch: { decorations: ['fiocchi'], decorationColors: { fiocchi: 'Rosso' } }, passo: 'decoration' });
  const colore = rialli({ decorationColors: { fiocchi: 'Verde' } }, { codice: 'opzione_non_disponibile', campo: 'decoration', voce: 'fiocchi' });
  assert.deepEqual(colore, { patch: { decorations: ['fiocchi', 'macarons'], decorationColors: {} }, passo: 'decoration' });
  const rifiutata = rialli({}, { codice: 'opzione_non_disponibile', campo: 'decoration', voce: 'macarons' });
  assert.deepEqual(rifiutata, { patch: { decorations: ['fiocchi'], decorationColors: { fiocchi: 'Rosso' } }, passo: 'decoration' });
});

test('extra rifiutato: si toglie e si torna al riepilogo', () => {
  assert.deepEqual(rialli({ extras: { 'salame-dolce': 1.5, 'cabaret-10': 1 } }, { codice: 'opzione_non_disponibile', campo: 'extras', voce: 'cabaret-10' }),
    { patch: { extras: { 'salame-dolce': 1.5 } }, passo: 'review' });
  assert.deepEqual(rialli({ extras: { 'torta-gratis': 1 } }, { codice: 'opzione_non_disponibile', campo: 'extras', voce: 'torta-gratis' }),
    { patch: { extras: {} }, passo: 'review' });
});

test('stile della scritta e occasione', () => {
  assert.deepEqual(rialli({ messageFont: 'comic-sans' }, { codice: 'opzione_non_disponibile', campo: 'message', voce: 'comic-sans' }), { patch: { messageFont: 'corsivo' }, passo: 'message' });
  assert.deepEqual(rialli({ messageFont: 'corsivo' }, { codice: 'opzione_non_disponibile', campo: 'message', voce: 'corsivo' }),
    { patch: { messageFont: S.cakeScritte.find((s) => s.id !== 'corsivo').id }, passo: 'message' });
  assert.deepEqual(rialli({ messageFont: 'caveat' }, { codice: 'scelta_non_valida', campo: 'details' }).patch, {}, 'font vecchio ancora valido');
  assert.deepEqual(rialli({ occasion: 'Festa di famiglia' }, { codice: 'opzione_non_disponibile', campo: 'message', voce: 'Festa di famiglia' }), { patch: { occasion: '' }, passo: 'message' });
});

test('più cose cambiate: si riparte dal primo passo toccato', () => {
  const x = listino();
  x.tipi_torta.find((t) => t.id === 'semifreddo').attivo = false;
  const r = rialli({}, { codice: 'opzione_non_disponibile', campo: 'covering', voce: 'panna' }, listinoDelSito(x));
  assert.deepEqual(r, { patch: { type: '', coveringId: '' }, passo: 'type' });
});

test('indice del passo fra i passi della torta nuova', () => {
  const passi = ['type', 'size', 'allergies', 'shape', 'flavors', 'filling', 'covering', 'decoration', 'message', 'details', 'review'];
  assert.equal(indicePasso(passi, 'covering'), 6);
  assert.equal(indicePasso(passi, 'base'), 3, 'base decisa dal tipo: il passo prima');
  assert.equal(indicePasso(passi, 'crumble'), 3);
  assert.equal(indicePasso(passi, null), -1);
});
