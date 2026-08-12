/**
 * Cake3D — torta gelato in 3D reale (WebGL via three.js + react-three-fiber).
 *
 * Filosofia: OGNI GUSTO È UNO STRATO DI COLORE PIENO, impilato come una vera
 * torta gelato. Materiali tipo gelato/panna (clearcoat + sheen), luci da studio
 * con ombre morbide, vassoio viola Punto Gi con bordo dorato, rotazione
 * automatica + trascinamento col mouse/dito.
 *
 * Forme supportate: tonda (cilindro), cuore (extrude), quadrata/rettangolare
 * (rounded box). La panna NON è di serie: arriva solo se scelta — con le
 * coperture (a ruche col sac-à-poche o lisce e spatolate; quelle col
 * sac-à-poche portano sul bordo di sopra UNA fila di ciuffi grossi il doppio)
 * o con la decorazione di panna (fila fitta di ciuffi normali). Le altre
 * coperture restano sulla calotta. Farcitura come anelli sottili tra gli
 * strati. Decorazioni 3D (macarons, spumini, fiori, fiocchi…), foto su cialda
 * e candelina; quando c'è l'anello di panna ci si appoggiano sopra.
 *
 * Le decorazioni possono essere PIÙ D'UNA: arrivano come lista di id
 * (`decorations`) più la mappa dei colori (`decorationColors`). I posti sul
 * contorno sono uno solo per tutte e se li dividono a turno, così si vedono
 * tutte e nessuna finisce sopra l'altra.
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
import { messageFontStyle } from '../lib/messageFont';

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

/**
 * Colori scegliibili per le decorazioni con `scelta_colore` (panna colorata,
 * zuccherini, perline…). Il configuratore salva il NOME del colore in italiano
 * (es. "Rosa", "Azzurra"): qui lo traduciamo in HEX. Accettiamo anche un HEX
 * già pronto, così se un giorno i colori arrivassero dal database non si rompe.
 */
const COLOR_NAMES = {
  rosa: '#f4a9c0',
  rosso: '#e0334c',
  rossa: '#e0334c',
  azzurro: '#8ed0f0',
  azzurra: '#8ed0f0',
  blu: '#3f57b3',
  verde: '#7cc47a',
  nero: '#3a3540',
  nera: '#3a3540',
  giallo: '#f7d34a',
  gialla: '#f7d34a',
  bianco: '#fff8e6',
  bianca: '#fff8e6',
  oro: '#e8c069',
  argento: '#cfd4d8',
};

/** Ciuffi arcobaleno: colori alternati, uno per ciuffo. */
const RAINBOW_COLORS = ['#f4577b', '#f79a3c', '#f7d34a', '#7cc47a', '#5fb6e8', '#8f6fd6'];

/** Da nome colore (o HEX) al colore da usare nel 3D; null se non riconosciuto. */
function colorFromChoice(choice) {
  const key = String(choice || '').trim().toLowerCase();
  if (!key) return null;
  if (key.startsWith('#')) return key;
  return COLOR_NAMES[key] || null;
}

/** True se il colore scelto è "arcobaleno". */
function isRainbowChoice(choice) {
  return String(choice || '').trim().toLowerCase().startsWith('arcobaleno');
}

/**
 * Toni della PANNA COLORATA. Sono volutamente PASTELLO: è panna montata con
 * dentro il colorante, non una caramella. I titolari scrivono i colori al
 * femminile ("Rossa", "Azzurra"), quindi teniamo entrambe le forme.
 */
const CREAM_COLORS = {
  rosa: '#f8c4d6',
  // "Rossa" deve restare distinguibile da "Rosa": i titolari le offrono come
  // due scelte diverse, quindi qui il rosso è pieno (lampone) e non un rosa
  // appena più carico — con le luci della scena schiarisce già parecchio.
  rosso: '#d8434f',
  rossa: '#d8434f',
  azzurro: '#bde2f6',
  azzurra: '#bde2f6',
  blu: '#95a7dd',
  verde: '#b7ddab',
  nero: '#565062',
  nera: '#565062',
  giallo: '#f8e296',
  gialla: '#f8e296',
  bianco: '#fff8e6',
  bianca: '#fff8e6',
};

/** Panna ARCOBALENO: settori pastello che girano intorno alla torta. */
const CREAM_RAINBOW = ['#f79ab6', '#f6bc7d', '#f5e089', '#a4d69b', '#95cfef', '#b8a3e6'];

/** Colore della PANNA dal nome scelto dal cliente; null se non riconosciuto. */
function creamColorFromChoice(choice) {
  const key = String(choice || '').trim().toLowerCase();
  if (!key) return null;
  if (key.startsWith('#')) return key;
  return CREAM_COLORS[key] || null;
}

/**
 * Dipinge una geometria a SETTORI arcobaleno: il colore dipende dall'angolo
 * intorno all'asse verticale e sfuma da un settore all'altro. Va bene per
 * qualsiasi forma (disco, cuore, box) perché guarda solo X e Z.
 */
function paintRainbow(geom, palette = CREAM_RAINBOW) {
  const pos = geom.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const a = new THREE.Color();
  const b = new THREE.Color();
  const n = palette.length;
  for (let i = 0; i < pos.count; i++) {
    const ang = Math.atan2(pos.getZ(i), pos.getX(i)); // -PI..PI
    const t = ((ang / (Math.PI * 2) + 1) % 1) * n; // 0..n
    const k = Math.floor(t);
    a.set(palette[k % n]);
    b.set(palette[(k + 1) % n]);
    // sfumatura corta: i settori restano leggibili, il passaggio è morbido
    const w = Math.min(1, Math.max(0, (t - k - 0.7) / 0.3));
    cols[i * 3] = a.r + (b.r - a.r) * w;
    cols[i * 3 + 1] = a.g + (b.g - a.g) * w;
    cols[i * 3 + 2] = a.b + (b.b - a.b) * w;
  }
  geom.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return geom;
}

/**
 * Tavolozza di una decorazione: se il cliente ha scelto un colore vale quello
 * (con due sfumature per non appiattire tutto), "Arcobaleno" accende tutti i
 * colori, altrimenti restano i colori naturali della decorazione.
 */
function decoPalette(defaults, choice) {
  if (isRainbowChoice(choice)) return RAINBOW_COLORS;
  const hex = colorFromChoice(choice);
  if (!hex) return defaults;
  return [hex, shade(hex, 0.16), shade(hex, -0.1)];
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

/** Contorno a rettangolo con angoli arrotondati (usato per la cornice del piatto). */
function roundedRectPath(path, w, d, r) {
  const hw = w / 2;
  const hd = d / 2;
  const rr = Math.max(0.001, Math.min(r, hw * 0.98, hd * 0.98));
  path.moveTo(-hw + rr, -hd);
  path.lineTo(hw - rr, -hd);
  path.absarc(hw - rr, -hd + rr, rr, -Math.PI / 2, 0, false);
  path.lineTo(hw, hd - rr);
  path.absarc(hw - rr, hd - rr, rr, 0, Math.PI / 2, false);
  path.lineTo(-hw + rr, hd);
  path.absarc(-hw + rr, hd - rr, rr, Math.PI / 2, Math.PI, false);
  path.lineTo(-hw, -hd + rr);
  path.absarc(-hw + rr, -hd + rr, rr, Math.PI, Math.PI * 1.5, false);
  return path;
}

/**
 * Cornice piatta a rettangolo arrotondato, già coricata sul piano XZ.
 * È la rifinitura lucida del bordo dei piatti quadrati/rettangolari: senza,
 * la loro superficie ampia non "legge" come oro.
 */
function roundedRectFrame(w, d, r, thickness, height) {
  const shape = roundedRectPath(new THREE.Shape(), w, d, r);
  shape.holes.push(
    roundedRectPath(new THREE.Path(), w - thickness * 2, d - thickness * 2, Math.max(0.01, r - thickness))
  );
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    curveSegments: 10,
  });
  geom.rotateX(-Math.PI / 2);
  geom.computeVertexNormals();
  return geom;
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

/** Il poligono del contorno della torta, forma per forma. */
function contornoPoly(shape, R, inset) {
  if (shape === 'cuore') return heartFootprint(R * inset);
  if (shape === 'quadrata' || shape === 'rettangolare') {
    const [w, d] = boxDims(shape, R);
    const hw = (w / 2) * inset, hd = (d / 2) * inset;
    return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
  }
  const poly = [];
  const m = 96;
  for (let i = 0; i < m; i++) {
    const a = (i / m) * Math.PI * 2;
    poly.push([Math.cos(a) * R * inset, Math.sin(a) * R * inset]);
  }
  return poly;
}

/**
 * Il posto è su un tratto di bordo che guarda DAVVERO fuori?
 *
 * Serve al CUORE, che ha l'incavo in cima: lì il contorno rientra, e quello che
 * per un pezzo è il "fuori" punta verso il centro della torta. Un fiocco
 * annodato in quel punto finiva in mezzo al cuore invece che sul bordo —
 * sembrava un errore, ed era un errore.
 *
 * Il controllo è geometrico e vale per qualsiasi forma: si fa un passo nel
 * verso in cui il pezzo sporge e si guarda se si è usciti dalla sagoma.
 */
function bordoLibero(poly, x, z, ang, passo) {
  return !pointInPoly(x + Math.cos(ang) * passo, z + Math.sin(ang) * passo, poly);
}

/** N punti distribuiti lungo il CONTORNO della forma (per i ciuffi di panna). */
function perimeterPts(shape, R, inset, n) {
  const poly = contornoPoly(shape, R, inset);
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
    // Insieme al punto porto anche la DIREZIONE DEL LATO su cui sta: serve a
    // orientare i pezzi che hanno un davanti. Ricavarla dai punti vicini non
    // basta — su un angolo verrebbe la diagonale, e il pezzo d'angolo
    // guarderebbe di sbieco rispetto a tutti i suoi vicini.
    const dx = seg.len ? (seg.b[0] - seg.a[0]) / seg.len : 0;
    const dz = seg.len ? (seg.b[1] - seg.a[1]) / seg.len : 0;
    out.push([seg.a[0] + (seg.b[0] - seg.a[0]) * t, seg.a[1] + (seg.b[1] - seg.a[1]) * t, k, dx, dz]);
  }
  return out;
}

