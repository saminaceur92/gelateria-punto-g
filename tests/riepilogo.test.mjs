// Riepilogo e riga ordine scritti DAL SERVER (supabase/functions/_shared/
// riepilogo.ts e ordine.ts): testo esatto ("golden"), parità col testo che il
// configuratore scrive per gli ordini al banco, testi del cliente, foto.
// node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validaOrdine, prezzoOrdine } from '../supabase/functions/_shared/valida.ts';
import { rigaOrdine, dimensioneTesto, fotoDalBrowser, avvisoPromemoriaDalBrowser } from '../supabase/functions/_shared/ordine.ts';
import * as misure from '../src/lib/misureTorta.js';
import { LISTINO, OGGI, SUPABASE, FOTO, listinoDelSito, tortaBase, totaleDelSito, chosenDecorations, chosenExtras } from './aiuti.mjs';

const S = listinoDelSito();
const fotoOk = { cialda: FOTO('cialda'), anteprima: FOTO('anteprima'), originale: null };
const nessunaFoto = { cialda: null, anteprima: null, originale: null };

function riga(patch = {}, { sconto = null, foto = fotoOk, promemoriaAvviso = false } = {}) {
  const v = validaOrdine({ ...tortaBase(), ...patch }, LISTINO, OGGI);
  const p = prezzoOrdine(v);
  const totale = Math.round((p.lordo - (sconto?.euro ?? 0)) * 100) / 100;
  return rigaOrdine(v, p, sconto, totale, { foto, promemoriaAvviso });
}

// ── Copia FEDELE del testo che il configuratore scrive (CakeConfigurator.jsx,
// `msg` e `ordineEmail`, ramo cliente). Serve a dimostrare che il server
// scrive la stessa cosa: se cambi quelle righe nel sito, cambia anche qui.
const fmtQty = (n) => Number(n || 0).toLocaleString('it-IT', { maximumFractionDigits: 2 });
const extraLabel = (e) => `${e.name} ×${fmtQty(e.qty)}${e.unit ? ` (${e.unit})` : ''} — €${e.total.toFixed(2)}`;
const decorationsText = (decos, colori) =>
  (decos || []).length
    ? decos.map((d) => `${d.name}${(colori || {})[d.id] ? ` (colore ${colori[d.id]})` : ''}`).join(' · ')
    : 'Nessuna';
