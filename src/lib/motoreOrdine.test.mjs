// node --test src/lib/motoreOrdine.test.mjs
// Il motore della lista delle frecce, con un database e un orologio finti.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creaMotoreOrdine } from './motoreOrdine.js';
import { ordinaComeIlSito } from './riordina.js';

// Coperture vere (09-10), già coi numeri puliti della migrazione.
const COPERTURE = [
  ['panna', 10], ['panna-veg', 10], ['panna-spatolata', 20], ['panna-spatolata-veg', 20], ['meringa', 30],
  ['panna-sopra', 40], ['panna-sopra-veg', 40], ['ganache-cop', 50], ['panna-sotto-sopra', 60],
  ['panna-sotto-sopra-veg', 60], ['cioccolato-cop', 70], ['glassa-specchio', 80], ['pistacchio-cop', 90],
  ['frutta-cop', 100], ['naked', 110], ['cioccolato-bianco-cop', 120], ['nocciola-cop', 130],
].map(([id, ordine]) => ({ id, nome: id, ordine, attivo: true }));

function dbFinto(righe, chiave = 'ordine') {
  const tab = new Map(righe.map((r) => [String(r.id), { ...r }]));
  const log = { letture: 0, scritture: [] };
  let freno = null; // se impostato, ogni scrittura aspetta che lo si sblocchi
  return {
    tab,
    log,
    frena() { let sblocca; freno = new Promise((r) => { sblocca = r; }); return () => { freno = null; sblocca(); }; },
    leggi: async () => {
      log.letture += 1;
      return { data: [...tab.values()].map((r) => ({ ...r })), error: null };
    },
    scrivi: async (id, n) => {
      if (freno) await freno;
      log.scritture.push([String(id), n]);
      const r = tab.get(String(id));
      if (!r || r.bloccata) return { data: [], error: null }; // come un blocco dei permessi
      r[chiave] = n;
      return { data: [{ id }], error: null };
    },
    ordineSito: () => ordinaComeIlSito([...tab.values()], chiave).map((r) => r.id),
  };
}
function orologioFinto() {
  let fn = null;
  return {
    imposta: (f) => { fn = f; return 1; },
    annulla: () => { fn = null; },
    scatta: () => { const f = fn; fn = null; f?.(); },
    inAttesa: () => fn !== null,
  };
}
const finito = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r)); };
const crea = (db, extra = {}) => {
  const ultimo = {};
  const salvati = [];
  const orologio = orologioFinto();
  const m = creaMotoreOrdine({
    leggi: db.leggi,
    scrivi: db.scrivi,
    avvisa: (p) => Object.assign(ultimo, p),
    salvato: (nomi) => salvati.push(nomi),
    orologio,
    ...extra,
  });
  return { m, ultimo, salvati, orologio };
};
const ids = (righe) => righe.map((r) => r.id);

test('carica: righe nell\'ordine del sito, colonna mancante riconosciuta', async () => {
  const db = dbFinto(COPERTURE);
  const { m, ultimo } = crea(db);
  assert.equal(await m.carica(), true);
  assert.deepEqual(ids(m.righe), db.ordineSito());
  assert.equal(ultimo.caricato, true);
  assert.equal(ultimo.senzaColonna, false);
  // ordine_torte prima della migrazione: la chiave non c'è
  const t = crea(dbFinto([{ id: 'a', ordine: 1, per_torte: true }]), { chiave: 'ordine_torte', universo: (r) => r.per_torte });
  await t.m.carica();
  assert.equal(t.ultimo.senzaColonna, true);
});

test('tre tocchi di fila: un salvataggio solo, e solo le righe cambiate', async () => {
  const db = dbFinto(COPERTURE);
  const { m, orologio, salvati, ultimo } = crea(db);
  await m.carica();
  db.log.letture = 0;
  m.sposta('naked', -1, { nome: 'Naked' });
  m.sposta('naked', -1, { nome: 'Naked' });
  m.sposta('naked', -1, { nome: 'Naked' });
  assert.equal(db.log.scritture.length, 0, 'niente prima del mezzo secondo');
  assert.ok(orologio.inAttesa());
  orologio.scatta();
  await finito();
  assert.equal(db.log.letture, 1, 'una rilettura di controllo');
  assert.equal(db.log.scritture.length, 4, 'naked + le tre che ha scavalcato');
  assert.deepEqual(db.ordineSito(), ids(m.righe), 'database e pagina uguali');
  // naked ha scavalcato frutta, pistacchio e glassa: ora viene dopo il cioccolato
  assert.deepEqual(db.ordineSito().slice(10, 13), ['cioccolato-cop', 'naked', 'glassa-specchio']);
  assert.deepEqual(salvati, [['Naked']]);
  assert.equal(ultimo.stato, 'salvato');
});