/**
 * Quanto è lungo il contorno. Serve per i ciuffi messi in fila attaccati: il
 * loro numero non si può decidere a occhio per forma, perché dipende anche dal
 * formato — su una torta da 20 persone il giro è il doppio che su una da 6, e
 * con un numero fisso i ciuffi si allontanano fino a diventare palline sparse.
 */
function perimeterLen(shape, R, inset) {
  const p = perimeterPts(shape, R, inset, 160);
  let L = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    L += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return L;
}

/** Quanti ciuffi larghi `passo` stanno attaccati lungo il contorno. */
function quantiInFila(shape, R, inset, passo) {
  return Math.max(10, Math.min(96, Math.round(perimeterLen(shape, R, inset) / passo)));
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

/**
 * Ciuffetto di panna. Prima era una pallina con sopra un cono: la sagoma
 * tornava, ma era liscia, e la panna liscia non esiste — quella che si vede
 * nelle loro torte porta sempre le righe della bocchetta a stella.
 */
function Dollop({ position, color, s = 1, rotation = 0 }) {
  return (
    <mesh
      castShadow
      geometry={CREAM_DROP_GEO}
      position={[position[0], position[1] - 0.03 * s, position[2]]}
      rotation={[0, rotation, 0]}
      scale={[0.21 * s, 0.28 * s, 0.21 * s]}
    >
      <meshPhysicalMaterial {...softMat(color)} />
    </mesh>
  );
}

/* ============================ decorazioni 3D "a pezzi" ============================ */

/**
 * InstancedMesh generico: riceve la lista dei pezzi già calcolata
 * ({ position, rotation, scale, color }) e la disegna in una sola draw call.
 * Serve a tenere leggera la scena: la torta 3D gira anche sul telefono.
 * `order` è l'ordine di rotazione di Eulero: con 'YXZ' si corica un pezzo e poi
 * lo si gira verso l'esterno della torta.
 * Il colore per pezzo passa da `setColorAt`: NON serve (anzi, non va messo)
 * `vertexColors` sul materiale, altrimenti three cerca un attributo che non c'è.
 */
function Pieces({ items, geometry, order = 'XYZ', children }) {
  const ref = useRef();
  const n = Math.max(1, items.length);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const p = it.position || [0, 0, 0];
      const r = it.rotation || [0, 0, 0];
      const s = it.scale === undefined ? 1 : it.scale;
      dummy.position.set(p[0], p[1], p[2]);
      dummy.rotation.set(r[0], r[1], r[2], order);
      if (Array.isArray(s)) dummy.scale.set(s[0], s[1], s[2]);
      else dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, col.set(it.color || '#ffffff'));
    }
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items, order]);
  if (!items.length) return null;
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, n]} castShadow receiveShadow>
      {children}
    </instancedMesh>
  );
}

/**
 * Posti dove appoggiare le decorazioni: seguono il CONTORNO della forma (così il
 * centro resta libero per scritta e foto) e portano l'angolo verso l'esterno,
 * per far "guardare fuori" i pezzi che hanno un davanti (macarons, fiocchi).
 */
function decoSpots(shape, R, n, inset = 0.8) {
  return perimeterPts(shape, R, inset, n).map(([x, z, i, dx, dz]) => {
    // Verso "fuori" preso dal LATO su cui il pezzo è appoggiato, non dal centro
    // della torta. Sul tondo è la stessa cosa; sul quadrato no: col verso preso
    // dal centro, un pezzo vicino all'angolo guarda in diagonale mentre i suoi
    // vicini guardano dritti — ed è esattamente il macaron che sembrava storto.
    // Così invece tutti quelli sullo stesso lato guardano nella stessa identica
    // direzione, angoli compresi.
    let ang;
    if (dx === undefined || Math.hypot(dx, dz) < 1e-6) {
      ang = Math.atan2(z, x); // ripiego: forme senza lati (non dovrebbe capitare)
    } else {
      // normale = direzione del lato ruotata di 90°, girata verso l'esterno
      let nx = dz;
      let nz = -dx;
      if (nx * x + nz * z < 0) { nx = -nx; nz = -nz; }
      ang = Math.atan2(nz, nx);
    }
    return { x, z, i, ang };
  });
}

/** Caso finto ma stabile: stessa torta → stessa disposizione a ogni render. */
function rnd(i, k = 1) {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/* ---- geometrie riusate da più decorazioni (costruite una volta sola) ---- */

/**
 * IL CORDONE DI PANNA, da cui nasce tutto quello che è "fatto col ciuffo".
 *
 * La panna montata non esce liscia dalla tasca: la bocchetta è a stella, e
 * lascia sul cordone le scanalature per il lungo. È quello — non la forma
 * generale — che fa riconoscere la panna a colpo d'occhio. Qui si dà un
 * percorso (`curve`) e un profilo di spessore (`taper`), e si ottiene il
 * cordone con le sue righe: dritto e alto diventa una ruche sul fianco, corto
 * e ritorto un ciuffetto, steso e appuntito una conchiglia.
 *
 *   lobes  quante scanalature (punte della bocchetta)
 *   flute  quanto sono profonde: 0 = tondo liscio, 0.5 = stella marcata
 *   twist  di quanto girano salendo — un filo, se no sembra una trivella
 *   onde   le ondulazioni della mano che spinge: senza queste il cordone viene
 *          identico a se stesso da cima a fondo e sembra plastica estrusa
 */
function creamRope({ curve, steps = 14, lobes = 6, flute = 0.32, twist = 0, onde = 0, nOnde = 6, taper }) {
  const around = lobes * 4;
  const frames = curve.computeFrenetFrames(steps, false);
  const pos = [];
  const idx = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = curve.getPoint(t);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const r0 = 0.5 * Math.max(0.03, taper(t)) * (1 + onde * Math.sin(t * Math.PI * 2 * nOnde));
    for (let j = 0; j < around; j++) {
      const a = (j / around) * Math.PI * 2;
      // la scanalatura: raggio pieno sulla cresta, rientrato nella valle
      const r = r0 * (1 - flute * (0.5 - 0.5 * Math.cos(lobes * (a + twist * t))));
      const cx = Math.cos(a) * r;
      const cz = Math.sin(a) * r;
      pos.push(p.x + N.x * cx + B.x * cz, p.y + N.y * cx + B.y * cz, p.z + N.z * cx + B.z * cz);
    }
  }
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < around; j++) {
      const k = (j + 1) % around;
      const a0 = i * around + j;
      const b0 = i * around + k;
      const a1 = (i + 1) * around + j;
      const b1 = (i + 1) * around + k;
      idx.push(a0, b0, a1, b0, b1, a1);
    }
  }
  // tappi alle due estremità: senza, si vede dentro il cordone
  const last = steps * around;
  const p0 = curve.getPoint(0);
  const c0 = pos.length / 3;
  pos.push(p0.x, p0.y, p0.z);
  for (let j = 0; j < around; j++) idx.push(c0, (j + 1) % around, j);
  const p1 = curve.getPoint(1);
  const c1 = pos.length / 3;
  pos.push(p1.x, p1.y, p1.z);
  for (let j = 0; j < around; j++) idx.push(c1, last + j, last + ((j + 1) % around));

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const rettaSu = new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));

/**
 * RUCHE: il cordone verticale che riveste il fianco della torta, dal vassoio
 * fino al bordo di sopra.
 *
 * Va costruito su misura per ogni torta, non stirato in altezza: la calotta in
 * cima dev'essere una semisfera VERA, alta quanto il cordone è largo. Stirando
 * una geometria unica si schiacciava, e i cordoni finivano con un tettuccio
 * piatto — sembravano tubi tagliati con la sega, non panna.
 *
 * `alt` = altezza in multipli della larghezza. Il pezzo esce largo 1.
 */
function rucheGeo(alt) {
  const cupola = 0.5 / alt; // semisfera in cima: alta quanto il raggio
  return creamRope({
    curve: new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, alt, 0)),
    steps: Math.max(14, Math.min(40, Math.round(alt * 4))),
    lobes: 6,
    // Scanalature appena accennate e onde piccolissime. Ogni volta che ho
    // alzato uno dei due il cordone ha smesso di sembrare panna: con le
    // scanalature marcate diventava una matita esagonale, con le onde grosse
    // una pannocchia. Quello che fa la differenza è la fila di ombre fra un
    // cordone e l'altro, non il rilievo del singolo.
    flute: 0.11,
    twist: 0.1,
    onde: 0.022,
    nOnde: 4,
    // taglio netto in basso: finisce dentro il vassoio e non si vede
    taper: (t) =>
      t < 1 - cupola
        ? 0.93 + 0.07 * Math.sin(Math.PI * t)
        : Math.sqrt(Math.max(0, 1 - Math.pow((t - (1 - cupola)) / cupola, 2))),
  });
}

/**
 * CIUFFETTO: la goccia che esce tenendo ferma la bocchetta e tirando su.
 * Sale girando e si chiude a punta. Larghezza 1, altezza 1.
 */
const CREAM_DROP_GEO = creamRope({
  curve: rettaSu,
  steps: 16,
  lobes: 6,
  flute: 0.3,
  twist: 1.15,
  // la punta resta un po' smussata: a chiuderla del tutto venivano dei
  // pinoli, e la panna montata in cima si ripiega sempre un pochino
  taper: (t) => Math.min(1, t / 0.09) * (1 - Math.pow(t, 2.3) * 0.88),
});

/**
 * Spumino fatto come nella realtà: un unico cordone di meringa spremuto a
 * spirale, largo alla base e sempre più stretto verso la punta. Il vecchio
 * profilo tornito disegnava cerchi perfettamente sovrapposti e sembrava una
 * pila di dischi; qui il giro è continuo e quindi molto più naturale.
 */