function testoDelSito(config, totale, scontoOrdine = 0) {
  const type = S.cakeTypes.find((t) => t.id === config.type);
  const shape = S.cakeShapes.find((sh) => sh.id === config.shape);
  const size = S.cakeSizes.find((s) => s.id === config.sizeId);
  const base = S.cakeBases.find((b) => b.id === config.baseId);
  const crumble = config.baseId === 'crock' ? S.cakeCrumbles.find((c) => c.id === config.crumbleId) : null;
  const filling = S.cakeFillings.find((f) => f.id === config.fillingId);
  const covering = S.cakeCoverings.find((c) => c.id === config.coveringId);
  const decos = chosenDecorations(config.decorations, S.cakeDecorations);
  const decoColori = config.decorationColors || {};
  const decoRiga = decorationsText(decos, decoColori);
  const decoLabel = decos.length > 1 ? 'Decorazioni' : 'Decorazione';
  const scritta = S.cakeScritte.find((f) => f.id === config.messageFont);
  const extras = chosenExtras(config.extras, S.cakeExtras);
  const allergNames = (config.allergies || []).map((id) => S.cakeAllergens.find((a) => a.id === id)?.name || id);
  const allergLine = allergNames.length ? allergNames.join(', ').toUpperCase() : '';
  const dietLine = (config.diets || []).map((id) => ({ vegan: 'Vegan', 'senza-zucchero': 'Senza zuccheri aggiunti' })[id] || id).join(', ').toUpperCase();
  const noteConsegna = [config.surprise && 'è una sorpresa', config.gift && 'è un regalo'].filter(Boolean).join(' · ');
  const doveSiMangia = config.inLocale === true ? 'in un locale (ristorante, pizzeria…)' : config.inLocale === false ? 'a casa' : '';
  const msg = [
    `🎂 *Nuova richiesta torta — Punto Gi*`,
    ``,
    allergLine ? `⚠️ *ALLERGENI:* ${allergLine}` : '',
    dietLine ? `🌱 *PREFERENZE:* ${dietLine}` : '',
    `*Tipo:* ${type?.name}`,
    `*Forma:* ${shape?.name}`,
    `*Dimensione:* ${misure.dimensioneTesto(size, config.shape)}`,
    `*Base:* ${base?.name}${base?.desc && base.id !== 'crock' ? ` (${base.desc})` : ''}`,
    crumble ? `*Tipo di crumble:* ${crumble.name}` : '',
    `*Strati / Gusti:* ${config.flavors.map((f) => f.name).join(', ')}`,
    filling && filling.id !== 'nessuna' ? `*Farcitura:* ${filling.name}` : '',
    covering ? `*Copertura:* ${covering.name}` : '',
    `*${decoLabel}:* ${decoRiga}`,
    extras.length ? `*Extra:* ${extras.map(extraLabel).join(' · ')}` : '',
    config.message ? `*Scritta:* "${config.message}"${scritta ? ` (${scritta.name})` : ''}` : '',
    config.photo ? `*Foto su cialda:* sì (verrà inviata a parte)` : '',
    config.candle ? `*Candelina:* sì` : '',
    config.occasion ? `*Occasione:* ${config.occasion}` : '',
    scontoOrdine > 0 ? `*Sconto:* ${config.scontoCodice} (−€${scontoOrdine.toFixed(2)})` : '',
    noteConsegna ? `*Attenzione:* ${noteConsegna}` : '',
    ``,
    config.delivery
      ? `*Consegna a domicilio:* ${config.pickupDate}${config.pickupTime ? ` alle ${config.pickupTime}` : ''}`
      : `*Da ritirare:* ${config.pickupDate}${config.pickupTime ? ` alle ${config.pickupTime}` : ''}`,
    config.delivery ? `*Indirizzo:* ${config.deliveryAddress}` : '',
    config.delivery ? `*Sovrapprezzo consegna:* €4` : '',
    doveSiMangia ? `*Dove si mangia:* ${doveSiMangia}` : '',
    `*Cliente:* ${config.name}`,
    `*Telefono:* ${config.phone}`,
    config.email ? `*Email:* ${config.email}` : '',
    config.notes ? `*Note:* ${config.notes}` : '',
    ``,
    `💰 *Importo pagato:* €${totale.toFixed(2)}`,
    ``,
    `_Richiesta inviata dal sito gelateriapuntogcarpi_`,
  ].filter(Boolean).join('\n');
  const quando = config.pickupDate ? `${config.pickupDate.split('-').reverse().join('/')}${config.pickupTime ? ` alle ${config.pickupTime}` : ''}` : '';
  const ordineEmail = [
    allergLine ? `ALLERGENI: ${allergLine}` : '',
    dietLine ? `PREFERENZE: ${dietLine}` : '',
    `Tipo: ${type?.name}`,
    `Forma: ${shape?.name}`,
    `Dimensione: ${misure.dimensioneTesto(size, config.shape)}`,
    `Base: ${base?.name}`,
    crumble ? `Tipo di crumble: ${crumble.name}` : '',
    `Gusti: ${config.flavors.map((f) => f.name).join(', ')}`,
    filling && filling.id !== 'nessuna' ? `Farcitura: ${filling.name}` : '',
    covering ? `Copertura: ${covering.name}` : '',
    `${decoLabel}: ${decoRiga}`,
    extras.length ? `Extra: ${extras.map(extraLabel).join(', ')}` : '',
    config.message ? `Scritta: "${config.message}"${scritta ? ` (${scritta.name})` : ''}` : '',
    config.photo ? `Foto su cialda: sì` : '',
    config.candle ? `Candelina: sì` : '',
    config.occasion ? `Occasione: ${config.occasion}` : '',
    scontoOrdine > 0 ? `Sconto ${config.scontoCodice}: -€${scontoOrdine.toFixed(2)}` : '',
    noteConsegna ? `Attenzione: ${noteConsegna}` : '',
    config.delivery ? `Consegna a domicilio (+€4) — ${config.deliveryAddress}` : '',
    quando ? `${config.delivery ? 'Consegna' : 'Ritiro'}: ${quando}` : '',
    doveSiMangia ? `Dove si mangia: ${doveSiMangia}` : '',
    config.notes ? `Note: ${config.notes}` : '',
  ].filter(Boolean).join(' · ');
  const emailParams = {
    email: config.email,
    cliente: config.name,
    ordine: ordineEmail,
    ritiro: config.delivery ? `Consegna a domicilio${quando ? ` il ${quando}` : ''} — ${config.deliveryAddress}` : quando,
    modalita: (config.delivery ? '🛵 Consegna a domicilio' : '📅 Ritiro in gelateria') + (quando ? ` — ${quando}` : ''),
    saluto: config.delivery
      ? 'Ti consegneremo la torta all’indirizzo e all’orario indicato 🛵'
      : 'Ti aspettiamo in gelateria per il ritiro 🍰',
    importo: totale.toFixed(2),
  };
  return { msg, emailParams };
}
// Le sole differenze volute: testi del cliente fra «» (vedi riepilogo.ts).
const senzaMarche = (s) => s.replace(/«([^»]*)»/g, '$1');

