/**
 * Quali parole vanno in GRASSETTO E SOTTOLINEATO nelle liste ingredienti del
 * quaderno allergeni.
 *
 * Prima questa logica stava dentro quadernoPdf.js e ragionava una parola alla
 * volta. Adesso ragiona per FRASI, e per due motivi:
 *
 *  1. Diversi allergeni hanno un nome di più parole — "frutta a guscio" è la
 *     dicitura ufficiale dell'Allegato II, e cercando solo parole singole non
 *     veniva evidenziata mai. Stessa cosa per "pan di spagna", "siero di latte",
 *     "lecitina di soia".
 *  2. I "falsi amici" (burro DI CACAO, latte DI COCCO) diventano frasi anche
 *     loro, e smettono di dipendere da come è scritta la punteggiatura: prima
 *     bastava scrivere "burro-di-cacao" col trattino per far saltare
 *     l'eccezione e ritrovarsi "burro" in grassetto per sbaglio.
 *
 * Il vocabolario ha due strati:
 *
 *   NUCLEO      cablato qui sotto, sempre attivo. È il PAVIMENTO: qualunque
 *               cosa succeda alla tabella del gestionale (non creata, svuotata,
 *               riga sbagliata, eccezione troppo larga) il quaderno continua a
 *               evidenziare almeno quello che evidenzia il nucleo da solo.
 *               Un documento di sicurezza non può regredire perché è saltata
 *               una configurazione.
 *   DASHBOARD   la tabella Supabase `parole_evidenza`, scheda "Parole in
 *               grassetto". Si SOMMA al nucleo: serve ad aggiungere le parole
 *               che il programma non conosce (crumble, biscotti, cialde…)
 *               senza dover toccare il codice.
 *
 * ── IL PAVIMENTO È GARANTITO PER COSTRUZIONE ──
 * `segmenta` calcola DUE volte: prima con il solo nucleo, poi col vocabolario
 * completo, e alla fine fa l'unione. Nessuna riga della dashboard può quindi
 * togliere un'evidenza che il nucleo darebbe da solo — né per errore né di
 * proposito. In più le eccezioni della dashboard non possono nemmeno provarci:
 * scavalcano le parole già accese dal nucleo.
 *
 * ── PERCHÉ LA RICERCA È FATTA COSÌ ──
 * `scansiona` avanza di UNA parola alla volta, non di tutta la frase trovata.
 * Sembra uno spreco e invece è il punto delicato: avanzando di tutta la frase
 * (1) una frase che comincia prima ne oscurava una più lunga che cominciava
 * dopo — "tracce di frutta" mangiava "frutta a guscio" e lasciava in tondo
 * "A GUSCIO"; e (2) una frase scartata perché conteneva una parola bloccata
 * si portava via anche gli allergeni veri che stavano dentro. Entrambi i casi
 * facevano SPARIRE del grassetto: esattamente quello che non deve succedere.
 */

/* ───────── NUCLEO: sempre attivo, non disattivabile dal gestionale ───────── */

/**
 * I 14 allergeni di legge e i derivati che hanno un nome tutto loro (panna,
 * burro, mascarpone, tuorlo…): sono le parole che chi ha un'allergia cerca con
 * gli occhi. Le voci di più parole sono frasi e vengono cercate come tali.
 */
export const NUCLEO = [
  // latte e derivati
  'latte', 'lattosio', 'latticello', 'panna', 'burro', 'yogurt', 'quark',
  'mascarpone', 'formaggio', 'caseina', 'caseinati', 'siero di latte',
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
  // la dicitura ufficiale dell'Allegato II: è di due parole, e da sola
  // "frutta" non vuol dire niente
  'frutta a guscio',
  // gli altri di legge
  'sesamo', 'lupini', 'lupino', 'sedano', 'senape', 'solfiti', 'solforosa',
  'anidride solforosa',
  'pesce', 'crostacei', 'molluschi',
  // composti che portano glutine e latte (così li scrive il quaderno a mano)
  'wafer', 'wafers',
  // La base bianca è la base di LATTE con cui parte quasi tutto il banco
  // (latte intero, panna, latte in polvere): i titolari la vogliono evidenziata
  // come gli altri ingredienti con allergene. Vale solo la coppia intera:
  // "base frutta", "base vegan" e "base acqua" restano normali.
  'base bianca',
];

