// node --test src/lib/riordina.test.mjs
// Fixture: i dati veri del 09-10-2026 (solo le colonne che servono).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  numero, ordinaComeIlSito, ordinaGustiTorte, capofila, gruppiDi, riordina, applica,
  numeriDi, daScrivere, listaCambiata,
} from './riordina.js';

const COPERTURE = [
  { id: 'panna-veg', ordine: 10, attivo: true },
  { id: 'panna', ordine: 10, attivo: true },
  { id: 'panna-spatolata-veg', ordine: 15, attivo: true },
  { id: 'panna-spatolata', ordine: 15, attivo: true },
  { id: 'meringa', ordine: 20, attivo: false },
  { id: 'panna-sopra', ordine: 20, attivo: true },
  { id: 'panna-sopra-veg', ordine: 20, attivo: true },
  { id: 'panna-sotto-sopra-veg', ordine: 30, attivo: true },
  { id: 'ganache-cop', ordine: 30, attivo: false },
  { id: 'panna-sotto-sopra', ordine: 30, attivo: true },
  { id: 'glassa-specchio', ordine: 40, attivo: false },
  { id: 'cioccolato-cop', ordine: 40, attivo: true },
  { id: 'pistacchio-cop', ordine: 50, attivo: true },
  { id: 'frutta-cop', ordine: 60, attivo: true },
  { id: 'naked', ordine: 70, attivo: true },
  { id: 'cioccolato-bianco-cop', ordine: 80, attivo: true },
  { id: 'nocciola-cop', ordine: 90, attivo: true },
];
const DECORAZIONI = [
  { id: 'nessuna', ordine: 10, attivo: true },
  { id: 'granella-nocciola', ordine: 20, attivo: true },
  { id: 'granella-nocciola-pistacchio', ordine: 20, attivo: false },
  { id: 'granella-pistacchio', ordine: 30, attivo: true },
  { id: 'granella-frutta-secca', ordine: 40, attivo: false },
  { id: 'zuccherini', ordine: 40, attivo: true },
  { id: 'smarties', ordine: 50, attivo: true },
  { id: 'perline', ordine: 60, attivo: true },
  { id: 'fiocchi', ordine: 70, attivo: true },
  { id: 'cioccolato-fondente-deco', ordine: 80, attivo: true },
  { id: 'macarons', ordine: 90, attivo: true },
  { id: 'spumini', ordine: 100, attivo: true },
  { id: 'marshmallow', ordine: 110, attivo: true },
  { id: 'fiori-eleganti', ordine: 120, attivo: true },
  { id: 'fiori-ostia', ordine: 130, attivo: true },
  { id: 'cioccolato-deco', ordine: 140, attivo: true },
  { id: 'frutta-fresca', ordine: 150, attivo: true },
  { id: 'drip', ordine: 155, attivo: true },
  { id: 'panna-deco-veg', ordine: 160, attivo: true },
  { id: 'panna-deco', ordine: 160, attivo: true },
  { id: 'panna-colorata-veg', ordine: 170, attivo: true },
  { id: 'panna-colorata', ordine: 170, attivo: true },
  { id: 'fantasia', ordine: 180, attivo: true },
  { id: 'colorate', ordine: 190, attivo: true },
];
const DIMENSIONI = [
  { id: '6', ordine: 10, alta: false },
  { id: 'alta-6', ordine: 10, alta: true },
  { id: '8', ordine: 20, alta: false },
  { id: 'alta-8', ordine: 20, alta: true },
  { id: '10', ordine: 30, alta: false },
  { id: 'alta-10', ordine: 30, alta: true },
  { id: '12', ordine: 40, alta: false },
  { id: 'alta-12', ordine: 40, alta: true },
  { id: 'alta-16', ordine: 50, alta: true },
  { id: '16', ordine: 50, alta: false },
  { id: 'alta-20', ordine: 60, alta: true },
  { id: '20', ordine: 60, alta: false },
  { id: 'alta-fdd02722', ordine: 70, alta: true },
  { id: 'fdd02722', ordine: 70, alta: false },
  { id: 'efd0a115', ordine: 80, alta: false },
  { id: 'alta-efd0a115', ordine: 80, alta: true },
  { id: '9f4550b9', ordine: 90, alta: false },
  { id: 'alta-9f4550b9', ordine: 90, alta: true },
  { id: 'cb8ba7bf', ordine: 100, alta: false },
  { id: 'alta-cb8ba7bf', ordine: 100, alta: true },
];
const g = (id, categoria, ordine, per_torte, attivo = true) => ({ id, categoria, ordine, per_torte, attivo });
const GUSTI = [
  g('base-bianca', 'base', 1, false), g('base-vegan', 'base', 2, false), g('base-frutta', 'base', 3, false),
  g('acqua', 'base', 4, false), g('latte', 'base', 5, false),
  g('fior-di-latte', 'crema', 10, true), g('yogurt-bianco', 'crema', 11, true), g('crema', 'crema', 12, true),
  g('cioccolato-al-latte', 'crema', 13, true), g('pistacchio', 'crema', 14, true), g('nocciola', 'crema', 15, true),
  g('caffe', 'crema', 16, true), g('stracciatella', 'crema', 17, true),
  g('cheesecake', 'golosone', 22, true), g('spagnola', 'golosone', 23, true), g('pino-pinguino', 'golosone', 24, true),
  g('nutella', 'golosone', 25, true), g('kinder', 'golosone', 26, true), g('caramello-salato', 'golosone', 27, true),
  g('bacio', 'golosone', 28, true), g('biscotto', 'golosone', 29, true), g('punto-gi', 'golosone', 30, true),
  g('mentaciock', 'golosone', 31, true), g('duplo', 'golosone', 32, true), g('giovanna', 'golosone', 33, true),
  g('limone', 'frutta-vegan', 40, true), g('fragola', 'frutta-vegan', 41, true), g('nero-nero', 'frutta-vegan', 46, true),
  g('cocco', 'frutta-vegan', 47, true), g('mango', 'frutta-vegan', 48, true), g('nocciola-gianduia', 'frutta-vegan', 49, true),
  g('pistacchio-salato', 'frutta-vegan', 50, true), g('yogurt-mango', 'frutta-vegan', 51, true),
  g('granita-pistacchio', 'leccornie', 52, false), g('granita-mandorla', 'leccornie', 53, false, false),
  g('pompelmo', 'frutta-vegan', 54, true, false), g('pesca', 'frutta-vegan', 55, true, false),
  g('melone', 'frutta-vegan', 56, true, false),
  g('pasticcini-semifreddo', 'leccornie', 70, false), g('salame-dolce', 'leccornie', 71, false),
  g('torte-gelato', 'leccornie', 72, false), g('torte-semifreddo', 'leccornie', 73, false),
  g('monoporzioni', 'leccornie', 74, false), g('gusto-del-mese', 'golosone', 75, false),
];