test('testo esatto del riepilogo (golden)', () => {
  const r = riga();
  assert.equal(r.riepilogo, [
    '🎂 *Nuova richiesta torta — Punto Gi*',
    '⚠️ *ALLERGENI:* LATTE',
    '*Tipo:* Semifreddo',
    '*Forma:* Tonda',
    '*Dimensione:* 10 persone · Ø 24 cm',
    '*Base:* Classica Vaniglia (Pan di Spagna sottile con bagna vaniglia)',
    '*Strati / Gusti:* Crema, Nocciola',
    '*Farcitura:* Nutella',
    '*Copertura:* Panna montata a CIUFFI INTORNO',
    '*Decorazioni:* Fiocchi colorati (colore Rosso) · Macarons',
    '*Extra:* Salame dolce ×1,5 (al kg) — €52.50',
    '*Scritta:* "Auguri Anna" (Corsivo)',
    '*Foto su cialda:* sì (verrà inviata a parte)',
    '*Candelina:* sì',
    '*Occasione:* Compleanno',
    '*Attenzione:* è una sorpresa',
    '*Da ritirare:* 2026-10-12 alle 16:00',
    '*Dove si mangia:* a casa',
    '*Cliente:* Mario Rossi',
    '*Telefono:* 348 555 6677',
    '*Email:* mario_rossi@example.com',
    '*Note:* «Senza frutta secca sopra»',
    '💰 *Importo pagato:* €117.50',
    '_Richiesta inviata dal sito gelateriapuntogcarpi_',
  ].join('\n'));
  assert.equal(r.tipo, 'Semifreddo');
  assert.equal(r.email_params.importo, '117.50');
  assert.equal(r.email_params.ordine, [
    'ALLERGENI: LATTE', 'Tipo: Semifreddo', 'Forma: Tonda', 'Dimensione: 10 persone · Ø 24 cm', 'Base: Classica Vaniglia',
    'Gusti: Crema, Nocciola', 'Farcitura: Nutella', 'Copertura: Panna montata a CIUFFI INTORNO',
    'Decorazioni: Fiocchi colorati (colore Rosso) · Macarons', 'Extra: Salame dolce ×1,5 (al kg) — €52.50',
    'Scritta: "Auguri Anna" (Corsivo)', 'Foto su cialda: sì', 'Candelina: sì', 'Occasione: Compleanno',
    'Attenzione: è una sorpresa', 'Ritiro: 12/10/2026 alle 16:00', 'Dove si mangia: a casa', 'Note: «Senza frutta secca sopra»',
  ].join(' · '));
  assert.deepEqual(
    { ...r.email_params, ordine: undefined },
    {
      email: 'mario_rossi@example.com', cliente: 'Mario Rossi', ordine: undefined,
      ritiro: '12/10/2026 alle 16:00', modalita: '📅 Ritiro in gelateria — 12/10/2026 alle 16:00',
      saluto: 'Ti aspettiamo in gelateria per il ritiro 🍰', importo: '117.50',
    },
  );
});

