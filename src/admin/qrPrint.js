import { qrSvgString } from '../components/QrCode';

/** Foglio di stampa: cartello A4 singolo oppure 4 cartellini da banco/tavolino. */
export function fogliStampaHtml(url, modo) {
  const qr = qrSvgString(url, { size: 600 });
  const testoUrl = url.replace(/^https?:\/\//, '');

  const cartello = `
    <div class="sheet big">
      <img class="logo" src="/logo.png" alt="" />
      <p class="kicker">Trasparenza e qualità artigianale</p>
      <h1>Ingredienti<br/>e Allergeni</h1>
      <p class="sub">Inquadra il QR con la fotocamera del telefono</p>
      <div class="qr">${qr}</div>
      <p class="url">${testoUrl}</p>
      <p class="foot">Informazioni redatte ai sensi del Reg. (UE) n. 1169/2011.<br/>In caso di allergie o intolleranze chiedi sempre conferma al nostro staff.</p>
    </div>`;

  const cartellino = `
    <div class="card">
      <p class="kicker">Punto Gi!</p>
      <h2>Ingredienti e Allergeni</h2>
      <div class="qr">${qr}</div>
      <p class="sub">Inquadra il QR<br/>con la fotocamera</p>
      <p class="url">${testoUrl}</p>
    </div>`;

  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"/>
<title>QR Allergeni — Punto Gi!</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Georgia, 'Times New Roman', serif; color: #33291f; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { height: 277mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; border: 2px solid #e6e0d4; border-radius: 10mm; padding: 12mm; }
  .logo { height: 42mm; object-fit: contain; margin-bottom: 2mm; }
  .kicker { margin: 0 0 3mm; font-family: Arial, Helvetica, sans-serif; font-size: 10pt; letter-spacing: .18em; text-transform: uppercase; color: #2c7699; }
  h1 { margin: 0 0 5mm; font-size: 34pt; line-height: 1.1; }
  .sub { margin: 0 0 7mm; font-family: Arial, Helvetica, sans-serif; font-size: 13pt; color: #5b5145; }
  .qr svg { width: 92mm; height: 92mm; }
  .card .qr svg { width: 48mm; height: 48mm; }
  .url { margin: 5mm 0 0; font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #8a8073; word-break: break-all; }
  .foot { margin: 8mm 0 0; font-family: Arial, Helvetica, sans-serif; font-size: 8.5pt; line-height: 1.5; color: #8a8073; max-width: 110mm; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 4mm; height: 277mm; }
  .card { border: 1.5px dashed #cfc7b8; border-radius: 6mm; padding: 8mm 6mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .card h2 { margin: 0 0 4mm; font-size: 16pt; line-height: 1.2; }
  .card .kicker { font-size: 8pt; }
  .card .sub { margin: 4mm 0 0; font-size: 9.5pt; }
  .card .url { font-size: 7.5pt; margin-top: 2mm; }
</style></head><body>
${modo === 'cartellini' ? `<div class="grid">${cartellino.repeat(4)}</div>` : cartello}
</body></html>`;

  return html;
}

/** Apre la finestra di stampa col foglio scelto. */
export function stampaCartello(url, modo) {
  const html = fogliStampaHtml(url, modo);

  // iframe nascosto invece di window.open: non viene bloccato dal browser.
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  frame.onload = () => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch {
      /* no-op */
    }
    setTimeout(() => frame.remove(), 60000);
  };
  document.body.appendChild(frame);
  frame.srcdoc = html;
}

