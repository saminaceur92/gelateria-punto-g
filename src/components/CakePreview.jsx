import { motion } from 'framer-motion';

/**
 * Anteprima 3D-look della torta che si aggiorna live.
 * - Dimensione → larghezza/altezza
 * - Numero piani: 2 sempre, 3 se cake type "piani"
 * - Strati gelato → colori dei layer
 * - Decorazione → topping
 * - Scritta → testo sopra
 * - Candelina → fiamma animata
 */
export default function CakePreview({ config }) {
  const {
    type = 'semifreddo',
    sizeId = '8',
    flavors = [],
    decoration = 'minimal',
    message = '',
    candle = false,
  } = config;

  // Larghezza scala in base alla dimensione
  const sizeMap = { '6': 0.78, '8': 0.86, '10': 0.92, '12': 1, '16': 1.08, '20': 1.14 };
  const scale = sizeMap[sizeId] ?? 0.9;

  // Colori strati: usa i gusti scelti, riempi con default
  const defaultColor = '#fff8e6';
  const layers = type === 'piani' ? 3 : 2;
  const layerColors = Array.from({ length: layers }, (_, i) =>
    flavors[i]?.color || flavors[flavors.length - 1]?.color || defaultColor
  );

  // Geometria
  const cx = 200;
  const baseY = 320;
  const layerH = 52;
  const baseW = 230 * scale;

  return (
    <motion.svg
      viewBox="0 0 400 400"
      width="100%"
      height="100%"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{ filter: 'drop-shadow(0 25px 35px rgba(96,46,158,0.18))' }}
    >
      <defs>
        {layerColors.map((c, i) => (
          <linearGradient key={i} id={`layerGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lighten(c, 0.18)} />
            <stop offset="100%" stopColor={darken(c, 0.1)} />
          </linearGradient>
        ))}
        <radialGradient id="plate" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="100%" stopColor="#e8d8c0" />
        </radialGradient>
        <linearGradient id="board" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d4b89a" />
          <stop offset="100%" stopColor="#a07c5a" />
        </linearGradient>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>

      {/* Tovaglia / piatto (ombra) */}
      <ellipse cx={cx} cy={baseY + 14} rx={baseW * 0.95} ry="14" fill="rgba(60,20,100,0.18)" />

      {/* Sotto-torta dorato */}
      <ellipse cx={cx} cy={baseY + 6} rx={baseW * 0.92} ry="14" fill="url(#board)" />
      <ellipse cx={cx} cy={baseY} rx={baseW * 0.92} ry="14" fill="#f0d9b8" />

      {/* Strati */}
      {layerColors.map((_, i) => {
        const idx = layerColors.length - 1 - i; // dal basso verso l'alto
        const y = baseY - i * layerH - 8;
        const w = baseW * (1 - i * 0.08);
        return (
          <g key={idx}>
            {/* lato curvo */}
            <path
              d={`M ${cx - w} ${y} a ${w} 12 0 0 0 ${w * 2} 0 L ${cx + w} ${y - layerH} a ${w} 12 0 0 1 -${w * 2} 0 Z`}
              fill={`url(#layerGrad-${idx})`}
            />
            {/* top */}
            <ellipse cx={cx} cy={y - layerH} rx={w} ry="12" fill={lighten(layerColors[idx], 0.1)} />
            {/* gocciolina di crema sul bordo */}
            {Array.from({ length: 6 }).map((_, k) => {
              const angle = (k / 6) * Math.PI;
              const dx = Math.cos(angle) * w * 0.92;
              return (
                <ellipse
                  key={k}
                  cx={cx + dx}
                  cy={y - 2}
                  rx="6"
                  ry="9"
                  fill={lighten(layerColors[idx], 0.22)}
                  opacity="0.85"
                />
              );
            })}
          </g>
        );
      })}

      {/* Decorazione sopra */}
      <Decoration kind={decoration} cx={cx} y={baseY - layers * layerH - 18} w={baseW * (1 - (layers - 1) * 0.08)} />

      {/* Candelina */}
      {candle && (
        <g>
          <rect
            x={cx - 5}
            y={baseY - layers * layerH - 70}
            width="10"
            height="48"
            rx="2"
            fill="#fff"
            stroke="#b651e4"
            strokeWidth="2"
          />
          {/* righe candelina */}
          <line x1={cx - 5} y1={baseY - layers * layerH - 60} x2={cx + 5} y2={baseY - layers * layerH - 60} stroke="#b651e4" strokeWidth="2" />
          <line x1={cx - 5} y1={baseY - layers * layerH - 48} x2={cx + 5} y2={baseY - layers * layerH - 48} stroke="#b651e4" strokeWidth="2" />
          <line x1={cx - 5} y1={baseY - layers * layerH - 36} x2={cx + 5} y2={baseY - layers * layerH - 36} stroke="#b651e4" strokeWidth="2" />
          {/* fiamma */}
          <motion.path
            d={`M ${cx} ${baseY - layers * layerH - 78} q -7 -8 0 -18 q 7 10 0 18 Z`}
            fill="#eb911e"
            animate={{ scale: [1, 1.1, 1], opacity: [0.9, 1, 0.9] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformOrigin: `${cx}px ${baseY - layers * layerH - 70}px` }}
          />
          <motion.circle
            cx={cx}
            cy={baseY - layers * layerH - 82}
            r="3"
            fill="#fff200"
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
        </g>
      )}

      {/* Scritta sulla torta */}
      {message && (
        <text
          x={cx}
          y={baseY - layers * layerH + 28}
          textAnchor="middle"
          fontFamily="'Caveat', cursive"
          fontSize="22"
          fill="#fff"
          stroke="#602e9e"
          strokeWidth="0.6"
          style={{ paintOrder: 'stroke' }}
        >
          {message.length > 22 ? message.slice(0, 22) + '…' : message}
        </text>
      )}
    </motion.svg>
  );
}