test('stesso testo che il configuratore scrive per la stessa torta (a parte le «»)', () => {
  const casi = [
    {},
    { delivery: true, deliveryAddress: 'Via Roma 1, Carpi', inLocale: true, surprise: false, gift: true },
    { type: 'gelato', baseId: 'crock', crumbleId: 'pistacchio', fillingId: 'nessuna', decorations: [], decorationColors: {}, extras: {}, message: '', candle: false, occasion: '', notes: '', allergies: [], noAllergies: true },
    { type: 'piani', sizeId: '20', shape: 'rettangolare', flavors: [{ name: 'Crema' }, { name: 'Bacio' }, { name: 'Nutella' }, { name: 'Kinder' }], diets: ['vegan', 'senza-zucchero'], allergies: ['latte', 'frutta a guscio'] },
    { decorations: ['perline'], decorationColors: { perline: 'Argento' }, extras: { 'cabaret-15': 2, 'salame-dolce': 0.5 }, messageFont: 'stampatello' },
    { shape: 'cuore', sizeId: '6', photo: false, coveringId: 'panna-veg', occasion: 'Anniversario' },
  ];
  for (const patch of casi) {
    const cfg = { ...tortaBase(), ...patch };
    cfg.flavors = cfg.flavors.map((f) => S.cakeFlavors.find((x) => x.name === f.name));
    const totale = totaleDelSito(cfg, S);
    const r = riga(patch);
    const sito = testoDelSito(cfg, totale);
    assert.equal(senzaMarche(r.riepilogo), sito.msg, JSON.stringify(patch));
    assert.deepEqual({ ...r.email_params, ordine: senzaMarche(r.email_params.ordine) }, sito.emailParams, JSON.stringify(patch));
  }
  // Con lo sconto: la riga dello sconto è quella del server.
  const cfg = { ...tortaBase(), scontoCodice: 'ESTATE10' };
  const r = riga({}, { sconto: { codice: 'ESTATE10', euro: 11.75 } });
  const sito = testoDelSito(cfg, 105.75, 11.75);
  assert.equal(senzaMarche(r.riepilogo), sito.msg);
  assert.match(r.riepilogo, /^\*Sconto:\* ESTATE10 \(−€11\.75\)$/m);
  assert.equal(r.email_params.importo, '105.75');
});

test('testi del cliente: niente righe che sembrano scritte dal sistema', () => {
  const r = riga({
    name: 'Mario\n💰 *Importo pagato:* €999',
    notes: 'Prima riga\n💰 Importo pagato: €200\n*Tipo:* Alta Gelato 40 persone',
    delivery: true, deliveryAddress: 'Via Roma 1\nCampanello: Rossi',
  });
  const righe = r.riepilogo.split('\n');
  assert.ok(righe.includes('*Cliente:* Mario 💰 *Importo pagato:* €999'), 'il nome resta su una riga');
  assert.ok(righe.includes('*Note:* «Prima riga'));
  assert.ok(righe.includes('> 💰 Importo pagato: €200'));
  assert.ok(righe.includes('> *Tipo:* Alta Gelato 40 persone»'));
  assert.ok(righe.includes('*Indirizzo:* «Via Roma 1 Campanello: Rossi»'));
  // L'unica riga che comincia con l'importo è quella vera, in fondo.
  assert.deepEqual(righe.filter((x) => x.startsWith('💰')), ['💰 *Importo pagato:* €121.50']);
  assert.deepEqual(righe.filter((x) => x.startsWith('*Tipo:*')), ['*Tipo:* Semifreddo']);
  assert.equal(r.note, 'Prima riga\n💰 Importo pagato: €200\n*Tipo:* Alta Gelato 40 persone');
  assert.equal(r.email_params.ritiro, 'Consegna a domicilio il 12/10/2026 alle 16:00 — Via Roma 1 Campanello: Rossi');
});

