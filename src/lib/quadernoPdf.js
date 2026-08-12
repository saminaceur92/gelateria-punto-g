import { supabase } from './supabase';
import { nuovoPdf, ripulisci } from './pdf';

/**
 * Quaderno Ingredienti e Allergeni generato dai dati del gestionale.
 *
 * È la risposta al problema di prima: il PDF ufficiale e il sito erano due
 * cose separate e potevano dire cose diverse. Adesso il PDF si costruisce
 * dalle STESSE tabelle che alimentano la pagina /allergeni, la carta del
 * gelato e il configuratore torte — quindi per costruzione non può divergere.
 *
 * Oltre ai gusti il documento copre anche i componenti delle torte (basi,
 * crumble, farciture, coperture, decorazioni, extra): sono prodotti venduti e
 * hanno allergeni dichiarati, ma finora non comparivano da nessuna parte se
 * non dentro al configuratore.
 *
 * `improntaDati` serve a capire, dal gestionale, se i dati sono cambiati dopo
 * l'ultima generazione: è quella che accende l'avviso "rigenera il PDF".
 */

/* ───────── Identità della gelateria (compare in testata) ───────── */

// Dati d'intestazione, gli stessi del quaderno impaginato a mano dai titolari.
export const GELATERIA = {
  nome: 'Gelateria Punto Gi',
  ragioneSociale: 'Gelateria Punto Gi S.r.l.',
  piva: '03578310363',
  indirizzo: 'Via Remesina Interna 46 — 41012 Carpi (MO)',
  telefono: '320 330 6009',
};

/**
 * Cambiala quando cambia il LAYOUT del documento: entra nell'impronta, così
 * dopo un aggiornamento del sito il gestionale segnala che conviene rigenerare.
 */
const VERSIONE_DOC = 3;

/* ───────── Allergeni e categorie ───────── */

// I 7 del Reg. UE 1169/2011 usati in gelateria, nell'ordine della dashboard.
const ALLERGENI = ['Glutine', 'Latte', 'Uova', 'Soia', 'Arachidi', 'Frutta a guscio', 'Solfiti'];

// In colonna il nome va su due righe quando è lungo.
const ETICHETTE = { 'Frutta a guscio': ['Frutta', 'a guscio'] };

// Titoli e sottotitoli sono gli stessi della pagina pubblica
// (CATEGORIE in src/pages/Allergeni.jsx): chi legge il PDF e chi legge il sito
// deve trovare le stesse sezioni con gli stessi nomi.
const CATEGORIE = [
  { key: 'base', titolo: 'Le nostre basi', nota: 'Ogni gusto parte da una di queste basi.' },
  { key: 'crema', titolo: 'Le Creme Classiche', nota: 'Gusti classici lisci, senza variegature.' },
  { key: 'golosone', titolo: 'I Nostri Golosoni', nota: 'Gusti con variegature: biscotti, granelle, creme…' },
  { key: 'frutta-vegan', titolo: 'Linea Frutta e Vegan', nota: 'A base acqua, senza latte né derivati animali.' },
  { key: 'leccornie', titolo: 'Altre Leccornie', nota: 'Pasticcini, torte, salame dolce e le altre specialità del banco.' },
];

// Le tabelle del configuratore torte: stesso significato della colonna
// `allergeni` (allergeni presenti), nessuna colonna per le tracce.
const TABELLE_TORTA = [
  { tabella: 'tipi_torta', titolo: 'Tipi di torta' },
  { tabella: 'basi', titolo: 'Basi della torta' },
  { tabella: 'crumble', titolo: 'Crumble' },
  { tabella: 'farciture', titolo: 'Farciture' },
  { tabella: 'coperture', titolo: 'Coperture' },
  { tabella: 'decorazioni', titolo: 'Decorazioni' },
  { tabella: 'extra', titolo: 'Altri prodotti da ordinare' },
];

const DIETE = [
  { key: 'vegan', sigla: 'V', label: 'Vegan', colore: '#2e9e5b' },
  { key: 'senza_glutine', sigla: 'SG', label: 'Senza glutine', colore: '#c0894c' },
  { key: 'senza_lattosio', sigla: 'SL', label: 'Senza lattosio', colore: '#2c7699' },
  { key: 'senza_zucchero', sigla: 'SZ', label: 'Senza zuccheri aggiunti', colore: '#6b4f9e' },
];

/* ───────── Evidenza degli allergeni nelle liste ingredienti ───────── */

/**
 * Nelle liste ingredienti le parole-allergene vanno in GRASSETTO E
 * SOTTOLINEATE, come nel quaderno impaginato a mano dai titolari — ed è il
 * modo in cui il Reg. 1169/2011 chiede di farle risaltare. L'elenco copre i
 * 14 allergeni di legge e i derivati che hanno un nome tutto loro (panna,
 * burro, mascarpone, tuorlo…): sono le parole che chi ha un'allergia cerca
 * con gli occhi.
 */
const PAROLE_ALLERGENE = new Set([
  // latte e derivati
  'latte', 'lattosio', 'latticello', 'panna', 'burro', 'yogurt', 'quark',
  'mascarpone', 'formaggio', 'caseina', 'caseinati',
  // uova
  'uova', 'uovo', 'albume', 'tuorlo',
  // cereali con glutine
  'glutine', 'grano', 'frumento', 'orzo', 'segale', 'avena', 'farro', 'kamut',
  // soia
  'soia',
  // arachidi e frutta a guscio
  'arachidi', 'arachide', 'mandorle', 'mandorla', 'nocciole', 'nocciola',
  'noci', 'noce', 'pistacchi', 'pistacchio', 'anacardi', 'macadamia', 'pecan',
  'gianduia', 'nutella',
  // gli altri di legge
  'sesamo', 'lupini', 'lupino', 'sedano', 'senape', 'solfiti', 'solforosa',
  'pesce', 'crostacei', 'molluschi',
  // composti che portano glutine e latte (così li scrive il quaderno a mano)
  'wafer', 'wafers',
]);

