// Validazione e prezzo LATO SERVER (supabase/functions/_shared/valida.ts,
// listino.ts, price.ts) sul listino vero del 2026-10-09.
// node --test tests/*.test.mjs   (Node 24: i .ts si importano togliendo i tipi)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validaOrdine, prezzoOrdine, OrdineRifiutato, oggiARoma, rigaSingola, testoMultiriga } from '../supabase/functions/_shared/valida.ts';
import { formeAmmesse } from '../supabase/functions/_shared/forme.ts';
import { caricaListino, ListinoNonDisponibile } from '../supabase/functions/_shared/listino.ts';
import { computeOrder } from '../supabase/functions/_shared/price.ts';
import { torteConsigliate } from '../src/data/fallback/cakeOptions.js';
import { personeOf as personeSito } from '../src/lib/misureTorta.js';
import { LISTINO, OGGI, listino, listinoDelSito, tortaBase, totaleDelSito, supabaseFinto } from './aiuti.mjs';

const valida = (patch = {}, L = LISTINO) => validaOrdine({ ...tortaBase(), ...patch }, L, OGGI);

/** Deve essere rifiutata con [status, codice, campo]; restituisce l'errore. */
function rifiuta(patch, atteso, L = LISTINO) {
  try {
    valida(patch, L);
  } catch (e) {
    assert.ok(e instanceof OrdineRifiutato, `errore inatteso: ${e && e.stack}`);
    assert.deepEqual([e.status, e.codice, e.campo], atteso, e.message);
    return e;
  }
  assert.fail(`doveva rifiutare ${JSON.stringify(atteso)} e invece passa: ${JSON.stringify(patch)}`);
}

test('tipo, taglia e forma: sconosciuti, spenti o della lista sbagliata', () => {
  const e = rifiuta({ type: 'zzz' }, [409, 'opzione_non_disponibile', 'type']);
  assert.match(e.message, /^Il tipo di torta scelto non è più disponibile/);
  assert.equal(e.voce, 'zzz');
  // Taglie delle alte: oggi tutte spente.
  rifiuta({ type: 'piani', sizeId: 'alta-10' }, [409, 'taglia_non_valida', 'size']);
  rifiuta({ sizeId: 'alta-10' }, [409, 'taglia_non_valida', 'size']);
  rifiuta({ sizeId: '' }, [409, 'taglia_non_valida', 'size']);
  rifiuta({ sizeId: 'non-esiste' }, [409, 'taglia_non_valida', 'size']);
  // Forma: sconosciuta, spenta, rettangolare sotto i 15 persone.
  rifiuta({ shape: 'esagonale' }, [409, 'forma_non_valida', 'shape']);
  const L = listino();
  L.forme.find((f) => f.id === 'cuore').attivo = false;
  const spenta = rifiuta({ shape: 'cuore' }, [409, 'forma_non_valida', 'shape'], L);
  assert.match(spenta.message, /«Cuore»/);
  rifiuta({ shape: 'rettangolare' }, [409, 'forma_non_valida', 'shape']);
  assert.ok(valida({ shape: 'rettangolare', sizeId: '16' }));
});

test('taglie delle alte accese: la taglia normale su un\'alta non passa più', () => {
  // Oggi (alte spente) un'alta usa le taglie normali, come il sito.
  assert.ok(valida({ type: 'piani', sizeId: '16', flavors: [{ name: 'Crema' }, { name: 'Bacio' }, { name: 'Nutella' }, { name: 'Kinder' }] }));
  const L = listino();
  L.dimensioni.find((s) => s.id === 'alta-10').attivo = true;
  rifiuta({ type: 'piani', sizeId: '16' }, [409, 'taglia_non_valida', 'size'], L);
  assert.ok(validaOrdine({ ...tortaBase(), type: 'piani', sizeId: 'alta-10' }, L, OGGI));
  rifiuta({ sizeId: 'alta-10' }, [409, 'taglia_non_valida', 'size'], L); // mai su una torta normale
});

