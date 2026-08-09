// Genera pagine STATICHE per i crawler, dopo `vite build`.
//
// Perche' serve: il sito e' una SPA React. I crawler delle AI (GPTBot,
// PerplexityBot, ClaudeBot...) NON eseguono JavaScript: senza questo passaggio
// vedono soltanto <div id="root"></div> e i meta tag. La pagina /allergeni —
// il contenuto piu' citabile del sito — risultava identica alla home.
//
// Cosa fa:
//   1. legge dist/index.html (lo shell prodotto da Vite, con gli asset con hash)
//   2. scarica i gusti da Supabase (stessa fonte della pagina React)
//   3. scrive dist/allergeni/index.html con title/description/canonical propri,
//      il contenuto degli allergeni in HTML semantico e uno schema Menu dedicato
//
// Il contenuto statico finisce dentro #root: React lo sostituisce al mount, quindi
// gli utenti vedono la pagina normale (e la vedono anche prima, il che è un bonus).
//
// A prova di guasto: se mancano le variabili d'ambiente o Supabase non risponde,
// lo script NON blocca il build — lascia il comportamento SPA precedente.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = resolve(__dirname, '..', 'dist');
const SITE = 'https://www.gelateriapuntogi.it';

const URL_SB = process.env.VITE_SUPABASE_URL;
const KEY_SB = process.env.VITE_SUPABASE_KEY;

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const splitAll = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

const CATEGORIE = [
  { key: 'base', title: 'Le nostre basi', hint: 'Ogni gusto parte da una di queste basi.' },
  { key: 'crema', title: 'Le Creme Classiche', hint: 'Gusti classici lisci, senza variegature.' },
  { key: 'golosone', title: 'I Nostri Golosoni', hint: 'Gusti con variegature: biscotti, granelle, creme.' },
  { key: 'frutta-vegan', title: 'Linea Frutta e Vegan', hint: 'A base acqua, senza latte ne derivati animali.' },
  { key: 'leccornie', title: 'Altre Leccornie', hint: 'Pasticceria a freddo e specialita.' },
];

async function fetchGusti() {
  if (!URL_SB || !KEY_SB) return null;
  const url = `${URL_SB}/rest/v1/allergeni_prodotti?select=*&attivo=eq.true&order=ordine`;
  const res = await fetch(url, { headers: { apikey: KEY_SB, Authorization: `Bearer ${KEY_SB}` } });
  if (!res.ok) throw new Error(`Supabase HTTP ${res.status}`);
  return res.json();
}

// --- HTML del contenuto allergeni (semantico, leggibile senza CSS) -----------
function contenutoHtml(rows) {
  const perCat = {};
  rows.forEach((r) => { (perCat[r.categoria] = perCat[r.categoria] || []).push(r); });

  const sezioni = CATEGORIE.map((cat) => {
    const items = perCat[cat.key];
    if (!items || !items.length) return '';
    const righe = items.map((p) => {
      const certi = splitAll(p.allergeni_certi);
      const tracce = splitAll(p.allergeni_tracce);
      const diete = [
        p.vegan && 'vegan',
        p.senza_glutine && 'senza glutine',
        p.senza_lattosio && 'senza lattosio',
        p.senza_zucchero && 'senza zuccheri aggiunti',
      ].filter(Boolean);
      return `        <article>
          <h3>${esc(p.gusto)}</h3>
          ${p.descrizione ? `<p>${esc(p.descrizione)}</p>` : ''}
          ${p.ingredienti ? `<p><strong>Ingredienti:</strong> ${esc(p.ingredienti)}</p>` : ''}
          <p><strong>Allergeni presenti:</strong> ${certi.length ? esc(certi.join(', ')) : 'nessuno tra i principali'}</p>
          ${tracce.length ? `<p><strong>Possibili tracce:</strong> ${esc(tracce.join(', '))}</p>` : ''}
          ${diete.length ? `<p><strong>Adatto a:</strong> ${esc(diete.join(', '))}</p>` : ''}
        </article>`;
    }).join('\n');
    return `      <section>
        <h2>${esc(cat.title)}</h2>
        <p>${esc(cat.hint)}</p>
${righe}
      </section>`;
  }).filter(Boolean).join('\n');

  // Blocco di apertura auto-contenuto: risponde alla domanda nelle prime righe,
  // che e' cio' che le AI estraggono per le citazioni.
  const intro = `      <p>La Gelateria Punto Gi! di Carpi (MO), in Via Remesina Interna 46, pubblica qui
      l'elenco completo degli ingredienti e degli allergeni di ogni gusto di gelato, ai sensi del
      Regolamento (UE) n. 1169/2011. Per ogni gusto trovi la base di partenza, gli ingredienti,
      gli allergeni presenti e le possibili tracce, oltre alle indicazioni per chi segue una dieta
      vegana, senza glutine, senza lattosio o senza zuccheri aggiunti. Tutti i gelati sono prodotti
      artigianalmente nello stesso laboratorio con le stesse attrezzature: non e' possibile garantire
      l'assenza assoluta di contaminazioni crociate, quindi ogni prodotto puo' contenere tracce di
      glutine, latte, uova, soia, frutta a guscio e arachidi anche quando non sono tra gli ingredienti.
      In caso di allergie o intolleranze chiedi sempre conferma al personale.</p>`;

  return `    <main>
      <h1>Ingredienti e allergeni — Gelateria Punto Gi!, Carpi (MO)</h1>
${intro}
${sezioni}
      <p><a href="${SITE}/">Torna al sito della Gelateria Punto Gi!</a></p>
    </main>`;
}