const MERINGUE_GEO = (() => {
  const punti = [];
  const giri = 2.45;
  for (let i = 0; i <= 72; i++) {
    const t = i / 72;
    const r = 0.4 * (1 - Math.pow(t, 0.92)) + 0.012;
    const a = -t * giri * Math.PI * 2;
    // La base parte abbastanza alta da non affondare nel piano quando il
    // cordone raggiunge il suo spessore pieno; poi sale lentamente a cono.
    const y = 0.29 + t * 0.56 + Math.sin(t * Math.PI) * 0.018;
    punti.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  const curva = new THREE.CatmullRomCurve3(punti, false, 'centripetal');
  return creamRope({
    curve: curva,
    steps: 72,
    lobes: 8,
    flute: 0.14,
    twist: 0.35,
    onde: 0.018,
    nOnde: 7,
    // L'imbocco si chiude come una codina appoggiata; in cima il cordone si
    // assottiglia molto, senza terminare con uno spillo alto e rigido.
    taper: (t) =>
      Math.min(1, t / 0.025) * (0.55 * (1 - 0.78 * Math.pow(t, 2.15)) + 0.02),
  });
})();

/** Cilindretto morbido con gli angoli arrotondati (marshmallow). Raggio 0.5, altezza 1. */
const MARSHMALLOW_GEO = (() => {
  const r = 0.5;
  const half = 0.5;
  const cr = 0.17;
  const pts = [new THREE.Vector2(0, -half)];
  for (let i = 0; i <= 5; i++) {
    const a = -Math.PI / 2 + (i / 5) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r - cr + Math.cos(a) * cr, -half + cr + Math.sin(a) * cr));
  }
  for (let i = 0; i <= 5; i++) {
    const a = (i / 5) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r - cr + Math.cos(a) * cr, half - cr + Math.sin(a) * cr));
  }
  pts.push(new THREE.Vector2(0, half));
  const g = new THREE.LatheGeometry(pts, 20);
  g.computeVertexNormals();
  return g;
})();

/* ---- MACARONS: due dischetti con la crema in mezzo ---- */

const MACARON_COLORS = ['#f4a9c0', '#f7b98a', '#f6e79a', '#b8e0a6', '#a9d2f0', '#e7c9f0'];

function Macarons({ spots, y, color }) {
  const { gusci, creme } = useMemo(() => {
    const pal = decoPalette(MACARON_COLORS, color);
    const gusci = [];
    const creme = [];
    for (const { x, z, i, ang } of spots) {
      const c = pal[i % pal.length];
      const rad = 0.115 + rnd(i, 3) * 0.014;
      const yy = y + rad * 0.97;
      // in piedi, con la faccia tonda rivolta fuori dalla torta
      const rot = [Math.PI / 2, Math.PI / 2 - ang, 0];
      const ux = Math.cos(ang);
      const uz = Math.sin(ang);
      const off = 0.044;
      gusci.push({ position: [x + ux * off, yy, z + uz * off], rotation: rot, scale: [rad, 0.05, rad], color: c });
      gusci.push({ position: [x - ux * off, yy, z - uz * off], rotation: rot, scale: [rad, 0.05, rad], color: c });
      creme.push({
        position: [x, yy, z],
        rotation: rot,
        scale: [rad * 0.93, 0.042, rad * 0.93],
        color: mix(c, '#fff3e0', 0.5),
      });
    }
    return { gusci, creme };
  }, [spots, y, color]);

  return (
    <>
      <Pieces items={gusci} order="YXZ">
        <cylinderGeometry args={[1, 1, 1, 22]} />
        <meshPhysicalMaterial roughness={0.62} clearcoat={0.25} clearcoatRoughness={0.5} envMapIntensity={0.5} />
      </Pieces>
      <Pieces items={creme} order="YXZ">
        <cylinderGeometry args={[1, 1, 1, 22]} />
        <meshPhysicalMaterial roughness={0.85} envMapIntensity={0.25} />
      </Pieces>
    </>
  );
}

/* ---- SPUMINI: piccole meringhe basse e tonde (rosa o blu) ---- */

const SPUMINI_COLORS = ['#f7bfd3', '#a6cbf0'];

function Spumini({ spots, y, color }) {
  const items = useMemo(() => {
    const pal = decoPalette(SPUMINI_COLORS, color);
    return spots.map(({ x, z, i }) => {
      const s = 0.185 + rnd(i, 5) * 0.025;
      return {
        position: [x, y - 0.004, z],
        rotation: [0, rnd(i, 6) * 6.28, 0],
        scale: [s, s * 0.78, s],
        color: pal[i % pal.length],
      };
    });
  }, [spots, y, color]);
  return (
    <Pieces items={items} geometry={MERINGUE_GEO}>
      <meshPhysicalMaterial roughness={0.84} sheen={0.42} sheenRoughness={0.88} envMapIntensity={0.28} />
    </Pieces>
  );
}

/* ---- MARSHMALLOW: cilindretti morbidi con gli angoli arrotondati ---- */

const MARSHMALLOW_COLORS = ['#fff3ec', '#f7bfd0', '#f6e6a8', '#bfe6c8'];

function Marshmallow({ spots, y, color }) {
  const items = useMemo(() => {
    const pal = decoPalette(MARSHMALLOW_COLORS, color);
    return spots.map(({ x, z, i }) => {
      const r = 0.098 + rnd(i, 7) * 0.018;
      const h = 0.17 + rnd(i, 8) * 0.035;
      const c = pal[i % pal.length];
      // Tutti in piedi, come si appoggiano davvero su una torta. Prima qualcuno
      // era coricato e qualcuno no, e da fuori sembrava solo disordine.
      // L'unica variazione è la rotazione su sé stessi, che non si nota come
      // "storto" ma toglie l'effetto stampino.
      return { position: [x, y + h / 2, z], rotation: [0, rnd(i, 10) * 6.28, 0], scale: [r * 2, h, r * 2], color: c };
    });
  }, [spots, y, color]);
  return (
    <Pieces items={items} geometry={MARSHMALLOW_GEO} order="YXZ">
      <meshPhysicalMaterial roughness={0.95} sheen={1} sheenRoughness={0.9} envMapIntensity={0.18} />
    </Pieces>
  );
}

/* ---- FIORI: petali a raggiera; eleganti (zucchero duro) e di ostia (piatti) ---- */

const FIORI_COLORS = ['#f4a9c0', '#e0334c', '#8ed0f0', '#7cc47a', '#f7d34a', '#fff8e6'];

function FioriEleganti({ spots, y, color }) {
  const { petali, cuori } = useMemo(() => {
    const pal = decoPalette(FIORI_COLORS, color);
    const petali = [];
    const cuori = [];
    for (const { x, z, i } of spots) {
      const c = pal[i % pal.length];
      const rot0 = rnd(i, 11) * 1.2;
      const rp = 0.062;
      for (let p = 0; p < 6; p++) {
        const b = rot0 + (p / 6) * Math.PI * 2;
        petali.push({
          position: [x + Math.cos(b) * rp, y + 0.028, z + Math.sin(b) * rp],
          rotation: [0, -b, 0],
          scale: [0.075, 0.03, 0.046],
          color: c,
        });
      }
      cuori.push({ position: [x, y + 0.042, z], scale: [0.042, 0.032, 0.042], color: '#f2c33f' });
    }
    return { petali, cuori };
  }, [spots, y, color]);
  return (
    <>
      <Pieces items={petali}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshPhysicalMaterial roughness={0.28} clearcoat={0.85} clearcoatRoughness={0.12} envMapIntensity={0.9} />
      </Pieces>
      <Pieces items={cuori}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial roughness={0.35} metalness={0.25} envMapIntensity={0.9} />
      </Pieces>
    </>
  );
}

function FioriOstia({ spots, y, color }) {
  const { petali, cuori } = useMemo(() => {
    const pal = decoPalette(FIORI_COLORS, color);
    const petali = [];
    const cuori = [];
    for (const { x, z, i } of spots) {
      const c = pal[i % pal.length];
      const rot0 = rnd(i, 12) * 1.2;
      const rp = 0.075;
      for (let p = 0; p < 5; p++) {
        const b = rot0 + (p / 5) * Math.PI * 2;
        petali.push({
          position: [x + Math.cos(b) * rp, y + 0.014 + rnd(i + p, 13) * 0.01, z + Math.sin(b) * rp],
          rotation: [rnd(i + p, 14) * 0.3 - 0.15, -b, 0],
          scale: [0.09, 0.005, 0.052],
          color: c,
        });
      }
      cuori.push({ position: [x, y + 0.018, z], scale: [0.03, 0.006, 0.03], color: '#fbe9a8' });
    }
    return { petali, cuori };
  }, [spots, y, color]);
  return (
    <>
      <Pieces items={petali} order="YXZ">
        <sphereGeometry args={[1, 14, 8]} />
        <meshPhysicalMaterial
          transparent
          opacity={0.85}
          roughness={0.8}
          side={THREE.DoubleSide}
          envMapIntensity={0.3}
        />
      </Pieces>
      <Pieces items={cuori}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial roughness={0.8} />
      </Pieces>
    </>
  );
}

/* ---- FRUTTA FRESCA: ribes, more e lamponi ---- */

const RIBES = ['#d42a44', '#e0334c', '#b81f38'];
const MORE_LAMPONI = ['#3a2350', '#2c1a3d', '#e0526f', '#c93a5c'];

function FruttaFresca({ spots, y }) {
  const { lisce, ruvide, foglie } = useMemo(() => {
    const lisce = [];
    const ruvide = [];
    const foglie = [];
    for (const { x, z, i } of spots) {
      // grappolino: 2-3 bacche per posto, sparse quel tanto che basta
      const n = 2 + (i % 2);
      for (let k = 0; k < n; k++) {
        const a = rnd(i, 20 + k) * Math.PI * 2;
        const d = 0.04 + rnd(i, 30 + k) * 0.055;
        const px = x + Math.cos(a) * d;
        const pz = z + Math.sin(a) * d;
        if (rnd(i, 40 + k) > 0.45) {
          const r = 0.055 + rnd(i, 50 + k) * 0.022;
          ruvide.push({
            position: [px, y + r * 0.85, pz],
            rotation: [rnd(i, 60 + k) * 3, rnd(i, 61 + k) * 3, 0],
            scale: r,
            color: MORE_LAMPONI[(i + k) % MORE_LAMPONI.length],
          });
        } else {
          const r = 0.042 + rnd(i, 51 + k) * 0.016;
          lisce.push({ position: [px, y + r * 0.9, pz], scale: r, color: RIBES[(i + k) % RIBES.length] });
        }
      }
      if (i % 3 === 0) {
        foglie.push({
          position: [x + 0.075, y + 0.018, z - 0.055],
          rotation: [0.12, rnd(i, 70) * 3, 0],
          scale: [0.078, 0.008, 0.042],
          color: '#5a8f3c',
        });
      }
    }
    return { lisce, ruvide, foglie };
  }, [spots, y]);
  return (
    <>
      <Pieces items={lisce}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshPhysicalMaterial roughness={0.16} clearcoat={0.95} clearcoatRoughness={0.1} envMapIntensity={1.1} />
      </Pieces>
      <Pieces items={ruvide}>
        <icosahedronGeometry args={[1, 1]} />
        <meshPhysicalMaterial roughness={0.3} clearcoat={0.7} clearcoatRoughness={0.25} envMapIntensity={0.9} />
      </Pieces>
      <Pieces items={foglie} order="YXZ">
        <sphereGeometry args={[1, 10, 8]} />
        <meshPhysicalMaterial roughness={0.5} clearcoat={0.4} envMapIntensity={0.5} />
      </Pieces>
    </>
  );
}