/**
 * La parola `i` della lista `nude` va evidenziata? Le eccezioni sono i falsi
 * amici: il burro DI CACAO non è latte, il latte DI COCCO nemmeno, la NOCE di
 * cocco e la noce moscata non sono frutta a guscio, il grano SARACENO non ha
 * glutine, e "senza lattosio / senza glutine" è una promessa, non un
 * ingrediente.
 */
function daEvidenziare(parola, nude, i) {
  const w = parola.toLowerCase();
  if (!PAROLE_ALLERGENE.has(w)) {
    // "anidride solforosa": anche "anidride", se la parola dopo è quella
    return w === 'anidride' && nude[i + 1] === 'solforosa';
  }
  if (nude[i - 1] === 'senza') return false;
  if (w === 'burro' && nude[i + 1] === 'di' && nude[i + 2] === 'cacao') return false;
  if (w === 'latte' && nude[i + 1] === 'di' && nude[i + 2] === 'cocco') return false;
  if ((w === 'noce' || w === 'noci')
    && ((nude[i + 1] === 'di' && nude[i + 2] === 'cocco') || nude[i + 1] === 'moscata')) return false;
  if (w === 'grano' && nude[i + 1] === 'saraceno') return false;
  return true;
}

/**
 * Manda a capo un testo come `pdf.spezza`, ma ogni riga esce come elenco di
 * segmenti { t, ev }: quelli con `ev` vanno scritti in grassetto e
 * sottolineati. L'andata a capo tiene conto che il grassetto è più largo,
 * così le righe non sbordano dalla colonna.
 */
function righeConEvidenza(pdf, testo, maxLarghezza, dim) {
  const limite = maxLarghezza * 0.985;
  const atomi = String(testo).split(/\s+/).filter(Boolean);
  // la parola "nuda" di ogni atomo (senza punteggiatura), per i controlli
  // sulla parola prima e dopo
  const nude = atomi.map((a) => {
    const m = a.toLowerCase().match(/[a-zà-ÿ]+/);
    return m ? m[0] : '';
  });
  const spazioW = pdf.larghezzaTesto(' ', dim);
  const righe = [];
  let riga = [];
  let wRiga = 0;
  atomi.forEach((atomo, i) => {
    const seg = atomo.split(/([A-Za-zÀ-ÿ]+)/).filter(Boolean).map((p) => ({
      t: p,
      ev: /[A-Za-zÀ-ÿ]/.test(p) && daEvidenziare(p, nude, i),
    }));
    const wAtomo = seg.reduce((s, x) => s + pdf.larghezzaTesto(x.t, dim, x.ev ? 'b' : 'n'), 0);
    if (riga.length && wRiga + spazioW + wAtomo > limite) {
      righe.push(riga);
      riga = [];
      wRiga = 0;
    }
    if (riga.length) { riga.push({ t: ' ', ev: false }); wRiga += spazioW; }
    riga.push(...seg);
    wRiga += wAtomo;
  });
  if (riga.length) righe.push(riga);
  return righe;
}

/* ───────── Colori del documento (gli stessi del sito) ───────── */

const INCHIOSTRO = '#33291f';
const BLU = '#2c7699';
const AMBRA = '#9a6a2f';
const GRIGIO = '#857c72';
const FILETTO = '#ddd6c9';
const CREMA = '#fbf7ef';

/* ───────── Lettura dei dati ───────── */

const elenco = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
const chiave = (s) => String(s || '').trim().toLowerCase();

/**
 * Come `ripulisci`, ma su un testo di più righe: tiene i capoversi e segnala
 * il rientro. Nel gestionale i sotto-punti (a, b, c…) si scrivono mettendo
 * degli spazi a inizio riga: qui quel rientro diventa esattamente 3 spazi,
 * così chi stampa sa che quella riga va rientrata.
 */
const pulisciMulti = (s) => String(s || '')
  .split('\n')
  .map((r) => (/^[ \t]{2,}/.test(r) ? `   ${ripulisci(r)}` : ripulisci(r)))
  .join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

/**
 * Il logo della gelateria pronto per il PDF: si legge il PNG del sito, lo si
 * appoggia su fondo bianco e lo si converte in JPEG (l'unico formato che il
 * generatore sa incorporare). Se qualcosa non va si torna null e il quaderno
 * esce senza logo, che è meglio che non uscire affatto.
 */
export async function logoPerPdf(src = '/logo.png', maxPx = 900) {
  if (typeof document === 'undefined') return null;
  try {
    const img = await new Promise((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = ko;
      i.src = src;
    });
    const scala = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scala));
    const h = Math.max(1, Math.round(img.naturalHeight * scala));
    const tela = document.createElement('canvas');
    tela.width = w;
    tela.height = h;
    const ctx = tela.getContext('2d');
    ctx.fillStyle = '#ffffff'; // il PNG è trasparente, il PDF no
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = tela.toDataURL('image/jpeg', 0.9);
    const b64 = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
    const byteJpeg = new Uint8Array(b64.length);
    for (let i = 0; i < b64.length; i += 1) byteJpeg[i] = b64.charCodeAt(i);
    return { byteJpeg, larghezzaPx: w, altezzaPx: h };
  } catch {
    return null;
  }
}

/** Legge una tabella intera. Se non esiste (o non è leggibile) torna null. */
async function leggiTabella(tabella) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from(tabella).select('*');
    if (error) return null;
    return data || [];
  } catch {
    return null;
  }
}

