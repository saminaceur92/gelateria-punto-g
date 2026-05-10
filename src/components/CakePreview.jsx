import { useMemo, useRef, useState } from 'react';
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
    photo = null,
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

  // Rotazione (yaw + pitch) — solo manuale, niente autorotate
  const [rot, setRot] = useState({ x: -22, y: -18 });
  const dragRef = useRef({ active: false, lastX: 0, lastY: 0 });

  const onPointerDown = (e) => {
    if (!interactive) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current.active = true;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
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
  };
  const onPointerUp = () => {
    dragRef.current.active = false;
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
        {layers.map((l, i) => {
          const isTop = i === layers.length - 1;
          return (
            <Cylinder
              key={i}
              radius={l.radius}
              height={l.height}
              yBase={l.yOffset}
              color={l.color}
              topImage={isTop && photo ? photo : null}
            />
          );
        })}

        {/* Foto bordino decorativo (se presente) */}
        {photo && <PhotoFrame radius={topRadius} y={totalHeight + 0.4} />}

        {/* Decorazione: se c'è messaggio o foto, va sul perimetro (lascia spazio al centro) */}
        {photo || message ? (
          <DecorationRing kind={decoration} radius={topRadius} y={totalHeight + 2} />
        ) : (
          <Decoration kind={decoration} radius={topRadius} y={totalHeight + 2} topColor={layerColors[layerColors.length - 1]} />
        )}

        {/* Candelina (di lato se c'è messaggio per non coprirlo) */}
        {candle && <Candle y={totalHeight + 4} offsetX={message ? topRadius * 0.65 : 0} offsetZ={message ? -topRadius * 0.2 : 0} />}

        {/* Scritta sul top */}
        {message && (
          <CakeText
            text={message}
            font={messageFont}
            rotation={messageRotation}
            radius={topRadius}
            y={totalHeight + (photo ? 1.2 : 0.6)}
            topColor={layerColors[layerColors.length - 1]}
            onPhoto={!!photo}
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

function Cylinder({ radius, height, yBase, color, topImage = null }) {
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
      {/* Disco superiore (o foto se topImage) */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: radius * 2,
          height: radius * 2,
          borderRadius: '50%',
          background: topImage
            ? `url(${topImage}) center/cover no-repeat, ${color}`
            : `radial-gradient(circle at 40% 35%, ${lighten(color, 0.22)}, ${color} 55%, ${darken(color, 0.1)})`,
          transform: `translate(-50%, -50%) translateY(${-(yBase + height)}px) rotateX(90deg)`,
          boxShadow: topImage
            ? `inset 0 0 18px rgba(0,0,0,0.25)`
            : `inset 0 0 25px ${darken(color, 0.18)}55`,
          overflow: 'hidden',
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

function Candle({ y, offsetX = 0, offsetZ = 0 }) {
  const ox = offsetX;
  const oz = offsetZ;
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
              transform: `translate(-50%, -50%) translateY(${-(y + 19)}px) translate3d(${ox}px, 0, ${oz}px) rotateY(${a}deg) translateZ(${r}px)`,
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
          transform: `translate(-50%, -50%) translateY(${-(y + 38)}px) translate3d(${ox}px, 0, ${oz}px) rotateX(90deg)`,
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
          transform: `translate(-50%, -50%) translateY(${-(y + 41)}px) translate3d(${ox}px, 0, ${oz}px)`,
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
          transform: `translate(-50%, -50%) translateY(${-(y + 54)}px) translate3d(${ox}px, 0, ${oz}px)`,
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
          transform: `translate(-50%, -50%) translateY(${-(y + 6)}px) translate3d(${ox}px, 0, ${oz}px) rotateX(90deg)`,
          pointerEvents: 'none',
        }}
      />
    </>
  );
}

function PhotoFrame({ radius, y }) {
  // Cornice dorata sulla foto
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: radius * 2 + 6,
        height: radius * 2 + 6,
        borderRadius: '50%',
        border: '3px solid #d4b07a',
        boxShadow: 'inset 0 0 8px rgba(0,0,0,0.3), 0 0 6px rgba(212,176,122,0.5)',
        transform: `translate(-50%, -50%) translateY(${-y}px) rotateX(90deg)`,
        pointerEvents: 'none',
      }}
    />
  );
}