test('su e poi giù: niente da scrivere, nemmeno una lettura', async () => {
  const db = dbFinto(COPERTURE);
  const { m, orologio } = crea(db);
  await m.carica();
  db.log.letture = 0;
  m.sposta('frutta-cop', -1);
  m.sposta('frutta-cop', +1);
  orologio.scatta();
  await finito();
  assert.equal(db.log.letture, 0);
  assert.equal(db.log.scritture.length, 0);
});

test('la coppia della panna si salva con lo stesso numero', async () => {
  const db = dbFinto(COPERTURE);
  const { m } = crea(db);
  await m.carica();
  m.sposta('panna-sopra-veg', -1);
  assert.equal(await m.salvaSubito(), true, 'salvaSubito non aspetta il mezzo secondo');
  assert.equal(db.tab.get('panna-sopra').ordine, db.tab.get('panna-sopra-veg').ordine);
  assert.equal(db.tab.get('panna-sopra').ordine, 30);
  assert.equal(db.tab.get('meringa').ordine, 40);
});

test('lista cambiata da un altro dispositivo: si ricarica e non si scrive niente', async () => {
  const db = dbFinto(COPERTURE);
  const { m, orologio, ultimo } = crea(db);
  await m.carica();
  db.tab.get('nocciola-cop').ordine = 5; // l'altro dispositivo
  m.sposta('naked', -1);
  orologio.scatta();
  await finito();
  assert.equal(db.log.scritture.length, 0);
  assert.match(ultimo.avviso, /cambiata da un altro dispositivo/);
  assert.deepEqual(ids(m.righe), db.ordineSito(), 'la pagina mostra la lista vera');
  assert.equal(m.righe[0].id, 'nocciola-cop');
});

test('scrittura rifiutata: ci si ferma alla prima, si ricarica e lo si dice', async () => {
  const db = dbFinto(COPERTURE);
  const { m, ultimo, salvati } = crea(db);
  await m.carica();
  db.tab.get('frutta-cop').bloccata = true;
  m.sposta('naked', -1); // naked 110 → 100, frutta-cop 100 → 110
  const ok = await m.salvaSubito();
  assert.equal(ok, false);
  assert.match(ultimo.errore, /non ha accettato/);
  assert.equal(db.log.scritture.length <= 2, true);
  assert.deepEqual(ids(m.righe), db.ordineSito(), 'dopo l\'errore la pagina mostra il database');
  assert.deepEqual(salvati, [], 'niente nello storico');
});

test('tocchi durante un salvataggio in corso: un secondo giro salva il resto', async () => {
  const db = dbFinto(COPERTURE);
  const { m, orologio } = crea(db);
  await m.carica();
  const sblocca = db.frena();
  m.sposta('naked', -1);
  orologio.scatta(); // parte il primo salvataggio, fermo sulla prima scrittura
  await finito();
  m.sposta('nocciola-cop', -1); // tocco mentre si salva
  m.sposta('nocciola-cop', -1);
  orologio.scatta(); // il salvataggio è in corso: si mette in coda
  sblocca();
  await finito();
  assert.deepEqual(db.ordineSito(), ids(m.righe), 'alla fine database e pagina coincidono');
  assert.deepEqual(db.ordineSito().slice(-4), ['naked', 'nocciola-cop', 'frutta-cop', 'cioccolato-bianco-cop']);
});

test('ordine dei gusti nelle torte: si tocca solo la sua colonna', async () => {
  const gusti = [
    { id: 'fior-di-latte', ordine: 10, ordine_torte: 10, per_torte: true },
    { id: 'crema', ordine: 20, ordine_torte: 20, per_torte: true },
    { id: 'nutella', ordine: 30, ordine_torte: 30, per_torte: true },
    { id: 'acqua', ordine: 40, ordine_torte: null, per_torte: false },
  ];
  const db = dbFinto(gusti, 'ordine_torte');
  const { m } = crea(db, { chiave: 'ordine_torte', universo: (r) => r.per_torte });
  await m.carica();
  assert.equal(m.righe.length, 3, 'solo i gusti per torte');
  m.sposta('nutella', -1);
  m.sposta('nutella', -1);
  assert.equal(await m.salvaSubito(), true);
  assert.deepEqual(ordinaComeIlSito([...db.tab.values()].filter((r) => r.per_torte), 'ordine_torte').map((r) => r.id),
    ['nutella', 'fior-di-latte', 'crema']);
  assert.deepEqual([...db.tab.values()].map((r) => r.ordine), [10, 20, 30, 40], 'la carta non si tocca');
});

test('errore di lettura: messaggio, niente scritture', async () => {
  let rotta = false;
  const db = dbFinto(COPERTURE);
  const leggi = async () => (rotta ? { data: null, error: { message: 'rete assente' } } : db.leggi());
  const { m, ultimo } = crea({ ...db, leggi });
  assert.equal(await m.carica(), true);
  m.sposta('naked', -1);
  rotta = true;
  assert.equal(await m.salvaSubito(), false);
  assert.match(ultimo.errore, /Ordine non salvato: rete assente/);
  assert.equal(db.log.scritture.length, 0);
  assert.equal(await m.carica(), false);
});
