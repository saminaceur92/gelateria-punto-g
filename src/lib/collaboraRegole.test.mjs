// node --test src/lib/collaboraRegole.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TIPI, MSG_MAX, errori, primoErrore, parametri, emailOk, telefonoOk, pulito, testoMessaggio,
  tipoDaRicerca, etichettaTipo, linkWhatsapp, linkEmail, linkTelefono, linkWhatsappTelefono,
  dopoRisposta, NON_INVIATA, perUrl,
} from './collaboraRegole.js';

const ok = {
  tipo: 'eventi', nome: 'Mario Rossi', azienda: '', email: 'mario@example.com', telefono: '',
  messaggio: 'Una festa aziendale per 80 persone a dicembre.', privacy: true, sito: '',
};

test('modulo corretto: nessun errore', () => {
  assert.deepEqual(errori(ok), {});
  assert.equal(primoErrore(errori(ok)), null);
});

test('tipo mancante, inventato o non proposto dal modulo', () => {
  assert.ok(errori({ ...ok, tipo: '' }).tipo);
  assert.ok(errori({ ...ok, tipo: 'boh' }).tipo);
  // 'lavoro' esiste nel database ma il modulo oggi non lo propone
  assert.ok(errori({ ...ok, tipo: 'lavoro' }).tipo);
  assert.deepEqual(TIPI.map((t) => t.id), ['locale', 'eventi', 'aziende', 'creator', 'fornitore', 'altro']);
  assert.equal(etichettaTipo('lavoro'), 'Lavorare con noi');
  assert.equal(etichettaTipo('inventato'), 'Altro');
});

test('nome: spazi e a capo non contano', () => {
  assert.ok(errori({ ...ok, nome: '  a  ' }).nome);
  assert.ok(errori({ ...ok, nome: '\n\t' }).nome);
  assert.equal(errori({ ...ok, nome: 'Al' }).nome, undefined);
  assert.equal(pulito('  Anna\nMaria\u001b  Bianchi '), 'Anna Maria Bianchi');
});

test('email: stessa regola del configuratore e del database', () => {
  assert.equal(emailOk('a@b.c'), true);
  assert.equal(emailOk(' mario@example.com '), true);
  assert.equal(emailOk('mario@'), false);
  assert.equal(emailOk('mario example@x.it'), false);
  assert.equal(emailOk(`${'x'.repeat(250)}@b.it`), false);
  assert.match(errori({ ...ok, email: '' }).email, /Scrivi la tua email/);
  assert.match(errori({ ...ok, email: 'mario@' }).email, /incompleta/);
});

test('email: niente emoji, caratteri di controllo come spazi (come nel database)', () => {
  // emoji (oltre U+FFFF) ovunque nell'indirizzo, e mezza emoji spaiata
  for (const e of ['mario🍦@gmail.com', '🍦@x.it', 'mario@🍕.ws', 'mario\uD83C@gmail.com']) {
    assert.equal(emailOk(e), false, e);
    assert.match(errori({ ...ok, email: e }).email, /non può contenere emoji/, e);
  }
  // lettere accentate e simboli comuni restano ammessi
  assert.equal(emailOk('andrè@example.it'), true);
  assert.equal(emailOk('info@caffè.it'), true);
  // controllo in mezzo = spazio (sbagliata); in testa e in coda sparisce
  assert.equal(emailOk('mario\u0001rossi@example.com'), false);
  assert.match(errori({ ...ok, email: 'mario\u0007@example.com' }).email, /incompleta/);
  assert.equal(emailOk('\u0001mario@example.com\u0002'), true);
});

test('telefono facoltativo, fissi ed esteri ammessi', () => {
  assert.equal(telefonoOk(''), true);
  assert.equal(telefonoOk('   '), true);
  assert.equal(telefonoOk('059 623 1234'), true);
  assert.equal(telefonoOk('+39 348 555 6677'), true);
  assert.equal(telefonoOk('+33 1 23 45 67 89'), true);
  assert.equal(telefonoOk('12 34'), false);
  assert.equal(telefonoOk('1234567890123456'), false);
});

test('messaggio: minimo 20 caratteri veri, massimo 2000', () => {
  assert.match(errori({ ...ok, messaggio: '' }).messaggio, /Raccontaci la tua idea/);
  assert.match(errori({ ...ok, messaggio: 'corto' }).messaggio, /almeno 20/);
  assert.ok(errori({ ...ok, messaggio: `${'\n'.repeat(30)}ok` }).messaggio);
  assert.ok(errori({ ...ok, messaggio: 'x'.repeat(MSG_MAX + 1) }).messaggio);
  assert.equal(errori({ ...ok, messaggio: 'x'.repeat(MSG_MAX) }).messaggio, undefined);
  assert.equal(testoMessaggio('\n  Riga uno\u0007\r\nRiga due\rtre  \n'), 'Riga uno\nRiga due\ntre');
});

