// node --test src/admin/consigliateStat.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  riepilogoConsigliate, piuScelta, divisione, percentuali, elencoNomi, volte, GRUPPI,
} from './consigliateStat.js';

// Una voce come la restituisce statistiche_riepilogo.
const ev = (chiave, conteggio, ordine = 300, etichetta = undefined) =>
  ({ chiave, etichetta, gruppo: 'torta', ordine, conteggio });

// Il catalogo dopo la migrazione del 9 ottobre: nove torte, tutte a zero.
const CATALOGO = [
  ev('torta_consigliata_gelato_golosa', 0, 301, 'La Golosa'),
  ev('torta_consigliata_gelato_delicata', 0, 302, 'La Delicata'),
  ev('torta_consigliata_gelato_fresca', 0, 303, 'La Fresca'),
  ev('torta_consigliata_gelato_classicissima', 0, 304, 'La Classicissima'),
  ev('torta_consigliata_gelato_vegan', 0, 305, 'La Vegan'),
  ev('torta_consigliata_semifreddo_nutellona', 0, 351, 'La Nutellona'),
  ev('torta_consigliata_semifreddo_cheesecake', 0, 352, 'La Cheesecake'),
  ev('torta_consigliata_semifreddo_biscottona', 0, 353, 'La Biscottona'),
  ev('torta_consigliata_semifreddo_rocher', 0, 354, 'La Rocher'),
];
const conNumeri = (numeri) => CATALOGO.map((e) => ({ ...e, conteggio: numeri[e.chiave.split('_').pop()] ?? 0 }));

test('divide gelato e semifreddo e trova la più scelta', () => {
  const c = riepilogoConsigliate([
    ...conNumeri({ golosa: 8, fresca: 3, nutellona: 5 }),
    ev('torta_sorprendimi', 40, 201),
    ev('torta_passo_forma', 99, 4),
  ]);
  assert.equal(c.aCatalogo, true);
  assert.deepEqual(c.perGruppo.map((g) => [g.id, g.valore]), [['gelato', 11], ['semifreddo', 5]]);
  assert.equal(c.dettaglio, 16);
  assert.equal(c.totale, 16);
  assert.equal(c.max, 8);
  assert.deepEqual(c.top.map((t) => t.nome), ['La Golosa']);
  // Dalla più scelta; a pari numero (gli zeri) nell'ordine della vetrina.
  assert.deepEqual(c.torte.slice(0, 5).map((t) => t.nome), ['La Golosa', 'La Nutellona', 'La Fresca', 'La Delicata', 'La Classicissima']);
  assert.deepEqual(c.perGruppo[1].torte.map((t) => t.nome), ['La Nutellona', 'La Cheesecake', 'La Biscottona', 'La Rocher']);
  assert.deepEqual(piuScelta(c), { valore: 'La Golosa', spiega: '8 volte · torta gelato' });
  assert.equal(divisione(c), '🍦 11 · 🍰 5');
});

test('il vecchio evento entra nel totale ma non nella divisione: niente conta due volte', () => {
  const c = riepilogoConsigliate([ev('torta_consigliata', 7, 202, 'Ha scelto una torta già composta'), ...conNumeri({ rocher: 2 })]);
  assert.equal(c.generico, 7);
  assert.equal(c.dettaglio, 2);
  assert.equal(c.totale, 9);
  assert.deepEqual(c.perGruppo.map((g) => g.valore), [0, 2]);
  assert.deepEqual(piuScelta(c), { valore: 'La Rocher', spiega: '2 volte · semifreddo' });
});

test('pari merito: due o tre nomi insieme, oltre si dice quante sono', () => {
  const due = riepilogoConsigliate(conNumeri({ golosa: 4, nutellona: 4, fresca: 1 }));
  assert.deepEqual(due.top.map((t) => t.nome), ['La Golosa', 'La Nutellona']);
  assert.deepEqual(piuScelta(due), { valore: 'La Golosa e La Nutellona', spiega: 'pari merito, 4 volte ciascuna' });

  const tre = riepilogoConsigliate(conNumeri({ golosa: 1, nutellona: 1, rocher: 1 }));
  assert.equal(piuScelta(tre).valore, 'La Golosa, La Nutellona e La Rocher');
  assert.equal(piuScelta(tre).spiega, 'pari merito, 1 volta ciascuna');

  const cinque = riepilogoConsigliate(conNumeri({ golosa: 1, delicata: 1, fresca: 1, nutellona: 1, rocher: 1 }));
  assert.equal(piuScelta(cinque).valore, '5 a pari merito');
  assert.match(piuScelta(cinque).spiega, /^1 volta ciascuna/);
});

