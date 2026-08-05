/**
 * Generatore PDF minimale, senza dipendenze esterne.
 *
 * Serve a costruire il Quaderno Ingredienti e Allergeni partendo dai dati del
 * gestionale (vedi src/lib/quadernoPdf.js). È volutamente piccolo: sa scrivere
 * testo, righe, rettangoli e cerchietti — cioè tutto quello che serve a una
 * tabella allergeni — e niente di più.
 *
 * Perché non una libreria: il PDF si genera solo dentro il gestionale, e una
 * libreria da ~350 KB avrebbe pesato su ogni build e su ogni deploy per un
 * documento che è solo testo e filetti.
 *
 * Font: i 3 "standard 14" (Helvetica normale/grassetto/corsivo). Non vanno
 * incorporati nel file, li ha già ogni lettore PDF. Codifica WinAnsi: copre
 * tutte le lettere accentate italiane (à è é ì ò ù), l'euro e le virgolette
 * tipografiche. Le emoji non esistono in questi font e vengono tolte.
 *
 * Coordinate: origine in ALTO A SINISTRA e y che cresce verso il basso (come
 * sullo schermo). La conversione al sistema del PDF (origine in basso) è
 * interna, così il codice del layout si legge nell'ordine in cui si stampa.
 */

/* ───────── Misure dei font (AFM Adobe, millesimi di em) ───────── */

// Larghezze dei caratteri ASCII 32-126.
const W_NORMALE = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const W_GRASSETTO = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/**
 * WinAnsi: i codici 0x80-0x9F non seguono Unicode. Qui ci sono i caratteri di
 * quella fascia che possono davvero comparire nei testi scritti dallo staff
 * (virgolette e trattini "belli" che Word e il telefono inseriscono da soli).
 */
const WINANSI_SPECIALI = {
  '€': 0x80, // €
  '‚': 0x82,
  'ƒ': 0x83,
  '„': 0x84,
  '…': 0x85, // …
  '†': 0x86,
  '‡': 0x87,
  'ˆ': 0x88,
  '‰': 0x89,
  'Š': 0x8a,
  '‹': 0x8b,
  'Œ': 0x8c,
  'Ž': 0x8e,
  '‘': 0x91, // '
  '’': 0x92, // '
  '“': 0x93, // "
  '”': 0x94, // "
  '•': 0x95, // •
  '–': 0x96, // –
  '—': 0x97, // —
  '˜': 0x98,
  '™': 0x99,
  'š': 0x9a,
  '›': 0x9b,
  'œ': 0x9c,
  'ž': 0x9e,
  'Ÿ': 0x9f,
};

/**
 * Per i caratteri sopra 127 la larghezza è quella della lettera "base"
 * (in Helvetica À è largo come A, è come e, e così via).
 */
const BASE_ACCENTATE = {
  0xc0: 'A', 0xc1: 'A', 0xc2: 'A', 0xc3: 'A', 0xc4: 'A', 0xc5: 'A',
  0xc7: 'C', 0xc8: 'E', 0xc9: 'E', 0xca: 'E', 0xcb: 'E',
  0xcc: 'I', 0xcd: 'I', 0xce: 'I', 0xcf: 'I', 0xd1: 'N',
  0xd2: 'O', 0xd3: 'O', 0xd4: 'O', 0xd5: 'O', 0xd6: 'O', 0xd8: 'O',
  0xd9: 'U', 0xda: 'U', 0xdb: 'U', 0xdc: 'U', 0xdd: 'Y',
  0xe0: 'a', 0xe1: 'a', 0xe2: 'a', 0xe3: 'a', 0xe4: 'a', 0xe5: 'a',
  0xe7: 'c', 0xe8: 'e', 0xe9: 'e', 0xea: 'e', 0xeb: 'e',
  0xec: 'i', 0xed: 'i', 0xee: 'i', 0xef: 'i', 0xf1: 'n',
  0xf2: 'o', 0xf3: 'o', 0xf4: 'o', 0xf5: 'o', 0xf6: 'o', 0xf8: 'o',
  0xf9: 'u', 0xfa: 'u', 0xfb: 'u', 0xfc: 'u', 0xfd: 'y', 0xff: 'y',
};