test('privacy: solo true (non "true", non 1)', () => {
  assert.ok(errori({ ...ok, privacy: false }).privacy);
  assert.ok(errori({ ...ok, privacy: 'true' }).privacy);
  assert.ok(errori({ ...ok, privacy: 1 }).privacy);
});

test('il primo errore segue l’ordine del modulo', () => {
  const e = errori({ ...ok, privacy: false, email: 'x', nome: '' });
  assert.equal(primoErrore(e), 'nome');
  assert.equal(primoErrore(errori({ ...ok, tipo: '', messaggio: '' })), 'tipo');
  assert.equal(primoErrore(errori({ ...ok, telefono: '1' })), 'telefono');
});

test('parametri: ripuliti, vuoti → null, millisecondi interi e limitati', () => {
  const p = parametri({ ...ok, nome: '  Mario   Rossi ', azienda: '   ', telefono: ' ', sito: '', messaggio: '  Ciao\r\nmondo  ' }, 4_000_000.6);
  assert.equal(p.p_nome, 'Mario Rossi');
  assert.equal(p.p_azienda, null);
  assert.equal(p.p_telefono, null);
  assert.equal(p.p_sito, null);
  assert.equal(p.p_messaggio, 'Ciao\nmondo');
  assert.equal(p.p_ms, 3_600_000);
  assert.equal(parametri(ok, 4523.7).p_ms, 4524);
  assert.equal(parametri(ok, -5).p_ms, 0);
  assert.equal(parametri(ok, NaN).p_ms, null);
  assert.equal(parametri({ ...ok, sito: 'http://x' }, 10).p_sito, 'http://x');
  assert.equal(parametri({ ...ok, privacy: 'true' }, 10).p_privacy, false);
  assert.deepEqual(Object.keys(p).sort(), ['p_azienda', 'p_email', 'p_messaggio', 'p_ms', 'p_nome', 'p_privacy', 'p_sito', 'p_telefono', 'p_tipo']);
});

test('risposta del database: grazie, doppione, errore sotto il campo, riquadro', () => {
  assert.deepEqual(dopoRisposta({ ok: true, gia_ricevuta: false }),
    { fase: 'fatto', giaRicevuta: false, conta: true, erroriServer: {}, avviso: '', campo: null });
  // il doppione mostra il grazie ma NON si conta di nuovo nelle statistiche
  assert.deepEqual(dopoRisposta({ ok: true, gia_ricevuta: true }),
    { fase: 'fatto', giaRicevuta: true, conta: false, erroriServer: {}, avviso: '', campo: null });
  assert.deepEqual(dopoRisposta({ ok: false, campo: 'email', motivo: 'Controlla l’email.' }),
    { fase: 'modulo', giaRicevuta: false, conta: false, erroriServer: { email: 'Controlla l’email.' }, avviso: '', campo: 'email' });
  // campo sconosciuto o assente: il motivo va nel riquadro (con WhatsApp)
  assert.equal(dopoRisposta({ ok: false, campo: 'boh', motivo: 'Troppe proposte.' }).avviso, 'Troppe proposte.');
  assert.equal(dopoRisposta({ ok: false, campo: null, motivo: 'Scrivici su WhatsApp.' }).campo, null);
  // niente risposta o risposta strana: messaggio generico, mai il grazie
  for (const r of [null, undefined, {}, { ok: 'true' }, { ok: false, motivo: 42 }]) {
    const d = dopoRisposta(r);
    assert.equal(d.fase, 'modulo');
    assert.equal(d.avviso, NON_INVIATA);
    assert.equal(d.conta, false);
  }
});

test('tipo dal link: solo se esiste', () => {
  assert.equal(tipoDaRicerca('?tipo=eventi'), 'eventi');
  assert.equal(tipoDaRicerca('?tipo=lavoro'), '');
  assert.equal(tipoDaRicerca('?tipo=<script>'), '');
  assert.equal(tipoDaRicerca(''), '');
  assert.equal(tipoDaRicerca(undefined), '');
});

test('WhatsApp di riserva: la proposta già scritta, accorciata se lunghissima', () => {
  const u = new URL(linkWhatsapp({ ...ok, azienda: 'Bar Centrale' }));
  assert.equal(u.searchParams.get('phone'), '393203306009');
  const t = u.searchParams.get('text');
  assert.match(t, /Collabora con noi/);
  assert.match(t, /Eventi e feste/);
  assert.match(t, /Mario Rossi/);
  assert.match(t, /Bar Centrale/);
  assert.match(t, /festa aziendale/);
  const lungo = new URL(linkWhatsapp({ ...ok, messaggio: 'y'.repeat(1900) })).searchParams.get('text');
  assert.ok(lungo.length < 1700);
  assert.ok(new URL(linkWhatsapp({})).searchParams.get('text').startsWith('Ciao!'));
});

