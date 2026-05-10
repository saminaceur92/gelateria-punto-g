import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * Vera torta 3D in CSS:
 * - Ogni strato = cilindro composto da N pannelli radiali + disco top/bottom
 * - Decorazioni 3D
 * - Candelina cilindrica con fiamma animata
 * - Scritta su un piano che giace orizzontale sulla calotta
 * - Drag su due assi (yaw + pitch) + autorotate
 */
const PANEL_COUNT = 28;
const SIZE_MAP = { '6': 0.78, '8': 0.86, '10': 0.92, '12': 1, '16': 1.08, '20': 1.14 };

export default function CakePreview({ config, interactive = true }) {
  const {
    type = 'semifreddo',
    sizeId = '8',
    flavors = [],
    decoration = 'minimal',
    message = '',
    candle = false,
    messageFont = 'caveat',
    messageRotation = 0,
  } = config;

  const scale = SIZE_MAP[sizeId] ?? 0.9;
  const layersN = type === 'piani' ? 3 : 2;

  const defaultColor = '#fff8e6';
  const layerColors = Array.from({ length: layersN }, (_, i) =>
    flavors[i]?.color || flavors[flavors.length - 1]?.color || defaultColor
  );

  const layerH = 44;
  const baseRadius = 130 * scale;

  const layers = layerColors.map((color, i) => ({
    color,
    radius: baseRadius * (1 - i * 0.08),
    height: layerH,
    yOffset: i * layerH,
  }));
  const totalHeight = layersN * layerH;
  const topRadius = layers[layers.length - 1].radius;

  // Rotazione (yaw + pitch)
  const [rot, setRot] = useState({ x: -18, y: -22 });
  const dragRef = useRef({ active: false, lastX: 0, lastY: 0, lastUserAt: Date.now() });

  useEffect(() => {
    if (!interactive) return;
    let raf;
    const tick = () => {
      const now = Date.now();
      if (!dragRef.current.active && now - dragRef.current.lastUserAt > 2500) {
        setRot((r) => ({ ...r, y: r.y + 0.25 }));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [interactive]);

  const onPointerDown = (e) => {
    if (!interactive) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current.active = true;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    dragRef.current.lastUserAt = Date.now();
  };
  const onPointerMove = (e) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    setRot((r) => ({
      x: clamp(r.x - dy * 0.4, -85, 30),
      y: r.y + dx * 0.5,
    }));
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    dragRef.current.lastUserAt = Date.now();
  };
  const onPointerUp = () => {
    dragRef.current.active = false;
    dragRef.current.lastUserAt = Date.now();
  };

  return (
    <div
      className={`cake-3d ${interactive ? 'interactive' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerUp}
      style={{ touchAction: 'none' }}
    >
      <div
        className="cake-3d-scene"
        style={{ transform: `translateY(20px) rotateX(${rot.x}deg) rotateY(${rot.y}deg)` }}
      >
        {/* Ombra a terra */}
        <div
          className="cake-shadow"
          style={{
            width: baseRadius * 2.4,
            height: baseRadius * 0.6,
            transform: `translate(-50%, -50%) translateY(20px) rotateX(90deg)`,
          }}
        />

        {/* Sotto-torta dorato (board) */}
        <BoardPlate radius={baseRadius * 1.1} y={-2} />

        {/* Strati */}
        {layers.map((l, i) => (
          <Cylinder
            key={i}
            radius={l.radius}
            height={l.height}
            yBase={l.yOffset}
            color={l.color}
          />
        ))}

        {/* Decorazione sopra */}
        <Decoration kind={decoration} radius={topRadius} y={totalHeight + 2} />

        {/* Candelina */}
        {candle && <Candle y={totalHeight + 4} />}

        {/* Scritta sul top */}
        {message && (
          <CakeText
            text={message}
            font={messageFont}
            rotation={messageRotation}
            radius={topRadius}
            y={totalHeight + 0.6}
          />
        )}
      </div>

      {interactive && (
        <div className="cake-3d-hint" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 0 1 15-6.7" /><path d="M21 4v5h-5" />
            <path d="M21 12a9 9 0 0 1-15 6.7" /><path d="M3 20v-5h5" />
          </svg>
          Trascina per ruotare
        </div>
      )}
    </div>
  );
}

/* ====================== Primitives 3D ====================== */

function BoardPlate({ radius, y }) {
  return (
    <>
      {/* Top dorato */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: radius * 2,
          height: radius * 2,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 40% 35%, #f5e0b8, #d4b07a 70%, #a07c5a)',
          transform: `translate(-50%, -50%) translateY(${-y}px) rotateX(90deg)`,
          boxShadow: 'inset 0 0 30px rgba(0,0,0,0.15)',
        }}
      />
      {/* Bordo laterale (cilindro sottile) */}
      {Array.from({ length: PANEL_COUNT }).map((_, i) => {
        const angle = (i * 360) / PANEL_COUNT;
        const w = 2 * radius * Math.sin(Math.PI / PANEL_COUNT) + 0.5;
        const lightFactor = 0.5 + 0.5 * Math.cos(((angle - 30) * Math.PI) / 180);
        const c = mix('#a07c5a', '#5a3520', 1 - lightFactor);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: w,
              height: 6,
              background: `linear-gradient(180deg, ${lighten(c, 0.1)}, ${c}, ${darken(c, 0.15)})`,
              transform: `translate(-50%, -50%) translateY(${-(y - 3)}px) rotateY(${angle}deg) translateZ(${radius}px)`,
            }}
          />
        );
      })}
    </>
  );
}

function Cylinder({ radius, height, yBase, color }) {
  const panels = useMemo(() => {
    const arr = [];
    const panelW = 2 * radius * Math.sin(Math.PI / PANEL_COUNT) + 0.6;
    for (let i = 0; i < PANEL_COUNT; i++) {
      const angle = (i * 360) / PANEL_COUNT;
      const lightFactor = 0.5 + 0.5 * Math.cos(((angle - 30) * Math.PI) / 180);
      const bg = mix(color, '#ffffff', lightFactor * 0.32);
      const shadow = mix(color, '#000000', (1 - lightFactor) * 0.22);
      arr.push({ angle, panelW, color: mix(bg, shadow, 0.4) });
    }
    return arr;
  }, [radius, color]);

  return (
    <>
      {/* Pannelli laterali */}
      {panels.map((p, i) => (
        <div
          key={`side-${i}`}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: p.panelW,
            height: height,
            background: `linear-gradient(180deg, ${lighten(p.color, 0.1)}, ${p.color} 50%, ${darken(p.color, 0.12)})`,
            transform: `translate(-50%, -50%) translateY(${-(yBase + height / 2)}px) rotateY(${p.angle}deg) translateZ(${radius}px)`,
          }}
        />
      ))}
      {/* Disco superiore */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: radius * 2,
          height: radius * 2,
          borderRadius: '50%',
          background: `radial-gradient(circle at 40% 35%, ${lighten(color, 0.22)}, ${color} 55%, ${darken(color, 0.1)})`,
          transform: `translate(-50%, -50%) translateY(${-(yBase + height)}px) rotateX(90deg)`,
          boxShadow: `inset 0 0 25px ${darken(color, 0.18)}55`,
        }}
      />
      {/* Goccioline di crema sul bordo */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * 360) / 12;
        return (
          <div
            key={`drop-${i}`}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 16,
              height: 22,
              borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
              background: `radial-gradient(circle at 35% 30%, ${lighten(color, 0.3)}, ${color})`,
              transform: `translate(-50%, -50%) translateY(${-(yBase + height - 4)}px) rotateY(${a}deg) translateZ(${radius - 1}px)`,
              boxShadow: `inset -2px -3px 4px ${darken(color, 0.2)}`,
            }}
          />
        );
      })}
    </>
  );
}

function Candle({ y }) {
  return (
    <>
      {/* Cilindro candelina */}
      {Array.from({ length: 14 }).map((_, i) => {
        const a = (i * 360) / 14;
        const r = 5;
        const w = 2 * r * Math.sin(Math.PI / 14) + 0.4;
        return (
          <div
            key={`candle-${i}`}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: w,
              height: 38,
              background: `linear-gradient(180deg, #fff 0%, #f0f0f0 50%, #d0d0d0 100%)`,
              transform: `translate(-50%, -50%) translateY(${-(y + 19)}px) rotateY(${a}deg) translateZ(${r}px)`,
            }}
          />
        );
      })}
      {/* Disco top candela */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: '#fff',
          transform: `translate(-50%, -50%) translateY(${-(y + 38)}px) rotateX(90deg)`,
        }}
      />
      {/* Stoppino */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 1.5,
          height: 6,
          background: '#3a2418',
          transform: `translate(-50%, -50%) translateY(${-(y + 41)}px)`,
        }}
      />
      {/* Fiamma */}
      <motion.div
        animate={{ scale: [1, 1.12, 0.95, 1.08, 1] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 14,
          height: 24,
          borderRadius: '50% 50% 50% 50% / 70% 70% 30% 30%',
          background: 'radial-gradient(ellipse at 50% 70%, #fff200, #eb911e 55%, rgba(235,145,30,0) 100%)',
          transform: `translate(-50%, -50%) translateY(${-(y + 54)}px)`,
          filter: 'blur(0.4px)',
          boxShadow: '0 0 28px rgba(235,145,30,0.7)',
          pointerEvents: 'none',
        }}
      />
      {/* Glow sulla torta */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(235,145,30,0.28), transparent 70%)',
          transform: `translate(-50%, -50%) translateY(${-(y + 6)}px) rotateX(90deg)`,
          pointerEvents: 'none',
        }}
      />
    </>
  );
}