/* ---- CIOCCOLATO: riccioli e scaglie (bianco, latte, fondente) ---- */


/* ---- FIOCCHI: fiocchetti a nastro, in piedi sul bordo ---- */

const FIOCCHI_COLORS = ['#3a3540', '#f4a9c0', '#e0334c', '#e8c069'];

/**
 * Fiocchi di raso. Due modi, a seconda di dove finiscono:
 *
 *  - SUL FIANCO (torta senza panna sul bordo): annodati intorno, col nastro che
 *    scende lungo il lato, come nelle torte decorate col nastro.
 *  - SULLA PANNA (quando c'è l'anello di ciuffi): appoggiati sopra, altrimenti
 *    finiscono coperti dalla panna. Lì vanno più piccoli e con le asole meno
 *    sollevate: a grandezza piena si alzavano come una corona e sbordavano
 *    fuori dalla torta.
 *
 * `y` è l'altezza del nodo, `drop` decide la lunghezza dei nastri, `s` quanto
 * è grande tutto il fiocco e `alzata` di quanto si aprono le asole verso l'alto.
 */
function Fiocchi({ spots, y, drop = 0.5, color, s = 1, alzata = 0.72 }) {
  const { asole, nodi, code } = useMemo(() => {
    const pal = decoPalette(FIOCCHI_COLORS, color);
    const asole = [];
    const nodi = [];
    const code = [];
    for (const { x, z, i, ang } of spots) {
      const c = pal[i % pal.length];
      const ry = Math.PI / 2 - ang; // il fiocco guarda verso l'esterno
      const ux = -Math.sin(ang);    // tangente al bordo
      const uz = Math.cos(ang);
      const nx = Math.cos(ang);     // normale uscente
      const nz = Math.sin(ang);
      // il nodo sporge dal fianco, così il nastro non sprofonda nella torta
      const px = x + nx * 0.028 * s;
      const pz = z + nz * 0.028 * s;
      // due asole affiancate lungo il fianco, inclinate verso l'alto. Il nastro
      // è di raso: largo e piatto, non un cordoncino — altrimenti a questa
      // distanza il fiocco non si legge.
      for (const sgn of [-1, 1]) {
        // Le due asole salgono verso l'ALTO allargandosi, come in un fiocco
        // annodato davvero: prima erano inclinate in giù e sembravano due ali
        // afflosciate. Sono anche un po' più alzate rispetto al nodo.
        asole.push({
          position: [px + ux * sgn * 0.135 * s, y + 0.062 * s, pz + uz * sgn * 0.135 * s],
          rotation: [0, ry, -sgn * alzata],
          scale: [0.17 * s, 0.1 * s, 0.036 * s],
          color: c,
        });
        // I due nastri scendono DIVARICANDOSI verso l'esterno (prima si
        // chiudevano verso il centro, e sembravano incollati fra loro).
        // Lunghezza diversa da un fiocco all'altro: sembra annodato a mano.
        const len = drop * (0.55 + ((i * 7) % 5) * 0.06);
        code.push({
          position: [px + ux * sgn * 0.055 * s, y - len / 2 - 0.05 * s, pz + uz * sgn * 0.055 * s],
          rotation: [0, ry, -sgn * 0.32],
          scale: [0.058 * s, len, 0.014 * s],
          color: c,
        });
      }
      nodi.push({ position: [px, y, pz], scale: [0.052 * s, 0.048 * s, 0.038 * s], color: shade(c, -0.18) });
    }
    return { asole, nodi, code };
  }, [spots, y, drop, color, s, alzata]);
  // raso: molto lucido e liscio
  const nastro = { roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.05 };
  return (
    <>
      <Pieces items={asole}>
        <torusGeometry args={[1, 0.34, 8, 20]} />
        <meshPhysicalMaterial {...nastro} />
      </Pieces>
      <Pieces items={nodi}>
        <sphereGeometry args={[1, 12, 10]} />
        <meshPhysicalMaterial {...nastro} />
      </Pieces>
      <Pieces items={code} order="YXZ">
        <boxGeometry args={[1, 1, 1]} />
        <meshPhysicalMaterial {...nastro} />
      </Pieces>
    </>
  );
}

/**
 * Decorazioni con resa 3D "a pezzi" (quelle a chicchi stanno in TOPPINGS).
 * Vengono disposte lungo il contorno della torta, così il centro resta libero
 * per la scritta e per la foto su cialda.
 */
const PIECE_DECORATIONS = new Set([
  'macarons',
  'spumini',
  'marshmallow',
  'fiori-eleganti',
  'fiori-ostia',
  'frutta-fresca',
  'fiocchi',
]);

/*
 * Nota: "Fantasia del gelataio", "Decorazioni colorate e divertenti" e le due
 * "Decorazioni cioccolato" NON hanno resa 3D: dipendono da cosa c'è in gelateria
 * quel giorno e da come decide di decorare il gelataio. Disegnarle sarebbe una
 * promessa — l'immagine finisce nell'ordine e il laboratorio si troverebbe
 * vincolato. Vengono scritte a parole sopra la torta (vedi CakePreview.jsx,
 * DECORAZIONI_SU_DISPONIBILITA), e qui semplicemente non compaiono.
 */

/**
 * Quanti posti lungo il bordo vuole ogni decorazione quando è da sola. È anche
 * la misura di quanto è INGOMBRANTE il suo pezzo: chi ne vuole pochi (i fiori
 * eleganti, i macarons) ha pezzi grossi e comanda la spaziatura quando le
 * decorazioni sono più d'una.
 */
const DECO_COUNT = {
  macarons: 9,
  spumini: 14,
  marshmallow: 12,
  'fiori-eleganti': 7,
  'fiori-ostia': 8,
  'frutta-fresca': 10,
  fiocchi: 8,
  fantasia: 15,
  colorate: 15,
};

/** Decorazioni che si annodano sul FIANCO invece di stare sulla superficie. */
const EDGE_DECORATIONS = new Set(['fiocchi']);

/**
 * Decorazioni "mix": pezzi sulla superficie E nastri sul fianco. Oggi nessuna —
 * "fantasia del gelataio" e "decorazioni colorate" facevano parte di questo
 * gruppo, ma ora non si disegnano affatto (si scrivono e basta, vedi sopra).
 * L'insieme resta perché la ripartizione dei posti lo prevede.
 */
const MIX_DECORATIONS = new Set();

/** Quanti nastri annoda sul fianco ogni decorazione che li prevede. */
const NASTRI_PER_DECO = 4;

/**
 * UNA decorazione sulla superficie, sui posti del contorno che le sono toccati.
 * Chi non ha una resa 3D non disegna niente: meglio pulito che finto.
 */
function DecorazioneSopra({ id, spots, y, color }) {
  if (!spots || !spots.length) return null;
  switch (id) {
    case 'macarons':
      return <Macarons spots={spots} y={y} color={color} />;
    case 'spumini':
      return <Spumini spots={spots} y={y} color={color} />;
    case 'marshmallow':
      return <Marshmallow spots={spots} y={y} color={color} />;
    case 'fiori-eleganti':
      return <FioriEleganti spots={spots} y={y} color={color} />;
    case 'fiori-ostia':
      return <FioriOstia spots={spots} y={y} color={color} />;
    case 'frutta-fresca':
      return <FruttaFresca spots={spots} y={y} />;
    // "fantasia del gelataio" e "decorazioni colorate" non passano di qui:
    // non si disegnano: dipendono dalla gelateria e si scrivono sopra la torta.
    default:
      return null;
  }
}

/**
 * TUTTE le decorazioni scelte, insieme.
 *
 * I posti sul contorno sono uno solo per tutte: la decorazione k prende quelli
 * con indice i % n === k (interlacciate), così si vedono tutte e nessuna finisce
 * sopra l'altra. I nastri (fiocchi, e quelli del mix) fanno storia a sé: si
 * annodano sul FIANCO, su un anello loro, e non tolgono spazio alla superficie.
 */
function Decorazioni3D({
  ids,
  shape,
  R,
  y,
  colors,
  topInset = 0.79,
  edgeR,
  edgeY,
  drop,
  bowS = 1,
  bowAlzata = 0.72,
}) {
  const shapeF = shape === 'rettangolare' ? 1.15 : shape === 'quadrata' ? 1.05 : 1;

  // chi occupa la superficie e chi il fianco (il mix sta di qua e di là)
  const sopra = useMemo(() => ids.filter((id) => !EDGE_DECORATIONS.has(id)), [ids]);
  const fianco = useMemo(
    () => ids.filter((id) => EDGE_DECORATIONS.has(id) || MIX_DECORATIONS.has(id)),
    [ids]
  );

  // Quanti posti servono sul contorno. Comanda la decorazione col pezzo più
  // ingombrante (quella che ne vuole meno): con una decorazione sola i posti
  // sono esattamente quelli di sempre, con più decorazioni se ne aggiungono
  // pochi — sommarli farebbe della torta un ammasso. Il totale è multiplo del
  // numero di decorazioni, così l'alternanza gira regolare.
  const nSopra = useMemo(() => {
    const k = sopra.length;
    if (!k) return 0;
    const minimo = Math.min(...sopra.map((id) => DECO_COUNT[id] || 10));
    const grezzo = Math.round(minimo * (1 + (k - 1) * 0.35) * shapeF);
    return Math.max(k * 3, Math.ceil(grezzo / k) * k);
  }, [sopra, shapeF]);

  const spotsSopra = useMemo(
    () => decoSpots(shape, R, nSopra, topInset),
    [shape, R, nSopra, topInset]
  );
  const gruppiSopra = useMemo(
    () => sopra.map((_, k) => spotsSopra.filter((s) => s.i % sopra.length === k)),
    [sopra, spotsSopra]
  );

  // Fianco: pochi nastri, ben distanziati, sul contorno esterno della torta.
  // Si scartano i posti che cadono in un rientro del bordo — sul cuore è
  // l'incavo in cima: un nastro annodato lì finirebbe in mezzo alla torta.
  // Meglio un fiocco in meno che uno piantato dove non si può annodare.
  const bowR = edgeR ?? R;
  const nFianco = fianco.length * NASTRI_PER_DECO;
  const spotsFianco = useMemo(() => {
    const poly = contornoPoly(shape, bowR, 1.0);
    return decoSpots(shape, bowR, nFianco, 1.0).filter((s) =>
      bordoLibero(poly, s.x, s.z, s.ang, bowR * 0.1)
    );
  }, [shape, bowR, nFianco]);
  const gruppiFianco = useMemo(
    () => fianco.map((_, k) => spotsFianco.filter((s) => s.i % fianco.length === k)),
    [fianco, spotsFianco]
  );

  return (
    <>
      {sopra.map((id, k) => (
        <DecorazioneSopra
          key={`sopra-${id}`}
          id={id}
          spots={gruppiSopra[k]}
          y={y}
          color={(colors && colors[id]) || ''}
        />
      ))}
      {fianco.map((id, k) => (
        <Fiocchi
          key={`fianco-${id}`}
          spots={gruppiFianco[k] || []}
          y={edgeY ?? y}
          drop={drop}
          s={bowS}
          alzata={bowAlzata}
          color={(colors && colors[id]) || ''}
        />
      ))}
    </>
  );
}

