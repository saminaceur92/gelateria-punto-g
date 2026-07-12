/**
 * Cake3D — torta gelato in 3D reale (WebGL via three.js + react-three-fiber).
 *
 * Filosofia: OGNI GUSTO È UNO STRATO DI COLORE PIENO, impilato come una vera
 * torta gelato. Materiali tipo gelato/panna (clearcoat + sheen), luci da studio
 * con ombre morbide, vassoio viola Punto Gi! con bordo dorato, rotazione
 * automatica + trascinamento col mouse/dito.
 *
 * Forme supportate: tonda (cilindro), cuore (extrude), quadrata/rettangolare
 * (rounded box). Copertura solo sulla calotta (per non nascondere i gusti) con
 * colature. Farcitura come anelli sottili tra gli strati. Decorazioni, foto su
 * cialda e candelina in 3D.
 */

import { Suspense, useMemo, useRef, useState, useEffect, useLayoutEffect } from 'react';
import { Canvas, useLoader, useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  ContactShadows,
  Environment,
  Lightformer,
} from '@react-three/drei';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three-stdlib';

/* ============================ utilità colore ============================ */

function shade(hex, amount) {
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

/** Mescola due colori HEX (t=0 → a, t=1 → b). */
function mix(hexA, hexB, t) {
  const p = (h) => {
    const m = (h || '#888').replace('#', '');
    const f = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
    return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
  };
  const a = p(hexA);
  const b = p(hexB);
  const toHex = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${toHex(a[0] + (b[0] - a[0]) * t)}${toHex(a[1] + (b[1] - a[1]) * t)}${toHex(a[2] + (b[2] - a[2]) * t)}`;
}

/** Colore "gelato": ammorbidito verso la crema → tono naturale, non da caramella. */
function creamy(hex) {
  return mix(hex, '#fff3e0', 0.17);
}

/** True se il colore è scuro (per scegliere scritta bianca vs cioccolato). */
function isDark(hex) {
  const m = (hex || '#888888').replace('#', '');
  const f = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const r = parseInt(f.slice(0, 2), 16);
  const g = parseInt(f.slice(2, 4), 16);
  const b = parseInt(f.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b < 145;
}

/* ============================ geometria cuore ============================ */

function makeHeartShape() {
  const s = new THREE.Shape();
  const x = 0;
  const y = 0;
  s.moveTo(x + 0.5, y + 0.5);
  s.bezierCurveTo(x + 0.5, y + 0.5, x + 0.4, y, x, y);
  s.bezierCurveTo(x - 0.6, y, x - 0.6, y + 0.7, x - 0.6, y + 0.7);
  s.bezierCurveTo(x - 0.6, y + 1.1, x - 0.3, y + 1.54, x + 0.5, y + 1.9);
  s.bezierCurveTo(x + 1.3, y + 1.54, x + 1.6, y + 1.1, x + 1.6, y + 0.7);
  s.bezierCurveTo(x + 1.6, y + 0.7, x + 1.6, y, x + 1.0, y);
  s.bezierCurveTo(x + 0.6, y, x + 0.5, y + 0.5, x + 0.5, y + 0.5);
  return s;
}

/** Geometria cuore estrusa, normalizzata: footprint ≈ 2R, altezza esatta h, centrata. */
function buildHeartGeometry(R, h) {
  const bevelT = Math.min(0.04, h * 0.25);
  const depth = Math.max(0.02, h - 2 * bevelT);
  const geom = new THREE.ExtrudeGeometry(makeHeartShape(), {
    depth,
    bevelEnabled: true,
    bevelThickness: bevelT,
    bevelSize: bevelT,
    bevelSegments: 2,
    curveSegments: 48,
    steps: 1,
  });
  geom.rotateX(-Math.PI / 2);
  geom.rotateY(Math.PI);
  geom.computeBoundingBox();
  let bb = geom.boundingBox;
  const sizeX = bb.max.x - bb.min.x;
  const sizeZ = bb.max.z - bb.min.z;
  const sXZ = (2 * R) / Math.max(sizeX, sizeZ);
  geom.scale(sXZ, 1, sXZ);
  geom.computeBoundingBox();
  bb = geom.boundingBox;
  const cx = (bb.max.x + bb.min.x) / 2;
  const cz = (bb.max.z + bb.min.z) / 2;
  const minY = bb.min.y;
  const curH = bb.max.y - bb.min.y;
  geom.translate(-cx, -minY, -cz); // base a y=0
  geom.scale(1, h / curH, 1); // altezza esatta
  geom.translate(0, -h / 2, 0); // centrata su y=0
  geom.computeVertexNormals();
  return geom;
}

/* ============================ geometria strati (stile Gelopie) ============================ */

/**
 * Disco di gelato liscio con bordo ARROTONDATO e leggermente bombato
 * (come Gelopie: dischi netti, lucidi, ben separati — NON ondulati/mosci).
 * Costruito con LatheGeometry rotando un profilo a spigoli raccordati.
 */
function roundedDisc(R, h, { bulge = 0.012, seg = 128, arc = 8 } = {}) {
  const half = h / 2;
  // bordo come il cuore: lato quasi dritto + piccolo raccordo (non "a cuscino")
  const cr = Math.min(half * 0.7, 0.05);
  const pts = [];
  pts.push(new THREE.Vector2(0, -half));
  pts.push(new THREE.Vector2(R - cr, -half));
  // raccordo inferiore: da -90° a 0°
  for (let i = 1; i <= arc; i++) {
    const a = -Math.PI / 2 + (i / arc) * (Math.PI / 2);
    pts.push(new THREE.Vector2(R - cr + Math.cos(a) * cr, -half + cr + Math.sin(a) * cr));
  }
  // leggero rigonfiamento a metà fianco
  pts.push(new THREE.Vector2(R + bulge * R, 0));
  // raccordo superiore: da 0° a 90°
  for (let i = 0; i <= arc; i++) {
    const a = (i / arc) * (Math.PI / 2);
    pts.push(new THREE.Vector2(R - cr + Math.cos(a) * cr, half - cr + Math.sin(a) * cr));
  }
  pts.push(new THREE.Vector2(0, half));
  const geom = new THREE.LatheGeometry(pts, seg);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Disco di GELATO VERO: parte dal disco arrotondato ma lo rende leggermente
 * irregolare e organico (profilo non perfetto, bordo un po' ondulato) → sembra
 * gelato spatolato, non un macaron lucido perfetto. Spostamento radiale che
 * dipende solo dall'angolo → resta watertight.
 */
function gelatoDisc(R, h, seed = 1) {
  const geom = roundedDisc(R, h);
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const rad = Math.hypot(x, z);
    if (rad > 1e-4) {
      const a = Math.atan2(z, x);
      const n =
        Math.sin(a * 3 + seed) * 0.5 +
        Math.sin(a * 5 - seed * 1.3) * 0.3 +
        Math.sin(a * 9 + seed * 2.1) * 0.2;
      const f = 1 + n * 0.01; // profilo appena imperfetto (pulito come il cuore)
      pos.setX(i, x * f);
      pos.setZ(i, z * f);
      // micro-ondulazione del bordo, molto sottile
      pos.setY(i, y + Math.sin(a * 2 + seed * 1.7) * 0.005 * (rad / R));
    }
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

/** Dimensioni (larghezza, profondità) dei box, contenute per stare nel piatto/schermo. */
function boxDims(shape, R) {
  if (shape === 'rettangolare') return [R * 1.85, R * 1.1];
  return [R * 1.55, R * 1.55]; // quadrata
}

/**
 * Riquadro (mondo) in cui sta la scritta sulla torta. Dipende dalla forma e dal
 * bordo occupato:
 *  - 'granella' → la scritta sta nel buco centrale (spazio piccolo)
 *  - 'panna'    → dentro l'anello di ciuffi (spazio medio)
 *  - 'none'     → niente bordo: la scritta si allarga a TUTTA la torta
 */
function messageBox(shape, R, level) {
  if (level === 'granella') {
    if (shape === 'rettangolare') return { w: R * 1.55, h: R * 0.56 };
    if (shape === 'quadrata') return { w: R * 1.1, h: R * 0.9 };
    if (shape === 'cuore') return { w: R * 0.9, h: R * 0.56 };
    return { w: R * 1.06, h: R * 0.6 }; // tonda
  }
  if (level === 'panna') {
    if (shape === 'rettangolare') return { w: R * 1.6, h: R * 0.66 };
    if (shape === 'quadrata') return { w: R * 1.26, h: R * 1.02 };
    if (shape === 'cuore') return { w: R * 1.0, h: R * 0.66 };
    return { w: R * 1.34, h: R * 0.78 }; // tonda
  }
  // none → tutta la torta
  if (shape === 'rettangolare') return { w: R * 1.8, h: R * 0.84 };
  if (shape === 'quadrata') return { w: R * 1.46, h: R * 1.2 };
  if (shape === 'cuore') return { w: R * 1.24, h: R * 0.84 };
  return { w: R * 1.62, h: R * 0.92 }; // tonda
}

/** Aspetto (w/h) della foto in base alla forma della torta. */
function photoAspect(shape) {
  if (shape === 'rettangolare') return 1.85 / 1.1;
  if (shape === 'cuore') return 2 / 1.74;
  return 1; // tonda, quadrata
}

/**
 * Footprint della foto sul top: sagoma + dimensioni. Dipende dalla forma e dal
 * bordo occupato (come la scritta):
 *  - 'granella' → piccola (sta nel buco)
 *  - 'panna'    → media (dentro i ciuffi)
 *  - 'none'     → aderisce a TUTTA la torta
 */
function photoFootprint(shape, R, level) {
  const aspect = photoAspect(shape);
  const wByShape = {
    cuore: { granella: 1.0, panna: 1.5, none: 1.92 },
    quadrata: { granella: 1.0, panna: 1.28, none: 1.48 },
    rettangolare: { granella: 1.4, panna: 1.52, none: 1.78 },
    tonda: { granella: 1.12, panna: 1.5, none: 1.92 },
  };
  const w = R * (wByShape[shape] || wByShape.tonda)[level];
  if (shape === 'cuore') return { kind: 'heart', w, h: w / aspect, aspect };
  if (shape === 'quadrata') return { kind: 'rect', w, h: w, aspect: 1 };
  if (shape === 'rettangolare') return { kind: 'rect', w, h: w / aspect, aspect };
  return { kind: 'circle', w, h: w, aspect: 1 };
}

/** Geometria piatta della foto (cerchio / rettangolo / cuore), già coricata sul top. */
function photoGeometry(kind, w, h) {
  if (kind === 'heart') {
    const g = new THREE.ShapeGeometry(makeHeartShape(), 40);
    g.computeBoundingBox();
    const bb = g.boundingBox;
    const sx = bb.max.x - bb.min.x;
    const sy = bb.max.y - bb.min.y;
    const pos = g.attributes.position;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      // UV ruotato di 180° per compensare la rotateY(PI) della geometria a cuore
      uv[i * 2] = 1 - (pos.getX(i) - bb.min.x) / sx;
      uv[i * 2 + 1] = 1 - (pos.getY(i) - bb.min.y) / sy;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, 0);
    g.scale(w / sx, h / sy, 1);
    g.rotateX(-Math.PI / 2);
    g.rotateY(Math.PI);
    return g;
  }
  if (kind === 'rect') {
    const g = new THREE.PlaneGeometry(w, h);
    g.rotateX(-Math.PI / 2);
    return g;
  }
  const g = new THREE.CircleGeometry(w / 2, 72);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Geometria di uno strato in base alla forma. */
function makeLayerGeo(shape, R, h, seed = 1) {
  if (shape === 'cuore') return buildHeartGeometry(R, h);
  if (shape === 'quadrata' || shape === 'rettangolare') {
    const [w, d] = boxDims(shape, R);
    return new RoundedBoxGeometry(w, h, d, 6, Math.min(0.1, h * 0.45));
  }
  return gelatoDisc(R, h, seed);
}

/** Poligono 2D (X,Z) del contorno a cuore, normalizzato al footprint del cuore 3D. */
function heartFootprint(R) {
  const pts = makeHeartShape().getPoints(90);
  const poly = pts.map((p) => [-p.x, p.y]); // stessa orientazione di buildHeartGeometry
  let mnx = Infinity, mxx = -Infinity, mnz = Infinity, mxz = -Infinity;
  for (const [x, z] of poly) {
    if (x < mnx) mnx = x; if (x > mxx) mxx = x;
    if (z < mnz) mnz = z; if (z > mxz) mxz = z;
  }
  const s = (2 * R) / Math.max(mxx - mnx, mxz - mnz);
  const cx = (mnx + mxx) / 2, cz = (mnz + mxz) / 2;
  return poly.map(([x, z]) => [(x - cx) * s, (z - cz) * s]);
}

/** Punto dentro poligono (ray casting). */
function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
    if (((zi > z) !== (zj > z)) && (x < ((xj - xi) * (z - zi)) / (zj - zi) + xi)) inside = !inside;
  }
  return inside;
}

/** N punti distribuiti lungo il CONTORNO della forma (per i ciuffi di panna). */
function perimeterPts(shape, R, inset, n) {
  // costruisce il poligono di contorno per la forma
  let poly;
  if (shape === 'cuore') {
    poly = heartFootprint(R * inset);
  } else if (shape === 'quadrata' || shape === 'rettangolare') {
    const [w, d] = boxDims(shape, R);
    const hw = (w / 2) * inset, hd = (d / 2) * inset;
    poly = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
  } else {
    poly = [];
    const m = 96;
    for (let i = 0; i < m; i++) {
      const a = (i / m) * Math.PI * 2;
      poly.push([Math.cos(a) * R * inset, Math.sin(a) * R * inset]);
    }
  }
  // ricampiona n punti equidistanti per lunghezza d'arco
  const segs = [];
  let total = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push({ a, b, len, acc: total });
    total += len;
  }
  const out = [];
  for (let k = 0; k < n; k++) {
    const target = (k / n) * total;
    let seg = segs[segs.length - 1];
    for (let i = 0; i < segs.length; i++) {
      if (segs[i].acc + segs[i].len >= target) { seg = segs[i]; break; }
    }
    const t = seg.len ? (target - seg.acc) / seg.len : 0;
    out.push([seg.a[0] + (seg.b[0] - seg.a[0]) * t, seg.a[1] + (seg.b[1] - seg.a[1]) * t, k]);
  }
  return out;
}

/* ============================ mesh di uno strato ============================ */

function LayerMesh({ geometry, y, children }) {
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} position={[0, y, 0]} castShadow receiveShadow>
      {children}
    </mesh>
  );
}

/* ============================ materiali ============================ */

// Gelato vero: OPACO e CREMOSO (non lucido/plastica), con sheen morbido tipo latte.
const flavorMat = (color) => {
  const c = creamy(color);
  return {
    color: c,
    roughness: 0.92,
    clearcoat: 0.05,
    clearcoatRoughness: 0.8,
    sheen: 1,
    sheenRoughness: 0.95,
    sheenColor: mix(c, '#ffffff', 0.5),
    envMapIntensity: 0.18,
  };
};

const glossyMat = (color) => ({
  color,
  roughness: 0.14,
  clearcoat: 1,
  clearcoatRoughness: 0.08,
  metalness: 0,
  envMapIntensity: 1.1,
});

const softMat = (color) => ({
  color,
  roughness: 0.78,
  clearcoat: 0.15,
  clearcoatRoughness: 0.6,
  sheen: 0.8,
  sheenColor: shade(color, 0.5),
  envMapIntensity: 0.4,
});

/* ============================ decorazioni ============================ */

function ringPts(n, r, startDeg = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (startDeg * Math.PI) / 180 + (i / n) * Math.PI * 2;
    out.push([Math.cos(a) * r, Math.sin(a) * r, i]);
  }
  return out;
}

function Dollop({ position, color, s = 1, rotation = 0 }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow position={[0, 0.05 * s, 0]}>
        <sphereGeometry args={[0.085 * s, 18, 14]} />
        <meshPhysicalMaterial {...softMat(color)} />
      </mesh>
      <mesh castShadow position={[0, 0.13 * s, 0]}>
        <coneGeometry args={[0.055 * s, 0.11 * s, 16]} />
        <meshPhysicalMaterial {...softMat(color)} />
      </mesh>
    </group>
  );
}

function Berry({ position, color, r = 0.07 }) {
  return (
    <mesh castShadow position={position}>
      <sphereGeometry args={[r, 18, 14]} />
      <meshPhysicalMaterial color={color} roughness={0.25} clearcoat={0.8} clearcoatRoughness={0.2} envMapIntensity={1} />
    </mesh>
  );
}

function Decorations({ id, R, y, coverColor }) {
  const items = [];
  const push = (el) => items.push(el);

  switch (id) {
    case 'frutta': {
      const fruit = ['#d22d50', '#3f4fb3', '#7a1f3d', '#d22d50', '#4a5bbf', '#b01b3a'];
      ringPts(7, R * 0.62).forEach(([x, z, i]) =>
        push(<Berry key={`f${i}`} position={[x, y + 0.06, z]} color={fruit[i % fruit.length]} r={0.065 + (i % 3) * 0.012} />)
      );
      push(<Berry key="fc1" position={[0.08, y + 0.08, 0.02]} color="#d22d50" r={0.085} />);
      push(<Berry key="fc2" position={[-0.07, y + 0.07, 0.08]} color="#3f4fb3" r={0.07} />);
      push(<Berry key="fc3" position={[-0.02, y + 0.07, -0.09]} color="#7a1f3d" r={0.075} />);
      break;
    }
    case 'cioccolato': {
      ringPts(9, R * 0.6, 12).forEach(([x, z, i]) => (
        push(
          <mesh key={`ch${i}`} castShadow position={[x, y + 0.07, z]} rotation={[0.4, i * 1.1, 0.5 + (i % 3) * 0.3]}>
            <boxGeometry args={[0.05, 0.16, 0.012]} />
            <meshPhysicalMaterial color="#3a1d10" roughness={0.35} clearcoat={0.6} envMapIntensity={0.7} />
          </mesh>
        )
      ));
      ringPts(14, R * 0.85, 6).forEach(([x, z, i]) =>
        push(<Berry key={`cd${i}`} position={[x, y + 0.02, z]} color={i % 2 ? '#5a3318' : '#2a160e'} r={0.025} />)
      );
      push(
        <mesh key="cc" castShadow position={[0, y + 0.09, 0]} rotation={[0.2, 0.6, 0.3]}>
          <torusGeometry args={[0.07, 0.028, 12, 24]} />
          <meshPhysicalMaterial color="#3a1d10" roughness={0.3} clearcoat={0.7} envMapIntensity={0.8} />
        </mesh>
      );
      break;
    }
    case 'macaron': {
      const pastel = ['#f4a9c0', '#a9d8f4', '#c8f4a9', '#f4e3a9', '#d9a9f4', '#f4c0a9'];
      ringPts(6, R * 0.6).forEach(([x, z, i]) => (
        push(
          <mesh key={`mc${i}`} castShadow position={[x, y + 0.05, z]} rotation={[Math.PI / 2.6, 0, i]}>
            <cylinderGeometry args={[0.075, 0.075, 0.05, 24]} />
            <meshPhysicalMaterial color={pastel[i % pastel.length]} roughness={0.55} clearcoat={0.2} />
          </mesh>
        )
      ));
      ringPts(10, R * 0.88, 4).forEach(([x, z, i]) =>
        push(<Berry key={`ms${i}`} position={[x, y + 0.02, z]} color="#f4d35e" r={0.02} />)
      );
      break;
    }
    case 'fiori': {
      const petals = ['#f4a9c0', '#f7c948', '#e85d75', '#c490e4', '#ffffff'];
      ringPts(5, R * 0.58).forEach(([cx, cz, i]) => {
        const col = petals[i % petals.length];
        ringPts(5, 0.07).forEach(([px, pz, j]) =>
          push(
            <mesh key={`fl${i}-${j}`} castShadow position={[cx + px, y + 0.05, cz + pz]}>
              <sphereGeometry args={[0.038, 12, 10]} />
              <meshPhysicalMaterial color={col} roughness={0.5} sheen={0.6} sheenColor={shade(col, 0.4)} />
            </mesh>
          )
        );
        push(<Berry key={`flc${i}`} position={[cx, y + 0.06, cz]} color="#f7c948" r={0.04} />);
      });
      ringPts(8, R * 0.9, 3).forEach(([x, z, i]) =>
        push(<Berry key={`lf${i}`} position={[x, y + 0.02, z]} color="#5a8f3c" r={0.035} />)
      );
      break;
    }
    case 'fantasy': {
      const sprinkle = ['#e8467a', '#46a8e8', '#f7c948', '#7be84a', '#c490e4', '#f78f2e'];
      for (let i = 0; i < 46; i++) {
        const a = (i * 137.5 * Math.PI) / 180;
        const rr = R * 0.92 * Math.sqrt((i + 1) / 47);
        push(
          <mesh
            key={`sp${i}`}
            castShadow
            position={[Math.cos(a) * rr, y + 0.03, Math.sin(a) * rr]}
            rotation={[Math.PI / 2, i * 0.7, i * 1.3]}
          >
            <cylinderGeometry args={[0.012, 0.012, 0.07, 6]} />
            <meshStandardMaterial color={sprinkle[i % sprinkle.length]} roughness={0.4} />
          </mesh>
        );
      }
      push(<Dollop key="fa-c" position={[0, y, 0]} color={shade(coverColor, 0.05)} s={1.3} />);
      break;
    }
    case 'panna': {
      ringPts(8, R * 0.62).forEach(([x, z, i]) =>
        push(<Dollop key={`pd${i}`} position={[x, y + 0.02, z]} color={shade(coverColor, 0.06)} s={0.95} rotation={i} />)
      );
      push(<Dollop key="pd-c" position={[0, y + 0.02, 0]} color={shade(coverColor, 0.06)} s={1.2} />);
      push(<Berry key="pc" position={[0, y + 0.28, 0]} color="#cf2740" r={0.06} />);
      break;
    }
    case 'minimal':
    default: {
      ringPts(10, R * 0.7).forEach(([x, z, i]) => (
        push(
          <mesh key={`dr${i}`} castShadow position={[x, y + 0.03, z]}>
            <sphereGeometry args={[0.03, 16, 12]} />
            <meshStandardMaterial color="#e8c069" metalness={0.95} roughness={0.22} envMapIntensity={1.2} />
          </mesh>
        )
      ));
      push(
        <mesh key="dc" castShadow position={[0, y + 0.04, 0]}>
          <sphereGeometry args={[0.045, 16, 12]} />
          <meshStandardMaterial color="#e8c069" metalness={0.95} roughness={0.22} envMapIntensity={1.2} />
        </mesh>
      );
      break;
    }
  }
  return <group>{items}</group>;
}

/* ============================ granella croccante (firma Gelopie) ============================ */

function Granella({ R, y, shape, coverage = 1, count = 1200, colors = ['#c79a58', '#7a4a26'], shiny = false, holeW = 0, holeH = 0 }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    // campionatore di punti che SEGUE la forma del top
    let sample;
    let maxExt;
    if (shape === 'quadrata' || shape === 'rettangolare') {
      const [w, d] = boxDims(shape, R);
      const hw = (w / 2) * coverage;
      const hd = (d / 2) * coverage;
      maxExt = Math.max(hw, hd);
      sample = () => [(Math.random() * 2 - 1) * hw, (Math.random() * 2 - 1) * hd];
    } else if (shape === 'cuore') {
      const poly = heartFootprint(R * coverage);
      let mnx = Infinity, mxx = -Infinity, mnz = Infinity, mxz = -Infinity;
      for (const [x, z] of poly) {
        if (x < mnx) mnx = x; if (x > mxx) mxx = x;
        if (z < mnz) mnz = z; if (z > mxz) mxz = z;
      }
      maxExt = Math.max(mxx - mnx, mxz - mnz) / 2;
      sample = () => {
        for (let k = 0; k < 40; k++) {
          const x = mnx + Math.random() * (mxx - mnx);
          const z = mnz + Math.random() * (mxz - mnz);
          if (pointInPoly(x, z, poly)) return [x, z];
        }
        return [0, 0];
      };
    } else {
      const rMax = R * coverage;
      maxExt = rMax;
      sample = () => {
        const a = Math.random() * Math.PI * 2;
        const rr = Math.sqrt(Math.random()) * rMax;
        return [Math.cos(a) * rr, Math.sin(a) * rr];
      };
    }

    const dummy = new THREE.Object3D();
    const cols = colors.map((c) => new THREE.Color(c));
    const tmp = new THREE.Color();
    for (let i = 0; i < count; i++) {
      let [x, z] = sample();
      let dist = Math.hypot(x, z);
      // buco centrale ellittico (per scritta/foto): granella solo nella corona esterna
      if (holeW > 0 && holeH > 0) {
        const inHole = () => (x * x) / (holeW * holeW) + (z * z) / (holeH * holeH) < 1;
        let tries = 0;
        while (inHole() && tries < 30) { [x, z] = sample(); tries++; }
        if (inHole()) {
          const e = Math.sqrt((x * x) / (holeW * holeW) + (z * z) / (holeH * holeH)) || 1e-3;
          const s = (1.05 + Math.random() * 0.12) / e;
          x *= s; z *= s;
        }
        dist = Math.hypot(x, z);
      }
      const pile = (1 - Math.min(1, dist / (maxExt + 1e-3))) * 0.04;
      const yy = y + 0.008 + Math.random() * 0.035 + pile;
      dummy.position.set(x, yy, z);
      dummy.rotation.set(Math.random() * 3.1, Math.random() * 3.1, Math.random() * 3.1);
      const s = 0.02 + Math.random() * 0.026;
      dummy.scale.set(s, s * (0.55 + Math.random() * 0.5), s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      tmp.copy(cols[(Math.random() * cols.length) | 0]).offsetHSL(0, (Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.14);
      mesh.setColorAt(i, tmp);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [shape, R, y, coverage, count, colors, shiny, holeW, holeH]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow receiveShadow>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial roughness={shiny ? 0.25 : 0.85} metalness={0} envMapIntensity={shiny ? 1.3 : 0.4} />
    </instancedMesh>
  );
}

// Le 3 granelle/topping disponibili (palette stile crumble)
const TOPPINGS = {
  'granella-nocciola-pistacchio': { colors: ['#c0894c', '#b07a3e', '#9bb15f', '#aac06f', '#6f4a28'] },
  zuccherini: { colors: ['#e8467a', '#46a8e8', '#f7c948', '#7be84a', '#c490e4', '#f78f2e', '#ffffff'], shiny: true },
  'granella-frutta-secca': { colors: ['#d8c19a', '#b78a52', '#8a5a36', '#caa46a', '#9c6b3f', '#dccaa2'] },
};

/* ============================ colature copertura ============================ */

function Drips({ shape, R, topEdgeY, color, maxLen }) {
  // Colature di glassa che scendono dal bordo della calotta sui lati.
  // Solo tonda: i punti circolari non seguirebbero il bordo di cuore/box.
  if (shape !== 'tonda') return null;
  const n = 16;
  const drips = ringPts(n, R * 0.99);
  return (
    <group>
      {drips.map(([x, z, i]) => {
        const seed = (i * 53) % 100;
        const len = maxLen * (0.4 + (seed / 100) * 0.6);
        const ang = Math.atan2(z, x);
        return (
          <group key={`drip${i}`} position={[x, topEdgeY + 0.02, z]} rotation={[0, -ang + Math.PI / 2, 0]}>
            {/* rigonfiamento sul bordo */}
            <mesh castShadow position={[0, 0, 0]}>
              <sphereGeometry args={[0.06, 14, 12]} />
              <meshPhysicalMaterial {...glossyMat(color)} />
            </mesh>
            {/* colata affusolata */}
            <mesh castShadow position={[0, -len / 2, 0]}>
              <cylinderGeometry args={[0.045, 0.022, len, 12]} />
              <meshPhysicalMaterial {...glossyMat(color)} />
            </mesh>
            {/* goccia finale */}
            <mesh castShadow position={[0, -len, 0]}>
              <sphereGeometry args={[0.028, 12, 10]} />
              <meshPhysicalMaterial {...glossyMat(color)} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* ============================ foto su cialda ============================ */

function PhotoDisc({ url, y, foot, transform }) {
  const tex = useLoader(THREE.TextureLoader, url);
  const tf = transform || { zoom: 1, posX: 50, posY: 50 };
  const geo = useMemo(() => photoGeometry(foot.kind, foot.w, foot.h), [foot.kind, foot.w, foot.h]);
  const border = useMemo(
    () => photoGeometry(foot.kind, foot.w + 0.06, foot.h + 0.06),
    [foot.kind, foot.w, foot.h]
  );
  useMemo(() => {
    if (!tex) return;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const img = tex.image;
    if (img && img.width && img.height) {
      const W = img.width;
      const H = img.height;
      const a = W / H;
      const At = foot.aspect;
      let winWpx, winHpx;
      if (a >= At) { winHpx = H; winWpx = H * At; } else { winWpx = W; winHpx = W / At; }
      winWpx /= tf.zoom;
      winHpx /= tf.zoom;
      const winW = winWpx / W;
      const winH = winHpx / H;
      const winLeft = (tf.posX / 100) * (1 - winW);
      const winTop = (tf.posY / 100) * (1 - winH);
      tex.repeat.set(winW, winH);
      tex.offset.set(winLeft, 1 - winTop - winH);
    }
    tex.needsUpdate = true;
  }, [tex, tf.zoom, tf.posX, tf.posY, foot.aspect]);
  return (
    <group position={[0, y + 0.02, 0]}>
      <mesh geometry={border} position={[0, -0.006, 0]} renderOrder={1}>
        <meshStandardMaterial color="#fff8ec" roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geo} renderOrder={2}>
        <meshStandardMaterial map={tex} roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ============================ scritta sulla torta ============================ */

function MessageText({ text, font, y, boxW, boxH, z = 0, onDark = false }) {
  const [tex, setTex] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const family = font === 'fraunces' ? "'Fraunces', serif" : font === 'inter' ? "'Inter', sans-serif" : "'Caveat', cursive";
    const weight = font === 'inter' ? '800' : font === 'fraunces' ? '600' : '700';
    const style = font === 'fraunces' ? 'italic' : 'normal';
    const upper = font === 'inter';
    const cssAt = (px) => `${style} ${weight} ${px}px ${family}`;

    const build = () => {
      // canvas con lo stesso rapporto del riquadro 3D → testo non deformato
      const aspect = boxW / boxH;
      const CW = 1400;
      const CH = Math.max(200, Math.round(CW / aspect));
      const canvas = document.createElement('canvas');
      canvas.width = CW;
      canvas.height = CH;
      const ctx = canvas.getContext('2d');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const content = upper ? text.toUpperCase() : text;
      const availW = CW * 0.9;
      const availH = CH * 0.82;

      const wrap = (px) => {
        ctx.font = cssAt(px);
        const words = content.split(/\s+/);
        const lines = [];
        let cur = '';
        for (const w of words) {
          const t = cur ? `${cur} ${w}` : w;
          if (ctx.measureText(t).width > availW && cur) { lines.push(cur); cur = w; } else cur = t;
        }
        if (cur) lines.push(cur);
        const maxW = Math.max(...lines.map((l) => ctx.measureText(l).width));
        return { lines, maxW, totalH: lines.length * px * 1.16 };
      };

      // auto-fit: font massimo che entra nel riquadro
      let chosen = null;
      for (let px = Math.round(CH * 0.78); px >= 14; px -= 2) {
        const r = wrap(px);
        if (r.maxW <= availW && r.totalH <= availH) { chosen = { px, ...r }; break; }
      }
      if (!chosen) { const r = wrap(14); chosen = { px: 14, ...r }; }

      ctx.font = cssAt(chosen.px);
      ctx.lineJoin = 'round';
      const lh = chosen.px * 1.16;
      const startY = CH / 2 - ((chosen.lines.length - 1) * lh) / 2;
      // su fondo scuro → bianco panna spesso; su fondo chiaro → cioccolato
      const fill = onDark ? '#ffffff' : '#4a2a12';
      const stroke = onDark ? 'rgba(28,16,8,0.55)' : 'rgba(255,250,242,0.92)';
      chosen.lines.forEach((ln, i) => {
        const yy = startY + i * lh;
        ctx.lineWidth = chosen.px * (onDark ? 0.18 : 0.14);
        ctx.strokeStyle = stroke;
        ctx.strokeText(ln, CW / 2, yy);
        ctx.fillStyle = fill;
        ctx.fillText(ln, CW / 2, yy);
      });

      const t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      t.needsUpdate = true;
      if (!cancelled) setTex(t);
    };

    if (document.fonts && document.fonts.load) {
      document.fonts.load(cssAt(80), text).then(build).catch(build);
    } else {
      build();
    }
    return () => { cancelled = true; };
  }, [text, font, boxW, boxH, onDark]);

  if (!tex) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y + 0.025, z]}>
      <planeGeometry args={[boxW, boxH]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/* ============================ candelina ============================ */

function Candle({ y }) {
  const flame = useRef();
  useFrame((state) => {
    if (flame.current) {
      const t = state.clock.elapsedTime;
      flame.current.scale.y = 1 + Math.sin(t * 12) * 0.12;
      flame.current.scale.x = 1 + Math.sin(t * 9 + 1) * 0.06;
    }
  });
  return (
    <group position={[0, y, 0]}>
      <mesh castShadow position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.4, 20]} />
        <meshPhysicalMaterial color="#fff5fa" roughness={0.4} clearcoat={0.4} />
      </mesh>
      {/* righine decorative */}
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.0365, 0.0365, 0.03, 20]} />
        <meshStandardMaterial color="#7cb7d7" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.0365, 0.0365, 0.03, 20]} />
        <meshStandardMaterial color="#eb911e" roughness={0.5} />
      </mesh>
      {/* stoppino */}
      <mesh position={[0, 0.41, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.03, 8]} />
        <meshStandardMaterial color="#3a2418" />
      </mesh>
      {/* fiamma */}
      <mesh ref={flame} position={[0, 0.47, 0]}>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshBasicMaterial color="#ffce4a" />
      </mesh>
      <pointLight position={[0, 0.5, 0]} color="#ffb347" intensity={1.2} distance={1.6} decay={2} />
    </group>
  );
}

/* ============================ corpo torta ============================ */

function CakeModel({ shape, plateShape, flavors, base, filling, covering, candle, photo, photoTransform, decorationId, message, messageFont }) {
  // Torta gelato vera: BASSA e LARGA. Dischi di gelato netti e impilati.
  const R = 1.18;
  const layers = Math.max(1, flavors.length);
  const bandH = layers >= 5 ? 0.15 : layers === 4 ? 0.18 : layers === 3 ? 0.22 : layers === 2 ? 0.28 : 0.4;

  const coverColor = covering?.color || '#fff4e0';
  const coverIsNaked = covering?.id === 'naked';
  const useCover = !coverIsNaked && covering;
  const baseColor = base?.color || '#e8d2a8';
  const fillingColor = filling?.color;
  const glossyCover =
    covering?.id === 'glassa-specchio' ||
    covering?.id === 'ganache-cop' ||
    covering?.id === 'cioccolato-cop';

  const platterH = 0.12;
  const baseH = 0.1;
  const capH = 0.07;
  const OV = 1.16; // i dischi si sovrappongono un po' → niente z-fighting, solco netto tra strati

  // y=0 = piano superiore del vassoio. La torta cresce verso l'alto.
  const platterY = -platterH / 2;
  const baseY = baseH / 2;
  const stackBottom = baseH;
  const bandCenterY = (i) => stackBottom + bandH * (i + 0.5);
  const bodyTop = stackBottom + layers * bandH;
  const capY = bodyTop - 0.015; // la calotta si appoggia sul disco superiore
  // dove poggiano granella/decorazioni/foto/scritta: sopra il bombamento del disco superiore
  const surfaceY = (useCover ? bodyTop + capH * 0.5 : bodyTop) + bandH * 0.1;

  // Geometrie: dischi lisci e netti (Gelopie), leggermente sovrapposti per i solchi.
  const geos = useMemo(() => {
    const bands = [];
    for (let i = 0; i < layers; i++) bands.push(makeLayerGeo(shape, R, bandH * OV, i * 1.7 + 1));
    return {
      base: makeLayerGeo(shape, R * 0.985, baseH * 1.3, 0.3),
      bands,
      cap: useCover ? makeLayerGeo(shape, R * 0.995, capH * 1.6, 5.5) : null,
      fill: fillingColor ? makeLayerGeo(shape, R * 1.015, 0.06, 8.2) : null,
    };
  }, [shape, R, bandH, baseH, capH, layers, useCover, fillingColor]);

  // ---- Piatto (vassoio) ORO, con forma dedicata ----
  const pShape = plateShape || (shape === 'quadrata' ? 'quadrata' : shape === 'rettangolare' ? 'rettangolare' : 'tonda');
  // footprint (larghezza, profondità) della torta, per dimensionare il piatto
  const foot = shape === 'rettangolare' ? boxDims('rettangolare', R)
    : shape === 'quadrata' ? boxDims('quadrata', R)
    : [2 * R, 2 * R]; // tonda / cuore (diametro)
  const plateMargin = R * 0.42;
  const plateRound = Math.max(foot[0], foot[1]) / 2 + plateMargin;
  const plateW = (pShape === 'rettangolare' ? Math.max(foot[0], 2 * R) : Math.max(foot[0], foot[1])) + plateMargin * 2;
  const plateD = (pShape === 'rettangolare' ? Math.max(foot[1], R * 1.15) : Math.max(foot[0], foot[1])) + plateMargin * 2;
  const goldPlate = { color: '#d9ad54', metalness: 0.85, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.28, envMapIntensity: 1.15 };
  const plateGeo = useMemo(
    () => (pShape === 'tonda' ? null : new RoundedBoxGeometry(plateW, platterH, plateD, 4, Math.min(0.12, platterH * 0.4))),
    [pShape, plateW, plateD, platterH]
  );
  const showRosetteRing = (shape === 'tonda' || shape === 'cuore') && (covering?.id === 'panna' || covering?.id === 'meringa');

  // Scritta / foto al centro → il topping si sagoma con un buco al centro
  const hasMessage = !!(message && message.trim());
  const hasGranella = !!(decorationId && TOPPINGS[decorationId]);
  const hasCenter = !!photo || hasMessage;
  const fullCoverage = shape === 'tonda' ? 0.98 : shape === 'cuore' ? 0.92 : 0.9;
  const granellaCoverage = hasCenter ? fullCoverage : showRosetteRing ? 0.66 : fullCoverage;
  // Riquadro scritta: dipende da forma e dal bordo occupato (granella > panna > niente)
  const borderLevel = hasGranella ? 'granella' : showRosetteRing ? 'panna' : 'none';
  const msgBox = messageBox(shape, R, borderLevel);
  // colore del fondo sotto la scritta → scritta bianca (panna) su scuro, cioccolato su chiaro
  const topFlavor = flavors[layers - 1] || flavors[flavors.length - 1] || { color: '#fff4e0' };
  const msgOnDark = isDark(useCover ? coverColor : topFlavor.color);
  const photoFoot = photoFootprint(shape, R, borderLevel);
  // buco ellittico nella granella che segue il contenuto centrale (foto o scritta)
  const holeW = photo ? photoFoot.w / 2 + R * 0.05 : hasMessage ? msgBox.w / 2 + R * 0.05 : 0;
  const holeH = photo ? photoFoot.h / 2 + R * 0.05 : hasMessage ? msgBox.h / 2 + R * 0.05 : 0;

  return (
    <group>
      {/* ---- Piatto ORO Punto Gi! (forma in base alla torta / n° persone) ---- */}
      {pShape === 'tonda' ? (
        <mesh position={[0, platterY, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[plateRound, plateRound * 0.97, platterH, 80]} />
          <meshPhysicalMaterial {...goldPlate} />
        </mesh>
      ) : (
        <mesh geometry={plateGeo} position={[0, platterY, 0]} castShadow receiveShadow>
          <meshPhysicalMaterial {...goldPlate} />
        </mesh>
      )}
      {/* bordo lucido più scuro (rifinitura, solo piatto rotondo) */}
      {pShape === 'tonda' && (
        <mesh position={[0, platterY + platterH / 2 - 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[plateRound - 0.03, 0.02, 16, 90]} />
          <meshStandardMaterial color="#b98e34" metalness={0.95} roughness={0.25} envMapIntensity={1.3} />
        </mesh>
      )}

      {/* ---- Base biscotto / pan di spagna ---- */}
      <LayerMesh geometry={geos.base} y={baseY}>
        <meshPhysicalMaterial {...flavorMat(baseColor)} clearcoat={0.08} roughness={0.78} />
      </LayerMesh>

      {/* ---- STRATI DI GUSTO: ogni gusto = un disco di gelato di un colore ---- */}
      {Array.from({ length: layers }).map((_, i) => {
        const flavor = flavors[i] || flavors[flavors.length - 1] || { color: '#fff4e0' };
        return (
          <LayerMesh key={`l${i}`} geometry={geos.bands[i]} y={bandCenterY(i)}>
            <meshPhysicalMaterial {...flavorMat(flavor.color)} />
          </LayerMesh>
        );
      })}

      {/* ---- Farcitura: anelli sottili tra gli strati ---- */}
      {fillingColor &&
        Array.from({ length: Math.max(0, layers - 1) }).map((_, i) => (
          <LayerMesh key={`fl${i}`} geometry={geos.fill} y={stackBottom + bandH * (i + 1)}>
            <meshPhysicalMaterial {...softMat(fillingColor)} />
          </LayerMesh>
        ))}

      {/* ---- Copertura: calotta sottile sul disco superiore (niente cupola) ---- */}
      {useCover && (
        <>
          <LayerMesh geometry={geos.cap} y={capY}>
            <meshPhysicalMaterial {...(glossyCover ? glossyMat(coverColor) : softMat(coverColor))} />
          </LayerMesh>
          {/* colature solo per glasse lucide (ganache, cioccolato, specchio) */}
          {glossyCover && (
            <Drips shape={shape} R={R} topEdgeY={bodyTop} color={coverColor} maxLen={Math.min(0.45, bandH * layers * 0.6)} />
          )}
        </>
      )}

      {/* ---- Ciuffi di panna lungo il bordo, SEGUONO la forma (solo coperture cremose) ---- */}
      {showRosetteRing &&
        perimeterPts(shape, R, 0.86, shape === 'tonda' ? 12 : shape === 'cuore' ? 15 : 16).map(([x, z, i]) => (
          <Dollop key={`ro${i}`} position={[x, surfaceY - 0.02, z]} color={shade(coverColor, 0.05)} s={0.85} rotation={i} />
        ))}

      {/* ---- Topping: granella croccante sopra, SEGUE la forma; buco per scritta/foto ---- */}
      {hasGranella && (
        <Granella
          shape={shape}
          R={R}
          y={surfaceY}
          colors={TOPPINGS[decorationId].colors}
          shiny={TOPPINGS[decorationId].shiny}
          coverage={granellaCoverage}
          holeW={holeW}
          holeH={holeH}
        />
      )}

      {/* ---- Foto su cialda al centro (più grande se non c'è granella) ---- */}
      {photo && (
        <Suspense fallback={null}>
          <PhotoDisc url={photo} y={surfaceY} foot={photoFoot} transform={photoTransform} />
        </Suspense>
      )}

      {/* ---- Scritta applicata sulla torta (al centro, se non c'è la foto) ---- */}
      {hasMessage && !photo && (
        <MessageText
          text={message.trim()}
          font={messageFont}
          y={surfaceY}
          boxW={msgBox.w}
          boxH={msgBox.h}
          z={shape === 'cuore' ? R * 0.12 : 0}
          onDark={msgOnDark}
        />
      )}

      {/* ---- Candelina ---- */}
      {candle && <Candle y={surfaceY} />}
    </group>
  );
}

/* ============================ scena + canvas ============================ */

function Scene({ spin = true, ...props }) {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(mq.matches);
    const on = (e) => setReduce(e.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  return (
    <>
      {/* luci da studio */}
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[4, 7, 4]}
        intensity={2.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={20}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-5, 3, -3]} intensity={0.6} color="#e2efec" />
      <directionalLight position={[0, 2, -6]} intensity={0.5} color="#ffe6c8" />

      {/* environment auto-contenuto (nessun download esterno) per riflessi cremosi */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3} position={[0, 5, 1]} scale={[8, 4, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={1.4} position={[-4, 2, 2]} scale={[4, 6, 1]} color="#e9f2ef" />
        <Lightformer form="rect" intensity={1.2} position={[4, 1, -2]} scale={[4, 6, 1]} color="#fff1dc" />
        <Lightformer form="ring" intensity={1.5} position={[0, 3, -4]} scale={3} color="#ffffff" />
      </Environment>

      <group position={[0, -0.28, 0]}>
        <CakeModel {...props} />
        <ContactShadows
          position={[0, -0.125, 0]}
          opacity={0.4}
          scale={3.6}
          blur={2.6}
          far={3}
          resolution={512}
          color="#233a36"
        />
      </group>

      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom={false}
        autoRotate={spin && !reduce}
        autoRotateSpeed={1.1}
        enableDamping
        dampingFactor={0.08}
        minPolarAngle={Math.PI * 0.26}
        maxPolarAngle={Math.PI * 0.48}
        target={[0, -0.04, 0]}
      />
    </>
  );
}

export default function Cake3D(props) {
  const [spin, setSpin] = useState(true);
  return (
    <div className="cake3d-stage">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
        camera={{ position: [0, 2.7, 5.0], fov: 30 }}
      >
        <Suspense fallback={null}>
          <Scene {...props} spin={spin} />
        </Suspense>
      </Canvas>
      <button
        type="button"
        className="cake3d-spin-toggle"
        onClick={() => setSpin((s) => !s)}
        aria-pressed={!spin}
        title={spin ? 'Ferma la rotazione' : 'Riprendi la rotazione'}
      >
        {spin ? '⏸ Ferma' : '↻ Ruota'}
      </button>
    </div>
  );
}
