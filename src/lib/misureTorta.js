// Misure della torta per FORMA.
//
// Ogni taglia (n° persone) misura diversamente a seconda della forma, e non
// sempre è un diametro: la quadrata si misura col lato, la rettangolare con
// due lati. I titolari le scrivono dalla dashboard, tab Dimensioni.
//
// Dove stanno nel database (tabella `dimensioni`):
//  - `diametro` → la TONDA. È la colonna storica e resta la misura di
//    riferimento: il sito funziona anche prima che la migrazione
//    2026-09-14-misure-per-forma venga eseguita.
//  - `misure`   → le altre forme, in cm:
//    { cuore: [22], quadrata: [20], rettangolare: [24, 34] }

// La forma rettangolare è disponibile solo da 15 persone in su.
export const RECT_MIN_PERSONE = 15;

// N° persone ricavato dalla dimensione (id o etichetta).
export const personeOf = (size) => {
  if (!size) return 0;
  return parseInt(size.id, 10) || parseInt(size.label, 10) || 0;
};

// Come si misura ogni forma. Una forma nuova, finché non si aggiunge qui,
// si misura col diametro.
const MISURA_FORMA = {
  tonda: { tipo: 'diametro', lati: 1 },
  cuore: { tipo: 'diametro', lati: 1 },
  quadrata: { tipo: 'lato', lati: 1 },
  rettangolare: { tipo: 'lati', lati: 2 },
};
export const misuraForma = (formaId) => MISURA_FORMA[formaId] || MISURA_FORMA.tonda;

const positivo = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** I numeri della misura di una taglia in una forma ([] = non indicata). */
export function misureDi(size, formaId) {
  if (!size) return [];
  const { tipo, lati } = misuraForma(formaId);
  const tonda = positivo(size.diameter);
  if (!formaId || formaId === 'tonda') return tonda ? [tonda] : [];
  const scritte = (Array.isArray(size.misure?.[formaId]) ? size.misure[formaId] : [])
    .slice(0, lati)
    .map(positivo);
  if (scritte.length === lati && scritte.every(Boolean)) return scritte;
  // Non indicata: una forma che si misura col diametro (il cuore) prende
  // quello della tonda, come faceva il sito prima. Quadrata e rettangolare
  // no: un diametro lì sarebbe una misura sbagliata, meglio non darne.
  return tipo === 'diametro' && tonda ? [tonda] : [];
}

const cm = (n) => String(n).replace('.', ',');

/** "Ø 24 cm", "22×22 cm", "24×34 cm" — oppure '' se la misura non c'è. */
export function misuraTesto(size, formaId) {
  const m = misureDi(size, formaId);
  if (!m.length) return '';
  const { tipo } = misuraForma(formaId);
  if (tipo === 'diametro') return `Ø ${cm(m[0])} cm`;
  if (tipo === 'lato') return `${cm(m[0])}×${cm(m[0])} cm`;
  return `${cm(m[0])}×${cm(m[1])} cm`;
}

/** "10 persone · Ø 24 cm" (solo l'etichetta se la misura non c'è). */
export function dimensioneTesto(size, formaId) {
  if (!size) return '';
  return [size.label, misuraTesto(size, formaId)].filter(Boolean).join(' · ');
}
