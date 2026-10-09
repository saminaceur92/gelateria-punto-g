// La riga ordine nei metadata di Stripe (supabase/functions/_shared/metadati.ts).
// node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsonAscii, spezza, metadatiOrdine, ricomponi, TroppoTestoPerStripe, PEZZO, MAX_CHIAVI } from '../supabase/functions/_shared/metadati.ts';
import { validaOrdine, prezzoOrdine } from '../supabase/functions/_shared/valida.ts';
import { rigaOrdine } from '../supabase/functions/_shared/ordine.ts';
import { LISTINO, OGGI, FOTO, tortaBase } from './aiuti.mjs';

// Copia della funzione `encode` di qs@6.16.0, quella che stripe-node usa per
// mandare i metadata: un "mezzo carattere" UTF-16 rimasto da solo a fine
// pezzo si mangia il carattere dopo. È il guasto che il formato ASCII evita.
const hex = Array.from({ length: 256 }, (_, i) => '%' + ((i < 16 ? '0' : '') + i.toString(16)).toUpperCase());
function qsEncode(c) {
  const d = [];
  for (let o = 0; o < c.length; ++o) {
    let i = c.charCodeAt(o);
    if (i === 45 || i === 46 || i === 95 || i === 126 || (i >= 48 && i <= 57) || (i >= 65 && i <= 90) || (i >= 97 && i <= 122)) { d.push(c.charAt(o)); continue; }
    if (i < 128) { d.push(hex[i]); continue; }
    if (i < 2048) { d.push(hex[192 | (i >> 6)] + hex[128 | (i & 63)]); continue; }
    if (i < 55296 || i >= 57344) { d.push(hex[224 | (i >> 12)] + hex[128 | ((i >> 6) & 63)] + hex[128 | (i & 63)]); continue; }
    o += 1; i = 65536 + (((i & 1023) << 10) | (c.charCodeAt(o) & 1023));
    d.push(hex[240 | (i >> 18)] + hex[128 | ((i >> 12) & 63)] + hex[128 | ((i >> 6) & 63)] + hex[128 | (i & 63)]);
  }
  return d.join('');
}
// Quello che Stripe salva e poi rimanda al webhook.
const viaStripe = (md) => Object.fromEntries(Object.entries(md).map(([k, v]) => [k, decodeURIComponent(qsEncode(v))]));

const torta = String.fromCodePoint(0x1f370);

test('JSON solo ASCII: JSON.parse restituisce il valore identico', () => {
  const v = { a: `è à ù — «Note» ${torta} 🛵 Ø ×`, b: [' ', 'x\ny'], c: 1.5 };
  const s = jsonAscii(v);
  assert.ok(/^[\x20-\x7e]*$/.test(s), 'solo caratteri ASCII stampabili');
  assert.deepEqual(JSON.parse(s), v);
});

test('emoji a cavallo di un taglio: il formato vecchio si rompeva, quello nuovo no (tutte le 450 posizioni)', () => {
  let rotteVecchio = 0;
  for (let pad = 0; pad < PEZZO; pad++) {
    const riga = { riepilogo: 'x'.repeat(pad), email_params: { saluto: `Ti aspettiamo in gelateria per il ritiro ${torta}` }, cliente_nome: 'Mario' };
    // vecchio: JSON grezzo a pezzi fissi da 450
    const grezzo = JSON.stringify(riga);
    const md = { chunks: String(Math.ceil(grezzo.length / 450)) };
    for (let i = 0, k = 0; i < grezzo.length; i += 450, k++) md['d' + k] = grezzo.slice(i, i + 450);
    const vecchio = ricomponi(viaStripe(md));
    if (!vecchio || vecchio.cliente_nome !== 'Mario') rotteVecchio++;
    // nuovo
    const nuovo = ricomponi(viaStripe(metadatiOrdine(riga, 100, null)));
    assert.deepEqual(nuovo, riga, `posizione ${pad}`);
  }
  assert.ok(rotteVecchio > 0, 'il guasto del formato vecchio va riprodotto, altrimenti il test non prova niente');
});

test('i tagli non cadono mai accanto a uno spazio', () => {
  const testo = jsonAscii({ riepilogo: 'parola '.repeat(400) });
  const pezzi = spezza(testo);
  assert.equal(pezzi.join(''), testo);
  for (const p of pezzi.slice(0, -1)) {
    assert.ok(p.length <= PEZZO && p.length > PEZZO - 41);
    assert.ok(!p.startsWith(' ') && !p.endsWith(' '));
  }
});