const ordinaPer = (righe, campoNome) =>
  [...righe].sort((a, b) => {
    const oa = Number(a.ordine ?? 9999);
    const ob = Number(b.ordine ?? 9999);
    if (oa !== ob) return oa - ob;
    return String(a[campoNome] || '').localeCompare(String(b[campoNome] || ''), 'it');
  });

/**
 * Raccoglie tutto quello che finisce nel quaderno.
 * Torna anche `mancanti`: tabelle non trovate (di solito perché una migrazione
 * non è ancora stata eseguita). Il documento si genera lo stesso, saltandole.
 */
export async function raccogliDati() {
  const gustiRaw = await leggiTabella('allergeni_prodotti');
  if (gustiRaw === null) {
    return { errore: 'Non riesco a leggere i gusti dal gestionale (tabella allergeni_prodotti).' };
  }

  const gusti = ordinaPer(gustiRaw.filter((r) => r.attivo !== false), 'gusto').map((r) => {
    const certi = elenco(r.allergeni_certi);
    const tracce = elenco(r.allergeni_tracce);
    const categoria = chiave(r.categoria) || 'altro';
    return {
      nome: ripulisci(r.gusto),
      categoria,
      descrizione: ripulisci(r.descrizione || ''),
      ingredienti: ripulisci(r.ingredienti || ''),
      certi,
      tracce,
      // Per i gelati la casella vuota vuol dire davvero "nessun allergene". Per
      // le altre leccornie i titolari non li hanno indicati: non si può
      // dichiarare un'assenza che nessuno ha verificato.
      nonDichiarati: categoria === 'leccornie' && !certi.length && !tracce.length,
      diete: DIETE.filter((d) => r[d.key] === true).map((d) => d.sigla),
    };
  });

  const sezioniTorta = [];
  const mancanti = [];
  for (const t of TABELLE_TORTA) {
    // Volutamente in sequenza: sono 7 letture piccole e l'ordine conta poco,
    // ma così un errore su una non porta con sé le altre.
    // eslint-disable-next-line no-await-in-loop
    const righe = await leggiTabella(t.tabella);
    if (righe === null) {
      mancanti.push(t.tabella);
      continue;
    }
    const voci = ordinaPer(righe.filter((r) => r.attivo !== false), 'nome')
      .map((r) => ({
        nome: ripulisci(r.nome),
        descrizione: ripulisci(r.descrizione || ''),
        ingredienti: '',
        certi: elenco(r.allergeni),
        tracce: [],
        diete: [],
      }))
      .filter((v) => v.nome);
    if (voci.length) sezioniTorta.push({ titolo: t.titolo, voci });
  }

  // Testi fissi e glossario additivi (migrazione 2026-08-05-quaderno-testi-e-additivi).
  // Se le tabelle non ci sono il quaderno esce lo stesso, senza quelle parti.
  const testiRaw = await leggiTabella('quaderno_testi');
  if (testiRaw === null) mancanti.push('quaderno_testi');
  const testi = ordinaPer((testiRaw || []).filter((r) => r.attivo !== false), 'chiave').map((r) => ({
    chiave: String(r.chiave || ''),
    titolo: ripulisci(r.titolo || ''),
    testo: pulisciMulti(r.testo || ''),
    posizione: chiave(r.posizione) || 'apertura',
  })).filter((t) => t.titolo || t.testo);

  const additiviRaw = await leggiTabella('additivi');
  if (additiviRaw === null) mancanti.push('additivi');
  const additivi = ordinaPer((additiviRaw || []).filter((r) => r.attivo !== false), 'codice').map((r) => ({
    codice: ripulisci(r.codice || ''),
    nome: ripulisci(r.nome || ''),
    descrizione: ripulisci(r.descrizione || ''),
  })).filter((a) => a.codice);

  const logo = await logoPerPdf();

  return { gusti, sezioniTorta, testi, additivi, logo, mancanti, errore: null };
}

/**
 * Impronta dei dati che finiscono nel PDF: se cambia, il documento pubblicato
 * non è più allineato al gestionale. Non è crittografica, serve solo a
 * riconoscere una modifica.
 */
export function improntaDati(dati) {
  if (!dati || dati.errore) return '';
  const voce = (v) => [v.nome, v.descrizione, v.ingredienti, v.certi.join('|'), v.tracce.join('|'), v.diete.join('|')];
  const canonico = JSON.stringify([
    VERSIONE_DOC,
    (dati.gusti || []).map((g) => [g.categoria, ...voce(g)]),
    (dati.sezioniTorta || []).map((s) => [s.titolo, s.voci.map(voce)]),
    (dati.testi || []).map((t) => [t.chiave, t.posizione, t.titolo, t.testo]),
    (dati.additivi || []).map((a) => [a.codice, a.nome, a.descrizione]),
  ]);
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < canonico.length; i += 1) {
    const c = canonico.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ (c + i), 0x85ebca6b);
  }
  const hex = (n) => (n >>> 0).toString(16).padStart(8, '0');
  return hex(a) + hex(b);
}

/* ───────── Costruzione del PDF ───────── */

const due = (n) => String(n).padStart(2, '0');
const dataIt = (d) => `${due(d.getDate())}/${due(d.getMonth() + 1)}/${d.getFullYear()}`;

/** Nome del file, con la data dentro: nello storage le versioni restano in ordine. */
export function nomeFile(quando = new Date()) {
  return `quaderno-allergeni-${quando.getFullYear()}-${due(quando.getMonth() + 1)}-${due(quando.getDate())}.pdf`;
}

/**
 * Costruisce il documento. `dati` è quello che torna da raccogliDati().
 * Torna { blob, nome, pagine }.
 */
