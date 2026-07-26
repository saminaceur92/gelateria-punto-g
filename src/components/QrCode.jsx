import qrcode from 'qrcode-generator';

/**
 * QR Code generato in locale (nessuna chiamata a servizi esterni).
 * Libreria: qrcode-generator (MIT, zero dipendenze).
 *
 * Esporta: <QrCode/> per l'anteprima a schermo, qrSvgString/qrPngDataUrl per
 * il download (SVG vettoriale per la tipografia, PNG per l'uso veloce).
 */

// Marrone del brand: scuro quanto basta per una lettura sicura da telefono.
export const QR_DARK = '#33291f';
export const QR_LIGHT = '#ffffff';

// Correzione d'errore alta: il QR resta leggibile anche se si sporca o si rovina
// un angolo (è un cartello che sta in gelateria).
function build(value) {
  const qr = qrcode(0, 'H');
  qr.addData(value || ' ');
  qr.make();
  return qr;
}

// Percorso SVG dei moduli scuri: un solo <path>, così il file resta leggero.
function modulesPath(qr, margin) {
  const count = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < count; r += 1) {
    for (let c = 0; c < count; c += 1) {
      if (qr.isDark(r, c)) d += `M${c + margin} ${r + margin}h1v1h-1z`;
    }
  }
  return d;
}

/** Anteprima a schermo (SVG scalabile, nitido a qualsiasi dimensione). */
export default function QrCode({ value, size = 220, margin = 4, dark = QR_DARK, light = QR_LIGHT, title }) {
  const qr = build(value);
  const total = qr.getModuleCount() + margin * 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${total} ${total}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={title || `QR Code per ${value}`}
      style={{ display: 'block', borderRadius: 12 }}
    >
      <rect width={total} height={total} fill={light} />
      <path d={modulesPath(qr, margin)} fill={dark} />
    </svg>
  );
}

/** SVG come stringa: per il download e per il foglio di stampa. */
export function qrSvgString(value, { size = 1024, margin = 4, dark = QR_DARK, light = QR_LIGHT } = {}) {
  const qr = build(value);
  const total = qr.getModuleCount() + margin * 2;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"`,
    ` viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">`,
    `<rect width="${total}" height="${total}" fill="${light}"/>`,
    `<path d="${modulesPath(qr, margin)}" fill="${dark}"/>`,
    '</svg>',
  ].join('');
}

/** PNG ad alta risoluzione (canvas): pronto per WhatsApp, Canva, stampa. */
export function qrPngDataUrl(value, { size = 1600, margin = 4, dark = QR_DARK, light = QR_LIGHT } = {}) {
  const qr = build(value);
  const count = qr.getModuleCount();
  const total = count + margin * 2;
  // Lato modulo intero: niente moduli sfocati o di larghezza diversa.
  const cell = Math.max(1, Math.floor(size / total));
  const dim = cell * total;

  const canvas = document.createElement('canvas');
  canvas.width = dim;
  canvas.height = dim;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, dim, dim);
  ctx.fillStyle = dark;
  for (let r = 0; r < count; r += 1) {
    for (let c = 0; c < count; c += 1) {
      if (qr.isDark(r, c)) ctx.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell);
    }
  }
  return canvas.toDataURL('image/png');
}
