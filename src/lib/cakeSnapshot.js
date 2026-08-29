/**
 * Foto della torta 3D in alta risoluzione.
 *
 * La torta 3D (Cake3D) si carica in lazy: three.js pesa e il sito pubblico non
 * deve pagarlo finché la torta non serve. Il configuratore però, al momento
 * dell'ordine, deve poter chiedere "fammi la foto" — e importare Cake3D per
 * farlo trascinerebbe three.js nel chunk principale. Questo modulo non importa
 * niente: è solo il punto d'incontro. Cake3D ci REGISTRA la funzione di
 * cattura del suo <canvas> quando monta, il configuratore la CHIAMA passando
 * il canvas che trova nell'anteprima.
 *
 * La cattura ridisegna la scena a una risoluzione più alta di quella dello
 * schermo (lato lungo a 2048 px, di default) e la restituisce già stesa su un
 * canvas 2D con lo sfondo color crema del sito: il WebGL è trasparente, e un
 * JPEG di un'area trasparente viene NERO.
 */

/** Sfondo delle foto: la crema del sito (--cream in global.css). */
export const SFONDO_FOTO = '#fbf6ec';

const catture = new WeakMap();

/** Cake3D: registra la funzione di cattura del proprio canvas. */
export function registraCattura(canvas, fn) {
  if (canvas && typeof fn === 'function') catture.set(canvas, fn);
}

/** Cake3D: allo smontaggio, la toglie. */
export function rimuoviCattura(canvas) {
  if (canvas) catture.delete(canvas);
}

/**
 * Foto della torta disegnata in quel canvas: un canvas 2D già con lo sfondo,
 * col lato lungo di `maxPx` pixel. `null` se il 3D non è (ancora) pronto o se
 * la cattura fallisce: chi chiama decide il ripiego, l'ordine non si ferma.
 */
export function catturaTorta3D(canvas, { maxPx = 2048, sfondo = SFONDO_FOTO } = {}) {
  const fn = canvas && catture.get(canvas);
  if (!fn) return null;
  try {
    return fn({ maxPx, sfondo }) || null;
  } catch (e) {
    console.warn('[foto torta] cattura HD fallita:', e && e.message);
    return null;
  }
}

/**
 * Copia ridotta di un canvas: il lato lungo diventa `maxPx` (mai ingrandita).
 * `sfondo` (facoltativo) si stende sotto: serve quando la sorgente è il canvas
 * WebGL trasparente e non è passata da catturaTorta3D.
 */
export function ridimensiona(sorgente, maxPx, sfondo) {
  const scala = Math.min(1, maxPx / Math.max(sorgente.width, sorgente.height));
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(sorgente.width * scala));
  out.height = Math.max(1, Math.round(sorgente.height * scala));
  const ctx = out.getContext('2d');
  if (sfondo) {
    ctx.fillStyle = sfondo;
    ctx.fillRect(0, 0, out.width, out.height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sorgente, 0, 0, out.width, out.height);
  return out;
}