const ids = (righe) => righe.map((r) => r.id);
// Applica una mossa e restituisce le righe nuove.
const muovi = (righe, id, delta, opz = {}) => {
  const r = riordina(righe, id, delta, opz);
  assert.ok(r, `${id} doveva potersi spostare`);
  return applica(righe, r.cambi, opz.chiave);
};
// La pulizia della migrazione (sezione 18b) rifatta in JS: 10, 20, 30…
// nell'ordine del sito, gemelle allo stesso numero dell'originale.
function pulizia(righe, chiave = 'ordine') {
  const n = new Map();
  gruppiDi(righe, chiave).forEach((gr, k) => gr.righe.forEach((r) => n.set(String(r.id), (k + 1) * 10)));
  return righe.map((r) => ({ ...r, [chiave]: n.get(String(r.id)) }));
}

test('ordine del sito: numero, poi id; vuoti in fondo', () => {
  assert.deepEqual(ids(ordinaComeIlSito(COPERTURE)).slice(0, 7),
    ['panna', 'panna-veg', 'panna-spatolata', 'panna-spatolata-veg', 'meringa', 'panna-sopra', 'panna-sopra-veg']);
  const conVuoti = [{ id: 'b', ordine: null }, { id: 'a', ordine: 20 }, { id: 'c', ordine: '' }, { id: 'd', ordine: 10 }];
  assert.deepEqual(ids(ordinaComeIlSito(conVuoti)), ['d', 'a', 'b', 'c']);
  assert.equal(numero(''), null);
  assert.equal(numero('30'), 30);
  assert.equal(capofila('panna-veg', new Set(['panna', 'panna-veg'])), 'panna');
  assert.equal(capofila('solo-veg', new Set(['solo-veg'])), 'solo-veg', 'senza originale non è una gemella');
});

