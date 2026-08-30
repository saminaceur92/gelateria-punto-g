/**
 * Stile della scritta sulla torta — normalizzazione degli id.
 *
 * Gli id "buoni" sono quelli della tabella `scritte` su Supabase:
 * `stampatello`, `corsivo`, `corsivo-scolastico`. Gli ordini vecchi (e le
 * bozze salvate nel browser) usano invece i vecchi id cablati `inter`,
 * `caveat`, `fraunces`: qui li rimappiamo, così l'anteprima 2D
 * (CakePreview) e la torta 3D (Cake3D) disegnano la scritta allo stesso modo.
 */

// vecchio id → id della tabella `scritte`
const LEGACY_IDS = {
  inter: 'stampatello',
  caveat: 'corsivo',
  fraunces: 'corsivo-scolastico',
};

// come si disegna ogni stile: famiglia CSS, peso, corsivo, maiuscolo
const FONT_STYLES = {
  stampatello: {
    family: "'Inter', sans-serif",
    weight: 800,
    italic: false,
    uppercase: true,
    letterSpacing: '0.06em',
  },
  corsivo: {
    family: "'Kalam', cursive",
    weight: 400,
    italic: false,
    uppercase: false,
    letterSpacing: 'normal',
  },
  'corsivo-scolastico': {
    family: "'Dancing Script', cursive",
    weight: 600,
    italic: false,
    uppercase: false,
    letterSpacing: 'normal',
  },
};

/** Stile usato quando non è stato scelto niente (o l'id non è riconosciuto). */
export const DEFAULT_MESSAGE_FONT = 'corsivo';

/** Id normalizzato: accetta i nuovi id e i vecchi (retrocompatibilità). */
export function normalizeMessageFont(id) {
  const key = String(id || '').trim().toLowerCase();
  if (FONT_STYLES[key]) return key;
  if (LEGACY_IDS[key]) return LEGACY_IDS[key];
  return DEFAULT_MESSAGE_FONT;
}

/** Come rendere la scritta: { family, weight, italic, uppercase, letterSpacing }. */
export function messageFontStyle(id) {
  return FONT_STYLES[normalizeMessageFont(id)];
}