function Decoration({ kind, radius, y, topColor }) {
  if (kind === 'minimal') {
    // Rosellina di panna al centro + 6 piccoli fiori sul bordo
    const centerFlower = (
      <Rosette key="center" x={0} z={0} y={y + 8} size={28} colorPetal="#fff" colorCenter="#eb911e" />
    );
    const ring = Array.from({ length: 6 }).map((_, i) => {
      const a = (i * 360) / 6;
      const r = radius * 0.62;
      return (
        <Rosette
          key={i}
          x={Math.cos((a * Math.PI) / 180) * r}
          z={Math.sin((a * Math.PI) / 180) * r}
          y={y + 6}
          size={18}
          colorPetal="#ffd9e6"
          colorCenter="#b651e4"
        />
      );
    });
    return [centerFlower, ...ring];
  }

  if (kind === 'frutta') {
    // Mix di frutti realistici: fragole, mirtilli, lamponi, kiwi
    const fruits = [
      { type: 'strawberry', color: '#e22e4f' },
      { type: 'blueberry', color: '#3a4a8c' },
      { type: 'raspberry', color: '#c93060' },
      { type: 'kiwi', color: '#9bc56a' },
      { type: 'strawberry', color: '#d83048' },
      { type: 'blueberry', color: '#2d3a78' },
      { type: 'raspberry', color: '#bf2a55' },
      { type: 'kiwi', color: '#a8cc78' },
    ];
    const ring = fruits.map((f, i) => {
      const a = (i * 360) / fruits.length;
      const r = radius * 0.6;
      const x = Math.cos((a * Math.PI) / 180) * r;
      const z = Math.sin((a * Math.PI) / 180) * r;
      return <Fruit key={i} type={f.type} color={f.color} x={x} z={z} y={y} />;
    });
    // Mix piccoli al centro
    const center = Array.from({ length: 5 }).map((_, i) => {
      const a = (i * 360) / 5 + 30;
      const r = radius * 0.22;
      const f = fruits[i];
      return (
        <Fruit
          key={`c-${i}`}
          type={f.type}
          color={f.color}
          x={Math.cos((a * Math.PI) / 180) * r}
          z={Math.sin((a * Math.PI) / 180) * r}
          y={y}
          scale={0.75}
        />
      );
    });
    return [...ring, ...center];
  }

  if (kind === 'cioccolato') {
    // Riccioli di cioccolato 3D + gocce di ganache
    const curls = Array.from({ length: 10 }).map((_, i) => {
      const a = (i * 360) / 10;
      const r = radius * 0.55;
      const x = Math.cos((a * Math.PI) / 180) * r;
      const z = Math.sin((a * Math.PI) / 180) * r;
      return <ChocoCurl key={i} x={x} z={z} y={y} rot={a + 30} dark={i % 2 === 0} />;
    });
    const drops = Array.from({ length: 18 }).map((_, i) => {
      const a = (i * 360) / 18 + 10;
      const r = radius * (0.85 + (i % 2) * 0.05);
      const x = Math.cos((a * Math.PI) / 180) * r;
      const z = Math.sin((a * Math.PI) / 180) * r;
      const len = 8 + (i % 3) * 6;
      return (
        <div
          key={`d-${i}`}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 5,
            height: len,
            borderRadius: '50% 50% 40% 40%',
            background: 'linear-gradient(180deg, #5a3520, #2a1208)',
            transform: `translate(-50%, -50%) translateY(${-(y - len / 2)}px) translate3d(${x}px, 0, ${z}px) rotateY(${-a}deg)`,
            boxShadow: 'inset -1px 0 2px rgba(0,0,0,0.4)',
          }}
        />
      );
    });
    // Cioccolatino centrale
    const center = (
      <div
        key="c"
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 28,
          height: 28,
          borderRadius: 4,
          background: 'linear-gradient(135deg, #6b3a20, #2a1208)',
          boxShadow: 'inset 2px 2px 4px rgba(255,255,255,0.15), inset -2px -2px 4px rgba(0,0,0,0.4), 0 4px 8px rgba(0,0,0,0.3)',
          transform: `translate(-50%, -50%) translateY(${-(y + 8)}px) rotateX(90deg) rotate(45deg)`,
        }}
      />
    );
    return [...curls, ...drops, center];
  }

  if (kind === 'panna') {
    // Ciuffi di panna grandi, alti, con punta
    const big = Array.from({ length: 8 }).map((_, i) => {
      const a = (i * 360) / 8;
      const r = radius * 0.7;
      const x = Math.cos((a * Math.PI) / 180) * r;
      const z = Math.sin((a * Math.PI) / 180) * r;
      return <CreamSwirl key={i} x={x} z={z} y={y} size={1} />;
    });
    const small = Array.from({ length: 5 }).map((_, i) => {
      const a = (i * 360) / 5 + 36;
      const r = radius * 0.3;
      const x = Math.cos((a * Math.PI) / 180) * r;
      const z = Math.sin((a * Math.PI) / 180) * r;
      return <CreamSwirl key={`s-${i}`} x={x} z={z} y={y} size={0.7} />;
    });
    return [...big, ...small];
  }

  if (kind === 'fantasy') {
    // Sprinkles colorati ovunque + macarons sui bordi
    const colors = ['#b651e4', '#eb911e', '#7ea15a', '#e84a6e', '#6db8b6', '#f5e26a', '#ff6f9c'];
    const sprinkles = Array.from({ length: 60 }).map((_, i) => {
      const a = (i * 137.5) % 360;
      const r = radius * (0.15 + ((i * 13) % 100) / 100 * 0.7);
      const x = Math.cos((a * Math.PI) / 180) * r;
      const z = Math.sin((a * Math.PI) / 180) * r;
      const c = colors[i % colors.length];
      const rot = (i * 47) % 180;
      return (
        <div
          key={`sp-${i}`}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 3,
            height: 9,
            borderRadius: 2,
            background: c,
            transform: `translate(-50%, -50%) translateY(${-(y + 4)}px) rotateX(80deg) translate3d(${x}px, 0, ${z}px) rotateZ(${rot}deg)`,
            boxShadow: `0 0 2px ${c}`,
          }}
        />
      );
    });
    const macarons = Array.from({ length: 5 }).map((_, i) => {
      const a = (i * 360) / 5;
      const r = radius * 0.65;
      const x = Math.cos((a * Math.PI) / 180) * r;
      const z = Math.sin((a * Math.PI) / 180) * r;
      const c = colors[(i * 2) % colors.length];
      return <Macaron key={`m-${i}`} x={x} z={z} y={y} color={c} />;
    });
    return [...sprinkles, ...macarons];
  }
  return null;
}

