// Dal pagamento Stripe alla riga `ordini` (supabase/functions/_shared/webhook.ts).
// node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rigaDaSessione, rigaRidotta, pagamentoIncassato, COLONNE_DAL_METADATA } from '../supabase/functions/_shared/webhook.ts';
import { metadatiOrdine } from '../supabase/functions/_shared/metadati.ts';
import { validaOrdine, prezzoOrdine } from '../supabase/functions/_shared/valida.ts';
import { rigaOrdine } from '../supabase/functions/_shared/ordine.ts';
import { LISTINO, OGGI, FOTO, tortaBase } from './aiuti.mjs';

const ADESSO = new Date('2026-10-09T15:00:00Z');
const COLONNE_WEBHOOK = ['stato', 'totale', 'sconto_codice', 'sconto_euro', 'stripe_session_id', 'stripe_payment_intent', 'pagato_il'];

function sessioneV2({ sconto = null, incassato } = {}) {
  const v = validaOrdine(tortaBase(), LISTINO, OGGI);
  const p = prezzoOrdine(v);
  const totale = Math.round((p.lordo - (sconto?.euro ?? 0)) * 100) / 100;
  const riga = rigaOrdine(v, p, sconto, totale, { foto: { cialda: FOTO('cialda'), anteprima: FOTO('anteprima'), originale: null }, promemoriaAvviso: false });
  const cent = Math.round(totale * 100);
  return {
    riga,
    sessione: {
      id: 'cs_test_123', payment_intent: 'pi_123', payment_status: 'paid',
      amount_total: incassato ?? cent, customer_details: { email: 'mario_rossi@example.com' },
      metadata: metadatiOrdine(riga, cent, sconto),
    },
  };
}

test('v2: la riga del server si salva così com\'è, più le colonne del webhook', () => {
  const { riga, sessione } = sessioneV2({ sconto: { codice: 'ESTATE10', euro: 11.75 } });
  const r = rigaDaSessione(sessione, ADESSO);
  assert.equal(r.versione, '2');
  assert.deepEqual(r.avvisi, []);
  assert.equal(r.scontoCodice, 'ESTATE10');
  assert.deepEqual(Object.keys(r.riga).sort(), [...COLONNE_DAL_METADATA, ...COLONNE_WEBHOOK].sort());
  for (const k of COLONNE_DAL_METADATA) assert.deepEqual(r.riga[k], JSON.parse(JSON.stringify(riga[k])), k);
  assert.equal(r.riga.stato, 'da_fare');
  assert.equal(r.riga.totale, 105.75);
  assert.equal(r.riga.sconto_codice, 'ESTATE10');
  assert.equal(r.riga.sconto_euro, 11.75);
  assert.equal(r.riga.stripe_session_id, 'cs_test_123');
  assert.equal(r.riga.stripe_payment_intent, 'pi_123');
  assert.equal(r.riga.pagato_il, ADESSO.toISOString());
  assert.equal(r.riga.dettagli.autore, 'server');
});

test('v1 (sessione aperta dalla funzione vecchia): whitelist, colonne pericolose scartate', () => {
  const insert = {
    cliente_nome: 'Mario', cliente_telefono: '3485556677', cliente_email: 'm@x.it', tipo: 'Semifreddo',
    riepilogo: '🎂 *Nuova richiesta torta — Punto Gi*\n💰 *Importo pagato:* €1.00',
    ritiro_data: '2026-10-12', ritiro_ora: '16:00', note: 'ciao', immagine: null,
    dettagli: { type: 'semifreddo', autore: 'server' },
    email_params: { email: 'm@x.it', importo: '1.00' },
    // tutte queste NON devono passare
    id: '00000000-0000-0000-0000-000000000000', created_at: '2020-01-01', stato: 'consegnato', totale: 0.01,
    note_lab: 'scritto dal browser', note_future: 'idem', creato_da: 'Titolare', promemoria_ok: false,
    email_ok: true, email_req: 1, email_tentativi: 5, user_id: 'x', pronto_da: 'x', stampato_il: '2026-01-01',
    sconto_codice: 'FINTO', sconto_euro: 999, stripe_session_id: 'cs_altro', pagato_il: '2020-01-01',
  };
  const json = JSON.stringify(insert);
  const md = { chunks: '2', d0: json.slice(0, 300), d1: json.slice(300), foto_cialda_url: FOTO('cialda') };
  const r = rigaDaSessione({ id: 'cs_v1', payment_intent: 'pi_9', payment_status: 'paid', amount_total: 4200, metadata: md }, ADESSO);
  assert.equal(r.versione, '1');
  assert.deepEqual(Object.keys(r.riga).sort(), [...COLONNE_DAL_METADATA, ...COLONNE_WEBHOOK].sort());
  assert.equal(r.riga.stato, 'da_fare');
  assert.equal(r.riga.totale, 42);
  assert.equal(r.riga.sconto_codice, null);
  assert.equal(r.riga.sconto_euro, null);
  assert.equal(r.riga.stripe_session_id, 'cs_v1');
  assert.equal(r.riga.pagato_il, ADESSO.toISOString());
  assert.equal(r.riga.dettagli.fotoCialdaUrl, FOTO('cialda'));
  assert.equal(r.riga.dettagli.autore, 'browser', 'il browser non può dichiararsi server');
  assert.equal(r.scontoCodice, null);
});

