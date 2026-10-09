// node --test src/lib/collaboraRegole.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TIPI, MSG_MAX, errori, primoErrore, parametri, emailOk, telefonoOk, pulito, testoMessaggio,
  tipoDaRicerca, etichettaTipo, linkWhatsapp, linkEmail, linkTelefono, linkWhatsappTelefono,
  dopoRisposta, NON_INVIATA,
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

test('dashboard: email, telefono e WhatsApp del mittente', () => {
  const m = linkEmail('anna.bianchi+eventi@example.com', 'Anna Maria Bianchi');
  assert.ok(m.startsWith('mailto:anna.bianchi+eventi@example.com?subject='));
  assert.match(decodeURIComponent(m), /La tua proposta a Gelateria Punto Gi/);
  assert.match(decodeURIComponent(m), /Ciao Anna,/);
  assert.ok(linkEmail('a?b#c@x.it', '').startsWith('mailto:a%3Fb%23c@x.it?'));
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
