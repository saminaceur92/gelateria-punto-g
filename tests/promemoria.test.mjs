// Il flag `promemoria` della torta deve arrivare in ordini.dettagli da TUTTE
// e due le strade, perché il database ci conta:
//  - ordine pagato dal sito: configuratore → create-checkout (valida.ts lo
//    tiene solo se è vero/falso) → metadata della sessione Stripe → webhook;
//  - ordine al banco: il configuratore salva la riga da sé (dettagli = la
//    torta, più promemoria_ok dall'interruttore «Promemoria tra un anno»).
// migrations/2026-10-09-promemoria-ricorrenze.sql (accoda_promemoria) crea i
// promemoria di ANNIVERSARIO solo con dettagli.promemoria = true: se un giorno
// la riscrittura dei dettagli lo perdesse, gli anniversari pagati online
// resterebbero senza promemoria e nessuno se ne accorgerebbe.
// node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validaOrdine, prezzoOrdine } from '../supabase/functions/_shared/valida.ts';
import { rigaOrdine } from '../supabase/functions/_shared/ordine.ts';
import { metadatiOrdine } from '../supabase/functions/_shared/metadati.ts';
import { rigaDaSessione } from '../supabase/functions/_shared/webhook.ts';
import { occasioneConPromemoria } from '../src/lib/promemoriaRegole.js';
import { LISTINO, OGGI, FOTO, tortaBase } from './aiuti.mjs';

// La parte di accoda_promemoria che guarda i dettagli dell'ordine (stessa
// regola: `dettagli ->> 'promemoria'` vale 'true', 'false' o niente).
function creaPromemoria(dettagli) {
  const occ = occasioneConPromemoria(dettagli?.occasion);
  const flag = dettagli && 'promemoria' in dettagli ? String(dettagli.promemoria) : '';
  if (!occ || flag === 'false') return false;
  return occ === 'Compleanno' || flag === 'true';
}

// La riga che il webhook salva per un ordine pagato dal sito con questa torta.
function pagatoDalSito(patch) {
  const v = validaOrdine({ ...tortaBase(), ...patch }, LISTINO, OGGI);
  const p = prezzoOrdine(v);
  const foto = { cialda: FOTO('cialda'), anteprima: FOTO('anteprima'), originale: null };
  const riga = rigaOrdine(v, p, null, p.lordo, { foto, promemoriaAvviso: false });
  const cent = Math.round(p.lordo * 100);
  const sessione = {
    id: 'cs_test_promemoria', payment_intent: 'pi_promemoria', payment_status: 'paid',
    amount_total: cent, metadata: metadatiOrdine(riga, cent, null),
  };
  return rigaDaSessione(sessione, new Date('2026-10-10T10:00:00Z')).riga;
}

test('pagato dal sito: dettagli.promemoria arriva fino alla riga salvata dal webhook', () => {
  for (const occasion of ['Anniversario', 'Compleanno']) {
    const r = pagatoDalSito({ occasion, promemoria: true });
    assert.equal(r.dettagli.promemoria, true, occasion);
    assert.equal(r.dettagli.occasion, occasion);
    // promemoria_ok non arriva mai dal browser: resta quello del database (vero).
    assert.ok(!('promemoria_ok' in r));
    assert.ok(creaPromemoria(r.dettagli), `${occasion}: il database mette in coda i promemoria`);
  }
});

test('pagato dal sito: flag spento o di tipo sbagliato', () => {
  const spento = pagatoDalSito({ occasion: 'Compleanno', promemoria: false });
  assert.equal(spento.dettagli.promemoria, false);
  assert.equal(creaPromemoria(spento.dettagli), false);
  // Solo vero/falso: il resto si scarta, e senza flag l'anniversario non parte.
  for (const strano of ['true', 1, { si: true }]) {
    const r = pagatoDalSito({ occasion: 'Anniversario', promemoria: strano });
    assert.ok(!('promemoria' in r.dettagli), JSON.stringify(strano));
    assert.equal(creaPromemoria(r.dettagli), false);
  }
});

test('sito vecchio (senza flag): il compleanno come prima, l\'anniversario no (avviso mai visto)', () => {
  const compleanno = pagatoDalSito({ occasion: 'Compleanno' });
  const anniversario = pagatoDalSito({ occasion: 'Anniversario' });
  assert.ok(!('promemoria' in compleanno.dettagli));
  assert.ok(creaPromemoria(compleanno.dettagli));
  assert.equal(creaPromemoria(anniversario.dettagli), false);
});

test('configuratore: il flag nasce acceso e viaggia con la torta (banco e sito)', () => {
  // Il configuratore non si può montare in Node (React, 3D…): si controlla il
  // testo, come fa scripts/verifica-eventi.mjs per gli eventi.
  const src = readFileSync(new URL('../src/components/CakeConfigurator.jsx', import.meta.url), 'utf8');
  const iniziale = src.match(/function makeInitialConfig\([\s\S]*?\r?\n}\r?\n/)?.[0] || '';
  assert.match(iniziale, /\n\s+promemoria: true,/, 'makeInitialConfig: promemoria acceso di partenza');
  // Banco: dettagli = la config (promemoria compreso), interruttore → promemoria_ok.
  assert.match(src, /const \{ photo, \.\.\.dettagli \} = cfg;/);
  assert.match(src, /dettagli: \{\s*\n\s*\.\.\.dettagli,/);
  // Il flag vuol dire «avviso mostrato»: vero solo per le occasioni col
  // promemoria, e al banco solo con l'interruttore su «Sì». Viaggia nei
  // dettagli (cfg) e, al banco, anche in promemoria_ok.
  assert.match(src, /const promemoria = Boolean\(avvisoPromemoria\(config\.occasion\)\) && \(!staff \|\| config\.promemoria !== false\);/);
  assert.match(src, /const cfg = \{ \.\.\.config, [^\n]*promemoria \};/);
  assert.match(src, /promemoria_ok: cfg\.promemoria,/);
  // Sito: tutta la config va a create-checkout, dove valida.ts tiene `promemoria`.
  assert.match(src, /config: \{ \.\.\.cfg,/);
});