/**
 * I falsi amici: contengono una parola del nucleo ma NON sono quell'allergene.
 * Il burro DI CACAO non è latte, il latte DI COCCO nemmeno, la NOCE di cocco e
 * la noce moscata non sono frutta a guscio, il grano SARACENO non ha glutine.
 *
 * ⚠️ REGOLA PER CHI AGGIUNGE QUI: un'eccezione spegne TUTTE le parole della
 * frase. Quindi nessuna delle altre parole deve essere a sua volta un
 * allergene. "burro di cacao" va bene (cacao è innocuo); "burro di arachidi"
 * o "latte di mandorla" NO, spegnerebbero arachidi e mandorla, che sono
 * allergeni veri.
 */
export const NUCLEO_ECCEZIONI = [
  'burro di cacao',
  'latte di cocco',
  'noce di cocco',
  'noci di cocco',
  'noce moscata',
  'grano saraceno',
];

/* ───────── Costruzione del vocabolario ───────── */

/** "Burro di Cacao!" -> ['burro','di','cacao'] */
export function paroleDi(frase) {
  return String(frase == null ? '' : frase)
    .toLowerCase()
    .split(/[^a-zà-ÿ]+/)
    .filter(Boolean);
}

/**
 * Una voce di una parola sola deve avere almeno 3 lettere.
 * Motivo concreto: scrivendo "E322" nella scheda, le cifre spariscono (sono
 * separatori) e resterebbe la chiave "e" — cioè la congiunzione "e", che
 * manderebbe in grassetto mezzo quaderno. Stesso discorso per "di", "a", "o".
 * Le frasi di più parole non hanno questo problema.
 */
function voceAccettabile(parole) {
  if (!parole.length) return false;
  if (parole.length === 1 && parole[0].length < 3) return false;
  return true;
}

/**
 * Mette insieme nucleo e righe della dashboard. `righeDb` sono le righe della
 * tabella `parole_evidenza` (già filtrate sugli attivi): { parola, tipo }.
 */
export function costruisciVocabolario(righeDb = []) {
  const evidenzia = new Map();
  const eccezioni = new Map();

  const aggiungi = (mappa, frase, fonte) => {
    const parole = paroleDi(frase);
    if (!voceAccettabile(parole)) return;
    mappa.set(parole.join(' '), { parole, fonte });
  };

  NUCLEO.forEach((f) => aggiungi(evidenzia, f, 'nucleo'));
  NUCLEO_ECCEZIONI.forEach((f) => aggiungi(eccezioni, f, 'nucleo'));

  (righeDb || []).forEach((r) => {
    if (!r || r.attivo === false) return;
    const parole = paroleDi(r.parola);
    if (!voceAccettabile(parole)) return;
    if (String(r.tipo || '').toLowerCase() === 'eccezione') {
      // Un'eccezione di una parola sola spegnerebbe quell'allergene in tutto
      // il quaderno: non è un potere che si dà da una schermata.
      if (parole.length < 2) return;
      aggiungi(eccezioni, r.parola, 'dashboard');
    } else {
      aggiungi(evidenzia, r.parola, 'dashboard');
    }
  });

  // Le lunghezze di frase davvero presenti, dalla più lunga: così la ricerca
  // prova solo quelle e non tutte le misure intermedie.
  const lunghezze = (mappa) => {
    const s = new Set();
    mappa.forEach((v) => s.add(v.parole.length));
    return [...s].sort((a, b) => b - a);
  };

  return {
    evidenzia,
    eccezioni,
    lunghezzeEvidenzia: lunghezze(evidenzia),
    lunghezzeEccezioni: lunghezze(eccezioni),
  };
}

/** Vocabolario di sola sicurezza, senza niente dal gestionale. */
export const VOCABOLARIO_NUCLEO = costruisciVocabolario([]);

/* ───────── Ricerca nel testo ───────── */

const RE_SPEZZA = /([A-Za-zÀ-ÿ]+)/;
const RE_SOLO_LETTERE = /^[A-Za-zÀ-ÿ]+$/;

// "senza glutine" è una promessa, non un ingrediente: la parola dopo non va
// evidenziata. Vale anche per "privo/priva/privi/prive di".
const NEGAZIONI = new Set(['privo', 'priva', 'privi', 'prive']);

/**
 * Cerca le frasi di `mappa` dentro `parole`. Avanza di UNA parola per volta
 * (vedi la nota in testa al file: avanzare di tutta la frase faceva sparire
 * evidenze). In ogni posizione prova le frasi dalla più lunga alla più corta e
 * prende la prima UTILIZZABILE: se la più lunga non si può usare, quella più
 * corta dentro di essa ha comunque la sua occasione.
 */
function scansiona(parole, mappa, lunghezze, utilizzabile) {
  const n = parole.length;
  const trovati = [];
  for (let i = 0; i < n; i += 1) {
    for (const k of lunghezze) {
      if (k > n - i) continue;
      const chiave = parole.slice(i, i + k).join(' ');
      const voce = mappa.get(chiave);
      if (!voce) continue;
      if (utilizzabile && !utilizzabile(i, i + k, voce)) continue;
      trovati.push([i, i + k]);
      break;
    }
  }
  return trovati;
}