test('tutto a zero: nessuna "più scelta", nessuna divisione', () => {
  const c = riepilogoConsigliate(CATALOGO);
  assert.equal(c.aCatalogo, true);
  assert.equal(c.max, 0);
  assert.deepEqual(c.top, []);
  assert.deepEqual(c.perGruppo.map((g) => g.quota), [0, 0]);
  assert.deepEqual(piuScelta(c), { valore: '—', spiega: 'nessuna scelta in questo periodo' });
  assert.equal(divisione(c), '');
});

test('migrazione non ancora eseguita: si sa solo il totale', () => {
  const c = riepilogoConsigliate([ev('torta_consigliata', 3, 202), ev('torta_sorprendimi', 2, 201)]);
  assert.equal(c.aCatalogo, false);
  assert.equal(c.totale, 3);
  assert.equal(c.dettaglio, 0);
  assert.equal(divisione(c), '');
});

test('risposta malformata: non esplode e non inventa numeri', () => {
  const strane = [
    null, undefined, {}, 'eventi', [null], [42], [{ chiave: 42, conteggio: 5 }],
    [ev('torta_consigliata_altro_x', 5)], // gruppo che non esiste
    [ev('torta_consigliata_gelato_', 5)], // manca l'id
    [ev('torta_consigliata_gelato_golosa', 'tanti')],
    [ev('torta_consigliata_gelato_golosa', -4)],
    [ev('torta_consigliata_gelato_golosa', Infinity)],
  ];
  for (const x of strane) {
    const c = riepilogoConsigliate(x);
    assert.equal(c.totale, 0, JSON.stringify(x));
    assert.deepEqual(c.top, []);
    assert.equal(piuScelta(c).valore, '—');
  }
  // Senza etichetta si usa l'id, non una riga vuota.
  assert.equal(riepilogoConsigliate([ev('torta_consigliata_gelato_golosa', 1)]).torte[0].nome, 'golosa');
  // Una chiave ripetuta non si somma due volte.
  assert.equal(riepilogoConsigliate([ev('torta_consigliata_gelato_golosa', 2), ev('torta_consigliata_gelato_golosa', 2)]).totale, 2);
});

test('le due percentuali fanno sempre 100', () => {
  assert.deepEqual(percentuali([1, 7]), [13, 87]); // 12,5 + 87,5: arrotondate a parte farebbero 101
  assert.deepEqual(percentuali([7, 1]), [87, 13]);
  assert.deepEqual(percentuali([1, 2]), [33, 67]);
  assert.deepEqual(percentuali([0, 5]), [0, 100]);
  assert.deepEqual(percentuali([0, 0]), [0, 0]);
  for (let a = 0; a <= 40; a++) {
    for (let b = 0; b <= 40; b++) {
      if (a + b) assert.equal(percentuali([a, b]).reduce((s, x) => s + x, 0), 100, `${a}/${b}`);
    }
  }
  const c = riepilogoConsigliate(conNumeri({ golosa: 1, rocher: 7 }));
  assert.deepEqual(c.perGruppo.map((g) => g.quota), [13, 87]);
});

test('frasi in italiano', () => {
  assert.equal(elencoNomi([]), '');
  assert.equal(elencoNomi(['A']), 'A');
  assert.equal(elencoNomi(['A', 'B']), 'A e B');
  assert.equal(elencoNomi(['A', 'B', 'C']), 'A, B e C');
  assert.equal(volte(1), '1 volta');
  assert.equal(volte(0), '0 volte');
  // Come il resto della scheda (toLocaleString 'it-IT'): il punto delle
  // migliaia compare dalle cinque cifre in su.
  assert.equal(volte(12000), '12.000 volte');
});

test('i gruppi sono quelli dei due tasti del configuratore', () => {
  assert.deepEqual(GRUPPI.map((g) => g.id), ['gelato', 'semifreddo']);
  assert.deepEqual(GRUPPI.map((g) => g.nome), ['🍦 Torte gelato', '🍰 Semifreddi']);
});