test('punto 17: forme accese per gruppo (per_normali / per_alte)', () => {
  // Prima della migrazione le colonne non ci sono: vale tutto ciò che è acceso.
  assert.deepEqual(formeAmmesse(LISTINO.forme, true).sort(), ['cuore', 'quadrata', 'rettangolare', 'tonda']);
  const L = listino();
  for (const f of L.forme) { f.per_normali = true; f.per_alte = true; }
  L.forme.find((f) => f.id === 'cuore').per_alte = false;
  L.forme.find((f) => f.id === 'quadrata').per_normali = false;
  const alta = { type: 'piani', sizeId: '16', flavors: [{ name: 'Crema' }] };
  const e = rifiuta({ ...alta, shape: 'cuore' }, [409, 'forma_non_valida', 'shape'], L);
  assert.match(e.message, /non si fa per questo tipo di torta/);
  assert.ok(validaOrdine({ ...tortaBase(), shape: 'cuore' }, L, OGGI), 'il cuore resta per le normali');
  rifiuta({ shape: 'quadrata' }, [409, 'forma_non_valida', 'shape'], L);
  assert.ok(validaOrdine({ ...tortaBase(), ...alta, shape: 'quadrata' }, L, OGGI), 'la quadrata resta per le alte');
  // Rete di sicurezza: tutte spente per le alte → valgono tutte le accese.
  for (const f of L.forme) f.per_alte = false;
  assert.deepEqual(formeAmmesse(L.forme, true).sort(), ['cuore', 'quadrata', 'rettangolare', 'tonda']);
  assert.ok(validaOrdine({ ...tortaBase(), ...alta, shape: 'cuore' }, L, OGGI));
  // L'interruttore generale vince sempre.
  L.forme.find((f) => f.id === 'cuore').attivo = false;
  assert.ok(!formeAmmesse(L.forme, true).includes('cuore'));
});

test('base, crumble, gusti, inserto, copertura', () => {
  rifiuta({ baseId: 'crock', crumbleId: '' }, [422, 'scelta_non_valida', 'crumble']);
  rifiuta({ baseId: 'crock', crumbleId: 'inventato' }, [409, 'opzione_non_disponibile', 'crumble']);
  rifiuta({ baseId: '' }, [422, 'scelta_non_valida', 'base']);
  assert.equal(valida({ crumbleId: 'cacao' }).canon.crumbleId, '', 'il crumble conta solo con la base croccante');
  rifiuta({ flavors: [] }, [422, 'scelta_non_valida', 'flavors']);
  rifiuta({ flavors: [{ name: 'Crema' }, { name: 'Nocciola' }, { name: 'Bacio' }] }, [422, 'scelta_non_valida', 'flavors']);
  const pesca = rifiuta({ flavors: [{ name: 'Pesca' }] }, [409, 'opzione_non_disponibile', 'flavors']);
  assert.match(pesca.message, /^Il gusto «Pesca» non è più disponibile/);
  rifiuta({ flavors: [{ name: 'Torta da 40 persone' }] }, [409, 'opzione_non_disponibile', 'flavors']);
  rifiuta({ fillingId: 'ganache' }, [409, 'opzione_non_disponibile', 'filling']);
  rifiuta({ fillingId: '' }, [422, 'scelta_non_valida', 'filling']);
  const cop = rifiuta({ coveringId: 'glassa-specchio' }, [409, 'opzione_non_disponibile', 'covering']);
  assert.match(cop.message, /^«Glassa a specchio» non è più disponibile/);
  rifiuta({ coveringId: '' }, [422, 'scelta_non_valida', 'covering']);
  // Gli strati si possono ripetere; il nome si riconosce senza maiuscole.
  const v = valida({ flavors: [{ name: 'crema ' }, { name: 'CREMA' }] });
  assert.deepEqual(v.canon.flavors.map((f) => f.name), ['Crema', 'Crema']);
});