/**
 * Il cuore: dato l'elenco delle parole, dice quali vanno accese.
 * `pavimento` è l'array delle parole già accese dal solo nucleo: le eccezioni
 * che arrivano dalla dashboard non possono spegnerle. Vale null quando si sta
 * calcolando il pavimento stesso.
 */
function calcola(parole, vocab, pavimento) {
  const n = parole.length;
  const acceso = new Array(n).fill(false);
  const bloccato = new Array(n).fill(false);

  // 1. Le eccezioni bloccano. Quelle della dashboard però scavalcano le parole
  //    che il nucleo accende da solo: nessuna riga scritta a mano può togliere
  //    il grassetto a "latte", "base bianca" o "frutta a guscio".
  scansiona(parole, vocab.eccezioni, vocab.lunghezzeEccezioni).forEach(([da, a]) => {
    const voce = vocab.eccezioni.get(parole.slice(da, a).join(' '));
    const dallaDashboard = voce?.fonte === 'dashboard';
    for (let k = da; k < a; k += 1) {
      if (dallaDashboard && pavimento && pavimento[k]) continue;
      bloccato[k] = true;
    }
  });

  // 2. Le negazioni bloccano la parola che le segue.
  for (let i = 0; i < n; i += 1) {
    if (parole[i] === 'senza') {
      // "senza aggiunta di zuccheri" -> la parola utile è tre più in là
      if (parole[i + 1] === 'aggiunta' && parole[i + 2] === 'di') {
        if (i + 3 < n) bloccato[i + 3] = true;
      } else if (i + 1 < n) {
        bloccato[i + 1] = true;
      }
    } else if (NEGAZIONI.has(parole[i]) && parole[i + 1] === 'di' && i + 2 < n) {
      bloccato[i + 2] = true;
    }
  }

  // 3. Le evidenze. Una frase con dentro una parola bloccata non si usa, ma
  //    nella stessa posizione si prova subito una frase più corta.
  const libera = (da, a) => {
    for (let k = da; k < a; k += 1) if (bloccato[k]) return false;
    return true;
  };
  scansiona(parole, vocab.evidenzia, vocab.lunghezzeEvidenzia, libera).forEach(([da, a]) => {
    for (let k = da; k < a; k += 1) acceso[k] = true;
  });

  return acceso;
}

/**
 * Spezza il testo in segmenti { t, ev }, dove `ev` dice che quel pezzo va
 * scritto in grassetto e sottolineato. I segmenti rimessi in fila danno
 * ESATTAMENTE il testo di partenza: maiuscole, accenti e punteggiatura non si
 * toccano mai (il maiuscolo nel quaderno è quello scritto dai titolari).
 */
export function segmenta(testo, vocab = VOCABOLARIO_NUCLEO) {
  const pezzi = String(testo == null ? '' : testo).split(RE_SPEZZA).filter((p) => p !== '');

  // Le sole parole, in minuscolo, con la posizione che occupano fra i pezzi.
  const posizione = [];
  const parole = [];
  pezzi.forEach((p, i) => {
    if (RE_SOLO_LETTERE.test(p)) {
      posizione.push(i);
      parole.push(p.toLowerCase());
    }
  });

  // Prima il pavimento (solo nucleo), poi il vocabolario completo, poi
  // l'unione: così le evidenze possono solo aumentare, mai diminuire.
  const soloNucleo = vocab === VOCABOLARIO_NUCLEO;
  const pavimento = soloNucleo ? null : calcola(parole, VOCABOLARIO_NUCLEO, null);
  const acceso = calcola(parole, vocab, pavimento);
  if (pavimento) {
    for (let k = 0; k < acceso.length; k += 1) if (pavimento[k]) acceso[k] = true;
  }

  const evDelPezzo = new Array(pezzi.length).fill(false);
  posizione.forEach((idx, w) => { evDelPezzo[idx] = acceso[w]; });

  return pezzi.map((t, i) => ({ t, ev: evDelPezzo[i] }));
}

/**
 * Comodità per chi vuole solo sapere QUALI parole verrebbero evidenziate
 * (collaudi, anteprime, controlli di coerenza). Torna le parole così come sono
 * scritte nel testo, senza doppioni.
 */
export function paroleEvidenziate(testo, vocab = VOCABOLARIO_NUCLEO) {
  const viste = new Set();
  segmenta(testo, vocab).forEach((s) => { if (s.ev) viste.add(s.t); });
  return [...viste];
}