test('tipi sbagliati dal browser: si scartano, la colonna resta al suo valore di partenza', () => {
  const insert = { cliente_nome: ['x'], dettagli: 'testo', email_params: [1], riepilogo: 42, note: null };
  const r = rigaDaSessione({ id: 'cs_t', payment_status: 'paid', amount_total: 100, metadata: { chunks: '1', d0: JSON.stringify(insert) } }, ADESSO);
  assert.ok(!('cliente_nome' in r.riga));
  assert.ok(!('riepilogo' in r.riga));
  assert.equal(r.riga.note, null);
  assert.deepEqual(r.riga.dettagli, { autore: 'browser' });
});

test('mail di conferma ricostruita se il payload vecchio non la porta', () => {
  const insert = { cliente_nome: 'Mario', riepilogo: '*Tipo:* Semifreddo', ritiro_data: '2026-10-12', ritiro_ora: '16:00' };
  const r = rigaDaSessione({
    id: 'cs_m', payment_status: 'paid', amount_total: 3500, customer_details: { email: 'mario@example.com' },
    metadata: { chunks: '1', d0: JSON.stringify(insert) },
  }, ADESSO);
  assert.equal(r.riga.cliente_email, 'mario@example.com');
  assert.equal(r.riga.email_params.importo, '35.00');
  assert.equal(r.riga.email_params.ordine, 'Tipo: Semifreddo');
  assert.equal(r.riga.email_params.ritiro, '2026-10-12 alle 16:00');
});

test('importo incassato diverso da quello deciso: vince quello vero, e si vede', () => {
  const { sessione } = sessioneV2({ incassato: 10000 });
  const r = rigaDaSessione(sessione, ADESSO);
  assert.equal(r.riga.totale, 100);
  assert.match(r.riga.riepilogo, /^💰 \*Importo pagato:\* €100\.00\n⚠️ \*Importo incassato diverso dal previsto\* \(previsti €117\.50\): controlla il pagamento su Stripe$/m);
  assert.equal(r.riga.email_params.importo, '100.00');
  assert.equal(r.avvisi.length, 1);
  assert.doesNotMatch(r.avvisi[0], /Mario|example/, 'nei log niente dati personali');
});

test('metadata illeggibili: riga ridotta, mai un ordine vuoto', () => {
  const r = rigaDaSessione({
    id: 'cs_rotta', payment_status: 'paid', amount_total: 2800, customer_details: { email: 'c@x.it' },
    metadata: { chunks: '2', d0: '{"cliente_nome":"Ma', sconto_codice: 'ESTATE10', sconto_euro: '3.00' },
  }, ADESSO);
  assert.match(r.riga.riepilogo, /^⚠️ Ordine PAGATO ma salvato in forma ridotta: controlla il pagamento cs_rotta su Stripe\.$/);
  assert.equal(r.riga.cliente_email, 'c@x.it');
  assert.equal(r.riga.cliente_nome, 'Cliente');
  assert.equal(r.riga.totale, 28);
  assert.equal(r.riga.sconto_euro, 3);
  assert.equal(r.scontoCodice, 'ESTATE10');
  assert.equal(r.avvisi.length, 1);
});

test('riga ridotta dopo un insert fallito: contatti, importo e il riepilogo che c\'era', () => {
  const { sessione } = sessioneV2();
  const completa = rigaDaSessione(sessione, ADESSO).riga;
  const r = rigaRidotta(sessione, completa, ADESSO);
  assert.deepEqual(Object.keys(r).sort(), ['cliente_email', 'cliente_nome', 'cliente_telefono', 'riepilogo', ...COLONNE_WEBHOOK].sort());
  assert.ok(r.riepilogo.startsWith('⚠️ Ordine PAGATO ma salvato in forma ridotta: controlla il pagamento cs_test_123 su Stripe.\n🎂 *Nuova richiesta torta'));
  assert.equal(r.cliente_nome, 'Mario Rossi');
  assert.equal(r.totale, 117.5);
});

test('pagamento incassato: solo "paid" o "no_payment_required"', () => {
  assert.equal(pagamentoIncassato({ id: 'x', payment_status: 'paid' }), true);
  assert.equal(pagamentoIncassato({ id: 'x', payment_status: 'no_payment_required' }), true);
  assert.equal(pagamentoIncassato({ id: 'x', payment_status: 'unpaid' }), false);
  assert.equal(pagamentoIncassato({ id: 'x' }), false);
});