/* ============================ granella croccante (firma Gelopie) ============================ */

function Granella({
  R,
  y,
  shape,
  coverage = 1,
  count = 1200,
  colors = ['#c79a58', '#7a4a26'],
  shiny = false,
  // `round` → chicchi tondi (smarties, perline) invece delle scaglie di granella;
  // `flat` schiaccia il chicco (0.5 = lenticchia tipo smarties);
  // `metal` serve alle perline placcate oro/argento.
  round = false,
  flat = 1,
  metal = 0,
  sizeMin = 0.02,
  sizeMax = 0.046,
  holeW = 0,
  holeH = 0,
  // Spessore della fascia lungo il bordo, in frazione del raggio.
  banda = 0.3,
  // Altezza dei ciuffi di panna sotto: se c'è, i chicchi si alzano fin lassù
  // invece di stare appoggiati sulla torta.
  sopraCiuffi = 0,
}) {
  const ref = useRef();
  // Sopra i ciuffi ne bastano la metà: lì la fascia è stretta quanto un ciuffo,
  // e col numero pieno la granella diventava una crosta che copriva la panna
  // invece di spolverarla. Deve vedersi tutt'e due.
  const nChicchi = sopraCiuffi ? Math.round(count * 0.5) : count;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    // I chicchi vanno in una FASCIA lungo il bordo, non sparsi su tutto il piano:
    // così granelle, zuccherini, smarties e perline stanno dove stanno già gli
    // altri pezzi (macarons, frutta fresca…) e il centro resta libero.
    // `perimeterPts` conosce la forma: sul quadrato percorre il rettangolo, sul
    // cuore il cuore. Prendo il contorno esterno della fascia una volta sola e
    // poi, per ogni chicco, scivolo verso l'interno di una quantità a caso.
    const contorno = perimeterPts(shape, R, coverage, 240);
    const larghezza = Math.max(0.06, banda) * R; // spessore della fascia
    let maxExt = 0;
    for (const [px, pz] of contorno) maxExt = Math.max(maxExt, Math.hypot(px, pz));
    const sample = (i) => {
      // Ogni chicco ha la SUA fettina di contorno (i/n + un po' di caso): con
      // il caso puro venivano i grumi — archi fitti di granella e archi nudi —
      // e la fascia sembrava buttata lì storta invece che spolverata in giro.
      const quota = ((i + Math.random()) / nChicchi) % 1;
      const t = quota * contorno.length;
      const i0 = Math.floor(t) % contorno.length;
      const i1 = (i0 + 1) % contorno.length;
      const f = t - Math.floor(t);
      const x0 = contorno[i0][0] + (contorno[i1][0] - contorno[i0][0]) * f;
      const z0 = contorno[i0][1] + (contorno[i1][1] - contorno[i0][1]) * f;
      // verso il centro: più chicchi vicino al bordo che verso l'interno.
      // Sopra i ciuffi invece no: la fascia è larga quanto un ciuffo e i chicchi
      // vanno distribuiti pari, se no si ammucchiano sul lato interno e la fila
      // di panna resta scoperta di fuori.
      const l = Math.hypot(x0, z0) || 1e-3;
      const dentro = Math.pow(Math.random(), sopraCiuffi ? 1 : 0.7) * larghezza;
      const k = Math.max(0, (l - dentro) / l);
      // pizzico di disordine, altrimenti sembra tracciata col righello
      const j = () => (Math.random() - 0.5) * larghezza * 0.28;
      return [x0 * k + j(), z0 * k + j(), dentro];
    };

    const dummy = new THREE.Object3D();
    const cols = colors.map((c) => new THREE.Color(c));
    const tmp = new THREE.Color();
    for (let i = 0; i < nChicchi; i++) {
      let [x, z, dentro] = sample(i);
      let dist = Math.hypot(x, z);
      // buco centrale ellittico (per scritta/foto): granella solo nella corona esterna
      if (holeW > 0 && holeH > 0) {
        const inHole = () => (x * x) / (holeW * holeW) + (z * z) / (holeH * holeH) < 1;
        let tries = 0;
        while (inHole() && tries < 30) { [x, z, dentro] = sample(i); tries++; }
        if (inHole()) {
          const e = Math.sqrt((x * x) / (holeW * holeW) + (z * z) / (holeH * holeH)) || 1e-3;
          const s = (1.05 + Math.random() * 0.12) / e;
          x *= s; z *= s;
        }
        dist = Math.hypot(x, z);
      }
      const pile = (1 - Math.min(1, dist / (maxExt + 1e-3))) * 0.04;
      // Spolverata sui ciuffi: il chicco si alza quanto è alta la panna NEL
      // PUNTO dove sta — il ciuffo è una gobba, pieno al centro della fila e
      // basso ai lati. Prima ogni chicco saliva di una quota a caso, e quelli
      // ai bordi della fascia restavano campati in aria.
      const gobba = sopraCiuffi
        ? Math.sin(Math.PI * Math.min(1, dentro / larghezza)) * (0.9 + Math.random() * 0.18)
        : 0;
      const alto = sopraCiuffi ? sopraCiuffi * gobba : 0;
      const yy = y + 0.008 + Math.random() * 0.035 + pile + alto;
      dummy.position.set(x, yy, z);
      dummy.rotation.set(Math.random() * 3.1, Math.random() * 3.1, Math.random() * 3.1);
      const s = sizeMin + Math.random() * Math.max(0, sizeMax - sizeMin);
      const sy = round ? s * flat : s * (0.55 + Math.random() * 0.5) * flat;
      dummy.scale.set(s, sy, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      tmp.copy(cols[(Math.random() * cols.length) | 0]).offsetHSL(0, (Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.14);
      mesh.setColorAt(i, tmp);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [shape, R, y, coverage, banda, nChicchi, colors, shiny, round, flat, sizeMin, sizeMax, holeW, holeH, sopraCiuffi]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, nChicchi]} castShadow receiveShadow>
      <icosahedronGeometry args={[1, round ? 1 : 0]} />
      <meshStandardMaterial roughness={shiny ? 0.25 : 0.85} metalness={metal} envMapIntensity={shiny ? 1.3 : 0.4} />
    </instancedMesh>
  );
}

/**
 * Topping con resa 3D dedicata, per id della decorazione.
 * Solo le decorazioni "a chicchi" stanno qui: le altre (fiori, macarons, panna,
 * frutta fresca…) non hanno una resa 3D e semplicemente non compaiono — il 3D
 * resta pulito invece di mostrare qualcosa di finto.
 */
const TOPPINGS = {
  // --- decorazioni attuali ---
  'granella-nocciola': { colors: ['#c0894c', '#b07a3e', '#9c6b3f', '#8a5a36', '#6f4a28'] },
  'granella-pistacchio': { colors: ['#9bb15f', '#aac06f', '#7ea15a', '#87b06a', '#6d8f4e'] },
  zuccherini: { colors: ['#e8467a', '#46a8e8', '#f7c948', '#7be84a', '#c490e4', '#f78f2e', '#ffffff'], shiny: true },
  // confettini di zucchero: lenticchie tonde, lucide e grandi
  smarties: {
    colors: ['#e0334c', '#f78f2e', '#f7d34a', '#3fae5a', '#46a8e8', '#8f6fd6', '#f4a9c0', '#8a5a36'],
    shiny: true,
    round: true,
    flat: 0.5,
    count: 130,
    sizeMin: 0.05,
    sizeMax: 0.07,
  },
  // perline placcate: oro, argento, rosa e bianco → tonde e metalliche
  perline: {
    colors: ['#e8c069', '#d9ad54', '#cfd4d8', '#b9c0c6', '#f0a8bf', '#fdfbf5'],
    shiny: true,
    round: true,
    metal: 0.7,
    count: 260,
    sizeMin: 0.028,
    sizeMax: 0.04,
  },
  // --- id vecchi: restano per gli ordini storici ---
  'granella-nocciola-pistacchio': { colors: ['#c0894c', '#b07a3e', '#9bb15f', '#aac06f', '#6f4a28'] },
  'granella-frutta-secca': { colors: ['#d8c19a', '#b78a52', '#8a5a36', '#caa46a', '#9c6b3f', '#dccaa2'] },
};

/**
 * Coperture lucide: calotta a specchio + colature sui lati.
 * (`glassa-specchio`, `ganache-cop` e `meringa` non sono più in listino ma
 * restano qui per gli ordini già fatti.)
 */
const GLOSSY_COVERINGS = new Set([
  'cioccolato-cop',
  'cioccolato-bianco-cop',
  'nocciola-cop',
  'pistacchio-cop',
  'glassa-specchio',
  'ganache-cop',
]);