// --- Schema Menu con le diete (dato machine-readable per le AI) --------------
function schemaMenu(rows) {
  const dietOf = (p) => {
    const d = [];
    if (p.vegan) d.push('https://schema.org/VeganDiet');
    if (p.senza_glutine) d.push('https://schema.org/GlutenFreeDiet');
    if (p.senza_lattosio) d.push('https://schema.org/LowLactoseDiet');
    return d;
  };
  const perCat = {};
  rows.forEach((r) => { (perCat[r.categoria] = perCat[r.categoria] || []).push(r); });

  const sections = CATEGORIE.map((cat) => {
    const items = perCat[cat.key];
    if (!items || !items.length) return null;
    return {
      '@type': 'MenuSection',
      name: cat.title,
      hasMenuItem: items.map((p) => {
        const item = { '@type': 'MenuItem', name: p.gusto };
        if (p.descrizione || p.ingredienti) item.description = p.descrizione || p.ingredienti;
        const d = dietOf(p);
        if (d.length) item.suitableForDiet = d;
        return item;
      }),
    };
  }).filter(Boolean);

  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    '@id': `${SITE}/allergeni#menu`,
    name: 'Gusti, ingredienti e allergeni — Gelateria Punto Gi!',
    inLanguage: 'it-IT',
    provider: { '@type': 'IceCreamShop', '@id': `${SITE}/#gelateria` },
    hasMenuSection: sections,
  };
}

// --- Riscrittura dei meta nello shell ---------------------------------------
function conMeta(html, { title, description, canonical }) {
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(description)}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${esc(canonical)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(description)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${esc(canonical)}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${esc(description)}$2`);
}

async function main() {
  const shellPath = resolve(dist, 'index.html');
  if (!existsSync(shellPath)) {
    console.warn('[prerender-seo] dist/index.html assente: salto.');
    return;
  }

  let gusti;
  try {
    gusti = await fetchGusti();
  } catch (e) {
    console.warn('[prerender-seo] Supabase non raggiungibile:', e.message, '- salto, il sito resta SPA.');
    return;
  }
  if (!gusti || !gusti.length) {
    console.warn('[prerender-seo] Nessun dato allergeni (variabili mancanti o tabella vuota): salto.');
    return;
  }

  const shell = readFileSync(shellPath, 'utf8');
  const title = 'Allergeni e ingredienti dei gusti — Gelateria Punto Gi! Carpi';
  const description =
    'Elenco completo di ingredienti e allergeni di ogni gusto della Gelateria Punto Gi! di Carpi (MO), '
    + 'ai sensi del Reg. UE 1169/2011: gusti vegan, senza glutine e senza lattosio, con allergeni e possibili tracce.';

  let page = conMeta(shell, { title, description, canonical: `${SITE}/allergeni` });

  // Contenuto statico dentro #root (React lo sostituisce al mount).
  // Lo shell ha gia' un blocco di partenza per la home: qui va sostituito per
  // intero con quello degli allergeni. Si sostituisce da <div id="root"> fino
  // alla </div> che precede lo script del bundle.
  const contenuto = contenutoHtml(gusti);
  const apertura = page.indexOf('<div id="root">');
  if (apertura === -1) {
    console.warn('[prerender-seo] <div id="root"> non trovato: salto la pagina.');
    return;
  }
  // Trova la </div> di chiusura contando l'annidamento (non basta la prima:
  // il blocco di partenza potrebbe contenere altri div in futuro).
  const fineTagApertura = page.indexOf('>', apertura) + 1;
  let profondita = 1;
  let i = fineTagApertura;
  while (profondita > 0 && i < page.length) {
    const apri = page.indexOf('<div', i);
    const chiudi = page.indexOf('</div>', i);
    if (chiudi === -1) break;
    if (apri !== -1 && apri < chiudi) { profondita++; i = apri + 4; }
    else { profondita--; i = chiudi + 6; }
  }
  if (profondita !== 0) {
    console.warn('[prerender-seo] chiusura di #root non individuata: salto la pagina.');
    return;
  }
  page = page.slice(0, apertura)
    + `<div id="root">\n${contenuto}\n    </div>`
    + page.slice(i);

  // Schema Menu aggiuntivo (quello dell'attivita' resta ereditato dallo shell)
  const ld = `<script type="application/ld+json">\n${JSON.stringify(schemaMenu(gusti), null, 2)}\n</script>`;
  page = page.replace('</head>', `    ${ld}\n  </head>`);

  const outDir = resolve(dist, 'allergeni');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'index.html'), page);

  console.log(`[prerender-seo] dist/allergeni/index.html generato (${gusti.length} gusti, ${Math.round(page.length / 1024)} KB).`);
}

main().catch((e) => {
  // Mai bloccare il build per un problema SEO.
  console.warn('[prerender-seo] errore non bloccante:', e.message);
});