/* DecorationRing — versione perimetrale per quando c'è una foto sopra */
function DecorationRing({ kind, radius, y }) {
  const colorMap = {
    minimal: '#ffd9e6',
    frutta: '#e22e4f',
    cioccolato: '#5a3520',
    panna: '#fff',
    fantasy: '#b651e4',
  };
  const color = colorMap[kind] || '#fff';
  const count = kind === 'panna' ? 14 : kind === 'fantasy' ? 18 : 12;
  return Array.from({ length: count }).map((_, i) => {
    const a = (i * 360) / count;
    const r = radius * 0.92;
    const x = Math.cos((a * Math.PI) / 180) * r;
    const z = Math.sin((a * Math.PI) / 180) * r;
    if (kind === 'panna') return <CreamSwirl key={i} x={x} z={z} y={y} size={0.55} />;
    if (kind === 'frutta') {
      const types = ['strawberry', 'blueberry', 'raspberry'];
      const colors = ['#e22e4f', '#3a4a8c', '#c93060'];
      return <Fruit key={i} type={types[i % 3]} color={colors[i % 3]} x={x} z={z} y={y} scale={0.7} />;
    }
    if (kind === 'cioccolato') return <ChocoCurl key={i} x={x} z={z} y={y} rot={a + 30} dark={i % 2 === 0} />;
    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: `radial-gradient(circle at 35% 30%, ${lighten(color, 0.3)}, ${color})`,
          transform: `translate(-50%, -50%) translateY(${-(y + 5)}px) translate3d(${x}px, 0, ${z}px)`,
          boxShadow: `0 2px 4px rgba(0,0,0,0.25)`,
        }}
      />
    );
  });
}

