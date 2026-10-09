// node --test src/lib/noteOrdine.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteClienteDi, fondiAggiornamento, notaDaSalvare, bozzaSuperata } from './noteOrdine.js';

test('note del cliente: colonna, copia nei dettagli, vuote', () => {
  assert.equal(noteClienteDi(null), '');
  assert.equal(noteClienteDi({}), '');
  assert.equal(noteClienteDi({ note: null, dettagli: null }), '');
  assert.equal(noteClienteDi({ note: '   \n ' }), '', 'soli spazi = nessuna nota');
  assert.equal(noteClienteDi({ note: 'Senza frutta secca' }), 'Senza frutta secca');
  // Solo nella copia dentro dettagli (ordini dove la colonna è vuota)
  assert.equal(noteClienteDi({ note: null, dettagli: { notes: 'Scritta in blu' } }), 'Scritta in blu');
  // Colonna di soli spazi: vale la copia
  assert.equal(noteClienteDi({ note: '  ', dettagli: { notes: 'Copia' } }), 'Copia');
  // Gli a capo dentro la nota restano, si tolgono solo quelli ai bordi
  assert.equal(noteClienteDi({ note: '\nRiga 1\nRiga 2\n' }), 'Riga 1\nRiga 2');
});

test('tempo reale: un payload parziale non cancella dettagli e foto', () => {
  const ordine = {
    id: 'a1',
    cliente_nome: 'Anna',
    immagine: 'https://foto/torta.jpg',
    note_future: null,
    dettagli: { flavors: [{ name: 'Fior di Latte' }], fotoCialdaUrl: 'https://foto/cialda.jpg' },
  };
  const dopo = fondiAggiornamento(ordine, { id: 'a1', note_future: 'Chiedere la candelina' });
  assert.equal(dopo.note_future, 'Chiedere la candelina');
  assert.equal(dopo.immagine, 'https://foto/torta.jpg');
  assert.deepEqual(dopo.dettagli, ordine.dettagli);
  // dettagli parziali: si fondono chiave per chiave
  const dopo2 = fondiAggiornamento(dopo, { id: 'a1', dettagli: { emailInviata: true } });
  assert.equal(dopo2.dettagli.fotoCialdaUrl, 'https://foto/cialda.jpg');
  assert.equal(dopo2.dettagli.emailInviata, true);
  // l'ordine di partenza non si tocca
  assert.equal(ordine.note_future, null);
});

test('nota da salvare: vuota diventa null (o la stringa vuota per il laboratorio)', () => {
  assert.equal(notaDaSalvare('Ritira la nonna'), 'Ritira la nonna');
  assert.equal(notaDaSalvare('  testo con spazi  '), '  testo con spazi  ');
  assert.equal(notaDaSalvare(''), null);
  assert.equal(notaDaSalvare('   \n'), null);
  assert.equal(notaDaSalvare(undefined), null);
  assert.equal(notaDaSalvare('  ', ''), '');
});

test('bozza superata da un altro dispositivo', () => {
  assert.equal(bozzaSuperata(undefined, 'x'), false);
  assert.equal(bozzaSuperata({ testo: 'mio', base: '' }, null), false, 'base vuota e salvato null: niente di nuovo');
  assert.equal(bozzaSuperata({ testo: 'mio', base: 'vecchio' }, 'vecchio'), false);
  assert.equal(bozzaSuperata({ testo: 'mio', base: 'vecchio' }, 'nuovo da B'), true);
  assert.equal(bozzaSuperata({ testo: 'mio', base: 'vecchio' }, null), true, 'cancellata altrove');
});