/**
 * Coperture di PANNA MONTATA. Come veste la torta:
 *   'panna'             → sopra E FIANCHI, fatta col sac-à-poche: ruche
 *                         verticali su tutto il giro e ghirlanda sul bordo
 *   'panna-spatolata'   → sopra E FIANCHI, spianata col coltello: liscia
 *   'panna-sotto-sopra' → sopra + una ghirlanda in alto e una alla base
 *   'panna-sopra'       → solo la superficie superiore
 * ('meringa' non è più in listino: resta com'era, solo sopra.)
 */
const CREAM_COVERINGS = new Set([
  'panna',
  'panna-spatolata',
  'panna-sopra',
  'panna-sotto-sopra',
  'meringa',
]);

/** Copertura che avvolge tutto il fianco della torta. */
const CREAM_WRAP_FULL = new Set(['panna', 'panna-spatolata']);

/**
 * Coperture che portano l'ANELLO di ciuffi sul bordo di sopra: quelle fatte
 * col sac-à-poche. La spatolata no (è liscia per scelta), la meringa nemmeno.
 */
const CREAM_RING_COVERINGS = new Set(['panna', 'panna-sopra', 'panna-sotto-sopra']);

/**
 * Decorazioni di panna montata: mettono la fila di ciuffi sul bordo, e portano
 * con sé la panna spatolata intorno se la copertura non è già di panna.
 */
const CREAM_DECORATIONS = new Set(['panna-deco', 'panna-colorata']);

/** Decorazione "drip cake": le colature che scendono dal bordo. */
const DRIP_ID = 'drip';

/* ======================= panna montata col sac-à-poche ======================= */

/**
 * Larghezza di un cordone di ruche. Serve anche fuori di qui: le ruche
 * sporgono di mezzo cordone oltre il guscio di panna, e chi si appoggia al
 * FIANCO della torta (i fiocchi, che ci si annodano intorno) deve saperlo — se
 * no si lega al raggio del guscio e sparisce dietro la panna.
 */
const RUCHE_LARGHEZZA = 0.15;

/**
 * L'anello di ciuffi sul bordo di sopra. Non c'è di serie: arriva SOLO con la
 * panna — dalle coperture fatte col sac-à-poche o dalla decorazione di panna,
 * ed è SEMPRE LO STESSO: una fila sola, stessa grandezza e stessa posizione
 * sul bordo, da qualsiasi delle due strade arrivi ("voglio sia uguale").
 * Granella, decorazioni solide e fiocchi scelti insieme ci si appoggiano sopra.
 *
 * "Doppio" = ben più grosso del ciuffo base, non il doppio esatto: a 2× i
 * ciuffi di sopra sembravano enormi accanto alla ghirlanda della base
 * ("sproporzionate"); a 1.5×, con la base a 0.22, stanno in proporzione.
 */
const CIUFFO_DOPPIO = 0.2625;
const CIUFFO_BASE = 0.22;

/**
 * RUCHE su tutto il fianco: cordoni verticali attaccati uno all'altro, dal
 * vassoio al bordo di sopra. Quanti ne servono lo dice il giro della torta —
 * con un numero fisso, sui formati grandi si sarebbero allontanati fino a
 * sembrare righe sparse invece di un rivestimento.
 */
function RucheDiPanna({ shape, R, yBase, h, colore }) {
  const larghezza = RUCHE_LARGHEZZA;
  const geo = useMemo(() => rucheGeo(h / larghezza), [h]);
  useEffect(() => () => geo.dispose(), [geo]);
  const items = useMemo(
    () =>
      decoSpots(shape, R, quantiInFila(shape, R, 1, larghezza * 0.88), 1).map(({ x, z, i, ang }) => {
        // nessuno esce identico all'altro: un filo più grosso, girato di poco.
        // È la differenza fra la panna e una fila di tubi di plastica
        const w = larghezza * (0.94 + rnd(i, 21) * 0.13);
        return {
          position: [x, yBase, z],
          rotation: [0, Math.PI / 2 - ang + (rnd(i, 22) - 0.5) * 0.5, 0],
          // in altezza variano pochissimo: il filo di cime disuguali è quello
          // che si vede in una torta fatta a mano
          scale: [w, larghezza * (0.99 + rnd(i, 23) * 0.025), w],
          color: colore(i),
        };
      }),
    [shape, R, yBase, colore]
  );
  return (
    <Pieces items={items} geometry={geo} order="YXZ">
      <meshPhysicalMaterial {...softMat('#ffffff')} />
    </Pieces>
  );
}

/**
 * GHIRLANDA lungo un bordo: ciuffetti in piedi, uno appoggiato all'altro, tutto
 * il giro. `s` è la larghezza del ciuffo; il passo è appena più stretto, così
 * si toccano e la fila risulta piena invece che a palline distanziate.
 */
function GhirlandaDiPanna({ shape, R, inset = 1, y, s, colore }) {
  const items = useMemo(
    () =>
      decoSpots(shape, R, quantiInFila(shape, R, inset, s * 0.72), inset).map(({ x, z, i }) => {
        const w = s * (0.92 + rnd(i, 11) * 0.16);
        // più larghi che alti: tirati su, sembravano meringhe a punta
        return {
          position: [x, y, z],
          rotation: [0, rnd(i, 9) * 6.28, 0],
          scale: [w, s * (0.82 + rnd(i, 12) * 0.16), w],
          color: colore(i),
        };
      }),
    [shape, R, inset, y, s, colore]
  );
  return (
    <Pieces items={items} geometry={CREAM_DROP_GEO} order="YXZ">
      <meshPhysicalMaterial {...softMat('#ffffff')} />
    </Pieces>
  );
}

/* ============================ colature copertura ============================ */

