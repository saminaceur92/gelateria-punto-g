// node --test src/lib/analytics.test.mjs
//
// tracciaConsigliata(), cioè le scelte delle torte già composte, provate sul
// VERO analytics.js. In Node import.meta.env non esiste: il file si legge come
// testo, si sostituisce import.meta.env con un oggetto globale (nient'altro) e
// lo si carica da capo a ogni "visita", come un caricamento di pagina. La rete
// è finta: si guarda quali richieste partono e cosa risponde il database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SORGENTE = readFileSync(new URL('./analytics.js', import.meta.url), 'utf8')
  .replaceAll('import.meta.env', 'globalThis.__ENV__');

const PORTA = '/rest/v1/rpc/registra_torta_consigliata';
const REGISTRA = '/rest/v1/rpc/registra_evento';

// Un orologio finto: la finestra anti-doppio-tap (800 ms) non deve coprire i
// controlli "una volta per visita", che valgono anche minuti dopo.
let adesso = 1_000_000;
Date.now = () => adesso;
const passa = (ms) => { adesso += ms; };

let n = 0;
/**
 * Una visita al sito. `porta`: cosa risponde la funzione delle torte già
 * composte — 204 (migrazione eseguita), 404 (non ancora), un altro codice
 * HTTP, oppure 'giu' (rete giù: nessuna risposta).
 */
async function visita({ porta = 204, pathname = '/' } = {}) {
  const richieste = [];
  globalThis.__ENV__ = {
    VITE_SUPABASE_URL: 'https://prova.supabase.co',
    VITE_SUPABASE_KEY: 'chiave-finta',
    PROD: false,
    VITE_STATISTICHE_DEV: '1',
  };
  globalThis.window = globalThis;
  globalThis.innerWidth = 390;
  globalThis.matchMedia = () => ({ matches: true });
  globalThis.document = { visibilityState: 'visible', referrer: '', addEventListener: () => {} };
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: 'Mozilla/5.0 (iPhone) Safari/604.1', webdriver: false },
    configurable: true,
    writable: true,
  });
  globalThis.location = { pathname, hostname: 'localhost', search: '' };
  globalThis.fetch = (url, init) => {
    const dove = new URL(url).pathname;
    richieste.push({ dove, evento: JSON.parse(init.body).p_evento });
    if (dove === PORTA && porta === 'giu') return Promise.reject(new TypeError('Failed to fetch'));
    const status = dove === PORTA ? porta : 204;
    return Promise.resolve({ ok: status >= 200 && status < 300, status });
  };
  const mod = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(`${SORGENTE}\n// visita ${++n}`)}`);
  return { mod, richieste };
}

// Lascia arrivare le risposte finte (e quindi l'eventuale ripiego).
const risposte = () => new Promise((r) => setImmediate(r));

test('database aggiornato: una richiesta, alla porta, con la voce della torta', async () => {
  const { mod, richieste } = await visita({ porta: 204 });
  mod.tracciaConsigliata('golosa');
  await risposte();
  assert.deepEqual(richieste, [{ dove: PORTA, evento: 'torta_consigliata_gelato_golosa' }]);
});

test('database non ancora aggiornato (404): la scelta si conta col vecchio evento, una volta', async () => {
  const { mod, richieste } = await visita({ porta: 404 });
  mod.tracciaConsigliata('golosa');
  await risposte();
  assert.deepEqual(richieste, [
    { dove: PORTA, evento: 'torta_consigliata_gelato_golosa' },
    { dove: REGISTRA, evento: 'torta_consigliata' },
  ]);
  // Subito dopo un'altra torta: il ripiego non è un doppio tocco, parte anche lui.
  mod.tracciaConsigliata('nutellona');
  await risposte();
  assert.equal(richieste.filter((r) => r.evento === 'torta_consigliata').length, 2);
});

test('rete giù: niente ripiego (la scelta potrebbe essere arrivata) e nessun errore', async () => {
  const { mod, richieste } = await visita({ porta: 'giu' });
  mod.tracciaConsigliata('golosa');
  await risposte();
  assert.deepEqual(richieste, [{ dove: PORTA, evento: 'torta_consigliata_gelato_golosa' }]);
});

test('il database rifiuta la porta (401, permesso tolto per sbaglio): ripiego, come per il 404', async () => {
  const { mod, richieste } = await visita({ porta: 401 });
  mod.tracciaConsigliata('golosa');
  await risposte();
  assert.deepEqual(richieste.map((r) => r.evento), ['torta_consigliata_gelato_golosa', 'torta_consigliata']);
});

test('guasto del server (5xx): niente ripiego, potrebbe averla contata', async () => {
  for (const porta of [500, 503, 504]) {
    const { mod, richieste } = await visita({ porta });
    mod.tracciaConsigliata('golosa');
    await risposte();
    assert.deepEqual(richieste, [{ dove: PORTA, evento: 'torta_consigliata_gelato_golosa' }], `con ${porta}`);
  }
});

test('una volta per visita e per torta', async () => {
  const { mod, richieste } = await visita({ porta: 404 });
  mod.tracciaConsigliata('golosa');
  mod.tracciaConsigliata('golosa'); // doppio tocco
  await risposte();
  passa(60_000);
  mod.tracciaConsigliata('golosa'); // un minuto dopo, tornato indietro: la stessa torta
  await risposte();
  assert.equal(richieste.length, 2, JSON.stringify(richieste)); // porta + ripiego, una volta sola

  const altra = await visita({ porta: 204 }); // un'altra visita conta di nuovo
  altra.mod.tracciaConsigliata('golosa');
  await risposte();
  assert.equal(altra.richieste.length, 1);
});

test('il ripiego parte anche se intanto la scheda è passata in secondo piano', async () => {
  const { mod, richieste } = await visita({ porta: 404 });
  mod.tracciaConsigliata('rocher');
  document.visibilityState = 'hidden'; // il cliente cambia app prima della risposta
  await risposte();
  assert.deepEqual(richieste.map((r) => r.evento), ['torta_consigliata_semifreddo_rocher', 'torta_consigliata']);
});

test('una consigliata senza voce: il vecchio evento, una volta per visita', async () => {
  const { mod, richieste } = await visita({ porta: 404 });
  mod.tracciaConsigliata('una-torta-nuova');
  passa(60_000);
  mod.tracciaConsigliata('un-altra-nuova');
  await risposte();
  assert.deepEqual(richieste, [{ dove: REGISTRA, evento: 'torta_consigliata' }]);
});

test('nella dashboard non parte niente', async () => {
  const { mod, richieste } = await visita({ porta: 204, pathname: '/admin' });
  mod.tracciaConsigliata('golosa');
  await risposte();
  assert.deepEqual(richieste, []);
});

test('ogni voce per torta ha la forma che la scheda sa dividere', async () => {
  const { mod } = await visita();
  const valori = new Set(Object.values(mod.EV));
  for (const [id, chiave] of Object.entries(mod.EV_CONSIGLIATA)) {
    assert.match(chiave, new RegExp(`^torta_consigliata_(gelato|semifreddo)_${id}$`));
    assert.ok(valori.has(chiave), `${chiave} non è in EV`);
  }
});