test('metadata: chiavi fisse, sconto e foto per il webhook vecchio', () => {
  const riga = { riepilogo: 'x', dettagli: { fotoCialdaUrl: FOTO('cialda'), tortaConfigurataUrl: FOTO('anteprima') } };
  const md = metadatiOrdine(riga, 11750, { codice: 'ESTATE10', euro: 11.75 });
  assert.equal(md.v, '2');
  assert.equal(md.importo_cent, '11750');
  assert.equal(md.sconto_codice, 'ESTATE10');
  assert.equal(md.sconto_euro, '11.75');
  assert.equal(md.foto_cialda_url, FOTO('cialda'));
  assert.equal(md.torta_configurata_url, FOTO('anteprima'));
  assert.deepEqual(ricomponi(md), riga);
  assert.ok(!('sconto_codice' in metadatiOrdine(riga, 100, null)));
  for (const v of Object.values(md)) assert.ok(typeof v === 'string' && v.length <= 500);
});

test('il caso più pesante sta nei limiti di Stripe; il testo assurdo è rifiutato con un messaggio chiaro', () => {
  const pesante = {
    ...tortaBase(), type: 'piani', sizeId: '20',
    flavors: [{ name: 'Crema' }, { name: 'Bacio' }, { name: 'Nutella' }, { name: 'Kinder' }],
    notes: 'Mi raccomando: è per la nonna, scrivete «Auguri» in corsivo e niente glutine, già detto. '.repeat(12).slice(0, 1000),
    delivery: true, deliveryAddress: 'Via della Repubblica Italiana 123/b, scala C, interno 7, citofono Rossi-Bianchi, Carpi (MO) — '.repeat(4).slice(0, 300),
    decorations: ['fiocchi', 'macarons', 'smarties', 'drip', 'perline'], decorationColors: { fiocchi: 'Rosso', perline: 'Oro' },
    extras: { 'salame-dolce': 2, 'cabaret-10': 1, 'cabaret-15': 1, 'cabaret-20': 1 },
    allergies: ['latte', 'frutta a guscio', 'glutine', 'uova', 'soia'], diets: ['vegan'], gift: true,
  };
  const v = validaOrdine(pesante, LISTINO, OGGI);
  const p = prezzoOrdine(v);
  const riga = rigaOrdine(v, p, { codice: 'ESTATE10', euro: 10 }, p.lordo - 10, { foto: { cialda: FOTO('cialda'), anteprima: FOTO('anteprima'), originale: null }, promemoriaAvviso: true });
  const md = metadatiOrdine(riga, Math.round((p.lordo - 10) * 100), { codice: 'ESTATE10', euro: 10 });
  assert.ok(Object.keys(md).length <= MAX_CHIAVI, `${Object.keys(md).length} chiavi`);
  assert.deepEqual(ricomponi(viaStripe(md)), JSON.parse(JSON.stringify(riga)));
  // 1000 caratteri di sole emoji nelle note (4 volte nella riga): non ci sta.
  const emoji = validaOrdine({ ...pesante, notes: torta.repeat(500) }, LISTINO, OGGI);
  const pe = prezzoOrdine(emoji);
  const rigaEmoji = rigaOrdine(emoji, pe, null, pe.lordo, { foto: { cialda: null, anteprima: null, originale: null }, promemoriaAvviso: false });
  assert.throws(() => metadatiOrdine(rigaEmoji, 100, null), TroppoTestoPerStripe);
});

test('ricomponi: pezzi mancanti o JSON rotto → null, mai un ordine vuoto inventato', () => {
  assert.equal(ricomponi({}), null);
  assert.equal(ricomponi({ chunks: '2', d0: '{"a":1' }), null);
  assert.equal(ricomponi({ chunks: '1', d0: '{"a":' }), null);
  assert.equal(ricomponi({ chunks: '1', d0: '[1,2]' }), null);
  assert.equal(ricomponi({ chunks: '999', d0: '{}' }), null);
  assert.deepEqual(ricomponi({ chunks: '2', d0: '{"a":', d1: '1}' }), { a: 1 });
});