test('decorazioni e colori', () => {
  rifiuta({ decorations: ['granella-frutta-secca'] }, [409, 'opzione_non_disponibile', 'decoration']);
  const verde = rifiuta({ decorationColors: { fiocchi: 'Verde' } }, [409, 'opzione_non_disponibile', 'decoration']);
  assert.equal(verde.voce, 'fiocchi');
  rifiuta({ decorationColors: {} }, [422, 'scelta_non_valida', 'decoration']);
  rifiuta({ decorations: ['fiocchi', 'macarons', 'smarties', 'drip', 'fantasia', 'colorate'], decorationColors: { fiocchi: 'Rosso' } },
    [422, 'scelta_non_valida', 'decoration']);
  // Grafia del listino, 'nessuna' e doppioni ignorati (come il sito).
  const v = valida({ decorations: ['nessuna', 'fiocchi', 'fiocchi', ' macarons '], decorationColors: { fiocchi: 'rosso' } });
  assert.deepEqual(v.canon.decorations, ['fiocchi', 'macarons']);
  assert.deepEqual(v.canon.decorationColors, { fiocchi: 'Rosso' });
  // Il colore di una decorazione che non lo prevede si scarta.
  assert.deepEqual(valida({ decorations: ['macarons'], decorationColors: { macarons: 'Viola' } }).canon.decorationColors, {});
  // Formato vecchio (ordini salvati, "Rifai questa torta").
  const vecchio = valida({ decorations: undefined, decorationColors: undefined, decoration: 'perline', decorationColor: 'oro' });
  assert.deepEqual(vecchio.canon.decorations, ['perline']);
  assert.deepEqual(vecchio.canon.decorationColors, { perline: 'Oro' });
  assert.deepEqual(valida({ decorations: [], decorationColors: {} }).canon.decorations, []);
});

test('extra: id, quantità, passo', () => {
  rifiuta({ extras: { 'salame-dolce': 0.3 } }, [422, 'scelta_non_valida', 'extras']);
  rifiuta({ extras: { 'cabaret-10': 25 } }, [422, 'scelta_non_valida', 'extras']);
  rifiuta({ extras: { 'cabaret-10': 1.5 } }, [422, 'scelta_non_valida', 'extras']);
  rifiuta({ extras: { 'cabaret-10': -1 } }, [422, 'scelta_non_valida', 'extras']);
  rifiuta({ extras: { 'torta-gratis': 1 } }, [409, 'opzione_non_disponibile', 'extras']);
  const L = listino();
  L.extra.find((e) => e.id === 'cabaret-10').attivo = false;
  rifiuta({ extras: { 'cabaret-10': 1 } }, [409, 'opzione_non_disponibile', 'extras'], L);
  assert.deepEqual(valida({ extras: { 'cabaret-10': 0, 'salame-dolce': 20 } }).canon.extras, { 'salame-dolce': 20 });
});

