// node --test src/lib/promemoriaRegole.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  occasioneConPromemoria, testiPromemoria, avvisoPromemoria, leggiLinkPromemoria,
  anniversarioDi, stessaRicorrenza, raggruppaPromemoria, puoRimettere, festaDavanti, oggiISO,
} from './promemoriaRegole.js';

test('occasioni del sito (lette da Supabase il 09/10/2026) e nomi rinominati', () => {
  const attese = {
    Compleanno: 'Compleanno', Anniversario: 'Anniversario', Laurea: null, Battesimo: null,
    Comunione: null, 'Gender reveal': null, 'Festa di famiglia': null, Nessuna: null,
    'Compleanno 🎂': 'Compleanno', 'COMPLEANNO': 'Compleanno', 'Anniversario di matrimonio': 'Anniversario',
    '': null,
  };
  for (const [nome, occ] of Object.entries(attese)) assert.equal(occasioneConPromemoria(nome), occ, nome);
  assert.equal(occasioneConPromemoria(null), null);
  assert.equal(occasioneConPromemoria(undefined), null);
});

test('parole e avviso per il cliente', () => {
  assert.deepEqual(testiPromemoria('Anniversario'), { emoji: '🥂', ricorrenza: "l'anniversario" });
  assert.deepEqual(testiPromemoria('qualsiasi'), { emoji: '🎂', ricorrenza: 'il compleanno' });
  assert.match(avvisoPromemoria('Anniversario'), /^🥂 .*ricordarti l'anniversario.*un clic/);
  assert.match(avvisoPromemoria('Compleanno'), /^🎂 .*ricordarti il compleanno/);
  assert.equal(avvisoPromemoria('Laurea'), null);
  assert.equal(avvisoPromemoria(''), null);
});

test('link dalla mail: togli, stop, prova, link rovinato', () => {
  const tok = 'a1'.repeat(16);
  assert.deepEqual(leggiLinkPromemoria(`?togli=${tok}`), { modo: 'togli', token: tok, prova: false });
  assert.deepEqual(leggiLinkPromemoria(`?stop=${tok.toUpperCase()}`), { modo: 'stop', token: tok, prova: false });
  // «togli» vince: è il più leggero dei due
  assert.deepEqual(leggiLinkPromemoria(`?stop=${tok}&togli=${tok}`), { modo: 'togli', token: tok, prova: false });
  assert.deepEqual(leggiLinkPromemoria('?togli=prova'), { modo: 'togli', token: null, prova: true });
  assert.deepEqual(leggiLinkPromemoria('?stop=PROVA'), { modo: 'stop', token: null, prova: true });
  // token tagliato dal programma di posta: pagina "link non valido", non silenzio
  assert.deepEqual(leggiLinkPromemoria('?togli=abc'), { modo: 'togli', token: null, prova: false });
  assert.deepEqual(leggiLinkPromemoria('?stop='), { modo: 'stop', token: null, prova: false });
  assert.equal(leggiLinkPromemoria(`?torta=${tok}`), null);
  assert.equal(leggiLinkPromemoria(''), null);
  assert.equal(leggiLinkPromemoria(undefined), null);
});

test('data della festa: dal database, oppure ricavata (righe di prima della migrazione)', () => {
  assert.equal(anniversarioDi({ anniversario: '2027-08-15', tipo: 'primo', invio_previsto: '2027-07-16' }), '2027-08-15');
  assert.equal(anniversarioDi({ tipo: 'primo', invio_previsto: '2027-07-16' }), '2027-08-15');
  assert.equal(anniversarioDi({ tipo: 'secondo', invio_previsto: '2027-08-01' }), '2027-08-15');
  assert.equal(anniversarioDi({ tipo: 'primo', invio_previsto: '2028-01-30' }), '2028-02-29');
  assert.equal(anniversarioDi({}), null);
});

test('stessa festa: stesso ordine, oppure stessa email e occasione a 3 giorni o meno', () => {
  const a = { ordineId: 'A', email: 'm@x.it', occasione: 'Compleanno', anniversario: '2027-08-15' };
  assert.ok(stessaRicorrenza(a, { ...a }));
  assert.ok(stessaRicorrenza(a, { ...a, ordineId: 'B', anniversario: '2027-08-18' }));
  assert.ok(!stessaRicorrenza(a, { ...a, ordineId: 'B', anniversario: '2027-08-19' }));
  assert.ok(!stessaRicorrenza(a, { ...a, ordineId: 'B', occasione: 'Anniversario' }));
  assert.ok(!stessaRicorrenza(a, { ...a, ordineId: 'B', email: 'altra@x.it' }));
  assert.ok(stessaRicorrenza(a, { ...a, ordineId: 'B', anniversario: '2027-12-31' }) === false);
});

test('una scheda per festa, con le due mail in ordine e il badge del doppione', () => {
  const rows = [
    { id: 1, ordine_id: 'A', email: 'm@x.it', tipo: 'secondo', stato: 'in_attesa', invio_previsto: '2027-08-01', anniversario: '2027-08-15' },
    { id: 2, ordine_id: 'A', email: 'm@x.it', tipo: 'primo', stato: 'inviato', invio_previsto: '2027-07-16', inviato_il: '2027-07-16T07:02:00Z', anniversario: '2027-08-15' },
    { id: 3, ordine_id: 'B', email: 'm@x.it', tipo: 'primo', stato: 'in_attesa', invio_previsto: '2027-07-17', anniversario: '2027-08-16' },
    { id: 4, ordine_id: 'C', email: 'm@x.it', tipo: 'primo', stato: 'annullato', invio_previsto: '2027-09-01', anniversario: '2027-10-01', occasione: 'Anniversario' },
    { id: 5, ordine_id: 'D', email: 'z@x.it', tipo: 'primo', stato: 'errore', invio_previsto: '2027-07-20' },
    { id: 6, ordine_id: 'E', email: 'y@x.it', tipo: 'secondo', stato: 'inviato', invio_previsto: '2027-06-01', inviato_il: '2027-06-01T07:00:00Z' },
  ];
  const s = raggruppaPromemoria(rows, '2027-01-01'); // «oggi» fisso: la prova non scade
  assert.deepEqual(s.map((x) => x.ordineId), ['B', 'D', 'A', 'C', 'E']);
  const a = s.find((x) => x.ordineId === 'A');
  assert.deepEqual(a.righe.map((r) => r.tipo), ['primo', 'secondo']);
  assert.equal(a.prossima, '2027-08-01');
  assert.ok(a.doppione && s.find((x) => x.ordineId === 'B').doppione);
  assert.ok(!s.find((x) => x.ordineId === 'C').doppione);
  assert.equal(s.find((x) => x.ordineId === 'C').occasione, 'Anniversario');
  // riga di prima della migrazione: niente occasione né data della festa
  const d = s.find((x) => x.ordineId === 'D');
  assert.equal(d.occasione, 'Compleanno');
  assert.equal(d.anniversario, '2027-08-19');
  assert.ok(d.attiva, 'una mail in errore va sistemata: la scheda sta fra quelle attive');
  assert.deepEqual(raggruppaPromemoria(null), []);
});

test('«Rimetti in coda» solo dove ha senso', () => {
  assert.ok(puoRimettere({ stato: 'errore', inviato_il: '2027-07-16T07:00:00Z' }), 'errore di EmailJS: non era partita');
  assert.ok(puoRimettere({ stato: 'annullato', nota: 'tolto dal gestionale' }));
  assert.ok(puoRimettere({ stato: 'annullato', nota: 'annullato dal gestionale' }));
  assert.ok(!puoRimettere({ stato: 'inviato' }));
  assert.ok(!puoRimettere({ stato: 'in_attesa' }));
  assert.ok(!puoRimettere({ stato: 'annullato', inviato_il: '2027-07-16T07:00:00Z' }), 'già partita una volta');
  assert.ok(!puoRimettere({ stato: 'annullato', nota: 'tolto dal cliente' }));
  assert.ok(!puoRimettere({ stato: 'annullato', nota: 'tolto dal cliente (stessa ricorrenza)' }));
  assert.ok(!puoRimettere({ stato: 'annullato', nota: 'disiscritto' }));
});

test('feste già passate o troppo vicine: niente «Rimetti in coda», come dice il database', () => {
  const oggi = '2026-10-10';
  // rimetti_in_coda_promemoria vuole la festa ad almeno 3 giorni da oggi.
  assert.ok(festaDavanti({ anniversario: '2026-10-13' }, oggi));
  assert.ok(!festaDavanti({ anniversario: '2026-10-12' }, oggi));
  assert.ok(!festaDavanti({ anniversario: '2026-09-30' }, oggi));
  assert.ok(festaDavanti({}, oggi), 'data sconosciuta: decide il database');
  assert.ok(puoRimettere({ stato: 'errore', anniversario: '2026-10-13' }, oggi));
  assert.ok(!puoRimettere({ stato: 'errore', anniversario: '2026-10-12' }, oggi));
  assert.ok(!puoRimettere({ stato: 'errore', anniversario: '2026-09-30' }, oggi));
  assert.ok(!puoRimettere({ stato: 'annullato', nota: 'ha già ordinato', anniversario: '2026-09-30' }, oggi));
  assert.ok(!puoRimettere({ stato: 'annullato', nota: 'ricorrenza già passata', anniversario: '2026-09-30' }, oggi));
  // riga di prima della migrazione: la festa si ricava dalla data d'invio (30/09)
  assert.ok(!puoRimettere({ stato: 'annullato', nota: 'fuori tempo', tipo: 'primo', invio_previsto: '2026-08-31' }, oggi));
  assert.ok(puoRimettere({ stato: 'annullato', nota: 'tolto dal gestionale', anniversario: '2027-03-01' }, oggi));
});

test('una mail in errore tiene la festa «in arrivo» solo finché si può ancora rimettere in coda', () => {
  const oggi = '2026-10-10';
  const s = raggruppaPromemoria([
    // festa del 30/09, passata: la «30 giorni prima» in errore, la «14 giorni prima» annullata
    { id: 1, ordine_id: 'P', email: 'p@x.it', tipo: 'primo', stato: 'errore', invio_previsto: '2026-08-31', anniversario: '2026-09-30' },
    { id: 2, ordine_id: 'P', email: 'p@x.it', tipo: 'secondo', stato: 'annullato', nota: 'ricorrenza già passata', invio_previsto: '2026-09-16', anniversario: '2026-09-30' },
    // fra 2 giorni: il database non la rimette più in coda
    { id: 3, ordine_id: 'V', email: 'v@x.it', tipo: 'secondo', stato: 'errore', invio_previsto: '2026-09-28', anniversario: '2026-10-12' },
    // fra 3 giorni: si può ancora sistemare
    { id: 4, ordine_id: 'F', email: 'f@x.it', tipo: 'secondo', stato: 'errore', invio_previsto: '2026-09-29', anniversario: '2026-10-13' },
    // in coda resta attiva comunque (la ferma il giro)
    { id: 5, ordine_id: 'Q', email: 'q@x.it', tipo: 'secondo', stato: 'in_attesa', invio_previsto: '2026-10-09', anniversario: '2026-10-23' },
  ], oggi);
  assert.deepEqual(s.filter((x) => x.attiva).map((x) => x.ordineId), ['F', 'Q']);
  assert.deepEqual(s.filter((x) => !x.attiva).map((x) => x.ordineId).sort(), ['P', 'V']);
  assert.equal(s.find((x) => x.ordineId === 'F').prossima, '2026-09-29');
  assert.equal(s.find((x) => x.ordineId === 'P').prossima, null);
});

test('«oggi» col calendario del dispositivo', () => {
  assert.equal(oggiISO(new Date(2026, 9, 10, 0, 30)), '2026-10-10');
  assert.equal(oggiISO(new Date(2027, 0, 1, 23, 59)), '2027-01-01');
  assert.match(oggiISO(), /^\d{4}-\d{2}-\d{2}$/);
});