function Decoration({ kind, cx, y, w }) {
  if (kind === 'minimal') {
    return (
      <g>
        {Array.from({ length: 3 }).map((_, i) => (
          <text key={i} x={cx + (i - 1) * 22} y={y - 6} textAnchor="middle" fontSize="14" fill="#b651e4">✻</text>
        ))}
      </g>
    );
  }
  if (kind === 'frutta') {
    const fruits = ['#e84a6e', '#f5e26a', '#7ea15a', '#eb911e', '#c94a6b'];
    return (
      <g>
        {fruits.map((c, i) => (
          <circle key={i} cx={cx + (i - 2) * 18} cy={y} r="7" fill={c} />
        ))}
      </g>
    );
  }
  if (kind === 'cioccolato') {
    return (
      <g>
        {Array.from({ length: 8 }).map((_, i) => (
          <ellipse
            key={i}
            cx={cx + (i - 3.5) * 14}
            cy={y - (i % 2 === 0 ? 4 : 0)}
            rx="6"
            ry="3"
            fill={i % 2 ? '#3a2418' : '#5a3520'}
            transform={`rotate(${(i - 3.5) * 8} ${cx + (i - 3.5) * 14} ${y})`}
          />
        ))}
      </g>
    );
  }
  if (kind === 'panna') {
    return (
      <g>
        {Array.from({ length: 7 }).map((_, i) => (
          <path
            key={i}
            d={`M ${cx + (i - 3) * 20} ${y + 4} q -6 -10 0 -18 q 6 8 0 18 Z`}
            fill="#fffdf5"
            stroke="#e8d8c0"
            strokeWidth="0.8"
          />
        ))}
      </g>
    );
  }
  if (kind === 'fantasy') {
    const colors = ['#b651e4', '#eb911e', '#7ea15a', '#e84a6e', '#a5cdcb', '#f5e26a'];
    return (
      <g>
        {Array.from({ length: 14 }).map((_, i) => (
          <rect
            key={i}
            x={cx - w * 0.7 + (i / 14) * w * 1.4}
            y={y - 8 - (i % 3) * 4}
            width="3"
            height="9"
            fill={colors[i % colors.length]}
            transform={`rotate(${(i % 5) * 25} ${cx - w * 0.7 + (i / 14) * w * 1.4} ${y})`}
          />
        ))}
      </g>
    );
  }
  return null;
}

// Color helpers
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex({ r, g, b }) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
function lighten(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex({ r: r + (255 - r) * amt, g: g + (255 - g) * amt, b: b + (255 - b) * amt });
}
function darken(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex({ r: r * (1 - amt), g: g * (1 - amt), b: b * (1 - amt) });
}
