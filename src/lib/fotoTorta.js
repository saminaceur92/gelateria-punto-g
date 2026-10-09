/**
 * Conti della foto su cialda e della scritta che ci va sopra. Funzioni pure,
 * senza three e senza DOM: le usano la torta 3D (Cake3D.jsx) e i test
 * (node --test src/lib/fotoTorta.test.mjs).
 */

/**
 * Parte della foto che finisce sulla torta, in pixel dell'immagine: lo
 * stesso ritaglio che il cliente vede nell'editor (background-size e
 * background-position) e che la torta 3D stende sulla cialda.
 *   aspect      larghezza/altezza della cornice (dipende dalla forma)
 *   zoom        1 = la foto più grande che entra nella cornice
 *   posX, posY  0..100, come background-position
 */
export function finestraFoto(W, H, aspect, { zoom = 1, posX = 50, posY = 50 } = {}) {
  const w = (W / H >= aspect ? H * aspect : W) / zoom;
  const h = w / aspect;
  return { x: (posX / 100) * (W - w), y: (posY / 100) * (H - h), w, h };
}

/**
 * Fascia della scritta dentro la cornice della foto, in frazioni 0..1:
 * u da sinistra a destra, v dall'ALTO dell'immagine (il lato lontano da chi
 * guarda la torta) al basso. Sta in ALTO: è la parte della foto che nella
 * torta 3D si vede sempre. Quella verso chi guarda finisce dietro la fila di
 * ciuffi e granella del bordo davanti (la camera guarda dall'alto, di
 * sbieco): provata lì, la scritta spariva. Sul cuore la parte alta sono i
 * lobi, che sono anche la parte larga; sul cerchio gli angoli della fascia
 * restano dentro il disco.
 */
export function bandaScritta(kind) {
  if (kind === 'circle') return { u0: 0.17, u1: 0.83, v0: 0.14, v1: 0.4 };
  if (kind === 'heart') return { u0: 0.14, u1: 0.86, v0: 0.2, v1: 0.48 };
  return { u0: 0.06, u1: 0.94, v0: 0.07, v1: 0.35 }; // quadrata e rettangolare
}

/** Luminanza relativa (WCAG) di un colore sRGB 0..255: 0 nero, 1 bianco. */
export function luminanza(r, g, b) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export const contrasto = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

// I due colori della scritta: bianco panna e cioccolato, come sulla torta vera.
export const STILI_SCRITTA = {
  bianco: { fill: '#ffffff', stroke: 'rgba(28,16,8,0.78)', strokeK: 0.2 },
  cioccolato: { fill: '#4a2a12', stroke: 'rgba(255,250,242,0.95)', strokeK: 0.17 },
};
const L_BIANCO = 1;
const L_CIOCCOLATO = luminanza(0x4a, 0x2a, 0x12);

/**
 * Fra bianco e cioccolato, quello che si legge meglio sopra un fondo di
 * luminanza L. Si passa al cioccolato poco sotto L = 0.25: sopra una foto
 * media il bianco vince quasi sempre. Il contorno c'è comunque (vedi
 * STILI_SCRITTA): su una foto piena di dettagli nessun colore basta da solo.
 */
export function coloreScritta(L) {
  if (!Number.isFinite(L)) return 'bianco';
  return contrasto(L_BIANCO, L) >= contrasto(L_CIOCCOLATO, L) ? 'bianco' : 'cioccolato';
}

/**
 * Corpo massimo della scritta sopra la foto, in frazione dell'altezza della
 * fascia: più la scritta è lunga, più piccola (richiesta dei titolari). Fino
 * a 4 caratteri 0.80, poi cala dritto fino a 0.40 a 24 caratteri, il massimo
 * del configuratore. Così un nome corto non copre la foto.
 */
export function tettoPerLunghezza(n) {
  const t = Math.min(1, Math.max(0, (n - 4) / 20));
  return 0.8 - 0.4 * t;
}

/**
 * Corpo più grande (in px) con cui il testo entra nel riquadro, andando a
 * capo fra le parole. `misura(testo, px)` restituisce la larghezza del testo
 * a quel corpo (in pratica ctx.measureText). Se niente entra, si usa il
 * corpo minimo.
 */
export function adattaScritta({ testo, larghezza, altezza, misura, corpoMax, maxRighe = Infinity, corpoMin = 14, passo = 1 }) {
  const parole = String(testo || '').split(/\s+/).filter(Boolean);
  const aCapo = (px) => {
    const righe = [];
    let riga = '';
    for (const p of parole) {
      const prova = riga ? `${riga} ${p}` : p;
      if (misura(prova, px) > larghezza && riga) { righe.push(riga); riga = p; } else riga = prova;
    }
    if (riga) righe.push(riga);
    return righe;
  };
  // Passo di 1 px: con 2 il risultato dipendeva dal pari/dispari del punto di
  // partenza, e aggiungendo una lettera la scritta poteva crescere di un pixel.
  for (let px = Math.floor(corpoMax); px >= corpoMin; px -= passo) {
    const righe = aCapo(px);
    const piuLarga = Math.max(0, ...righe.map((r) => misura(r, px)));
    if (piuLarga <= larghezza && righe.length <= maxRighe && righe.length * px * 1.16 <= altezza) {
      return { px, righe };
    }
  }
  return { px: corpoMin, righe: aCapo(corpoMin) };
}