/** Un carattere qualsiasi -> il suo byte WinAnsi, oppure -1 se non stampabile. */
function byteWinAnsi(ch) {
  const c = ch.codePointAt(0);
  if (c === 9) return 32; // tab -> spazio
  if (c >= 32 && c <= 126) return c;
  if (c === 0xa0) return 32; // spazio unificatore -> spazio normale
  if (c >= 0xa1 && c <= 0xff) return c;
  const sp = WINANSI_SPECIALI[ch];
  if (sp) return sp;
  return -1; // emoji e simili: non esistono in Helvetica
}

/** Larghezza di un byte WinAnsi, in millesimi di em. */
function larghezzaByte(b, grassetto) {
  const tab = grassetto ? W_GRASSETTO : W_NORMALE;
  if (b >= 32 && b <= 126) return tab[b - 32];
  const base = BASE_ACCENTATE[b];
  if (base) return tab[base.charCodeAt(0) - 32];
  if (b === 0x80) return grassetto ? 556 : 556; // €
  if (b === 0x92 || b === 0x91) return grassetto ? 238 : 191; // apostrofi
  if (b === 0x93 || b === 0x94) return grassetto ? 500 : 333;
  if (b === 0x96) return 556; // –
  if (b === 0x97) return 1000; // —
  if (b === 0x85) return 1000; // …
  if (b === 0x95) return 350; // •
  if (b === 0xdf) return grassetto ? 611 : 556; // ß
  if (b === 0xb0) return 400; // °
  return grassetto ? 611 : 556;
}

/* ───────── Utilità testo ───────── */

/**
 * Ripulisce una stringa per il PDF: normalizza, toglie i caratteri che
 * Helvetica non ha (emoji) e compatta gli spazi rimasti.
 */
export function ripulisci(testo) {
  const s = String(testo == null ? '' : testo).normalize('NFC');
  let out = '';
  for (const ch of s) {
    if (ch === '\n') { out += '\n'; continue; }
    out += byteWinAnsi(ch) === -1 ? ' ' : ch;
  }
  return out.replace(/[ \t]+/g, ' ').trim();
}

/** Stringa -> testo PDF fra parentesi, con i byte WinAnsi già al posto giusto. */
function letterale(testo) {
  let out = '(';
  for (const ch of String(testo)) {
    const b = byteWinAnsi(ch);
    if (b === -1) continue;
    if (b === 40 || b === 41 || b === 92) out += '\\'; // ( ) \
    out += String.fromCharCode(b);
  }
  return `${out})`;
}

const num = (n) => (Math.round(n * 100) / 100).toString();

/** "#33291f" -> "0.2 0.161 0.122" (spazio colore RGB del PDF). */
function rgb(hex) {
  const h = String(hex || '#000').replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n3 = parseInt(v.slice(0, 6), 16);
  if (Number.isNaN(n3)) return '0 0 0';
  return [(n3 >> 16) & 255, (n3 >> 8) & 255, n3 & 255].map((x) => num(x / 255)).join(' ');
}

/* ───────── Il documento ───────── */

export const A4 = { larghezza: 595.28, altezza: 841.89 };

/**
 * Crea un documento. Ogni metodo di disegno lavora sulla pagina corrente.
 *
 *   const pdf = nuovoPdf();
 *   pdf.testo('Ciao', 40, 60, { dim: 14, font: 'b' });
 *   const blob = pdf.blob();
 */