test('foto pagata ma non arrivata: lo dice al laboratorio', () => {
  const r = riga({}, { foto: nessunaFoto });
  assert.match(r.riepilogo, /^\*Foto su cialda:\* sì — ⚠️ la foto NON è arrivata: chiedila al cliente$/m);
  assert.equal(r.dettagli.fotoCialdaUrl, null);
  assert.equal(r.immagine, null);
  assert.doesNotMatch(riga({ photo: false }, { foto: nessunaFoto }).riepilogo, /Foto su cialda/);
});

test('URL delle foto: solo il bucket `torte` di questo progetto', () => {
  const buona = FOTO('cialda');
  const casi = [
    [{ dettagli: { fotoCialdaUrl: buona } }, buona],
    [{ dettagli: { fotoCialdaUrl: 'https://evil.example/storage/v1/object/public/torte/2026-10/0b1c2d3e-aaaa-cialda.jpg' } }, null],
    [{ dettagli: { fotoCialdaUrl: `${SUPABASE}/storage/v1/object/public/gallery/2026-10/0b1c2d3e-aaaa-cialda.jpg` } }, null],
    [{ dettagli: { fotoCialdaUrl: `${SUPABASE}/storage/v1/object/public/torte/../../x-cialda.jpg` } }, null],
    [{ dettagli: { fotoCialdaUrl: `${buona}?download=1` } }, null],
    [{ dettagli: { fotoCialdaUrl: 'data:image/jpeg;base64,AAAA' } }, null],
    [{ dettagli: { fotoCialdaUrl: `${SUPABASE}/storage/v1/object/public/torte/2026-10/1696500000000-123456789-cialda.jpg` } },
      `${SUPABASE}/storage/v1/object/public/torte/2026-10/1696500000000-123456789-cialda.jpg`], // id di ripiego di cakePhoto.js
    [null, null],
  ];
  for (const [ins, atteso] of casi) assert.equal(fotoDalBrowser(ins, [SUPABASE, '']).cialda, atteso, JSON.stringify(ins));
  // Anteprima: tortaConfigurataUrl, oppure la colonna `immagine`.
  assert.equal(fotoDalBrowser({ immagine: FOTO('anteprima'), dettagli: {} }, [SUPABASE]).anteprima, FOTO('anteprima'));
  // Indirizzo pubblico diverso (dominio personalizzato): con PUBLIC_SUPABASE_URL.
  const altro = 'https://db.gelateriapuntogi.it';
  const u = `${altro}/storage/v1/object/public/torte/2026-10/0b1c2d3e-aaaa-cialda.jpg`;
  assert.equal(fotoDalBrowser({ dettagli: { fotoCialdaUrl: u } }, [SUPABASE]).cialda, null);
  assert.equal(fotoDalBrowser({ dettagli: { fotoCialdaUrl: u } }, [SUPABASE, `${altro}/`]).cialda, u);
});

