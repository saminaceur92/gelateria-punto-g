// node --test src/lib/fotoTorta.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  finestraFoto, bandaScritta, luminanza, contrasto, coloreScritta, tettoPerLunghezza, adattaScritta,
} from './fotoTorta.js';

// Il conto che faceva PhotoDisc in Cake3D.jsx prima di usare finestraFoto:
// repeat/offset della texture, in frazioni dell'immagine.
function vecchioPhotoDisc(W, H, At, tf) {
  const a = W / H;
  let winWpx, winHpx;
  if (a >= At) { winHpx = H; winWpx = H * At; } else { winWpx = W; winHpx = W / At; }
  winWpx /= tf.zoom;
  winHpx /= tf.zoom;
  const winW = winWpx / W;
  const winH = winHpx / H;
  return { left: (tf.posX / 100) * (1 - winW), top: (tf.posY / 100) * (1 - winH), winW, winH };
}

test('finestraFoto è lo stesso ritaglio di prima', () => {
  const formati = [[1600, 900], [900, 1600], [1200, 1200], [1600, 1066]];
  const aspetti = [1, 1.85 / 1.1, 2 / 1.74, 1.1 / 1.85];
  const tfs = [{ zoom: 1, posX: 50, posY: 50 }, { zoom: 2.3, posX: 10, posY: 90 }, { zoom: 3, posX: 100, posY: 0 }];
  for (const [W, H] of formati) for (const At of aspetti) for (const tf of tfs) {
    const f = finestraFoto(W, H, At, tf);
    const v = vecchioPhotoDisc(W, H, At, tf);
    assert.ok(Math.abs(f.x / W - v.left) < 1e-9);
    assert.ok(Math.abs(f.y / H - v.top) < 1e-9);
    assert.ok(Math.abs(f.w / W - v.winW) < 1e-9);
    assert.ok(Math.abs(f.h / H - v.winH) < 1e-9);
    // e non esce mai dall'immagine
    assert.ok(f.x >= -1e-9 && f.y >= -1e-9 && f.x + f.w <= W + 1e-6 && f.y + f.h <= H + 1e-6);
  }
});

test('la fascia della scritta sta dentro la cornice', () => {
  for (const kind of ['rect', 'circle', 'heart']) {
    const b = bandaScritta(kind);
    assert.ok(b.u0 >= 0 && b.u0 < b.u1 && b.u1 <= 1);
    assert.ok(b.v0 >= 0 && b.v0 < b.v1 && b.v1 <= 1);
  }
  // sul cerchio i quattro angoli della fascia sono dentro il disco
  const c = bandaScritta('circle');
  for (const u of [c.u0, c.u1]) for (const v of [c.v0, c.v1]) {
    assert.ok(Math.hypot(u - 0.5, v - 0.5) < 0.5, `angolo ${u},${v} fuori dal disco`);
  }
  // sempre nella metà lontana da chi guarda: quella vicina, in 3D, sta dietro
  // la fila di ciuffi e granella del bordo davanti
  for (const kind of ['rect', 'circle', 'heart']) assert.ok(bandaScritta(kind).v1 <= 0.5, kind);
});

test('luminanza e contrasto WCAG', () => {
  assert.equal(luminanza(0, 0, 0), 0);
  assert.ok(Math.abs(luminanza(255, 255, 255) - 1) < 1e-12);
  assert.ok(Math.abs(contrasto(1, 0) - 21) < 1e-12);
});

test('colore della scritta: bianco sullo scuro, cioccolato sul chiaro', () => {
  assert.equal(coloreScritta(0), 'bianco');
  assert.equal(coloreScritta(0.1), 'bianco');
  assert.equal(coloreScritta(0.2), 'bianco');
  assert.equal(coloreScritta(0.3), 'cioccolato');
  assert.equal(coloreScritta(1), 'cioccolato');
  assert.equal(coloreScritta(NaN), 'bianco'); // foto non leggibile
  // il cambio cade fra 0.24 e 0.25
  assert.equal(coloreScritta(0.24), 'bianco');
  assert.equal(coloreScritta(0.25), 'cioccolato');
});

test('più la scritta è lunga, più il tetto scende', () => {
  assert.equal(tettoPerLunghezza(1), 0.8);
  assert.equal(tettoPerLunghezza(4), 0.8);
  assert.ok(Math.abs(tettoPerLunghezza(24) - 0.4) < 1e-12);
  assert.ok(Math.abs(tettoPerLunghezza(40) - 0.4) < 1e-12);
  for (let n = 1; n < 30; n += 1) assert.ok(tettoPerLunghezza(n + 1) <= tettoPerLunghezza(n));
});

// Larghezza finta: ogni carattere è largo 0.6 volte il corpo.
const misura = (t, px) => t.length * px * 0.6;

test('adattaScritta: entra nel riquadro e rispetta le righe', () => {
  const r = adattaScritta({ testo: 'Buon compleanno Anna', larghezza: 900, altezza: 200, misura, corpoMax: 160, maxRighe: 2 });
  assert.ok(r.righe.length <= 2);
  for (const riga of r.righe) assert.ok(misura(riga, r.px) <= 900);
  assert.ok(r.righe.length * r.px * 1.16 <= 200);
  // senza limite di righe, come la scritta senza foto, resta valido
  const s = adattaScritta({ testo: 'Auguri', larghezza: 900, altezza: 300, misura, corpoMax: 234 });
  assert.equal(s.righe.length, 1);
});

test('mentre si scrive sopra la foto il corpo non cresce mai', () => {
  const frasi = ['Tanti auguri Anna 18!!!!', 'Buon compleanno Leonardo', 'Ale', 'Auguri nonna Pina e nonno'];
  const CW = 1024;
  const CH = Math.round(CW / 3.2); // fascia larga e bassa come sulla rettangolare
  for (const frase of frasi) {
    let prima = Infinity;
    for (let n = 1; n <= frase.length; n += 1) {
      const testo = frase.slice(0, n).trim();
      if (!testo) continue;
      const { px } = adattaScritta({
        testo, larghezza: CW * 0.9, altezza: CH * 0.82, misura, corpoMax: CH * tettoPerLunghezza(testo.length), maxRighe: 2,
      });
      assert.ok(px <= prima, `"${testo}": ${px} > ${prima}`);
      prima = px;
    }
  }
});