function Decoration({ kind, radius, y }) {
  if (kind === 'minimal') {
    return Array.from({ length: 5 }).map((_, i) => {
      const a = (i * 360) / 5;
      const r = radius * 0.55;
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 16,
            height: 16,
            color: '#b651e4',
            fontSize: 16,
            lineHeight: '16px',
            textAlign: 'center',
            transform: `translate(-50%, -50%) translateY(${-(y + 1)}px) rotateX(90deg) translate(${Math.cos(a * Math.PI / 180) * r}px, ${Math.sin(a * Math.PI / 180) * r}px)`,
          }}
        >
          ✻
        </div>
      );
    });
  }
  if (kind === 'frutta') {
    const fruits = ['#e84a6e', '#f5e26a', '#7ea15a', '#eb911e', '#c94a6b', '#b651e4'];
    return fruits.map((c, i) => {
      const a = (i * 360) / fruits.length;
      const r = radius * 0.55;
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: `radial-gradient(circle at 35% 30%, ${lighten(c, 0.3)}, ${c} 65%, ${darken(c, 0.2)})`,
            transform: `translate(-50%, -50%) translateY(${-(y + 9)}px) translate(${Math.cos(a * Math.PI / 180) * r}px, ${Math.sin(a * Math.PI / 180) * r}px)`,
            boxShadow: `0 3px 8px ${darken(c, 0.3)}77`,
          }}
        />
      );
    });
  }
  if (kind === 'cioccolato') {
    return Array.from({ length: 14 }).map((_, i) => {
      const a = (i * 360) / 14;
      const r = radius * 0.55;
      const c = i % 2 ? '#3a2418' : '#5a3520';
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 14,
            height: 6,
            borderRadius: 3,
            background: `linear-gradient(180deg, ${lighten(c, 0.2)}, ${c})`,
            transform: `translate(-50%, -50%) translateY(${-(y + 3)}px) rotateX(90deg) translate(${Math.cos(a * Math.PI / 180) * r}px, ${Math.sin(a * Math.PI / 180) * r}px) rotate(${a + 90}deg)`,
            boxShadow: `0 1px 2px ${darken(c, 0.4)}`,
          }}
        />
      );
    });
  }
  if (kind === 'panna') {
    return Array.from({ length: 9 }).map((_, i) => {
      const a = (i * 360) / 9;
      const r = radius * 0.7;
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 20,
            height: 24,
            borderRadius: '50% 50% 50% 50% / 70% 70% 30% 30%',
            background: 'radial-gradient(circle at 35% 30%, #fff, #e8d8c0)',
            transform: `translate(-50%, -50%) translateY(${-(y + 12)}px) translate(${Math.cos(a * Math.PI / 180) * r}px, ${Math.sin(a * Math.PI / 180) * r}px)`,
            boxShadow: 'inset -3px -3px 4px rgba(0,0,0,0.08)',
          }}
        />
      );
    });
  }
  if (kind === 'fantasy') {
    const colors = ['#b651e4', '#eb911e', '#7ea15a', '#e84a6e', '#a5cdcb', '#f5e26a'];
    return Array.from({ length: 24 }).map((_, i) => {
      const a = (i * 360) / 24;
      const r = radius * (0.3 + (i % 3) * 0.18);
      const c = colors[i % colors.length];
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 4,
            height: 12,
            borderRadius: 2,
            background: c,
            transform: `translate(-50%, -50%) translateY(${-(y + 6)}px) translate(${Math.cos(a * Math.PI / 180) * r}px, ${Math.sin(a * Math.PI / 180) * r}px) rotate(${a * 2}deg)`,
          }}
        />
      );
    });
  }
  return null;
}