test('gemelle vegetali: si spostano insieme, anche premendo sulla gemella', () => {
  const r1 = riordina(DECORAZIONI, 'panna-colorata', -1);
  const dopo = applica(DECORAZIONI, r1.cambi);
  const n = Object.fromEntries(dopo.map((r) => [r.id, r.ordine]));
  assert.equal(n['panna-colorata'], n['panna-colorata-veg'], 'stesso numero');
  assert.ok(n['panna-colorata'] < n['panna-deco'], 'sopra la panna decorativa');
  assert.equal(n['panna-deco'], n['panna-deco-veg']);
  // Premere la freccia sulla gemella dà lo stesso risultato
  const r2 = riordina(DECORAZIONI, 'panna-colorata-veg', -1);
  assert.deepEqual(r2.cambi, r1.cambi);
  // Nell'ordine nuovo l'originale viene subito prima della gemella
  const o = r1.ordine;
  assert.equal(o.indexOf('panna-colorata-veg'), o.indexOf('panna-colorata') + 1);
});

test('prima e ultima voce non si spostano oltre il bordo', () => {
  assert.equal(riordina(DECORAZIONI, 'nessuna', -1), null);
  assert.equal(riordina(DECORAZIONI, 'colorate', +1), null);
  assert.equal(riordina(DECORAZIONI, 'inesistente', -1), null);
  assert.equal(riordina(DECORAZIONI, 'fiocchi', 2), null, 'solo un passo alla volta');
});

test('lista "sporca": la prima mossa rinumera, poi ogni tocco cambia al massimo 4 righe', () => {
  const r1 = riordina(DECORAZIONI, 'fiocchi', -1);
  assert.ok(Object.keys(r1.cambi).length > 4, 'la prima volta i numeri si sistemano');
  let righe = applica(DECORAZIONI, r1.cambi);
  // numeri tutti diversi, tranne le gemelle
  const capi = gruppiDi(righe).map((gr) => gr.riga.ordine);
  assert.equal(new Set(capi).size, capi.length);
  for (const [id, d] of [['fiocchi', -1], ['drip', +1], ['panna-deco', -1], ['nessuna', +1]]) {
    const r = riordina(righe, id, d);
    assert.ok(Object.keys(r.cambi).length <= 4, `${id}: ${Object.keys(r.cambi).length} righe`);
    righe = applica(righe, r.cambi);
  }
});

test('dopo la pulizia della migrazione: ogni mossa possibile cambia al massimo 4 righe', () => {
  for (const [nome, righe] of [['coperture', COPERTURE], ['decorazioni', DECORAZIONI]]) {
    const pulite = pulizia(righe);
    assert.deepEqual(ids(ordinaComeIlSito(pulite)), ids(ordinaComeIlSito(righe)), `${nome}: ordine invariato`);
    for (const gr of gruppiDi(pulite)) {
      for (const d of [-1, 1]) {
        const r = riordina(pulite, gr.id, d);
        if (r) assert.ok(Object.keys(r.cambi).length <= 4, `${nome} ${gr.id} ${d}`);
      }
    }
  }
});

test('su e poi giù: stessi numeri, niente da scrivere', () => {
  const pulite = pulizia(COPERTURE);
  const base = numeriDi(pulite);
  const su = muovi(pulite, 'naked', -1);
  assert.ok(daScrivere(su, base).length === 2);
  const giu = muovi(su, 'naked', +1);
  assert.deepEqual(daScrivere(giu, base), []);
});

test('taglie: spostando le normali, le alte restano nel loro ordine', () => {
  const normali = (r) => !r.alta;
  const prima = ids(ordinaComeIlSito(DIMENSIONI).filter((r) => r.alta));
  let righe = muovi(DIMENSIONI, '8', -1, { visibile: normali });
  assert.deepEqual(ids(ordinaComeIlSito(righe).filter(normali)).slice(0, 3), ['8', '6', '10']);
  assert.deepEqual(ids(ordinaComeIlSito(righe).filter((r) => r.alta)), prima);
  // la prima normale non sale, anche se sopra c'è un'alta
  assert.equal(riordina(righe, '8', -1, { visibile: normali }), null);
  // spostare la 25 persone (preceduta da due alte) le scavalca, le alte restano ferme fra loro
  righe = muovi(righe, 'fdd02722', -1, { visibile: normali });
  assert.deepEqual(ids(ordinaComeIlSito(righe).filter(normali)).slice(-5), ['fdd02722', '20', 'efd0a115', '9f4550b9', 'cb8ba7bf']);
  assert.deepEqual(ids(ordinaComeIlSito(righe).filter((r) => r.alta)), prima);
});