export function generaQuaderno(dati, { quando = new Date() } = {}) {
  const pdf = nuovoPdf();
  const M = 42;
  const LARG = pdf.larghezza - M * 2;
  const FONDO = pdf.altezza - 58; // sotto questa quota si va a pagina nuova

  // Colonne della matrice: nome, un allergene per colonna, diete.
  const colonne = ALLERGENI.slice();
  // Se qualcuno ha scritto a mano un allergene fuori elenco, deve comparire
  // lo stesso: un documento di sicurezza non può perdere per strada un dato.
  const noti = new Set(colonne.map(chiave));
  const tutteLeVoci = [...(dati.gusti || []), ...(dati.sezioniTorta || []).flatMap((s) => s.voci)];
  tutteLeVoci.forEach((v) => {
    [...(v.certi || []), ...(v.tracce || [])].forEach((a) => {
      if (!noti.has(chiave(a))) { noti.add(chiave(a)); colonne.push(a); }
    });
  });

  // La colonna del prodotto è la più larga perché ci sta dentro la lista
  // completa degli ingredienti: è quella che legge chi ha un'allergia, non
  // può essere tagliata. Alle colonne degli allergeni bastano ~30 punti
  // (l'etichetta più lunga, "Arachidi", ne misura 26).
  const W_DIETA = 58;
  const W_NOME = Math.max(150, LARG - W_DIETA - colonne.length * 30);
  const W_ALL = (LARG - W_NOME - W_DIETA) / colonne.length;

  let y = 0;
  const xColonna = (i) => M + W_NOME + i * W_ALL;

  /* ── testate e piè di pagina ── */

  function testataPrima() {
    y = 52;
    pdf.testo('QUADERNO INGREDIENTI E ALLERGENI', M, y, { dim: 7.5, font: 'b', colore: '#c0894c', spaziatura: 1.4 });
    y += 26;
    pdf.testo(GELATERIA.nome, M, y, { dim: 24, font: 'b', colore: INCHIOSTRO });
    y += 14;
    pdf.testo(`${GELATERIA.ragioneSociale} — P.IVA ${GELATERIA.piva}`, M, y, { dim: 9, colore: GRIGIO });
    y += 11;
    pdf.testo(`${GELATERIA.indirizzo} · Tel. ${GELATERIA.telefono}`, M, y, { dim: 9, colore: GRIGIO });
    pdf.testo(`Aggiornato al ${dataIt(quando)}`, M + LARG, y - 11, { dim: 9, font: 'b', colore: BLU, allinea: 'dx' });
    pdf.testo('Reg. (UE) n. 1169/2011', M + LARG, y, { dim: 9, colore: GRIGIO, allinea: 'dx' });
    y += 10;
    pdf.linea(M, y, M + LARG, y, { colore: INCHIOSTRO, spessore: 1.4 });
    y += 22;
  }

  function testataSeguenti() {
    y = 40;
    pdf.testo(`Quaderno Ingredienti e Allergeni — ${GELATERIA.nome}`, M, y, { dim: 7.5, colore: GRIGIO });
    pdf.testo(dataIt(quando), M + LARG, y, { dim: 7.5, colore: GRIGIO, allinea: 'dx' });
    y += 5;
    pdf.linea(M, y, M + LARG, y, { colore: FILETTO, spessore: 0.6 });
    y += 20;
  }

  function paginaNuova() {
    pdf.nuovaPagina();
    testataSeguenti();
  }

  /** Assicura `serve` punti di spazio, altrimenti cambia pagina. */
  function spazio(serve) {
    if (y + serve > FONDO) paginaNuova();
  }

  const testiDi = (posizione) => (dati.testi || []).filter((t) => t.posizione === posizione);

  /* ── copertina ── */

  /**
   * Prima pagina: logo, insegna, ragione sociale e i testi di presentazione
   * scritti dai titolari (scheda "Testi del quaderno", posizione "copertina").
   */
  function copertina() {
    y = 70;
    if (dati.logo) {
      const n = pdf.registraJpeg(dati.logo.byteJpeg, dati.logo.larghezzaPx, dati.logo.altezzaPx);
      const maxL = 230;
      const maxA = 190;
      const scala = Math.min(maxL / dati.logo.larghezzaPx, maxA / dati.logo.altezzaPx);
      const w = dati.logo.larghezzaPx * scala;
      const h = dati.logo.altezzaPx * scala;
      pdf.immagine(n, M + (LARG - w) / 2, y, w, h);
      y += h + 26;
    }

    pdf.testo('QUADERNO INGREDIENTI E ALLERGENI', M + LARG / 2, y, {
      dim: 8.5, font: 'b', colore: '#c0894c', allinea: 'centro', spaziatura: 2,
    });
    y += 30;
    pdf.testo(GELATERIA.nome, M + LARG / 2, y, { dim: 27, font: 'b', colore: INCHIOSTRO, allinea: 'centro' });
    y += 12;

    const claim = testiDi('copertina').find((t) => t.chiave === 'claim');
    if (claim?.testo) {
      y += 12;
      pdf.testo(claim.testo, M + LARG / 2, y, { dim: 11, font: 'i', colore: BLU, allinea: 'centro' });
      y += 6;
    }

    y += 18;
    pdf.linea(M + 60, y, M + LARG - 60, y, { colore: FILETTO, spessore: 0.8 });
    y += 18;
    pdf.testo(GELATERIA.ragioneSociale, M + LARG / 2, y, { dim: 10, font: 'b', colore: INCHIOSTRO, allinea: 'centro' });
    y += 13;
    pdf.testo(GELATERIA.indirizzo, M + LARG / 2, y, { dim: 9, colore: GRIGIO, allinea: 'centro' });
    y += 12;
    pdf.testo(`P.IVA ${GELATERIA.piva} · Tel. ${GELATERIA.telefono}`, M + LARG / 2, y, { dim: 9, colore: GRIGIO, allinea: 'centro' });
    y += 8;
    pdf.linea(M + 60, y, M + LARG - 60, y, { colore: FILETTO, spessore: 0.8 });
    y += 30;

    // Data e riferimento di legge si disegnano ORA, in fondo a questa pagina:
    // se i titolari scrivono un testo lunghissimo e la copertina va a capo,
    // devono restare comunque sulla copertina.
    pdf.testo(`Aggiornato al ${dataIt(quando)}`, M + LARG / 2, FONDO - 6, {
      dim: 9, font: 'b', colore: BLU, allinea: 'centro',
    });
    pdf.testo('Redatto ai sensi del Regolamento (UE) n. 1169/2011', M + LARG / 2, FONDO + 8, {
      dim: 8, colore: GRIGIO, allinea: 'centro',
    });

    // I testi liberi possono essere lunghi a piacere: si va a pagina nuova
    // invece di stampare sopra al piè di pagina.
    const limite = FONDO - 26; // sopra la data in fondo alla copertina
    let inCopertina = true;
    const rigaCopertina = (passo) => {
      if (inCopertina ? y + passo > limite : y + passo > FONDO) {
        paginaNuova();
        inCopertina = false;
      }
    };

    testiDi('copertina').filter((t) => t.chiave !== 'claim').forEach((t) => {
      if (t.titolo) {
        rigaCopertina(18);
        pdf.testo(t.titolo.toUpperCase(), M + LARG / 2, y, {
          dim: 8.5, font: 'b', colore: BLU, allinea: 'centro', spaziatura: 1.2,
        });
        y += 18;
      }
      pdf.spezza(t.testo, LARG - 90, 9).forEach((r) => {
        rigaCopertina(13);
        pdf.testo(r, M + LARG / 2, y, { dim: 9, colore: INCHIOSTRO, allinea: 'centro' });
        y += 13;
      });
      y += 14;
    });
    return inCopertina;
  }

  /* ── testi liberi scritti dai titolari ── */

  /**
   * Manda a capo tenendo la prima riga più corta: serve per far partire il
   * testo dopo un attacco in grassetto ("1. Cereali contenenti glutine:").
   */
  function spezzaDopoAttacco(testo, largPrima, largResto, dim) {
    const righe = [];
    let riga = '';
    let larg = largPrima;
    for (const parola of String(testo).split(/\s+/).filter(Boolean)) {
      const prova = riga ? `${riga} ${parola}` : parola;
      if (pdf.larghezzaTesto(prova, dim) <= larg * 0.985 || !riga) riga = prova;
      else { righe.push(riga); riga = parola; larg = largResto; }
    }
    if (riga) righe.push(riga);
    return righe;
  }

  function bloccoTesto(t) {
    spazio(70);
    y += 18;
    if (t.titolo) {
      pdf.testo(t.titolo, M, y, { dim: 12.5, font: 'b', colore: INCHIOSTRO });
      y += 4;
      pdf.linea(M, y, M + 34, y, { colore: '#c0894c', spessore: 2 });
      y += 15;
    }

    String(t.testo || '').split('\n').forEach((rigaGrezza) => {
      if (!rigaGrezza.trim()) { y += 5; return; }
      const rientro = /^ {2,}/.test(rigaGrezza);
      const riga = rigaGrezza.trim();
      const dim = rientro ? 7.6 : 8.4;
      const passo = rientro ? 10.4 : 11.6;
      const x = M + (rientro ? 20 : 0);
      const larg = LARG - (rientro ? 20 : 0);
      const colore = rientro ? GRIGIO : INCHIOSTRO;

      // "1. Cereali contenenti glutine, cioè:" -> attacco in grassetto
      const num = /^(\d+\.\s+[^,:;.]{2,60}[,:;.])\s*([\s\S]*)$/.exec(riga);
      if (num && !rientro) {
        const attacco = num[1];
        const wAtt = pdf.larghezzaTesto(attacco, dim, 'b');
        const resto = spezzaDopoAttacco(num[2], larg - wAtt - 4, larg, dim);
        spazio(passo);
        pdf.testo(attacco, x, y, { dim, font: 'b', colore: INCHIOSTRO });
        if (resto[0]) pdf.testo(resto[0], x + wAtt + 4, y, { dim, colore });
        y += passo;
        resto.slice(1).forEach((r) => {
          spazio(passo);
          pdf.testo(r, x, y, { dim, colore });
          y += passo;
        });
        return;
      }

      pdf.spezza(riga, larg, dim).forEach((r) => {
        spazio(passo);
        pdf.testo(r, x, y, { dim, colore });
        y += passo;
      });
    });
    y += 8;
  }

  /* ── glossario additivi ── */

  function glossarioAdditivi() {
    const voci = dati.additivi || [];
    if (!voci.length) return;
    const W_COD = 52;
    const W_NOMEADD = 132;
    const W_DESC = LARG - W_COD - W_NOMEADD - 24;

    // Introduzione scritta dai titolari (scheda "Testi del quaderno",
    // posizione "glossario"); se manca resta una frase di servizio.
    const intro = (dati.testi || []).find((t) => t.posizione === 'glossario');

    spazio(120);
    y += 18;
    pdf.testo((intro?.titolo || 'Glossario degli additivi').toUpperCase(), M, y, {
      dim: 8, font: 'b', colore: '#c0894c', spaziatura: 1.2,
    });
    y += 12;
    const testoIntro = intro?.testo
      || 'Le sigle che compaiono nelle liste degli ingredienti, spiegate una per una.';
    pdf.spezza(testoIntro, LARG, 7.8).forEach((r) => {
      pdf.testo(r, M, y, { dim: 7.8, colore: GRIGIO });
      y += 10;
    });
    y += 6;

    const intestazione = () => {
      pdf.rettangolo(M, y, LARG, 20, { pieno: '#eef4f7' });
      pdf.testo('SIGLA', M + 9, y + 13, { dim: 7, font: 'b', colore: BLU, spaziatura: 0.6 });
      pdf.testo('NOME', M + W_COD + 12, y + 13, { dim: 7, font: 'b', colore: BLU, spaziatura: 0.6 });
      pdf.testo('A COSA SERVE', M + W_COD + W_NOMEADD + 24, y + 13, { dim: 7, font: 'b', colore: BLU, spaziatura: 0.6 });
      pdf.linea(M, y + 20, M + LARG, y + 20, { colore: BLU, spessore: 1 });
      y += 20;
    };
    intestazione();

    voci.forEach((a, i) => {
      const righeNome = pdf.spezza(a.nome || '—', W_NOMEADD, 8, 'b');
      const righeDesc = a.descrizione ? pdf.spezza(a.descrizione, W_DESC, 7.6) : [];
      const h = Math.max(22, 11 + Math.max(righeNome.length * 10, righeDesc.length * 9.4) + 7);
      if (y + h > FONDO) { paginaNuova(); intestazione(); }
      if (i % 2 === 1) pdf.rettangolo(M, y, LARG, h, { pieno: CREMA });
      pdf.testo(a.codice, M + 9, y + 13, { dim: 8, font: 'b', colore: BLU });
      let ny = y + 13;
      righeNome.forEach((r) => { pdf.testo(r, M + W_COD + 12, ny, { dim: 8, font: 'b', colore: INCHIOSTRO }); ny += 10; });
      let dy = y + 12.5;
      righeDesc.forEach((r) => { pdf.testo(r, M + W_COD + W_NOMEADD + 24, dy, { dim: 7.6, colore: '#5f574d' }); dy += 9.4; });
      pdf.linea(M, y + h, M + LARG, y + h, { colore: FILETTO, spessore: 0.5 });
      y += h;
    });
    y += 8;
  }

  /* ── blocchi della prima pagina ── */

  function riquadroAvviso() {
    const testo =
      "Tutti i prodotti sono realizzati artigianalmente nello stesso laboratorio e con le stesse attrezzature: non è possibile garantire l'assenza assoluta di contaminazioni crociate. Ogni prodotto può quindi contenere tracce di glutine, latte, uova, soia, frutta a guscio e arachidi anche quando questi non compaiono fra gli ingredienti dichiarati.";
    const righe = pdf.spezza(testo, LARG - 26, 8.2);
    const h = 30 + righe.length * 10.5;
    spazio(h + 18); // un riquadro non si spezza: o ci sta, o va a pagina nuova
    pdf.rettangolo(M, y, LARG, h, { pieno: '#fbf1e3', bordo: '#e6cba4', spessore: 0.8 });
    pdf.testo('AVVISO IMPORTANTE — CONTAMINAZIONI CROCIATE', M + 13, y + 17, { dim: 7.6, font: 'b', colore: AMBRA, spaziatura: 0.5 });
    righe.forEach((r, i) => pdf.testo(r, M + 13, y + 31 + i * 10.5, { dim: 8.2, colore: INCHIOSTRO }));
    y += h + 18;
  }

  function legenda() {
    const h = 54;
    spazio(h + 20);
    pdf.rettangolo(M, y, LARG, h, { pieno: CREMA, bordo: FILETTO, spessore: 0.6 });
    pdf.testo('COME SI LEGGE LA TABELLA', M + 13, y + 15, { dim: 7.2, font: 'b', colore: GRIGIO, spaziatura: 0.5 });

    // Simboli
    let x = M + 13;
    pdf.cerchio(x + 3, y + 30, 3, { pieno: BLU });
    pdf.testo('contiene questo allergene', x + 11, y + 32.5, { dim: 8, colore: INCHIOSTRO });
    x += 11 + pdf.larghezzaTesto('contiene questo allergene', 8) + 20;
    pdf.cerchio(x + 3, y + 30, 3, { bordo: AMBRA, spessore: 1 });
    pdf.testo('può contenerne tracce', x + 11, y + 32.5, { dim: 8, colore: INCHIOSTRO });
    x += 11 + pdf.larghezzaTesto('può contenerne tracce', 8) + 20;
    pdf.linea(x, y + 30, x + 6, y + 30, { colore: '#c9c2b6', spessore: 1 });
    pdf.testo('assente', x + 11, y + 32.5, { dim: 8, colore: INCHIOSTRO });

    // Sigle dieta
    let xd = M + 13;
    DIETE.forEach((d) => {
      const w = pdf.larghezzaTesto(d.sigla, 6.4, 'b') + 8;
      pdf.pillola(xd, y + 39, w, 10, { bordo: d.colore, spessore: 0.7 });
      pdf.testo(d.sigla, xd + w / 2, y + 46.5, { dim: 6.4, font: 'b', colore: d.colore, allinea: 'centro' });
      pdf.testo(d.label, xd + w + 4, y + 46.5, { dim: 7.6, colore: GRIGIO });
      xd += w + 6 + pdf.larghezzaTesto(d.label, 7.6) + 14;
    });

    y += h + 14;
  }

  // Qui c'era un riquadro che spiegava da dove arrivava il documento
  // ("Questo quaderno è generato dal gestionale…"). Tolto su indicazione dei
  // titolari: il quaderno è quello che legge il cliente, non deve raccontare
  // come è fatto dietro. Se un giorno servisse un testo del genere si scrive
  // dal gestionale, scheda "Testi del quaderno", posizione "Prima delle
  // tabelle" — senza rimettere mano al codice.

  /* ── tabella ── */

  function intestazioneTabella() {
    const h = 26;
    pdf.rettangolo(M, y, LARG, h, { pieno: '#eef4f7' });
    pdf.testo('PRODOTTO', M + 9, y + 16, { dim: 7, font: 'b', colore: BLU, spaziatura: 0.6 });
    colonne.forEach((a, i) => {
      const cx = xColonna(i) + W_ALL / 2;
      const parti = ETICHETTE[a] || [a];
      const base = parti.length > 1 ? y + 12 : y + 16;
      parti.forEach((p, k) => {
        pdf.testo(p, cx, base + k * 8, { dim: 6.4, font: 'b', colore: BLU, allinea: 'centro' });
      });
    });
    pdf.testo('DIETA', M + LARG - W_DIETA / 2, y + 16, { dim: 7, font: 'b', colore: BLU, allinea: 'centro', spaziatura: 0.6 });
    pdf.linea(M, y + h, M + LARG, y + h, { colore: BLU, spessore: 1 });
    y += h;
  }

  function segno(v, cx, cy) {
    if (v === 'certo') pdf.cerchio(cx, cy, 2.9, { pieno: BLU });
    else if (v === 'traccia') pdf.cerchio(cx, cy, 2.9, { bordo: AMBRA, spessore: 1.1 });
    else pdf.linea(cx - 3, cy, cx + 3, cy, { colore: '#cfc8bb', spessore: 0.9 });
  }

  /**
   * Tiene al massimo `max` righe e, se ne ha tolte, chiude con i puntini:
   * un testo troncato deve vedersi che è troncato.
   */
  function tronca(righe, max) {
    if (righe.length <= max) return righe;
    const tenute = righe.slice(0, max);
    tenute[max - 1] = `${tenute[max - 1].replace(/[ ,;.]+$/, '')}…`;
    return tenute;
  }

  /** Disegna una voce. Torna l'altezza usata. */
  function rigaVoce(voce, pari) {
    const larghNome = W_NOME - 18;
    const certiVoce = Array.isArray(voce.certi) ? voce.certi : [];
    const tracceVoce = Array.isArray(voce.tracce) ? voce.tracce : [];
    const dieteVoce = Array.isArray(voce.diete) ? voce.diete : [];
    const righeNome = pdf.spezza(voce.nome || '—', larghNome, 8.8, 'b');
    // Gli ingredienti si scrivono per intero: sono il dato di sicurezza.
    // Le parole-allergene escono in grassetto e sottolineate (vedi
    // righeConEvidenza), come nel quaderno impaginato a mano.
    // La descrizione (testo di vetrina) compare solo quando non ci sono
    // ingredienti, così la riga non resta spoglia ma non ruba spazio a loro.
    const tutteIngr = voce.ingredienti ? righeConEvidenza(pdf, voce.ingredienti, larghNome, 6.7) : [];
    const righeIngr = tutteIngr.slice(0, 8);
    if (tutteIngr.length > righeIngr.length) {
      // un testo troncato deve vedersi che è troncato
      righeIngr[righeIngr.length - 1] = [...righeIngr[righeIngr.length - 1], { t: '…', ev: false }];
    }
    const righeDesc = !righeIngr.length && voce.descrizione
      ? tronca(pdf.spezza(voce.descrizione, larghNome, 6.8, 'i'), 3)
      : [];
    const h = Math.max(
      26,
      13 + righeNome.length * 10.4 + righeDesc.length * 8.2 + righeIngr.length * 8.4 + 6,
    );

    if (y + h > FONDO) {
      paginaNuova();
      intestazioneTabella();
    }

    if (pari) pdf.rettangolo(M, y, LARG, h, { pieno: CREMA });

    // Filetti verticali fra le colonne
    pdf.linea(M + W_NOME, y, M + W_NOME, y + h, { colore: FILETTO, spessore: 0.4 });
    colonne.forEach((_, i) => {
      if (i === 0) return;
      pdf.linea(xColonna(i), y, xColonna(i), y + h, { colore: '#eee8dc', spessore: 0.35 });
    });
    pdf.linea(M + LARG - W_DIETA, y, M + LARG - W_DIETA, y + h, { colore: FILETTO, spessore: 0.4 });

    // Nome, descrizione, ingredienti
    let ty = y + 13;
    righeNome.forEach((r) => { pdf.testo(r, M + 9, ty, { dim: 8.8, font: 'b', colore: INCHIOSTRO }); ty += 10.4; });
    righeDesc.forEach((r) => { pdf.testo(r, M + 9, ty + 1, { dim: 6.8, font: 'i', colore: GRIGIO }); ty += 8.2; });
    righeIngr.forEach((segmenti) => {
      let tx = M + 9;
      segmenti.forEach((s) => {
        const font = s.ev ? 'b' : 'n';
        const w = pdf.larghezzaTesto(s.t, 6.7, font);
        pdf.testo(s.t, tx, ty + 1.5, { dim: 6.7, font, colore: s.ev ? INCHIOSTRO : '#5f574d' });
        // la sottolineatura: una riga sottile appena sotto la base del testo
        if (s.ev) pdf.linea(tx, ty + 3, tx + w, ty + 3, { colore: INCHIOSTRO, spessore: 0.5 });
        tx += w;
      });
      ty += 8.4;
    });

    // Pallini (o l'avviso, se nessuno ha ancora dichiarato gli allergeni)
    const cy = y + 12;
    if (voce.nonDichiarati) {
      const centro = M + W_NOME + (colonne.length * W_ALL) / 2;
      pdf.testo('Allergeni non dichiarati — chiedere al personale', centro, cy + 2.6, {
        dim: 6.8, font: 'i', colore: AMBRA, allinea: 'centro',
      });
    } else {
      const certi = new Set(certiVoce.map(chiave));
      const tracce = new Set(tracceVoce.map(chiave));
      colonne.forEach((a, i) => {
        const k = chiave(a);
        segno(certi.has(k) ? 'certo' : tracce.has(k) ? 'traccia' : '', xColonna(i) + W_ALL / 2, cy);
      });
    }

    // Sigle dieta (a capo se non ci stanno)
    if (dieteVoce.length) {
      let dx = M + LARG - W_DIETA + 5;
      let dy = y + 7;
      dieteVoce.forEach((sigla) => {
        const d = DIETE.find((x) => x.sigla === sigla);
        const w = pdf.larghezzaTesto(sigla, 6, 'b') + 7;
        if (dx + w > M + LARG - 4) { dx = M + LARG - W_DIETA + 5; dy += 12; }
        if (dy + 10 <= y + h) {
          pdf.pillola(dx, dy, w, 9.5, { bordo: d?.colore || GRIGIO, spessore: 0.7 });
          pdf.testo(sigla, dx + w / 2, dy + 7, { dim: 6, font: 'b', colore: d?.colore || GRIGIO, allinea: 'centro' });
        }
        dx += w + 3;
      });
    }

    pdf.linea(M, y + h, M + LARG, y + h, { colore: FILETTO, spessore: 0.5 });
    y += h;
  }

  function titoloSezione(titolo, nota) {
    spazio(nota ? 96 : 84);
    y += 16;
    pdf.testo(titolo, M, y, { dim: 13, font: 'b', colore: INCHIOSTRO });
    y += 4;
    pdf.linea(M, y, M + 34, y, { colore: '#c0894c', spessore: 2 });
    if (nota) {
      y += 12;
      pdf.testo(nota, M, y, { dim: 7.8, colore: GRIGIO });
    }
    y += 12;
  }

  function tabella(voci) {
    intestazioneTabella();
    voci.forEach((v, i) => rigaVoce(v, i % 2 === 1));
    y += 8;
  }

  /* ── il documento ── */

  // Copertina (solo se i titolari hanno scritto qualcosa o c'è il logo:
  // altrimenti si parte subito con la testata compatta, come prima).
  const conCopertina = !!dati.logo || testiDi('copertina').length > 0;
  if (conCopertina) {
    // Se la copertina è già traboccata su una seconda pagina non se ne apre
    // un'altra: si prosegue da lì.
    if (copertina()) paginaNuova();
  } else {
    testataPrima();
  }

  // Testi di apertura: filosofia, elenco di legge dei 14 allergeni, guida.
  testiDi('apertura').forEach(bloccoTesto);
  if (testiDi('apertura').length) y += 6;

  riquadroAvviso();
  legenda();

  // Gusti, raggruppati per categoria. Le categorie fuori elenco non si perdono:
  // finiscono in fondo col loro nome così come è scritto in database.
  const perCategoria = new Map();
  (dati.gusti || []).forEach((g) => {
    // La categoria può arrivare vuota o nulla da una riga compilata a metà:
    // in un documento di sicurezza il gusto deve comparire lo stesso.
    const cat = chiave(g.categoria) || 'altro';
    if (!perCategoria.has(cat)) perCategoria.set(cat, []);
    perCategoria.get(cat).push(g);
  });
  const ordine = [
    ...CATEGORIE.filter((c) => perCategoria.has(c.key)),
    ...[...perCategoria.keys()]
      .filter((k) => !CATEGORIE.some((c) => c.key === k))
      .map((k) => ({ key: k, titolo: k.charAt(0).toUpperCase() + k.slice(1).replace(/-/g, ' '), nota: '' })),
  ];

  if (ordine.length) {
    pdf.testo('GELATI E PRODOTTI DI GELATERIA', M, y, { dim: 8, font: 'b', colore: '#c0894c', spaziatura: 1.2 });
    y += 6;
  }
  ordine.forEach((c) => {
    titoloSezione(c.titolo, c.nota);
    tabella(perCategoria.get(c.key));
  });

  // Componenti delle torte su misura
  if ((dati.sezioniTorta || []).length) {
    spazio(120);
    y += 12;
    pdf.testo('TORTE SU MISURA — COMPONENTI', M, y, { dim: 8, font: 'b', colore: '#c0894c', spaziatura: 1.2 });
    y += 12;
    pdf.spezza(
      "Elementi che il cliente compone nel configuratore delle torte. Per questi la scheda riporta solo gli allergeni presenti: valgono comunque le tracce indicate nell'avviso in prima pagina.",
      LARG, 7.8,
    ).forEach((r) => { pdf.testo(r, M, y, { dim: 7.8, colore: GRIGIO }); y += 10; });
    y -= 6;
    dati.sezioniTorta.forEach((s) => {
      titoloSezione(s.titolo, '');
      tabella(s.voci);
    });
  }

  glossarioAdditivi();
  testiDi('chiusura').forEach(bloccoTesto);

  // Chiusura: una riga sola, senza riquadro, così non porta mai via un foglio
  // solo per sé (il "da dove arriva" sta in prima pagina).
  spazio(26);
  y += 16;
  pdf.testo('— Fine del quaderno —', M + LARG / 2, y, { dim: 7.6, font: 'i', colore: GRIGIO, allinea: 'centro' });

  /* ── piè di pagina su tutte le pagine ── */

  const tot = pdf.numeroPagine;
  for (let i = 0; i < tot; i += 1) {
    pdf.vaiA(i);
    const yy = pdf.altezza - 34;
    pdf.linea(M, yy - 10, M + LARG, yy - 10, { colore: FILETTO, spessore: 0.5 });
    pdf.testo(
      // Al cliente serve sapere quanto è aggiornato il documento, non da quale
      // programma esce: l'ora e il "generato dal gestionale" restano nello
      // storico delle versioni, dentro al gestionale.
      `${GELATERIA.nome} — aggiornato al ${dataIt(quando)}`,
      M, yy, { dim: 7, colore: GRIGIO },
    );
    pdf.testo(`Pagina ${i + 1} di ${tot}`, M + LARG, yy, { dim: 7, font: 'b', colore: GRIGIO, allinea: 'dx' });
  }

  return { blob: pdf.blob(), nome: nomeFile(quando), pagine: tot };
}