test('scritta, stile e occasione', () => {
  rifiuta({ message: 'x'.repeat(25) }, [422, 'scelta_non_valida', 'message']);
  assert.equal(valida({ message: 'x'.repeat(24) }).canon.message, 'x'.repeat(24));
  // 12 emoji = 24 unità, come le conta il maxLength dell'input.
  assert.ok(valida({ message: '🎂'.repeat(12) }));
  rifiuta({ messageFont: 'comic-sans' }, [409, 'opzione_non_disponibile', 'message']);
  assert.equal(valida({ messageFont: 'caveat' }).canon.messageFont, 'corsivo', 'font vecchio rimappato');
  assert.equal(valida({ message: '', messageFont: 'comic-sans' }).canon.messageFont, 'corsivo', 'senza scritta lo stile non conta');
  const L = listino();
  for (const s of L.scritte) s.attivo = false;
  assert.equal(validaOrdine({ ...tortaBase(), messageFont: 'stampatello' }, L, OGGI).righe.scritta.nome, 'Stampatello maiuscolo',
    'senza stili accesi valgono quelli di scorta del sito');
  const occ = rifiuta({ occasion: 'Festa di famiglia' }, [409, 'opzione_non_disponibile', 'message']);
  assert.match(occ.message, /^L'occasione «Festa di famiglia» non è più disponibile/);
  assert.equal(valida({ occasion: 'Anniversario' }).canon.occasion, 'Anniversario');
  assert.equal(valida({ occasion: '' }).canon.occasion, '');
});

test('dati del cliente, consegna, data e ora', () => {
  rifiuta({ delivery: true, deliveryAddress: '  ' }, [422, 'scelta_non_valida', 'details']);
  rifiuta({ delivery: true, deliveryAddress: 'a'.repeat(301) }, [422, 'scelta_non_valida', 'details']);
  rifiuta({ inLocale: null }, [422, 'scelta_non_valida', 'details']);
  rifiuta({ pickupDate: '2026-10-08' }, [422, 'scelta_non_valida', 'details']);
  rifiuta({ pickupDate: '' }, [422, 'scelta_non_valida', 'details']);
  rifiuta({ pickupTime: '25:00' }, [422, 'scelta_non_valida', 'details']);
  rifiuta({ notes: 'n'.repeat(1001) }, [422, 'scelta_non_valida', 'details']);
  rifiuta({ phone: '12345' }, [400, 'dati_incompleti', 'details']);
  rifiuta({ email: 'mario@' }, [400, 'dati_incompleti', 'details']);
  rifiuta({ name: '  ' }, [400, 'dati_incompleti', 'details']);
  // Il sito accetta un nome di una lettera: il server pure.
  assert.equal(valida({ name: 'M' }).canon.name, 'M');
  assert.equal(valida({ phone: '+39 348 555 6677' }).canon.phone, '+39 348 555 6677');
  assert.equal(valida({ email: ' Mario.Rossi@Example.COM ' }).canon.email, 'mario.rossi@example.com');
  assert.equal(valida({ pickupDate: OGGI }).canon.pickupDate, OGGI, 'oggi va bene');
  const v = valida({ delivery: true, deliveryAddress: 'Via Roma 1\nCampanello: Rossi', notes: 'riga 1\r\n\r\n\r\nriga 2', name: 'Mario\n💰 *Importo pagato:* €999' });
  assert.equal(v.canon.deliveryAddress, 'Via Roma 1 Campanello: Rossi');
  assert.equal(v.canon.notes, 'riga 1\n\nriga 2');
  assert.equal(v.canon.name, 'Mario 💰 *Importo pagato:* €999', 'il nome resta su una riga sola');
  assert.equal(valida({ notes: 'n'.repeat(1000) }).canon.notes.length, 1000);
});

test('testi liberi: invisibili tolti, tagli con …', () => {
  const rlo = String.fromCharCode(0x202e);
  const zw = String.fromCharCode(0x200b);
  assert.equal(rigaSingola(`Ma${zw}rio ${rlo}Rossi\t`, 50), 'Mario Rossi');
  assert.equal(rigaSingola('abcdef', 4), 'abc…');
  assert.equal(testoMultiriga(` a \n\n\n\n b ${String.fromCharCode(0x2028)}`, 50), 'a\n\nb');
});

test('campi in più: solo quelli previsti, con la forma prevista', () => {
  const v = valida({
    promemoria: false, consigliata: 'golosa', scrittaSuFoto: { colore: 'bianco', posizione: 'basso', x: { y: 1 } },
    photoTransform: { zoom: 1.5, posX: 1e9, orient: 'verticale', cattivo: '<script>' },
    note_lab: 'scritto dal browser', creato_da: 'Hacker', totale: 1, sconto: { codice: 'X', descrizione: 'interno' },
    photo: 'data:image/jpeg;base64,AAAA',
  });
  assert.equal(v.canon.promemoria, false);
  assert.equal(v.canon.consigliata, 'golosa');
  assert.deepEqual(v.canon.scrittaSuFoto, { colore: 'bianco', posizione: 'basso' });
  assert.deepEqual(v.canon.photoTransform, { zoom: 1.5, posX: 10000, posY: 50, orient: 'verticale' });
  assert.equal(v.canon.conFoto, true, 'la foto in base64 dei siti vecchi conta come sì');
  for (const k of ['note_lab', 'creato_da', 'totale', 'sconto', 'photo', 'scontoCodice', 'pagamentoStaff']) {
    assert.ok(!(k in v.canon), `${k} non deve passare`);
  }
  assert.ok(!('consigliata' in valida({ consigliata: '<b>x</b>' }).canon));
});

test('le 9 consigliate del sito passano così come le compone il configuratore', () => {
  const S = listinoDelSito();
  for (const t of torteConsigliate) {
    const cfg = {
      ...tortaBase(),
      type: t.type, baseId: t.baseId, crumbleId: t.crumbleId || '',
      flavors: t.flavors.map((n) => S.cakeFlavors.find((f) => f.name.toLowerCase() === n.toLowerCase())),
      fillingId: t.fillingId, coveringId: t.coveringId, decorations: [...(t.decorations || [])], decorationColors: {},
    };
    assert.ok(cfg.flavors.every(Boolean), `${t.id}: gusto non a listino`);
    assert.ok(validaOrdine(cfg, LISTINO, OGGI), t.id);
  }
});

test('prezzo del server = totale mostrato dal sito (3000 torte a caso, solo voci accese)', () => {
  const S = listinoDelSito();
  let seme = 12345;
  const caso = () => { seme = (seme * 1103515245 + 12345) % 2147483648; return seme / 2147483648; };
  const pesca = (a) => a[Math.floor(caso() * a.length)];
  let provate = 0;
  for (let i = 0; i < 3000; i++) {
    const type = pesca(S.cakeTypes).id;
    const alta = ['piani', 'alta-gelato'].includes(type);
    const taglie = S.cakeSizes.filter((s) => !s.alta);
    const size = pesca(alta && S.cakeSizes.some((s) => s.alta) ? S.cakeSizes.filter((s) => s.alta) : taglie);
    const shape = pesca(S.cakeShapes.filter((s) => s.id !== 'rettangolare' || personeSito(size) >= 15)).id;
    const baseId = pesca(S.cakeBases).id;
    const decs = [...new Set(Array.from({ length: Math.floor(caso() * 6) }, () => pesca(S.cakeDecorations.filter((d) => d.id !== 'nessuna')).id))];
    const decorationColors = Object.fromEntries(decs
      .map((id) => [id, S.cakeDecorations.find((d) => d.id === id)])
      .filter(([, d]) => d.colorChoice && d.colors.length)
      .map(([id, d]) => [id, pesca(d.colors)]));
    const extras = caso() < 0.5 ? {} : { [pesca(S.cakeExtras).id]: pesca(S.cakeExtras).step * (1 + Math.floor(caso() * 4)) };
    const cfg = {
      ...tortaBase(), type, sizeId: size.id, shape, baseId, crumbleId: baseId === 'crock' ? pesca(S.cakeCrumbles).id : '',
      flavors: Array.from({ length: 1 + Math.floor(caso() * (alta ? 4 : 2)) }, () => pesca(S.cakeFlavors)),
      fillingId: pesca(S.cakeFillings).id, coveringId: pesca(S.cakeCoverings).id,
      decorations: decs, decorationColors, extras, photo: caso() < 0.5, delivery: caso() < 0.3, deliveryAddress: 'Via Roma 1',
    };
    // Gli extra a passo diverso: si tiene la quantità del primo pescato.
    for (const [id, q] of Object.entries(cfg.extras)) {
      const passo = S.cakeExtras.find((e) => e.id === id).step;
      cfg.extras[id] = Math.min(20, Math.max(passo, Math.round(q / passo) * passo));
    }
    const v = validaOrdine(cfg, LISTINO, OGGI);
    assert.equal(prezzoOrdine(v).lordo, totaleDelSito(cfg, S), JSON.stringify(cfg).slice(0, 300));
    provate++;
  }
  assert.equal(provate, 3000);
});

test('scomposizione del prezzo', () => {
  const v = valida();
  const p = prezzoOrdine(v);
  // Semifreddo 28 + 10 persone 19 + Classica 1 + Nutella 2 + Panna 2 + fiocchi 5 + macarons 3 + foto 5
  // + salame 1,5 kg × 35 = 52,50 → 117,50 (le voci a 0 € non si elencano: la tonda)
  assert.equal(p.lordo, 117.5);
  assert.deepEqual(p.voci.map((x) => `${x.voce} = ${x.euro}`), [
    'Tipo: Semifreddo = 28', 'Taglia: 10 persone = 19', 'Base: Classica Vaniglia = 1', 'Inserto: Nutella = 2',
    'Copertura: Panna montata a CIUFFI INTORNO = 2', 'Decorazione: Fiocchi colorati = 5', 'Decorazione: Macarons = 3',
    'Foto su cialda = 5', 'Extra: Salame dolce ×1,5 = 52.5',
  ]);
});

test('oggi a Roma, non in UTC', () => {
  assert.equal(oggiARoma(new Date('2026-10-09T22:30:00Z')), '2026-10-10'); // ora legale: +2
  assert.equal(oggiARoma(new Date('2026-01-15T22:59:00Z')), '2026-01-15'); // ora solare: +1
  assert.equal(oggiARoma(new Date('2026-01-15T23:00:00Z')), '2026-01-16');
  assert.match(oggiARoma(), /^\d{4}-\d{2}-\d{2}$/);
});

test('caricaListino: errori che fermano il pagamento e tabelle facoltative', async () => {
  const L = await caricaListino(supabaseFinto());
  assert.equal(L.forme.length, 4);
  assert.equal(L.dimensioni.length, 20, 'anche le righe spente');
  // Rete giù su una tabella obbligatoria: niente pagamento.
  await assert.rejects(caricaListino(supabaseFinto(LISTINO, { errori: { coperture: { code: '', message: 'fetch failed' } } })), ListinoNonDisponibile);
  // Tabella facoltativa che non esiste: vuota, il resto funziona.
  const senza = { ...LISTINO };
  delete senza.gusti_torte;
  assert.deepEqual((await caricaListino(supabaseFinto(senza))).gusti_torte, []);
  // …ma un errore di rete anche su una facoltativa ferma tutto.
  await assert.rejects(caricaListino(supabaseFinto(LISTINO, { errori: { extra: { code: '', message: 'fetch failed' } } })), ListinoNonDisponibile);
  // Tabella obbligatoria che non esiste: ferma tutto.
  const senzaForme = { ...LISTINO };
  delete senzaForme.forme;
  await assert.rejects(caricaListino(supabaseFinto(senzaForme)), ListinoNonDisponibile);
});

test('computeOrder: prezzo, sconto verificato dal database, minimo di Stripe', async () => {
  const cfg = tortaBase();
  const senza = await computeOrder(supabaseFinto(), cfg, OGGI);
  assert.equal(senza.amountCents, 11750);
  assert.equal(senza.sconto, null);
  assert.match(senza.summary, /^Semifreddo · forma tonda · 10 persone · gusti: Crema, Nocciola · decorazioni: Fiocchi colorati \(Rosso\), Macarons · extra: Salame dolce ×1,5$/);

  const sb = supabaseFinto(LISTINO, { sconto: ({ p_totale }) => ({ valido: true, codice: 'ESTATE10', sconto: Math.round(p_totale * 10) / 100 }) });
  const con = await computeOrder(sb, { ...cfg, scontoCodice: 'estate10' }, OGGI);
  assert.deepEqual(con.sconto, { codice: 'ESTATE10', euro: 11.75 });
  assert.equal(con.amountCents, 10575);
  assert.deepEqual(sb.chiamate.find((c) => c[0] === 'rpc')[2], { p_codice: 'estate10', p_totale: 117.5 });

  const tutto = await computeOrder(supabaseFinto(LISTINO, { sconto: () => ({ valido: true, codice: 'GRATIS', sconto: 999 }) }), { ...cfg, scontoCodice: 'GRATIS' }, OGGI);
  assert.equal(tutto.amountCents, 50, 'mai sotto 0,50 €');

  const nonValido = await computeOrder(supabaseFinto(LISTINO, { sconto: () => ({ valido: false }) }), { ...cfg, scontoCodice: 'NO' }, OGGI);
  assert.equal(nonValido.amountCents, 11750);

  // Il controllo del codice non risponde: si ferma, non si addebita il prezzo pieno di nascosto.
  await assert.rejects(
    computeOrder(supabaseFinto(LISTINO, { errori: { verifica_sconto: { message: 'timeout' } } }), { ...cfg, scontoCodice: 'ESTATE10' }, OGGI),
    ListinoNonDisponibile,
  );
  // Un tipo sconosciuto non vale più 0 €: rifiuto prima di qualsiasi importo.
  await assert.rejects(computeOrder(supabaseFinto(), { ...cfg, type: 'zzz' }, OGGI), OrdineRifiutato);
});
