// node --test src/lib/misureTorta.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gruppiForma, formeDelTipo, formaEquivalente, formeAmmesseRighe, ultimaFormaDelGruppo,
  FORMA_PREDEFINITA,
} from './misureTorta.js';

// Righe della tabella `forme` come le legge la dashboard (anche le spente).
const RIGHE = [
  { id: 'tonda', attivo: true, per_normali: true, per_alte: true },
  { id: 'cuore', attivo: true, per_normali: true, per_alte: false },
  { id: 'quadrata', attivo: true, per_normali: false, per_alte: true },
  { id: 'rettangolare', attivo: false, per_normali: true, per_alte: true },
];
// Come le passa live.js al configuratore: solo le accese, flag in camelCase.
const sito = (righe) => righe.filter((f) => f.attivo).map((f) => ({ id: f.id, ...gruppiForma(f) }));
const ids = (forme) => forme.map((f) => f.id);

test('prima della migrazione: niente colonne, tutte le forme per tutti', () => {
  assert.deepEqual(gruppiForma({ id: 'tonda' }), { perNormali: true, perAlte: true });
  assert.deepEqual(gruppiForma(null), { perNormali: true, perAlte: true });
  const vecchie = [{ id: 'tonda' }, { id: 'cuore' }].map((f) => ({ ...f, ...gruppiForma(f) }));
  assert.deepEqual(ids(formeDelTipo(vecchie, false)), ['tonda', 'cuore']);
  assert.deepEqual(ids(formeDelTipo(vecchie, true)), ['tonda', 'cuore']);
});

test('forme per gruppo: il cuore spento per le alte, la quadrata per le normali', () => {
  assert.deepEqual(ids(formeDelTipo(sito(RIGHE), true)), ['tonda', 'quadrata']);
  assert.deepEqual(ids(formeDelTipo(sito(RIGHE), false)), ['tonda', 'cuore']);
  // l'ordine della lista resta quello del listino
  const alContrario = [...sito(RIGHE)].reverse();
  assert.deepEqual(ids(formeDelTipo(alContrario, true)), ['quadrata', 'tonda']);
});

test('rete di sicurezza: gruppo senza forme accese = tutte le accese', () => {
  const spente = RIGHE.map((f) => ({ ...f, per_alte: false }));
  assert.deepEqual(ids(formeDelTipo(sito(spente), true)), ['tonda', 'cuore', 'quadrata']);
  assert.deepEqual(formeDelTipo([], true), []);
  assert.deepEqual(formeDelTipo(undefined, false), []);
});

test('forma equivalente dopo un cambio di tipo', () => {
  const s = sito(RIGHE);
  assert.equal(FORMA_PREDEFINITA, 'tonda');
  assert.equal(formaEquivalente(s, 'quadrata', true), 'quadrata', 'vale ancora: resta');
  assert.equal(formaEquivalente(s, 'cuore', true), 'tonda', 'non vale per le alte: tonda');
  assert.equal(formaEquivalente(s, 'quadrata', false), 'tonda');
  assert.equal(formaEquivalente(s, 'inesistente', false), 'tonda');
  // Senza la tonda per il gruppo: la prima ammessa
  const senzaTonda = s.map((f) => (f.id === 'tonda' ? { ...f, perAlte: false } : f));
  assert.equal(formaEquivalente(senzaTonda, 'cuore', true), 'quadrata');
  assert.equal(formaEquivalente([], 'tonda', true), '');
});

test('dashboard: forme ammesse e rete di sicurezza sulle righe del database', () => {
  assert.deepEqual(formeAmmesseRighe(RIGHE, true), { ammesse: ['tonda', 'quadrata'], rete: false });
  assert.deepEqual(formeAmmesseRighe(RIGHE, false), { ammesse: ['tonda', 'cuore'], rete: false });
  // Le uniche ammesse per le alte vengono spente nella scheda Forme: rete.
  const forme = RIGHE.map((f) => (['tonda', 'quadrata'].includes(f.id) ? { ...f, attivo: false } : f));
  assert.deepEqual(formeAmmesseRighe(forme, true), { ammesse: ['cuore'], rete: true });
  // Nessuna forma accesa del tutto: niente rete, niente forme.
  assert.deepEqual(formeAmmesseRighe(RIGHE.map((f) => ({ ...f, attivo: false })), true), { ammesse: [], rete: false });
});

test("dashboard: non si spegne l'ultima forma accesa di un gruppo", () => {
  assert.equal(ultimaFormaDelGruppo(RIGHE, 'cuore', false), false, 'resta la tonda');
  const soloTonda = RIGHE.map((f) => (f.id === 'tonda' ? f : { ...f, per_alte: false }));
  assert.equal(ultimaFormaDelGruppo(soloTonda, 'tonda', true), true);
  // La rettangolare è accesa per le alte ma spenta nella scheda Forme: non conta.
  const conRett = RIGHE.map((f) => (f.id === 'quadrata' ? { ...f, per_alte: false } : f));
  assert.equal(ultimaFormaDelGruppo(conRett, 'tonda', true), true);
});
