// Comprime e ridimensiona le immagini in public/ (housekeeping una-tantum).
// Le foto pesanti (es. hero-cup.jpg da molti MB) rallentano il sito: questo
// script le riduce a una larghezza massima ragionevole e le ri-comprime,
// sovrascrivendo il file solo se il risultato è più leggero.
//
// Uso:  npm run optimize-images
//
// Nota: le foto caricate dai proprietari su Airtable sono già ottimizzate in
// automatico (usiamo le miniature di Airtable, vedi scripts/build-data.mjs).

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, extname } from 'node:path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');

const MAX_WIDTH = 1800; // larghezza massima utile per il web
const JPEG_QUALITY = 78;
const kb = (n) => Math.round(n / 1024);

const files = readdirSync(publicDir).filter((f) => /\.(jpe?g|png)$/i.test(f));

let savedTotal = 0;
for (const file of files) {
  const path = resolve(publicDir, file);
  const before = statSync(path).size;
  const ext = extname(file).toLowerCase();

  // Leggiamo in memoria così sharp non tiene il file aperto quando lo riscriviamo (Windows).
  const input = readFileSync(path);
  const img = sharp(input).rotate(); // .rotate() applica l'orientamento EXIF
  const meta = await img.metadata();
  if (meta.width && meta.width > MAX_WIDTH) {
    img.resize({ width: MAX_WIDTH, withoutEnlargement: true });
  }

  const out =
    ext === '.png'
      ? await img.png({ compressionLevel: 9, palette: true }).toBuffer()
      : await img.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();

  if (out.length < before) {
    writeFileSync(path, out);
    savedTotal += before - out.length;
    console.log(`  ✓ ${file}: ${kb(before)} KB → ${kb(out.length)} KB`);
  } else {
    console.log(`  · ${file}: già ottimizzata (${kb(before)} KB)`);
  }
}

console.log(`\nFatto. Risparmio totale: ${kb(savedTotal)} KB.`);