/* Sotto-componenti decorativi */
function Rosette({ x, z, y, size, colorPetal, colorCenter }) {
  const petals = Array.from({ length: 6 }).map((_, i) => {
    const a = (i * 360) / 6;
    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: size * 0.5,
          height: size * 0.7,
          borderRadius: '50%',
          background: `radial-gradient(circle at 40% 30%, #fff, ${colorPetal} 80%)`,
          transform: `translate(-50%, -50%) rotate(${a}deg) translateY(${-size * 0.32}px)`,
          boxShadow: 'inset -2px -2px 3px rgba(0,0,0,0.1)',
        }}
      />
    );
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: size * 1.2,
        height: size * 1.2,
        transform: `translate(-50%, -50%) translateY(${-y}px) translate3d(${x}px, 0, ${z}px) rotateX(90deg)`,
      }}
    >
      {petals}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: size * 0.35,
          height: size * 0.35,
          borderRadius: '50%',
          background: `radial-gradient(circle at 40% 30%, ${lighten(colorCenter, 0.3)}, ${colorCenter})`,
          transform: 'translate(-50%, -50%)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
        }}
      />
    </div>
  );
}

function Fruit({ type, color, x, z, y, scale = 1 }) {
  const baseStyle = {
    position: 'absolute',
    left: '50%',
    top: '50%',
  };
  if (type === 'strawberry') {
    return (
      <div
        style={{
          ...baseStyle,
          width: 18 * scale,
          height: 22 * scale,
          borderRadius: '50% 50% 50% 50% / 40% 40% 60% 60%',
          background: `radial-gradient(circle at 35% 25%, ${lighten(color, 0.4)}, ${color} 60%, ${darken(color, 0.3)})`,
          transform: `translate(-50%, -50%) translateY(${-(y + 11 * scale)}px) translate3d(${x}px, 0, ${z}px)`,
          boxShadow: `0 3px 8px rgba(0,0,0,0.3), inset -2px -3px 4px ${darken(color, 0.4)}`,
        }}
      >
        {/* Semini */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: 1.5,
              height: 2.5,
              background: '#f5e26a',
              borderRadius: 1,
              top: `${20 + (i % 3) * 20}%`,
              left: `${25 + (i % 2) * 30}%`,
              transform: 'rotate(15deg)',
            }}
          />
        ))}
        {/* Foglietta */}
        <div
          style={{
            position: 'absolute',
            top: -3,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 10,
            height: 6,
            background: '#5a8a3a',
            clipPath: 'polygon(0 100%, 50% 0, 100% 100%, 75% 60%, 50% 100%, 25% 60%)',
          }}
        />
      </div>
    );
  }
  if (type === 'blueberry') {
    return (
      <div
        style={{
          ...baseStyle,
          width: 14 * scale,
          height: 14 * scale,
          borderRadius: '50%',
          background: `radial-gradient(circle at 30% 25%, ${lighten(color, 0.5)}, ${color} 60%, ${darken(color, 0.3)})`,
          transform: `translate(-50%, -50%) translateY(${-(y + 7 * scale)}px) translate3d(${x}px, 0, ${z}px)`,
          boxShadow: `0 2px 5px rgba(0,0,0,0.4), inset -1px -2px 3px ${darken(color, 0.4)}`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '15%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 4,
            height: 4,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.4)',
          }}
        />
      </div>
    );
  }
  if (type === 'raspberry') {
    return (
      <div
        style={{
          ...baseStyle,
          width: 16 * scale,
          height: 14 * scale,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color}, ${darken(color, 0.3)})`,
          transform: `translate(-50%, -50%) translateY(${-(y + 7 * scale)}px) translate3d(${x}px, 0, ${z}px)`,
          boxShadow: `0 2px 5px rgba(0,0,0,0.3)`,
        }}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: 3,
              height: 3,
              borderRadius: '50%',
              background: `radial-gradient(circle at 30% 30%, ${lighten(color, 0.5)}, ${color})`,
              top: `${15 + Math.floor(i / 4) * 30}%`,
              left: `${10 + (i % 4) * 22}%`,
            }}
          />
        ))}
      </div>
    );
  }
  if (type === 'kiwi') {
    return (
      <div
        style={{
          ...baseStyle,
          width: 16 * scale,
          height: 16 * scale,
          borderRadius: '50%',
          background: `radial-gradient(circle, #fff 0%, ${color} 35%, ${darken(color, 0.2)} 95%)`,
          transform: `translate(-50%, -50%) translateY(${-(y + 3)}px) translate3d(${x}px, 0, ${z}px) rotateX(80deg)`,
          boxShadow: `0 2px 4px rgba(0,0,0,0.25)`,
          border: '1px solid #c8b070',
        }}
      >
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i * 360) / 8;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: 1.5,
                height: 2,
                background: '#1a1a1a',
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%) rotate(${a}deg) translateY(-4px)`,
                borderRadius: 1,
              }}
            />
          );
        })}
      </div>
    );
  }
  return null;
}

function ChocoCurl({ x, z, y, rot, dark }) {
  const c1 = dark ? '#3a1f10' : '#6b3a20';
  const c2 = dark ? '#1a0a04' : '#3a1f10';
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: 22,
        height: 10,
        borderRadius: '6px 6px 6px 6px / 50% 50% 50% 50%',
        background: `linear-gradient(180deg, ${c1} 0%, ${c2} 50%, ${c1} 100%)`,
        transform: `translate(-50%, -50%) translateY(${-(y + 8)}px) translate3d(${x}px, 0, ${z}px) rotateY(${-rot}deg) rotateX(20deg)`,
        boxShadow: 'inset 0 -2px 3px rgba(0,0,0,0.5), 0 3px 6px rgba(0,0,0,0.3)',
      }}
    />
  );
}

function CreamSwirl({ x, z, y, size = 1 }) {
  // Ciuffo di panna fatto a strati che si restringono
  const layers = 5;
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: `translate(-50%, -50%) translateY(${-y}px) translate3d(${x}px, 0, ${z}px)`,
      }}
    >
      {Array.from({ length: layers }).map((_, i) => {
        const w = (22 - i * 3) * size;
        const yShift = -i * 5 * size;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: w,
              height: w,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 30%, #ffffff, #f0e0c8)',
              transform: `translate(-50%, -50%) translateY(${yShift}px)`,
              boxShadow: 'inset -2px -3px 4px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.15)',
            }}
          />
        );
      })}
      {/* Punta */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 4 * size,
          height: 8 * size,
          borderRadius: '50% 50% 30% 30%',
          background: '#fff',
          transform: `translate(-50%, -50%) translateY(${-(layers + 1) * 5 * size}px)`,
        }}
      />
    </div>
  );
}

function Macaron({ x, z, y, color }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: 22,
        height: 16,
        transform: `translate(-50%, -50%) translateY(${-(y + 8)}px) translate3d(${x}px, 0, ${z}px)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: 22,
          height: 7,
          borderRadius: '50% 50% 30% 30%',
          background: `radial-gradient(ellipse at 40% 30%, ${lighten(color, 0.4)}, ${color})`,
          top: 0,
          boxShadow: 'inset 0 -1px 2px rgba(0,0,0,0.2)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 20,
          height: 4,
          background: '#fff5dd',
          top: 6,
          left: 1,
          borderRadius: 1,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 22,
          height: 7,
          borderRadius: '30% 30% 50% 50%',
          background: `radial-gradient(ellipse at 40% 70%, ${lighten(color, 0.4)}, ${color})`,
          bottom: 0,
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)',
        }}
      />
    </div>
  );
}