function CakeText({ text, font, rotation, radius, y }) {
  const fontMap = {
    caveat: { family: "'Caveat', cursive", size: 28, weight: 700 },
    fraunces: { family: "'Fraunces', serif", size: 20, weight: 700, italic: true },
    inter: { family: "'Inter', sans-serif", size: 16, weight: 700, upper: true },
  };
  const f = fontMap[font] || fontMap.caveat;
  const display = f.upper ? text.toUpperCase() : text;
  const dynSize = Math.min(f.size, (radius * 1.7) / Math.max(display.length * 0.55, 5));
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: radius * 2,
        height: 60,
        display: 'grid',
        placeItems: 'center',
        transform: `translate(-50%, -50%) translateY(${-(y + 1)}px) rotateX(90deg) rotate(${rotation}deg)`,
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          fontFamily: f.family,
          fontSize: dynSize,
          fontWeight: f.weight,
          fontStyle: f.italic ? 'italic' : 'normal',
          letterSpacing: f.upper ? '0.1em' : 'normal',
          color: '#602e9e',
          padding: '3px 12px',
          background: 'rgba(255,255,255,0.55)',
          borderRadius: 999,
          backdropFilter: 'blur(2px)',
          whiteSpace: 'nowrap',
          textShadow: '0 0 6px rgba(255,249,237,0.9)',
        }}
      >
        {display}
      </span>
    </div>
  );
}

/* ===================== Color helpers ===================== */
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
function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex({ r: A.r + (B.r - A.r) * t, g: A.g + (B.g - A.g) * t, b: A.b + (B.b - A.b) * t });
}
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