test('WhatsApp di riserva: il taglio non spezza mai un’emoji e il link non lancia', () => {
  // Il caso della revisione: l'emoji occupa le posizioni 1499 e 1500, proprio
  // dove cadeva il taglio. Il messaggio è valido, quindi arriva davvero all'invio.
  const messaggio = `${'a'.repeat(1499)}🍦${' resto del messaggio'.repeat(10)}`;
  assert.deepEqual(errori({ ...ok, messaggio }), {});
  const t = new URL(linkWhatsapp({ ...ok, messaggio })).searchParams.get('text');
  assert.ok(t.endsWith(`${'a'.repeat(1499)}🍦…`), 'l’emoji resta intera, poi i puntini');
  // 1500 caratteri VERI: anche un testo di sole emoji non si accorcia prima
  const emoji = '🍦'.repeat(1600);
  const te = new URL(linkWhatsapp({ ...ok, messaggio: emoji })).searchParams.get('text');
  assert.ok(te.endsWith(`${'🍦'.repeat(1500)}…`));
  assert.ok(!te.includes('\uFFFD'));
  // mezzi caratteri spaiati nei campi (incolla strani): niente errore, U+FFFD al loro posto
  for (const strano of ['\uD83C', '\uDF66', `ciao \uD83C${'x'.repeat(30)}`]) {
    const v = { ...ok, nome: `Mario ${strano}`, azienda: strano, messaggio: `${'m'.repeat(25)} ${strano}` };
    const u = new URL(linkWhatsapp(v));
    assert.ok(u.searchParams.get('text').includes('\uFFFD'));
  }
});

test('codifica per i link: come encodeURIComponent, ma non lancia mai', () => {
  for (const s of ['', 'a b&c?d#e', 'andrè', '🍦', 'Ciao,\r\n\r\n', 'x'.repeat(5000)]) {
    assert.equal(perUrl(s), encodeURIComponent(s));
  }
  assert.equal(perUrl('a\uD83Cb'), 'a%EF%BF%BDb');
  assert.equal(perUrl('\uDF66'), '%EF%BF%BD');
  assert.equal(perUrl('🍦\uD83C'), '%F0%9F%8D%A6%EF%BF%BD');
  assert.equal(perUrl(null), '');
  assert.equal(perUrl(undefined), '');
});

test('dashboard: email, telefono e WhatsApp del mittente', () => {
  const m = linkEmail('anna.bianchi+eventi@example.com', 'Anna Maria Bianchi');
  assert.ok(m.startsWith('mailto:anna.bianchi+eventi@example.com?subject='));
  assert.match(decodeURIComponent(m), /La tua proposta a Gelateria Punto Gi/);
  assert.match(decodeURIComponent(m), /Ciao Anna,/);
  assert.ok(linkEmail('a?b#c@x.it', '').startsWith('mailto:a%3Fb%23c@x.it?'));
  // Un'emoji nell'indirizzo (riga salvata prima di questa regola, o arrivata
  // a mano): il link si costruisce lo stesso, con l'emoji codificata intera.
  // Prima lanciava URIError e la dashboard spariva tutta.
  assert.ok(linkEmail('mario🍦@gmail.com', 'Mario').startsWith('mailto:mario%F0%9F%8D%A6@gmail.com?subject='));
  assert.ok(linkEmail('🍦@x.it', '🍦 Mario').includes('body=Ciao%20%F0%9F%8D%A6%2C'));
  assert.ok(linkEmail('andrè@example.it', '').startsWith('mailto:andr%C3%A8@example.it?'));
  assert.ok(linkEmail('mario\uD83C@x.it', 'Anna\uDF66').startsWith('mailto:mario%EF%BF%BD@x.it?'));
  assert.equal(linkTelefono('+39 348 555 6677'), 'tel:+393485556677');
  assert.equal(linkTelefono('059 623 1234'), 'tel:0596231234');
  assert.equal(linkTelefono('12'), null);
  assert.equal(linkWhatsappTelefono('348 555 6677'), 'https://api.whatsapp.com/send?phone=393485556677');
  assert.equal(linkWhatsappTelefono('+39 348 555 6677'), 'https://api.whatsapp.com/send?phone=393485556677');
  assert.equal(linkWhatsappTelefono('0039 391 234 5678'), 'https://api.whatsapp.com/send?phone=393912345678');
  assert.equal(linkWhatsappTelefono('3912345678'), 'https://api.whatsapp.com/send?phone=393912345678');
  assert.equal(linkWhatsappTelefono('059 623 1234'), null);
  assert.equal(linkWhatsappTelefono('+33 6 12 34 56 78'), null);
  assert.equal(linkWhatsappTelefono(''), null);
});