test('carta del gelato: ci si sposta solo dentro la propria categoria', () => {
  const stessoAmbito = (a, b) => a.categoria === b.categoria;
  assert.equal(riordina(GUSTI, 'fior-di-latte', -1, { stessoAmbito }), null, 'Fior di Latte non sale sopra le basi');
  const righe = muovi(GUSTI, 'kinder', -1, { stessoAmbito });
  const golosoni = ids(ordinaComeIlSito(righe).filter((r) => r.categoria === 'golosone'));
  assert.deepEqual(golosoni.slice(0, 5), ['cheesecake', 'spagnola', 'pino-pinguino', 'kinder', 'nutella']);
  // Il gusto del mese (golosone, ma in fondo alla tabella) sale fra i golosoni
  const mese = muovi(GUSTI, 'gusto-del-mese', -1, { stessoAmbito });
  const golosoni2 = ids(ordinaComeIlSito(mese).filter((r) => r.categoria === 'golosone'));
  assert.deepEqual(golosoni2.slice(-2), ['gusto-del-mese', 'giovanna']);
  // le altre categorie non cambiano ordine fra loro
  for (const cat of ['base', 'crema', 'frutta-vegan', 'leccornie']) {
    assert.deepEqual(ids(ordinaComeIlSito(mese).filter((r) => r.categoria === cat)),
      ids(ordinaComeIlSito(GUSTI).filter((r) => r.categoria === cat)), cat);
  }
});

test('gusti delle torte: ordine proprio, separato dalla carta', () => {
  const torte = GUSTI.filter((r) => r.per_torte);
  // Prima della migrazione (nessun ordine_torte): ordine della carta
  assert.deepEqual(ids(ordinaGustiTorte(torte)), ids(ordinaComeIlSito(torte)));
  // Dopo la migrazione: 10, 20, 30… come oggi
  const inizio = pulizia(torte, 'ordine_torte');
  assert.deepEqual(ids(ordinaGustiTorte(inizio)), ids(ordinaComeIlSito(torte)));
  // Nutella in cima alle torte: la carta non si tocca
  let righe = inizio;
  for (let i = 0; i < 20; i++) {
    const r = riordina(righe, 'nutella', -1, { chiave: 'ordine_torte' });
    if (!r) break;
    assert.ok(Object.keys(r.cambi).length <= 2, 'ogni tocco: 2 righe');
    righe = applica(righe, r.cambi, 'ordine_torte');
  }
  assert.equal(ordinaGustiTorte(righe)[0].id, 'nutella');
  assert.ok(righe.every((r) => r.ordine === GUSTI.find((x) => x.id === r.id).ordine), 'ordine della carta intatto');
  // Un gusto appena spuntato "per torte" (ordine_torte vuoto) parte in fondo
  const nuovo = { id: 'zabaione', categoria: 'crema', ordine: 18, per_torte: true, attivo: true, ordine_torte: null };
  const conNuovo = [...righe, nuovo];
  assert.equal(ordinaGustiTorte(conNuovo).at(-1).id, 'zabaione');
  const sale = riordina(conNuovo, 'zabaione', -1, { chiave: 'ordine_torte' });
  assert.ok(sale.cambi.zabaione > 0, 'alla prima mossa prende un numero');
});

test('salvataggio: righe da scrivere e lista cambiata altrove', () => {
  const pulite = pulizia(DECORAZIONI);
  const base = numeriDi(pulite);
  assert.equal(listaCambiata(pulite, base), false);
  const mosse = muovi(pulite, 'smarties', -1);
  assert.deepEqual(daScrivere(mosse, base).map((x) => x.id).sort(), ['smarties', 'zuccherini']);
  // Un altro dispositivo ha spostato qualcosa, aggiunto o tolto una voce
  assert.equal(listaCambiata(pulite.map((r) => (r.id === 'drip' ? { ...r, ordine: 999 } : r)), base), true);
  assert.equal(listaCambiata([...pulite, { id: 'nuova', ordine: 999 }], base), true);
  assert.equal(listaCambiata(pulite.slice(1), base), true);
  assert.equal(listaCambiata(pulite.map((r) => ({ ...r, ordine: String(r.ordine) })), base), false, 'stessi numeri anche come testo');
});