export function nuovoPdf({ larghezza = A4.larghezza, altezza = A4.altezza } = {}) {
  const pagine = [[]]; // ogni pagina è un elenco di comandi
  const immagini = []; // JPEG condivisi fra le pagine
  let corrente = 0;

  const cmd = (s) => { pagine[corrente].push(s); };
  const y2 = (y) => altezza - y; // schermo -> PDF

  /** Larghezza di un testo, in punti, per una certa dimensione e font. */
  function larghezzaTesto(testo, dim = 10, font = 'n') {
    const grassetto = font === 'b';
    let tot = 0;
    for (const ch of String(testo)) {
      const b = byteWinAnsi(ch);
      if (b === -1) continue;
      tot += larghezzaByte(b, grassetto);
    }
    return (tot * dim) / 1000;
  }

  /**
   * Manda a capo un testo dentro una certa larghezza.
   * Il 1,5% di margine copre le piccole differenze di misura dei caratteri
   * accentati: meglio andare a capo un filo prima che sbordare dalla colonna.
   */
  function spezza(testo, maxLarghezza, dim = 10, font = 'n') {
    const limite = maxLarghezza * 0.985;
    const righe = [];
    for (const paragrafo of String(testo).split('\n')) {
      let riga = '';
      for (const parola of paragrafo.split(/\s+/).filter(Boolean)) {
        const prova = riga ? `${riga} ${parola}` : parola;
        if (larghezzaTesto(prova, dim, font) <= limite || !riga) {
          riga = prova;
        } else {
          righe.push(riga);
          riga = parola;
        }
      }
      righe.push(riga);
    }
    return righe.filter((r, i) => r !== '' || i === 0);
  }

  /** Taglia un testo troppo lungo aggiungendo i puntini. */
  function accorcia(testo, maxLarghezza, dim = 10, font = 'n') {
    if (larghezzaTesto(testo, dim, font) <= maxLarghezza) return testo;
    let s = String(testo);
    while (s.length > 1 && larghezzaTesto(`${s}…`, dim, font) > maxLarghezza) {
      s = s.slice(0, -1);
    }
    return `${s.trim()}…`;
  }

  /**
   * Scrive una riga di testo. `y` è la BASE del testo, dall'alto della pagina.
   * `allinea`: 'sx' (default), 'dx', 'centro'.
   */
  function testo(str, x, y, { dim = 10, font = 'n', colore = '#000', allinea = 'sx', spaziatura = 0 } = {}) {
    const s = String(str ?? '');
    if (!s) return;
    const fontId = font === 'b' ? '/F2' : font === 'i' ? '/F3' : '/F1';
    let px = x;
    if (allinea !== 'sx') {
      const w = larghezzaTesto(s, dim, font) + spaziatura * Math.max(0, s.length - 1);
      px = allinea === 'dx' ? x - w : x - w / 2;
    }
    cmd(`${rgb(colore)} rg`);
    cmd('BT');
    cmd(`${fontId} ${num(dim)} Tf`);
    if (spaziatura) cmd(`${num(spaziatura)} Tc`);
    cmd(`1 0 0 1 ${num(px)} ${num(y2(y))} Tm`);
    cmd(`${letterale(s)} Tj`);
    if (spaziatura) cmd('0 Tc');
    cmd('ET');
  }

  /** Rettangolo pieno e/o bordato. */
  function rettangolo(x, y, w, h, { pieno, bordo, spessore = 0.6 } = {}) {
    if (!pieno && !bordo) return;
    if (pieno) cmd(`${rgb(pieno)} rg`);
    if (bordo) { cmd(`${rgb(bordo)} RG`); cmd(`${num(spessore)} w`); }
    cmd(`${num(x)} ${num(y2(y + h))} ${num(w)} ${num(h)} re`);
    cmd(pieno && bordo ? 'B' : pieno ? 'f' : 'S');
  }

  /** Riga orizzontale/obliqua. */
  function linea(x1, y1, x2, y2b, { colore = '#000', spessore = 0.6 } = {}) {
    cmd(`${rgb(colore)} RG`);
    cmd(`${num(spessore)} w`);
    cmd(`${num(x1)} ${num(y2(y1))} m ${num(x2)} ${num(y2(y2b))} l S`);
  }

  /** Cerchietto (i pallini della tabella allergeni). */
  function cerchio(cx, cy, r, { pieno, bordo, spessore = 0.8 } = {}) {
    const k = r * 0.5523;
    const y = y2(cy);
    if (pieno) cmd(`${rgb(pieno)} rg`);
    if (bordo) { cmd(`${rgb(bordo)} RG`); cmd(`${num(spessore)} w`); }
    cmd(`${num(cx + r)} ${num(y)} m`);
    cmd(`${num(cx + r)} ${num(y + k)} ${num(cx + k)} ${num(y + r)} ${num(cx)} ${num(y + r)} c`);
    cmd(`${num(cx - k)} ${num(y + r)} ${num(cx - r)} ${num(y + k)} ${num(cx - r)} ${num(y)} c`);
    cmd(`${num(cx - r)} ${num(y - k)} ${num(cx - k)} ${num(y - r)} ${num(cx)} ${num(y - r)} c`);
    cmd(`${num(cx + k)} ${num(y - r)} ${num(cx + r)} ${num(y - k)} ${num(cx + r)} ${num(y)} c`);
    cmd(pieno && bordo ? 'B' : pieno ? 'f' : 'S');
  }

  /** Rettangolo con gli angoli arrotondati (le targhette V / SG / SL). */
  function pillola(x, y, w, h, { pieno, bordo, raggio = 3, spessore = 0.6 } = {}) {
    const r = Math.min(raggio, h / 2, w / 2);
    const k = r * 0.5523;
    const b = y2(y + h); // bordo basso in coordinate PDF
    const t = y2(y);
    if (pieno) cmd(`${rgb(pieno)} rg`);
    if (bordo) { cmd(`${rgb(bordo)} RG`); cmd(`${num(spessore)} w`); }
    cmd(`${num(x + r)} ${num(b)} m`);
    cmd(`${num(x + w - r)} ${num(b)} l`);
    cmd(`${num(x + w - r + k)} ${num(b)} ${num(x + w)} ${num(b + r - k)} ${num(x + w)} ${num(b + r)} c`);
    cmd(`${num(x + w)} ${num(t - r)} l`);
    cmd(`${num(x + w)} ${num(t - r + k)} ${num(x + w - r + k)} ${num(t)} ${num(x + w - r)} ${num(t)} c`);
    cmd(`${num(x + r)} ${num(t)} l`);
    cmd(`${num(x + r - k)} ${num(t)} ${num(x)} ${num(t - r + k)} ${num(x)} ${num(t - r)} c`);
    cmd(`${num(x)} ${num(b + r)} l`);
    cmd(`${num(x)} ${num(b + r - k)} ${num(x + r - k)} ${num(b)} ${num(x + r)} ${num(b)} c`);
    cmd(pieno && bordo ? 'b' : pieno ? 'f' : 's');
  }

  /**
   * Registra un JPEG (una volta sola, anche se lo si disegna su più pagine) e
   * torna il numero da passare a `immagine`. Solo JPEG: nel PDF si incorpora
   * così com'è (filtro DCTDecode), senza doverlo decodificare.
   */
  function registraJpeg(byteJpeg, larghezzaPx, altezzaPx) {
    immagini.push({ byteJpeg, larghezzaPx, altezzaPx });
    return immagini.length; // 1-based: /Im1, /Im2…
  }

  /** Disegna un'immagine registrata, alle misure indicate (in punti). */
  function immagine(n, x, y, w, h) {
    if (!n || n > immagini.length) return;
    cmd('q');
    cmd(`${num(w)} 0 0 ${num(h)} ${num(x)} ${num(y2(y + h))} cm`);
    cmd(`/Im${n} Do`);
    cmd('Q');
  }

  function nuovaPagina() {
    pagine.push([]);
    corrente = pagine.length - 1;
    return corrente;
  }

  /** Torna su una pagina già creata (serve per piè di pagina e numerazione). */
  function vaiA(i) { corrente = Math.max(0, Math.min(i, pagine.length - 1)); }

  /* ───────── Serializzazione ───────── */

  // Byte -> stringa "binaria" (un carattere = un byte), a blocchi per non
  // sfondare lo stack con String.fromCharCode(...spread) su file grandi.
  function byteInStringa(b) {
    let s = '';
    for (let i = 0; i < b.length; i += 8192) {
      s += String.fromCharCode.apply(null, b.subarray(i, i + 8192));
    }
    return s;
  }

  function costruisci() {
    const oggetti = [];
    const nPagine = pagine.length;
    // 1 catalogo, 2 elenco pagine, 3-5 font, poi un oggetto per immagine e
    // infine 2 oggetti per pagina.
    const idImmagine = (i) => 6 + i;
    const base = 6 + immagini.length;
    const idPagina = (i) => base + i * 2;
    const idFlusso = (i) => base + 1 + i * 2;

    oggetti[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    oggetti[2] = `<< /Type /Pages /Kids [${pagine.map((_, i) => `${idPagina(i)} 0 R`).join(' ')}] /Count ${nPagine} >>`;
    oggetti[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    oggetti[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    oggetti[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>';

    immagini.forEach((im, i) => {
      const dati = byteInStringa(im.byteJpeg);
      oggetti[idImmagine(i)] = [
        '<< /Type /XObject /Subtype /Image',
        `/Width ${im.larghezzaPx} /Height ${im.altezzaPx}`,
        '/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode',
        `/Length ${dati.length} >>\nstream\n${dati}\nendstream`,
      ].join(' ');
    });

    const risorseImg = immagini.length
      ? ` /XObject << ${immagini.map((_, i) => `/Im${i + 1} ${idImmagine(i)} 0 R`).join(' ')} >>`
      : '';

    pagine.forEach((ops, i) => {
      const flusso = ops.join('\n');
      oggetti[idPagina(i)] = [
        '<< /Type /Page /Parent 2 0 R',
        `/MediaBox [0 0 ${num(larghezza)} ${num(altezza)}]`,
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >>${risorseImg} >>`,
        `/Contents ${idFlusso(i)} 0 R >>`,
      ].join(' ');
      oggetti[idFlusso(i)] = `<< /Length ${flusso.length} >>\nstream\n${flusso}\nendstream`;
    });

    // Il file si costruisce come stringa "binaria" (un carattere = un byte):
    // così .length è già l'offset in byte che serve alla tabella xref.
    let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offset = [];
    for (let i = 1; i < oggetti.length; i += 1) {
      offset[i] = out.length;
      out += `${i} 0 obj\n${oggetti[i]}\nendobj\n`;
    }
    const inizioXref = out.length;
    const totale = oggetti.length;
    out += `xref\n0 ${totale}\n0000000000 65535 f \n`;
    for (let i = 1; i < totale; i += 1) {
      out += `${String(offset[i]).padStart(10, '0')} 00000 n \n`;
    }
    out += `trailer\n<< /Size ${totale} /Root 1 0 R >>\nstartxref\n${inizioXref}\n%%EOF\n`;
    return out;
  }

  function byte() {
    const s = costruisci();
    const buf = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i += 1) buf[i] = s.charCodeAt(i) & 0xff;
    return buf;
  }

  return {
    larghezza,
    altezza,
    testo,
    rettangolo,
    linea,
    cerchio,
    pillola,
    registraJpeg,
    immagine,
    larghezzaTesto,
    spezza,
    accorcia,
    nuovaPagina,
    vaiA,
    get pagina() { return corrente; },
    get numeroPagine() { return pagine.length; },
    byte,
    blob: () => new Blob([byte()], { type: 'application/pdf' }),
  };
}
