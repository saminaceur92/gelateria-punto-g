// node --test src/lib/rigaBase.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { descriviBase } from './rigaBase.js';

test('basi vere del listino (lette il 10/10/2026)', () => {
  assert.equal(descriviBase('Senza base'), 'senza base');
  assert.equal(descriviBase('Classica Vaniglia'), 'su base classica vaniglia');
  assert.equal(descriviBase('Classica Cioccolato'), 'su base classica cioccolato');
  assert.equal(descriviBase('Salame al cioccolato'), 'su base salame al cioccolato');
  assert.equal(descriviBase('Base croccante'), 'su base croccante');
  // col crumble la scheda mostra il nome del crumble scelto
  assert.equal(descriviBase('Crumble pistacchio'), 'su base crumble pistacchio');
});

test('solo «nessuna base» si scrive da sola: una base «senza glutine» resta una base', () => {
  assert.equal(descriviBase('Nessuna base'), 'nessuna base');
  assert.equal(descriviBase('Niente base'), 'niente base');
  assert.equal(descriviBase('  SENZA   BASE '), 'senza base');
  assert.equal(descriviBase('Senza glutine'), 'su base senza glutine');
  assert.equal(descriviBase('Senza lattosio'), 'su base senza lattosio');
  assert.equal(descriviBase('Senza zuccheri aggiunti'), 'su base senza zuccheri aggiunti');
  assert.equal(descriviBase('Senza basetta'), 'su base senza basetta');
  assert.equal(descriviBase('Base senza glutine'), 'su base senza glutine');
});

test('nome mancante: nessuna riga', () => {
  assert.equal(descriviBase(''), '');
  assert.equal(descriviBase('   '), '');
  assert.equal(descriviBase(null), '');
  assert.equal(descriviBase(undefined), '');
});