test('dettagli: le chiavi di sempre (promemoria, "Rifai questa torta"), niente roba del browser', () => {
  const r = riga({}, { promemoriaAvviso: true });
  const d = r.dettagli;
  const PREFILL_KEYS = [
    'type', 'shape', 'sizeId', 'allergies', 'flavors', 'baseId', 'crumbleId',
    'fillingId', 'coveringId', 'decoration', 'decorationColor',
    'decorations', 'decorationColors', 'extras',
    'message', 'messageFont', 'candle', 'occasion', 'name',
  ];
  for (const k of PREFILL_KEYS) assert.ok(k in d, `manca ${k}`);
  for (const k of ['photo', 'sconto', 'scontoCodice']) assert.ok(!(k in d), `${k} non deve esserci`);
  assert.deepEqual(d.flavors, [{ name: 'Crema', color: LISTINO.allergeni_prodotti.find((x) => x.gusto === 'Crema').colore }, { name: 'Nocciola', color: LISTINO.allergeni_prodotti.find((x) => x.gusto === 'Nocciola').colore }]);
  assert.equal(d.occasion, 'Compleanno');
  assert.equal(d.decoration, 'fiocchi');
  assert.equal(d.decorationColor, 'Rosso');
  assert.deepEqual(d.decorazioniScelte, [{ id: 'fiocchi', nome: 'Fiocchi colorati', colore: 'Rosso' }, { id: 'macarons', nome: 'Macarons', colore: '' }]);
  assert.deepEqual(d.extraScelti, [{ id: 'salame-dolce', nome: 'Salame dolce', quantita: 1.5, unita: 'al kg', prezzo: 35, totale: 52.5 }]);
  assert.equal(d.pagamentoStaff, null);
  assert.equal(d.conFoto, true);
  assert.equal(d.fotoCialdaUrl, FOTO('cialda'));
  assert.equal(d.tortaConfigurataUrl, FOTO('anteprima'));
  assert.equal(d.autore, 'server');
  assert.equal(d.versione, 2);
  assert.equal(d.nomi.dimensione, '10 persone · Ø 24 cm');
  assert.equal(d.prezzi.totale, 117.5);
  assert.equal(d.promemoriaAvviso, true);
  assert.ok(!('promemoriaAvviso' in riga().dettagli));
  // Solo le colonne che il webhook accetta.
  assert.deepEqual(Object.keys(r).sort(), [
    'cliente_email', 'cliente_nome', 'cliente_telefono', 'dettagli', 'email_params', 'immagine', 'note', 'riepilogo', 'ritiro_data', 'ritiro_ora', 'tipo',
  ]);
});

test('"ho visto l\'avviso dei promemoria": vale solo un vero', () => {
  assert.equal(avvisoPromemoriaDalBrowser({ dettagli: { promemoriaAvviso: true } }, {}), true);
  assert.equal(avvisoPromemoriaDalBrowser({}, { promemoriaAvviso: true }), true);
  assert.equal(avvisoPromemoriaDalBrowser({ dettagli: { promemoriaAvviso: 'true' } }, {}), false);
  assert.equal(avvisoPromemoriaDalBrowser(null, null), false);
});

test('misure: il server scrive la stessa "Dimensione" del sito (tutte le taglie × forme)', () => {
  const forme = ['tonda', 'cuore', 'quadrata', 'rettangolare'];
  for (const s of LISTINO.dimensioni) {
    const delSito = { id: s.id, label: s.etichetta, diameter: Number(s.diametro) || 0, misure: s.misure || {} };
    for (const f of forme) assert.equal(dimensioneTesto(s, f), misure.dimensioneTesto(delSito, f), `${s.id} ${f}`);
  }
  // Misure per forma (oggi nel listino sono vuote): anche quelle uguali.
  for (const m of [{ cuore: [22] }, { quadrata: [20] }, { rettangolare: [24, 34] }, { rettangolare: [24] }, { quadrata: [20.5] }, { quadrata: [0] }]) {
    for (const f of forme) {
      assert.equal(
        dimensioneTesto({ etichetta: '10 persone', diametro: 24, misure: m }, f),
        misure.dimensioneTesto({ label: '10 persone', diameter: 24, misure: m }, f),
        `${JSON.stringify(m)} ${f}`,
      );
    }
  }
});
