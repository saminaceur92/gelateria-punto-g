// node --test src/lib/codiciRegole.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pulisci, problemaCodice, MASCHERA, impacchetta, spacchetta, DURATA_RICORDO_MS } from './codiciRegole.js';

test('spazi tolti come fa il database', () => {
  assert.equal(pulisci(' 12 34\t'), '1234');
  assert.equal(pulisci(null), '');
});

test('regole del codice nuovo', () => {
  assert.match(problemaCodice('123'), /almeno 4/);
  assert.equal(problemaCodice('1234'), '');
  assert.match(problemaCodice('12345', 'admin'), /almeno 6/);
  assert.equal(problemaCodice('123 456', 'admin'), '');
  assert.match(problemaCodice('5566', 'staff', '5567'), /non sono uguali/);
  assert.equal(problemaCodice('5566', 'staff', '55 66'), '');
});

test('la maschera non dice la lunghezza', () => {
  assert.equal(MASCHERA.length, 4);
});

test('il codice ricordato scade', () => {
  const t = 1_000_000;
  const s = impacchetta('908172', t);
  assert.equal(spacchetta(s, t + 1000), '908172');
  assert.equal(spacchetta(s, t + DURATA_RICORDO_MS + 1), '');
  assert.equal(spacchetta('908172', t), ''); // formato vecchio di sessionStorage: si richiede
  assert.equal(spacchetta(null, t), '');
});
