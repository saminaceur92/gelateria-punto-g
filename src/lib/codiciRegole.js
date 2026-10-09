// Regole dei codici dello staff, lato sito. Niente import: si prova con
// `node --test src/lib/codiciRegole.test.mjs`.
//
// A decidere è sempre il database (private.codice_problema nella migrazione
// 2026-10-09-codici-visibili.sql): queste servono solo a dire subito, prima di
// chiamare il server, cosa non va. Se cambiano là, vanno cambiate anche qui.

export const MIN_CODICE = 4;
// Un codice da amministratore apre anche i codici di tutti: almeno 6 cifre.
// Vale per i codici nuovi o cambiati; quelli già in uso continuano a funzionare.
export const MIN_CODICE_ADMIN = 6;

/** Come verifica_codice: gli spazi non contano ("12 34" = "1234"). */
export const pulisci = (s) => String(s ?? '').replace(/[ \t\n\r\f\v]/g, '');

/** '' se va bene, altrimenti la frase da mostrare. */
export function problemaCodice(codice, ruolo = 'staff', ripeti = undefined) {
  const c = pulisci(codice);
  if (c.length < MIN_CODICE) return `Il codice deve avere almeno ${MIN_CODICE} cifre.`;
  if (ruolo === 'admin' && c.length < MIN_CODICE_ADMIN) {
    return `Il codice di un amministratore deve avere almeno ${MIN_CODICE_ADMIN} cifre.`;
  }
  if (ripeti !== undefined && pulisci(ripeti) !== c) return 'I due codici nuovi non sono uguali.';
  return '';
}

/** Sempre 4 puntini: la maschera non deve svelare quanto è lungo il codice. */
export const MASCHERA = '••••';

// Il codice da amministratore ricordato nella scheda del browser scade: al
// banco il tablet resta acceso tutto il giorno.
export const DURATA_RICORDO_MS = 10 * 60 * 1000;
export const impacchetta = (pin, adesso = Date.now()) => JSON.stringify({ pin, scade: adesso + DURATA_RICORDO_MS });
export function spacchetta(salvato, adesso = Date.now()) {
  try {
    const { pin, scade } = JSON.parse(salvato || '');
    return typeof pin === 'string' && Number(scade) > adesso ? pin : '';
  } catch {
    return ''; // valore vecchio (solo il codice, senza scadenza): si richiede
  }
}

// Quanto resta a schermo un codice mostrato, prima di richiudersi da solo.
export const VISIBILE_UNO_MS = 30 * 1000;
export const VISIBILE_TUTTI_MS = 60 * 1000;