function CakeText({ text, font, rotation, radius, y, topColor, onPhoto }) {
  const fontMap = {
    caveat: { family: "'Caveat', cursive", weight: 700, lineH: 0.85, charW: 0.42 },
    fraunces: { family: "'Fraunces', serif", weight: 700, italic: true, lineH: 1, charW: 0.5 },
    inter: { family: "'Inter', sans-serif", weight: 800, upper: true, lineH: 1.05, charW: 0.62 },
  };
  const f = fontMap[font] || fontMap.caveat;
  const display = (f.upper ? text.toUpperCase() : text).trim();

  // Spezza in righe per riempire la torta a forma circolare
  // Diametro utile ~ 1.7 * radius. Se la frase è lunga, andiamo su 2 righe.
  const words = display.split(/\s+/);
  const targetWidth = radius * 1.75;
  const maxWidth = radius * 1.85;

  // Trova la migliore divisione in 1 o 2 righe per massimizzare la dimensione carattere
  const candidates = [];
  // 1 riga
  candidates.push([display]);
  // 2 righe (cerca il punto di rottura migliore tra le parole)
  if (words.length > 1) {
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' ');
      const b = words.slice(i).join(' ');
      candidates.push([a, b]);
    }
  }

  let best = { lines: [display], size: 0 };
  for (const lines of candidates) {
    const longest = Math.max(...lines.map((l) => l.length));
    // dimensione in modo che la riga più lunga occupi targetWidth
    const sizeByWidth = targetWidth / Math.max(longest * f.charW, 3);
    // limite altezza: 2 righe non devono uscire dal disco (riserva diametro)
    const sizeByHeight = (radius * 1.4) / (lines.length * f.lineH);
    const size = Math.min(sizeByWidth, sizeByHeight);
    if (size > best.size) best = { lines, size };
  }

  // Limite massimo assoluto
  const dynSize = Math.min(best.size, 90);

  // Colore intelligente
  const lum = onPhoto ? 0.6 : luminance(topColor);
  const isDark = lum < 0.55;
  const inkColor = isDark ? '#fff8e6' : '#3a1f10';
  const stroke = isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.7)';

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: maxWidth,
        height: maxWidth,
        display: 'grid',
        placeItems: 'center',
        transform: `translate(-50%, -50%) translateY(${-(y + 1)}px) rotateX(90deg) rotate(${rotation}deg)`,
        pointerEvents: 'none',
        textAlign: 'center',
      }}
    >
      <span
        style={{
          fontFamily: f.family,
          fontSize: dynSize,
          fontWeight: f.weight,
          fontStyle: f.italic ? 'italic' : 'normal',
          letterSpacing: f.upper ? '0.06em' : 'normal',
          color: inkColor,
          lineHeight: f.lineH,
          whiteSpace: 'pre-line',
          textShadow: `1px 1px 0 ${stroke}, -1px 1px 0 ${stroke}, 1px -1px 0 ${stroke}, -1px -1px 0 ${stroke}, 0 2px 6px rgba(0,0,0,0.35)`,
          filter: isDark
            ? 'drop-shadow(0 2px 1px rgba(0,0,0,0.5))'
            : 'drop-shadow(0 1px 0 rgba(255,255,255,0.5))',
        }}
      >
        {best.lines.join('\n')}
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
function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  // luminanza percepita (Rec. 709 semplificata)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