function Drips({ shape, R, topEdgeY, color, maxLen }) {
  // Colature di glassa che scendono dal bordo della calotta sui lati.
  // Seguono il contorno VERO della torta (perimeterPts conosce quadrata,
  // rettangolare e cuore): prima erano su un cerchio, quindi si potevano fare
  // solo sulle tonde e sulle altre forme non comparivano affatto.
  const n = shape === 'tonda' ? 16 : shape === 'cuore' ? 18 : 20;
  const drips = decoSpots(shape, R, n, 0.99);
  return (
    <group>
      {drips.map(({ x, z, i, ang }) => {
        const seed = (i * 53) % 100;
        const len = maxLen * (0.4 + (seed / 100) * 0.6);
        return (
          <group key={`drip${i}`} position={[x, topEdgeY + 0.02, z]} rotation={[0, -ang + Math.PI / 2, 0]}>
            {/* rigonfiamento sul bordo: schiacciato, così legge come glassa che
                scavalca il bordo e non come una pallina appiccicata */}
            <mesh castShadow position={[0, 0, 0]} scale={[1, 0.62, 0.85]}>
              <sphereGeometry args={[0.055, 14, 12]} />
              <meshPhysicalMaterial {...glossyMat(color)} />
            </mesh>
            {/* colata affusolata: larga e schiacciata contro il fianco, così
                aderisce alla torta invece di sembrare un bastoncino staccato */}
            <mesh castShadow position={[0, -len / 2, 0]} scale={[1, 1, 0.7]}>
              <cylinderGeometry args={[0.062, 0.032, len, 12]} />
              <meshPhysicalMaterial {...glossyMat(color)} />
            </mesh>
            {/* goccia finale */}
            <mesh castShadow position={[0, -len, 0]} scale={[1, 1, 0.7]}>
              <sphereGeometry args={[0.034, 12, 10]} />
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
    // stile della scritta: accetta gli id della tabella `scritte`
    // (stampatello / corsivo / corsivo-scolastico) e i vecchi inter/caveat/fraunces
    const f = messageFontStyle(font);
    const upper = f.uppercase;
    const cssAt = (px) => `${f.italic ? 'italic' : 'normal'} ${f.weight} ${px}px ${f.family}`;

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

function CakeModel({ shape, plateShape, tall, flavors, base, filling, covering, candle, photo, photoTransform, decorations, decorationColors, message, messageFont }) {
  // Torta gelato vera: BASSA e LARGA. Dischi di gelato netti e impilati.
  const R = 1.18;
  const layers = Math.max(1, flavors.length);
  // Le torte "Alte" (Alta semifreddo / Alta Gelato) devono VEDERSI più alte:
  // gli strati crescono, il diametro no — è così che si presenta una torta alta.
  const TALL_FACTOR = 1.6;
  const bandH =
    (layers >= 5 ? 0.15 : layers === 4 ? 0.18 : layers === 3 ? 0.22 : layers === 2 ? 0.28 : 0.4) *
    (tall ? TALL_FACTOR : 1);

  const coverColor = covering?.color || '#fff4e0';
  const coverIsNaked = covering?.id === 'naked';
  const useCover = !coverIsNaked && covering;
  const baseColor = base?.color || '#e8d2a8';
  const fillingColor = filling?.color;
  const glossyCover = GLOSSY_COVERINGS.has(covering?.id);

  // ---- DECORAZIONI SCELTE (possono essere più d'una) ----
  // Arrivano come lista di id, in ordine di scelta, più la mappa dei colori
  // (id -> nome del colore). Si ripulisce sempre: 'nessuna' non è una
  // decorazione, e doppioni o dati mancanti non devono far saltare niente.
  const decoColors = decorationColors || {};
  const decoKey = (Array.isArray(decorations) ? decorations : []).filter(Boolean).join('|');
  const decoIds = useMemo(() => {
    const out = [];
    for (const id of decoKey ? decoKey.split('|') : []) {
      if (!id || id === 'nessuna' || out.includes(id)) continue;
      out.push(id);
    }
    return out;
  }, [decoKey]);
  // stringa dei colori scelti: serve solo come dipendenza stabile per i useMemo
  const colorKey = decoIds.map((id) => decoColors[id] || '').join('|');
  const creamIds = decoIds.filter((id) => CREAM_DECORATIONS.has(id));
  // "Drip cake": le colature lungo il bordo. Prima venivano da sole con ogni
  // copertura lucida; è uno stile preciso, quindi ora si sceglie.
  const hasDrip = decoIds.includes(DRIP_ID);

  // ---- PANNA: quanto veste la torta e di che colore è ----
  // La panna NON è di serie: c'è solo se la si sceglie, come copertura o come
  // decorazione. (Per un giorno ogni torta usciva con due file di ciuffi
  // standard: no — chi vuole la torta pulita la deve poter avere pulita.)
  const coverIsCream = !!useCover && CREAM_COVERINGS.has(covering?.id);
  // La decorazione di panna porta con sé la panna spatolata intorno alla torta
  // (è proprio quello che dicono le loro descrizioni), ma solo se la copertura
  // scelta non è già di panna: in quel caso comanda la copertura.
  const creamDecoWrap = creamIds.length > 0 && !coverIsCream;
  const wrapFull = (coverIsCream && CREAM_WRAP_FULL.has(covering.id)) || creamDecoWrap;
  // "Sotto e sopra" è composta soltanto dalle ghirlande a ciuffi: serve qui per
  // sapere quanto sporge il bordo, ma non genera fasce lisce sul fianco.
  const pannaSottoSopra = coverIsCream && covering?.id === 'panna-sotto-sopra';
  // panna aggiunta dalla decorazione su una torta senza copertura: ci vuole
  // anche la superficie superiore, altrimenti resterebbe il gusto scoperto
  const extraCreamCap = creamDecoWrap && !useCover;

  // Panna montata colorata: il colore scelto tinge TUTTA la panna — copertura
  // sopra, fianchi e ciuffi. Toni pastello, da panna vera. Se la prop non arriva
  // o il colore non è riconosciuto, resta la panna bianca.
  const creamChoice = decoIds.includes('panna-colorata') ? decoColors['panna-colorata'] || '' : '';
  const creamRainbow = isRainbowChoice(creamChoice);
  const creamHex = creamColorFromChoice(creamChoice);
  const creamColor = creamHex || (coverIsCream ? coverColor : '#fff8e6');
  const dollopColor = (i) =>
    creamRainbow ? CREAM_RAINBOW[i % CREAM_RAINBOW.length] : shade(creamColor, 0.05);
  // la calotta è di panna solo se la copertura è di panna; altrimenti resta
  // la copertura scelta (cioccolato, pistacchio…) con la panna solo intorno
  const capColor = coverIsCream ? creamColor : coverColor;
  const capRainbow = creamRainbow && coverIsCream;
  // `vertexColors` cambia la compilazione dello shader: senza una key nuova il
  // materiale resterebbe quello di prima e l'arcobaleno non si vedrebbe.
  const creamMatKey = creamRainbow ? 'panna-arcobaleno' : 'panna-tinta-unita';

  // Topping "a chicchi": se la decorazione prevede la scelta del colore e il
  // cliente l'ha fatta, i chicchi prendono quel colore (arcobaleno → alternati).
  // Le granelle scelte possono essere più d'una: si mescolano sulla stessa
  // superficie, ma ognuna mette meno chicchi così il totale sopra la torta resta
  // quello di sempre e non diventa una crosta.
  // useMemo obbligatorio: la lista colori deve restare stabile, altrimenti la
  // granella si ridistribuisce a ogni render.
  const toppings = useMemo(() => {
    const scelte = decoIds.filter((id) => TOPPINGS[id]);
    return scelte.map((id) => {
      const t = TOPPINGS[id];
      const scelta = decoColors[id] || '';
      const hex = colorFromChoice(scelta);
      const colors = isRainbowChoice(scelta)
        ? RAINBOW_COLORS
        : hex
        ? [hex, shade(hex, 0.18), shade(hex, -0.12)]
        : t.colors;
      const chicchi = t.count === undefined ? 1200 : t.count;
      return { ...t, id, colors, count: Math.max(60, Math.round(chicchi / scelte.length)) };
    });
  }, [decoIds, colorKey]);

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
  // I dischi di gelato si sovrappongono (OV) per avere il solco tra uno strato e
  // l'altro: quello più in alto sporge quindi di bandH*(OV-1)/2 sopra `bodyTop`.
  // La calotta va posata SOPRA quel bordo, altrimenti il gelato le spunta
  // attraverso — si vedeva sulle torte alte, dove gli strati sono più spessi.
  const stackTop = bodyTop + bandH * ((OV - 1) / 2);
  const capY = stackTop - capH * 0.35;
  const capBottom = capY - capH * 0.55;
  const hasTopCap = !!useCover || extraCreamCap;
  // dove poggiano granella/decorazioni/foto/scritta: sopra il bombamento del disco superiore
  const surfaceY = (hasTopCap ? capY + capH * 0.8 : stackTop) + bandH * 0.06;
  // guscio di panna intorno alla torta: un filo più largo dei gusti, così li copre
  const bodyH = layers * bandH;
  const wrapR = R * 1.05;
  // Raggio della calotta di copertura. Deve essere un po' PIÙ LARGO del corpo:
  // sia la calotta sia i dischi di gelato hanno il bordo volutamente irregolare
  // (±1%), e con raggi uguali capitava che la calotta rientrasse sotto il bordo
  // lasciando scoperte delle mezzelune di gelato — sembrava rotta. Così invece
  // la copertura sborda sempre di poco, come una glassa vera.
  const capR = wrapFull ? wrapR * 0.998 : R * 1.03;

  // Geometrie: dischi lisci e netti (Gelopie), leggermente sovrapposti per i solchi.
  const geos = useMemo(() => {
    const bands = [];
    for (let i = 0; i < layers; i++) bands.push(makeLayerGeo(shape, R, bandH * OV, i * 1.7 + 1));
    // panna arcobaleno → la stessa panna dipinta a settori di colore
    const rainbow = (g) => (g && creamRainbow ? paintRainbow(g) : g);
    const capGeo = makeLayerGeo(shape, capR, capH * 1.6, 5.5);
    return {
      base: makeLayerGeo(shape, R * 0.985, baseH * 1.3, 0.3),
      bands,
      cap: useCover ? (coverIsCream ? rainbow(capGeo) : capGeo) : null,
      fill: fillingColor ? makeLayerGeo(shape, R * 1.015, 0.06, 8.2) : null,
      // guscio di panna che riveste i FIANCHI (copertura "Panna montata INTORNO")
      shell: wrapFull ? rainbow(makeLayerGeo(shape, wrapR, bodyH, 3.3)) : null,
      // calotta di panna aggiunta dalla decorazione su una torta senza copertura
      creamCap: extraCreamCap ? rainbow(makeLayerGeo(shape, wrapR * 0.998, capH * 1.6, 5.5)) : null,
    };
  }, [
    shape, R, bandH, baseH, capH, layers, useCover, fillingColor, coverIsCream,
    wrapFull, extraCreamCap, wrapR, capR, bodyH, creamRainbow,
  ]);

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
  // ORO VERO, in tutte le forme: la metalness resta BASSA di proposito. Con la
  // metalness alta il piano largo del piatto quadrato faceva da specchio
  // all'ambiente color panna e sembrava beige; così invece vince sempre il
  // colore dell'oro, da qualsiasi angolazione.
  const goldPlate = {
    color: '#d9a12a',
    metalness: 0.3,
    roughness: 0.33,
    clearcoat: 0.9,
    clearcoatRoughness: 0.16,
    sheen: 0.5,
    sheenColor: '#ffd979',
    envMapIntensity: 0.5,
  };
  // rifinitura del bordo: oro più scuro e più lucido, dà l'accento metallico
  const goldRim = { color: '#a5751b', metalness: 0.55, roughness: 0.22, envMapIntensity: 0.85 };
  const plateCorner = Math.min(0.12, platterH * 0.4);
  // ⚠️ La geometria del piatto si passa SEMPRE con la prop `geometry`, anche per
  // il piatto tondo. Prima il tondo la dichiarava come FIGLIO (<cylinderGeometry>)
  // e le altre forme come prop: siccome i due rami sono entrambi un <mesh> nello
  // stesso punto dell'albero, React riusa la stessa istanza invece di ricrearla,
  // e i due modi si annullavano a vicenda lasciando il mesh senza geometria.
  // Risultato: sceglievi 20 persone (piatto rettangolare) e poi un altro formato
  // (piatto tondo) e il piatto spariva. Un solo modo = nessun conflitto.
  const plateGeo = useMemo(
    () =>
      pShape === 'tonda'
        ? new THREE.CylinderGeometry(plateRound, plateRound * 0.97, platterH, 80)
        : new RoundedBoxGeometry(plateW, platterH, plateD, 4, plateCorner),
    [pShape, plateRound, plateW, plateD, platterH, plateCorner]
  );
  // Rifinitura lucida del bordo (l'anello del piatto tondo, la cornice di quello
  // quadrato/rettangolare): stessa regola, una geometria sola già orientata e
  // spostata all'altezza giusta, così il <mesh> non cambia mai forma.
  const plateRimGeo = useMemo(() => {
    const y = platterY + platterH / 2;
    if (pShape === 'tonda') {
      const g = new THREE.TorusGeometry(plateRound - 0.03, 0.02, 16, 90);
      g.rotateX(-Math.PI / 2);
      g.translate(0, y - 0.01, 0);
      return g;
    }
    const g = roundedRectFrame(plateW - 0.07, plateD - 0.07, plateCorner + 0.06, 0.06, 0.024);
    g.translate(0, y - 0.012, 0);
    return g;
  }, [pShape, plateRound, plateW, plateD, platterY, platterH, plateCorner]);

  // Il piatto si ricostruisce a ogni cambio di formato o forma: le geometrie
  // vecchie vanno liberate, altrimenti restano occupate sulla scheda video.
  useEffect(() => () => plateGeo.dispose(), [plateGeo]);
  useEffect(() => () => plateRimGeo.dispose(), [plateRimGeo]);

  // Dove finisce DAVVERO il fianco della torta. I fiocchi si annodano intorno,
  // e finora si legavano al raggio del guscio di panna: con le ruche, che
  // sporgono di mezzo cordone più in fuori, restavano sepolti dietro la panna.
  // Vale anche per le due fasce di "sotto e sopra", che allargano il fianco
  // pur non essendo un guscio intero.
  const pannaACiuffi = coverIsCream && covering?.id === 'panna';
  const fiancoR =
    wrapFull || pannaSottoSopra ? wrapR + (pannaACiuffi ? RUCHE_LARGHEZZA * 0.45 : 0) : R;

  // ---- L'ANELLO di ciuffi sul bordo di sopra: c'è solo se c'è la panna ----
  // UNA fila sola, sempre la stessa — che arrivi dalla copertura fatta col
  // sac-à-poche o dalla decorazione di panna: stessa grandezza, stessa
  // posizione sul bordo (Lucia: "voglio sia uguale"). E se la copertura ha già
  // il suo anello, la decorazione non aggiunge niente: al massimo il colore,
  // con la panna colorata.
  const coverRing = coverIsCream && CREAM_RING_COVERINGS.has(covering.id);
  const decoRing = creamIds.length > 0 && !coverRing;
  const hasRing = coverRing || decoRing;
  // dove sta l'anello (in frazione di R) e quanto è largo il suo ciuffo
  const ringInset = (wrapR * 0.93) / R;
  const ringS = CIUFFO_DOPPIO;

  // I ciuffi di panna hanno la loro ghirlanda dedicata; qui passano soltanto le
  // decorazioni solide. In questo modo panna + pezzi non genera una seconda
  // fila, ma un unico bordo con i pezzi posati sui ciuffi.
  const ids3D = useMemo(
    () => decoIds.filter((id) => PIECE_DECORATIONS.has(id)),
    [decoIds]
  );
  const pezziSopra = ids3D.filter((id) => !EDGE_DECORATIONS.has(id));

  // Scritta / foto al centro → il topping si sagoma con un buco al centro
  const hasMessage = !!(message && message.trim());
  const hasGranella = toppings.length > 0;
  // Anche la granella sta sul BORDO, come tutto il resto: è una fascia lungo il
  // contorno, non una spolverata su tutta la torta. Se sul bordo ci sono già i
  // pezzi (macarons, frutta…) la fascia si sposta appena più dentro, così i due
  // anelli convivono senza pestarsi invece di sovrapporsi.
  //
  // Con l'ANELLO di panna invece no: la granella non fa una seconda fila più
  // dentro, va SOPRA i ciuffi — è quello che si fa davvero, si spolvera sulla
  // panna appena fatta. Quindi la fascia sta esattamente sull'anello e i
  // chicchi si alzano fino alla sua cima.
  const granellaCoverage = hasRing
    ? ringInset + ringS / 2 / R
    : (shape === 'tonda' ? 0.96 : shape === 'cuore' ? 0.9 : 0.88) * (pezziSopra.length ? 0.82 : 1);
  const granellaBanda = hasRing ? ringS / R : pezziSopra.length ? 0.22 : 0.32;
  const granellaSuiCiuffi = hasRing ? ringS * 0.9 : 0;
  // Riquadro scritta: TUTTE le decorazioni stanno sul contorno, quindi quando
  // c'è qualcosa sul bordo il centro si restringe allo stesso modo.
  const borderLevel = hasGranella || hasRing || pezziSopra.length ? 'panna' : 'none';
  const msgBox = messageBox(shape, R, borderLevel);
  // colore del fondo sotto la scritta → scritta bianca (panna) su scuro, cioccolato su chiaro
  const topFlavor = flavors[layers - 1] || flavors[flavors.length - 1] || { color: '#fff4e0' };
  const msgOnDark = isDark(
    coverIsCream || extraCreamCap ? creamColor : useCover ? coverColor : topFlavor.color
  );
  const photoFoot = photoFootprint(shape, R, borderLevel);
  // buco ellittico nella granella che segue il contenuto centrale (foto o scritta)
  const holeW = photo ? photoFoot.w / 2 + R * 0.05 : hasMessage ? msgBox.w / 2 + R * 0.05 : 0;
  const holeH = photo ? photoFoot.h / 2 + R * 0.05 : hasMessage ? msgBox.h / 2 + R * 0.05 : 0;

  // La torta deve stare TUTTA nell'inquadratura. La camera è fissa e tarata
  // sulle torte normali: una "Alta" sforava e usciva decapitata dall'immagine.
  // Oltre un certo ingombro l'intera scena si rimpicciolisce in proporzione —
  // piatto compreso, come allontanare la macchina fotografica — così le
  // proporzioni restano vere.
  // Nell'ingombro contano anche calotta e anello di ciuffi (+0.35 fisso): al
  // primo giro guardavo solo gli strati, e una Alta a 2 gusti con la panna a
  // ciuffi passava il controllo ma sforava comunque.
  const fit = Math.min(1, 1.22 / (stackBottom + bodyH + 0.35));

  return (
    <group scale={fit}>
      {/* ---- Piatto ORO Punto Gi (forma in base alla torta / n° persone) ---- */}
      <mesh geometry={plateGeo} position={[0, platterY, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial {...goldPlate} />
      </mesh>
      {/* bordo lucido più scuro: rifinitura in TUTTE le forme di piatto */}
      <mesh geometry={plateRimGeo}>
        <meshStandardMaterial {...goldRim} />
      </mesh>

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

      {/* ---- PANNA INTORNO: guscio liscio che riveste i fianchi e copre i gusti ---- */}
      {geos.shell && (
        <LayerMesh geometry={geos.shell} y={stackBottom + bodyH / 2}>
          <meshPhysicalMaterial key={creamMatKey} {...softMat(creamColor)} vertexColors={creamRainbow} />
        </LayerMesh>
      )}

      {/* ---- Copertura: calotta sottile sul disco superiore (niente cupola) ---- */}
      {useCover && (
        <>
          <LayerMesh geometry={geos.cap} y={capY}>
            <meshPhysicalMaterial
              key={`${glossyCover ? 'glossy' : 'soft'}-${capRainbow ? 'rb' : 'flat'}`}
              {...(glossyCover ? glossyMat(capColor) : softMat(capColor))}
              vertexColors={capRainbow}
            />
          </LayerMesh>
          {/* Le colature NON sono più automatiche: prima ogni copertura lucida
              le portava con sé, ma è uno stile preciso (la "drip cake") e chi
              vuole una copertura liscia se le ritrovava per forza. Ora sono una
              decorazione a sé — vedi più sotto. */}
        </>
      )}

      {/* ---- Calotta di panna portata dalla decorazione (torta senza copertura) ---- */}
      {geos.creamCap && (
        <LayerMesh geometry={geos.creamCap} y={capY}>
          <meshPhysicalMaterial key={creamMatKey} {...softMat(creamColor)} vertexColors={creamRainbow} />
        </LayerMesh>
      )}

      {/* ---- Drip cake: colature dal bordo, ora che è una decorazione a sé ----
              Il colore è quello della copertura scelta; senza copertura si usa
              il cioccolato, che è il caso classico della drip cake. ---- */}
      {hasDrip && (
        <Drips
          shape={shape}
          R={capR}
          topEdgeY={(useCover ? capBottom : bodyTop) + 0.02}
          color={useCover ? coverColor : '#5a3520'}
          maxLen={Math.min(0.38, bodyH * 0.42)}
        />
      )}

      {/* ---- Panna montata fatta col SAC-À-POCHE ----
              "Panna INTORNO" aggiunge le ruche verticali su tutto il fianco;
              "Sotto e sopra" aggiunge la ghirlanda alla base. Le due file in
              alto sono già standard per tutte le torte. ---- */}
      {coverIsCream && covering?.id === 'panna' && (
        <>
          {/* le ruche partono da dentro il vassoio: il taglio netto in fondo
              resta nascosto e la panna sembra scendere fino al piatto */}
          <RucheDiPanna
            shape={shape}
            R={wrapR}
            yBase={-0.02}
            h={surfaceY - 0.02}
            colore={dollopColor}
          />
        </>
      )}

      {coverIsCream && covering?.id === 'panna-sotto-sopra' && (
        <GhirlandaDiPanna
          shape={shape}
          R={wrapR}
          y={stackBottom + 0.01}
          s={CIUFFO_BASE}
          colore={dollopColor}
        />
      )}

      {/* ---- L'ANELLO sul bordo di sopra: solo se la panna è stata scelta.
              Dalle coperture col sac-à-poche: UNA fila di ciuffi grossi il
              doppio. Dalla decorazione di panna: la fila fitta normale. ---- */}
      {hasRing && (
        <GhirlandaDiPanna
          shape={shape}
          R={R}
          inset={ringInset}
          y={surfaceY - 0.03}
          s={ringS}
          colore={dollopColor}
        />
      )}

      {/* ---- Decorazioni 3D "a pezzi": macarons, spumini, fiori, fiocchi…
              Se sono più d'una si dividono i posti sul contorno. Quando c'è
              l'anello di panna si appoggiano SOPRA i ciuffi (come la granella);
              senza panna stanno sulla torta, come sempre. ---- */}
      {ids3D.length > 0 && (
        <Decorazioni3D
          ids={ids3D}
          shape={shape}
          R={R}
          y={surfaceY + (hasRing ? ringS * 0.55 : 0)}
          topInset={hasRing ? ringInset : 0.79}
          colors={decoColors}
          // I FIOCCHI si annodano SEMPRE sul fianco, con o senza panna: è così
          // che si mette un nastro a una torta. (Per un giro li avevo appoggiati
          // sopra la panna per non farli coprire: sembravano posati lì, non
          // legati. La panna non li nasconde lo stesso, perché `fiancoR` tiene
          // conto di quanto sporgono le ruche.)
          edgeR={fiancoR}
          edgeY={bodyTop - bandH * 0.38}
          drop={bodyH}
        />
      )}

      {/* ---- Topping: granella croccante in una fascia lungo il BORDO (segue la forma) ---- */}
      {toppings.map(({ id, ...granella }) => (
        <Granella
          key={`gr-${id}`}
          shape={shape}
          R={R}
          y={surfaceY}
          coverage={granellaCoverage}
          banda={granellaBanda}
          sopraCiuffi={granellaSuiCiuffi}
          holeW={holeW}
          holeH={holeH}
          {...granella}
        />
      ))}

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
  const stage = useRef(null);
  // La torta 3D si ridisegna 60 volte al secondo. Sulla home ce n'è una anche
  // nella sezione "Crea la tua torta": senza questo controllo continuerebbe a
  // lavorare pure quando è lontanissima dallo schermo, e il sito scatta mentre
  // si scorre. Con `frameloop="never"` il disegno si ferma (resta l'ultimo
  // fotogramma, che nessuno sta guardando) e riparte appena torna in vista.
  const [inVista, setInVista] = useState(true);
  useEffect(() => {
    const el = stage.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      ([e]) => setInVista(e.isIntersecting),
      { rootMargin: '200px' } // riparte un attimo prima di entrare in scena
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="cake3d-stage" ref={stage}>
      <Canvas
        shadows
        dpr={[1, 2]}
        frameloop={inVista ? 'always' : 'never'}
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
