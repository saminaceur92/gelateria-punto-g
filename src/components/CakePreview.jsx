import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import {
  cakeShapes,
  cakeTypes,
  cakeSizes,
  cakeBases,
  cakeFillings,
  cakeCoverings,
  cakeDecorations,
} from '../data/cakeOptions';

// Three.js è pesante: lo carichiamo solo quando la torta 3D serve davvero.
const Cake3D = lazy(() => import('./Cake3D'));

/**
 * Anteprima visiva: SVG laterale con forma + strati colorati.
 * I colori degli strati corrispondono ai gusti scelti, le farciture
 * appaiono come linee tra gli strati, la copertura riveste l'esterno.
 */
export default function CakePreview({ config }) {
  const {
    shape = 'tonda',
    type,
    sizeId,
    flavors = [],
    baseId,
    fillingId = 'nessuna',
    coveringId = 'panna',
    decoration,
    message = '',
    candle = false,
    messageFont = 'caveat',
    photo = null,
  } = config;

  const sh = cakeShapes.find((x) => x.id === shape) || cakeShapes[0];
  const t = cakeTypes.find((x) => x.id === type);
  const s = cakeSizes.find((x) => x.id === sizeId);
  const b = cakeBases.find((x) => x.id === baseId);
  const filling = cakeFillings.find((x) => x.id === fillingId);
  const covering = cakeCoverings.find((x) => x.id === coveringId);
  const d = cakeDecorations.find((x) => x.id === decoration);

  const fontFamily =
    messageFont === 'fraunces'
      ? "'Fraunces', serif"
      : messageFont === 'inter'
      ? "'Inter', sans-serif"
      : "'Caveat', cursive";
  const fontStyle = messageFont === 'fraunces' ? 'italic' : 'normal';
  const fontWeight = messageFont === 'inter' ? 800 : messageFont === 'caveat' ? 700 : 600;
  const fontTransform = messageFont === 'inter' ? 'uppercase' : 'none';
  const fontLetter = messageFont === 'inter' ? '0.06em' : 'normal';

  return (
    <motion.div
      className="cake-card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="cake-card-ribbon">
        <span>Punto G!</span>
        <span className="dot" />
        <span>Pasticceria</span>
      </div>

      <div className="cake-card-body">
        {/* Renderer 3D reale (caricato in lazy) */}
        <Suspense fallback={<div className="cake3d-stage cake3d-loading" aria-hidden="true" />}>
          <Cake3D
            shape={shape}
            flavors={flavors}
            base={b}
            filling={filling}
            covering={covering}
            candle={candle}
            photo={photo}
            decorationId={d?.id}
          />
        </Suspense>

        <h3 className="cake-card-type">{t?.name || 'La tua torta'}</h3>

        {(s || sh) && (
          <p className="cake-card-size">
            {sh?.name}{s ? ` · Ø ${s.diameter} cm · ${s.label.toLowerCase()}` : ''}
          </p>
        )}

        {flavors.length > 0 && (
          <div className="cake-card-flavors">
            <span className="cake-card-label">Strati</span>
            <div className="flavor-chips">
              {flavors.map((f, i) => (
                <span key={i} className="flavor-chip">
                  <span className="flavor-chip-dot" style={{ background: f.color }} />
                  {f.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {filling && filling.id !== 'nessuna' && (
          <p className="cake-card-base">
            <em>farcito con {filling.name.toLowerCase()}</em>
          </p>
        )}

        {covering && (
          <p className="cake-card-base">
            <em>coperto da {covering.name.toLowerCase()}</em>
          </p>
        )}

        {b && (
          <p className="cake-card-base">
            <em>su base {b.name.toLowerCase()}</em>
          </p>
        )}

        {message && (
          <div className="cake-card-message">
            <span className="cake-card-label">Scritta</span>
            <p
              style={{
                fontFamily,
                fontStyle,
                fontWeight,
                textTransform: fontTransform,
                letterSpacing: fontLetter,
              }}
            >
              "{message}"
            </p>
          </div>
        )}

        <div className="cake-card-icons">
          {d && d.id !== 'nessuna' && (
            <span className="cake-card-icon">
              <span aria-hidden="true">{d.emoji}</span>
              {d.name}
            </span>
          )}
          {candle && (
            <span className="cake-card-icon">
              <span aria-hidden="true">🕯️</span>
              candelina
            </span>
          )}
          {photo && (
            <span className="cake-card-icon">
              <span aria-hidden="true">📸</span>
              foto su cialda
            </span>
          )}
        </div>
      </div>

      <div className="cake-card-footer">
        <span>fatta a mano · ingredienti freschi</span>
      </div>
    </motion.div>
  );
}

/* ===== SVG renderer laterale ===== */
function CakeSvg({ shape, flavors, base, filling, covering, candle, photo, decorationEmoji }) {
  const W = 400;
  const H = 380;
  const cx = W / 2;
  const baseY = 300; // base della torta (dove poggia sul vassoio)

  // Numero strati in base ai gusti scelti (min 1)
  const layers = Math.max(1, flavors.length);
  const layerH = layers > 3 ? 38 : layers > 2 ? 46 : 56;
  const totalCakeH = layers * layerH;
  const cakeTopY = baseY - totalCakeH;

  // Larghezza in base alla forma (vista 3/4)
  const widthByShape = {
    tonda: 240,
    cuore: 230,
    quadrata: 250,
    rettangolare: 300,
  };
  const cakeW = widthByShape[shape] || 240;
  const halfW = cakeW / 2;

  const isCircular = shape === 'tonda' || shape === 'cuore';
  // ry per ellissi (prospettiva 3/4 più marcata)
  const topRy = isCircular ? halfW * 0.32 : halfW * 0.26;

  const coverColor = covering?.color || '#fff8e6';
  const coverIsNaked = covering?.id === 'naked';
  const baseColor = base?.color || '#e8d2a8';
  const fillingColor = filling?.color;

  // Vassoio viola Punto G! (più largo e prominente)
  const platterRx = halfW + 55;
  const platterRy = topRy + 24;
  const platterCy = baseY + 14;
  const platterDepth = 14;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="100%"
      className="cake-svg cake-svg-spin"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="platterViolet" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#8b3fc4" />
          <stop offset="55%" stopColor="#602e9e" />
          <stop offset="100%" stopColor="#3d1c66" />
        </radialGradient>
        <linearGradient id="platterRim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.4)" />
        </linearGradient>
        <radialGradient id="platterShine" cx="35%" cy="35%" r="40%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <linearGradient id="sideShade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
          <stop offset="40%" stopColor="rgba(255,255,255,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
        </linearGradient>
      </defs>

      {/* Ombra a terra (più morbida e diffusa) */}
      <ellipse
        cx={cx}
        cy={baseY + 50}
        rx={platterRx + 18}
        ry={platterRy * 0.55}
        fill="rgba(60,20,100,0.28)"
        filter="blur(4px)"
      />

      {/* Vassoio viola — lato/profondità */}
      <path
        d={`M ${cx - platterRx} ${platterCy}
            v ${platterDepth}
            a ${platterRx} ${platterRy} 0 0 0 ${platterRx * 2} 0
            v ${-platterDepth} z`}
        fill="url(#platterRim)"
      />
      {/* Bordo inferiore scuro del vassoio */}
      <ellipse
        cx={cx}
        cy={platterCy + platterDepth}
        rx={platterRx}
        ry={platterRy}
        fill="#2a0f4a"
      />
      {/* Vassoio viola — top */}
      <ellipse cx={cx} cy={platterCy} rx={platterRx} ry={platterRy} fill="url(#platterViolet)" />
      {/* Riflesso lucido sul vassoio */}
      <ellipse
        cx={cx - platterRx * 0.3}
        cy={platterCy - platterRy * 0.35}
        rx={platterRx * 0.6}
        ry={platterRy * 0.45}
        fill="url(#platterShine)"
        opacity={0.85}
      />
      {/* Doppio bordo dorato decorativo del vassoio */}
      <ellipse
        cx={cx}
        cy={platterCy}
        rx={platterRx - 5}
        ry={platterRy - 3}
        fill="none"
        stroke="rgba(245,210,140,0.55)"
        strokeWidth={1.2}
      />
      <ellipse
        cx={cx}
        cy={platterCy}
        rx={platterRx - 12}
        ry={platterRy - 7}
        fill="none"
        stroke="rgba(245,210,140,0.25)"
        strokeWidth={0.7}
      />

      {/* GRUPPO TORTA: ruota sull'asse verticale (Y) tramite CSS */}
      <g className="cake-rotate" style={{ transformOrigin: `${cx}px ${baseY}px` }}>
        {/* Strati (dal basso verso l'alto): ogni strato = lato (rect) + top (ellisse) */}
        {Array.from({ length: layers }).map((_, i) => {
          const flavor = flavors[i] || flavors[flavors.length - 1] || { color: '#fff8e6' };
          const yTop = baseY - (i + 1) * layerH;
          const yBottom = yTop + layerH;
          const isTopLayer = i === layers - 1;

          // Costruisci il lato cilindrico come path: due ellissi (top e bottom) collegate
          const sidePath = `
            M ${cx - halfW} ${yTop}
            v ${layerH}
            a ${halfW} ${topRy} 0 0 0 ${cakeW} 0
            v ${-layerH}
          `;

          return (
            <g key={i}>
              {/* Lato dello strato */}
              <path d={sidePath} fill={flavor.color} />
              {/* Gradiente di luce sul lato (più chiaro a sx, più scuro a dx) */}
              <path
                d={sidePath}
                fill="url(#sideShade)"
                opacity={0.5}
              />
              {/* Disco superiore dello strato (visibile solo se non è coperto sopra) */}
              {(coverIsNaked || isTopLayer) && (
                <ellipse
                  cx={cx}
                  cy={yTop}
                  rx={halfW}
                  ry={topRy}
                  fill={flavor.color}
                />
              )}
              {/* Bordo "morso" leggero sul disco */}
              {(coverIsNaked || isTopLayer) && (
                <ellipse
                  cx={cx}
                  cy={yTop}
                  rx={halfW}
                  ry={topRy}
                  fill="none"
                  stroke={shadeColor(flavor.color, -0.18)}
                  strokeWidth={0.6}
                />
              )}

              {/* Farcitura tra strati: linea ondulata sopra al disco di ogni strato (tranne l'ultimo) */}
              {fillingColor && !isTopLayer && (
                <g>
                  <path
                    d={`M ${cx - halfW} ${yTop}
                        a ${halfW} ${topRy} 0 0 0 ${cakeW} 0`}
                    fill="none"
                    stroke={fillingColor}
                    strokeWidth={3.5}
                    strokeLinecap="round"
                  />
                </g>
              )}
            </g>
          );
        })}

        {/* Base biscotto sotto (sottile) */}
        <g>
          <path
            d={`M ${cx - halfW} ${baseY}
                v 6
                a ${halfW} ${topRy * 0.9} 0 0 0 ${cakeW} 0
                v -6`}
            fill={baseColor}
          />
          <ellipse cx={cx} cy={baseY} rx={halfW} ry={topRy} fill={baseColor} opacity={0.001} />
        </g>

        {/* Copertura esterna (solo se non naked): avvolge i lati e la calotta */}
        {!coverIsNaked && (
          <g>
            {/* Lato della copertura */}
            <path
              d={`M ${cx - halfW - 1} ${cakeTopY}
                  v ${totalCakeH}
                  a ${halfW + 1} ${topRy * 1.05} 0 0 0 ${cakeW + 2} 0
                  v ${-totalCakeH}
                  a ${halfW + 1} ${topRy * 1.05} 0 0 1 ${-(cakeW + 2)} 0`}
              fill={coverColor}
              stroke={shadeColor(coverColor, -0.15)}
              strokeWidth={0.5}
            />
            {/* Ombreggiatura lato (per dare volume) */}
            <path
              d={`M ${cx} ${cakeTopY}
                  v ${totalCakeH}
                  a ${halfW + 1} ${topRy * 1.05} 0 0 0 ${halfW + 1} ${-topRy * 1.05}
                  v ${-totalCakeH}`}
              fill="rgba(0,0,0,0.12)"
            />
            {/* Calotta superiore */}
            <ellipse
              cx={cx}
              cy={cakeTopY}
              rx={halfW + 1}
              ry={topRy * 1.05}
              fill={coverColor}
            />
            {/* Riflesso lucido sulla calotta (inclinato a sinistra) */}
            <ellipse
              cx={cx - halfW * 0.35}
              cy={cakeTopY - topRy * 0.25}
              rx={halfW * 0.45}
              ry={topRy * 0.35}
              fill="rgba(255,255,255,0.45)"
            />

            {/* Gocce/colature laterali per glasse liquide */}
            {(covering?.id === 'glassa-specchio' ||
              covering?.id === 'ganache-cop' ||
              covering?.id === 'cioccolato-cop') && (
              <g>
                {[0.12, 0.32, 0.52, 0.72, 0.88].map((p, i) => {
                  const angle = Math.PI * p; // mezzo cerchio frontale
                  const dx = -Math.cos(angle) * halfW;
                  const dy = Math.sin(angle) * topRy * 1.05;
                  const dh = 10 + ((i * 11) % 18);
                  return (
                    <path
                      key={i}
                      d={`M ${cx + dx - 4} ${cakeTopY + dy}
                          q 4 ${dh / 2} 8 0
                          v ${dh}
                          q -4 4 -8 0 z`}
                      fill={coverColor}
                      stroke={shadeColor(coverColor, -0.15)}
                      strokeWidth={0.4}
                    />
                  );
                })}
              </g>
            )}
          </g>
        )}

        {/* Pattern naked: contorni sottili per definire i singoli strati */}
        {coverIsNaked &&
          Array.from({ length: layers }).map((_, i) => {
            const yTop = baseY - (i + 1) * layerH;
            return (
              <ellipse
                key={`nk-${i}`}
                cx={cx}
                cy={yTop}
                rx={halfW}
                ry={topRy}
                fill="none"
                stroke="rgba(0,0,0,0.18)"
                strokeWidth={0.6}
              />
            );
          })}

        {/* Foto cialda sopra (cerchio prospettico) */}
        {photo && (
          <g>
            <defs>
              <clipPath id="photoClipTop">
                <ellipse cx={cx} cy={cakeTopY - 2} rx={halfW * 0.55} ry={topRy * 0.55} />
              </clipPath>
            </defs>
            <ellipse
              cx={cx}
              cy={cakeTopY - 2}
              rx={halfW * 0.6}
              ry={topRy * 0.6}
              fill="#d4b07a"
            />
            <image
              href={photo}
              x={cx - halfW * 0.55}
              y={cakeTopY - 2 - topRy * 0.55}
              width={halfW * 1.1}
              height={topRy * 1.1}
              preserveAspectRatio="xMidYMid slice"
              clipPath="url(#photoClipTop)"
            />
          </g>
        )}

        {/* Decorazioni sopra: 5 emoji disposte in cerchio (prospettico) sulla calotta */}
        {decorationEmoji && (
          <g fontSize="14" textAnchor="middle">
            {Array.from({ length: 5 }).map((_, i) => {
              const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
              const dx = Math.cos(a) * halfW * 0.55;
              const dy = Math.sin(a) * topRy * 0.55;
              return (
                <text key={i} x={cx + dx} y={cakeTopY - 2 + dy + 4}>
                  {decorationEmoji}
                </text>
              );
            })}
          </g>
        )}

        {/* Candelina (sull'asse centrale, leggermente avanti) */}
        {candle && (
          <g>
            <rect
              x={cx - 2}
              y={cakeTopY - 32}
              width={4}
              height={28}
              fill="#fff"
              stroke="#d8a8c8"
              strokeWidth={0.5}
              rx={1}
            />
            {/* Bandelle decorative sulla candela */}
            <rect x={cx - 2} y={cakeTopY - 24} width={4} height={2} fill="#b651e4" />
            <rect x={cx - 2} y={cakeTopY - 16} width={4} height={2} fill="#eb911e" />
            <line x1={cx} y1={cakeTopY - 32} x2={cx} y2={cakeTopY - 36} stroke="#3a2418" strokeWidth={1} />
            <ellipse cx={cx} cy={cakeTopY - 39} rx={3} ry={5} fill="#fff200" />
            <ellipse cx={cx} cy={cakeTopY - 39} rx={1.8} ry={3} fill="#eb911e" />
          </g>
        )}
      </g>

    </svg>
  );
}

/* Helper: schiarisce/scurisce un colore HEX di una percentuale (-1..1) */
function shadeColor(hex, amount) {
  const m = (hex || '#888888').replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  const apply = (v) =>
    Math.max(0, Math.min(255, Math.round(v + (amount > 0 ? (255 - v) * amount : v * amount))));
  const toHex = (v) => v.toString(16).padStart(2, '0');
  return `#${toHex(apply(r))}${toHex(apply(g))}${toHex(apply(b))}`;
}
