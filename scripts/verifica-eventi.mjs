// Guardia degli eventi delle statistiche: `node scripts/verifica-eventi.mjs`
//
// Un evento delle statistiche vive in TRE posti che nessuno tiene allineati da
// solo: la costante in src/lib/analytics.js (EV), la riga del catalogo
// statistiche_eventi (in una migrazione di migrations/) e il punto del sito che
// lo manda. Se manca la riga a catalogo il database scarta l'evento in
// silenzio; se manca il punto di chiamata la scheda Statistiche mostra uno zero
// per sempre. Nessuno dei due errori si vede a occhio: per questo c'è questo
// controllo.
//
// Controlla anche:
//  - le torte già composte (torteConsigliate in src/data/fallback/cakeOptions.js):
//    ognuna ha la sua voce in EV_CONSIGLIATA, con chiave
//    torta_consigliata_<gruppo>_<id>, un gruppo che la scheda sa dividere e la
//    riga a catalogo con etichetta = nome della torta;
//  - "un tocco, un evento": nessun elemento ha insieme data-ev e una chiamata a
//    traccia()/tracciaUnaVolta() (il click si conterebbe due volte), e la carta
//    della consigliata non ha data-ev. Vede solo le chiamate scritte DENTRO il
//    tag: un handler con un nome (onClick={apri}) che chiama traccia va
//    controllato a occhio.
//
// Legge i file come testo e non tocca né la rete né il database: analytics.js
// non si può importare in Node, perché usa import.meta.env.
// NON è agganciata a `npm run build`, di proposito: un controllo che fallisce
// bloccherebbe il deploy su Vercel per un'etichetta. Si lancia a mano dopo
// aver toccato eventi, consigliate o migrazioni delle statistiche.
// Esce con 1 se trova un errore; gli avvisi si stampano e basta.
// Uso: node scripts/verifica-eventi.mjs [cartella del sito, di solito la radice del repo]

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RADICE = resolve(process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '..'));
const leggi = (p) => readFileSync(join(RADICE, p), 'utf8');
const errori = [];
const avvisi = [];

/* ───────── 1. EV, EV_PASSO, EV_CONSIGLIATA in analytics.js ───────── */

const ANALYTICS = 'src/lib/analytics.js';
const analytics = leggi(ANALYTICS);
const blocco = (nome) => analytics.match(new RegExp(`export const ${nome} = Object\\.freeze\\(\\{([\\s\\S]*?)\\n\\}\\);`));

const bloccoEV = blocco('EV');
if (!bloccoEV) errori.push(`${ANALYTICS}: non trovo "export const EV = Object.freeze({"`);
const EV = new Map([...(bloccoEV?.[1] || '').matchAll(/^\s*([A-Z0-9_]+):\s*'([a-z0-9_]+)'/gm)].map((m) => [m[1], m[2]]));
const valoriEV = new Set(EV.values());

const mappa = (nome) => {
  const b = blocco(nome);
  if (!b) {
    errori.push(`${ANALYTICS}: non trovo "export const ${nome} = Object.freeze({"`);
    return new Map();
  }
  const m = new Map();
  for (const [, chiave, costante] of b[1].matchAll(/^\s*'?([a-z0-9_-]+)'?:\s*EV\.([A-Z0-9_]+)/gm)) {
    if (!EV.has(costante)) errori.push(`${nome}.${chiave} punta a EV.${costante}, che non esiste`);
    m.set(chiave, costante);
  }
  return m;
};
const EV_PASSO = mappa('EV_PASSO');
const EV_CONSIGLIATA = mappa('EV_CONSIGLIATA');

/* ───────── 2. Il catalogo, dalle migrazioni ─────────
   In ordine di nome (cioè di data): se una chiave compare due volte vale
   l'ultima, come quando le migrazioni si eseguono in fila. */

const catalogo = new Map();
for (const f of readdirSync(join(RADICE, 'migrations')).filter((x) => x.endsWith('.sql') && !x.endsWith('-prova.sql')).sort()) {
  const sql = leggi(join('migrations', f)).replace(/--[^\n]*/g, '');
  if (!/statistiche_eventi/.test(sql)) continue;
  for (const m of sql.matchAll(/\(\s*'([a-z0-9_]+)'\s*,\s*'((?:[^']|'')*)'\s*,\s*'([a-z]+)'\s*,\s*'([a-z]+)'\s*,\s*(\d+)\s*\)/g)) {
    catalogo.set(m[1], { etichetta: m[2].replace(/''/g, "'"), tipo: m[3], gruppo: m[4], ordine: Number(m[5]), file: f });
  }
}
if (!catalogo.size) errori.push('migrations/: nessuna riga del catalogo statistiche_eventi trovata');

/* ───────── 3. I punti di chiamata nel sito ───────── */

const sorgenti = [];
const cammina = (dir) => {
  for (const e of readdirSync(join(RADICE, dir), { withFileTypes: true })) {
    const rel = join(dir, e.name);
    if (e.isDirectory()) cammina(rel);
    else if (/\.(jsx?|mjs)$/.test(e.name) && !/\.test\.mjs$/.test(e.name)) sorgenti.push(rel);
  }
};
cammina('src');

const usati = new Set();
const dataEvSconosciuti = [];
let usaPasso = false;
let usaConsigliata = false;
for (const rel of sorgenti) {
  let testo = leggi(rel);
  const eAnalytics = relative(join(RADICE, 'src/lib'), join(RADICE, rel)) === 'analytics.js';
  if (eAnalytics) {
    // Le definizioni non sono usi: si tolgono prima di cercare.
    for (const nome of ['EV', 'EV_PASSO', 'EV_CONSIGLIATA']) testo = testo.replace(blocco(nome)?.[0] || '', '');
  } else {
    if (/\bEV_PASSO\s*\[/.test(testo)) usaPasso = true;
    if (/\bEV_CONSIGLIATA\s*\[/.test(testo)) usaConsigliata = true;
  }
  // Attributi veri solo nei .jsx, e solo valori fatti come una chiave: un
  // data-ev="…" scritto in un commento per spiegare non è un punto di
  // chiamata, mentre una chiave con un refuso (maiuscole, trattini) sì.
  if (rel.endsWith('.jsx')) {
    for (const [, k] of testo.matchAll(/data-ev="([\w-]+)"/g)) {
      usati.add(k);
      if (!valoriEV.has(k)) dataEvSconosciuti.push(`${rel}: data-ev="${k}"`);
    }
  }
  for (const [, nome] of testo.matchAll(/\bEV\.([A-Z0-9_]+)/g)) {
    if (EV.has(nome)) usati.add(EV.get(nome));
    else errori.push(`${rel}: EV.${nome} non esiste in EV (traccia riceverebbe undefined)`);
  }
  // Liste che finiscono in data-ev={x.ev} (menù, schede servizi, social).
  for (const [, k] of testo.matchAll(/\bev:\s*'([a-z0-9_]+)'/g)) {
    usati.add(k);
    if (!valoriEV.has(k)) dataEvSconosciuti.push(`${rel}: ev: '${k}'`);
  }
}
if (usaPasso) for (const c of EV_PASSO.values()) usati.add(EV.get(c));
if (usaConsigliata) for (const c of EV_CONSIGLIATA.values()) usati.add(EV.get(c));

for (const k of valoriEV) {
  if (!catalogo.has(k)) errori.push(`${k}: è in EV ma non a catalogo in nessuna migrazione (il database lo scarterebbe in silenzio)`);
  if (!usati.has(k)) errori.push(`${k}: è in EV ma nessun punto del sito lo manda (in scheda resterebbe a zero per sempre)`);
}
for (const s of dataEvSconosciuti) errori.push(`${s}: chiave che non è in EV (traccia() la scarta)`);
for (const [k, r] of catalogo) {
  if (!valoriEV.has(k)) avvisi.push(`${k}: a catalogo (${r.file}) ma il sito non lo manda più: va bene solo se è un evento in pensione`);
}

/* ───────── 4. Le torte già composte ───────── */

const { torteConsigliate } = await import(pathToFileURL(join(RADICE, 'src/data/fallback/cakeOptions.js')).href);
const { GRUPPI, PREFISSO } = await import(pathToFileURL(join(RADICE, 'src/admin/consigliateStat.js')).href);
const gruppiNoti = new Set(GRUPPI.map((g) => g.id));
const chiaviTorte = new Set();

for (const t of torteConsigliate || []) {
  const nome = `consigliata "${t.id}"`;
  if (!gruppiNoti.has(t.gruppo)) errori.push(`${nome}: gruppo "${t.gruppo}" che la scheda non sa dividere (GRUPPI in src/admin/consigliateStat.js)`);
  const costante = EV_CONSIGLIATA.get(t.id);
  if (!costante) { errori.push(`${nome}: manca in EV_CONSIGLIATA (si conterebbe solo nel totale, senza dire quale torta)`); continue; }
  const chiave = EV.get(costante);
  if (!chiave) continue; // già segnalato sopra
  chiaviTorte.add(chiave);
  const attesa = `${PREFISSO}${t.gruppo}_${t.id}`;
  if (chiave !== attesa) errori.push(`${nome}: chiave ${chiave}, attesa ${attesa} (la scheda divide i gruppi leggendo la chiave)`);
  const riga = catalogo.get(chiave);
  if (!riga) continue; // già segnalato sopra
  if (riga.tipo !== 'click' || riga.gruppo !== 'torta') errori.push(`${nome}: a catalogo come ${riga.tipo}/${riga.gruppo}, deve essere click/torta`);
  if (riga.etichetta !== t.name) errori.push(`${nome}: etichetta a catalogo "${riga.etichetta}", ma la torta si chiama "${t.name}"`);
}
const idTorte = new Set((torteConsigliate || []).map((t) => t.id));
for (const id of EV_CONSIGLIATA.keys()) {
  if (!idTorte.has(id)) errori.push(`EV_CONSIGLIATA.${id}: la torta non esiste più in torteConsigliate`);
}
for (const k of new Set([...valoriEV, ...catalogo.keys()])) {
  if (k.startsWith(PREFISSO) && !chiaviTorte.has(k)) {
    errori.push(`${k}: sembra una voce per torta ma nessuna consigliata la usa`);
  }
}

/* ───────── 5. Un tocco, un evento ─────────
   Si leggono i tag JSX di apertura per intero, graffe comprese: un `>` dentro
   un'arrow function (`() => …`) non chiude il tag, e un apostrofo dentro un
   commento dell'handler (in italiano capita sempre) non apre una stringa. */

function tagDiApertura(testo) {
  const tag = [];
  const inizio = /<([A-Za-z][\w.]*)(?=[\s/>])/g;
  let m;
  while ((m = inizio.exec(testo))) {
    // `a < b` è un confronto, non un tag: prima di un tag JSX c'è una
    // parentesi, un operatore, `return`, la fine di un altro tag…
    const prima = testo.slice(Math.max(0, m.index - 40), m.index).trimEnd();
    if (/[\w)\].]$/.test(prima) && !/\breturn$/.test(prima)) continue;
    let i = m.index + m[0].length;
    let graffe = 0;
    let quote = '';
    let fine = -1;
    for (; i < testo.length && i - m.index < 6000; i++) {
      const ch = testo[i];
      if (quote) {
        if (ch === '\\') i++;
        else if (ch === quote) quote = '';
        continue;
      }
      if (graffe > 0 && ch === '/' && testo[i + 1] === '/') {
        const a = testo.indexOf('\n', i);
        i = a < 0 ? testo.length : a;
        continue;
      }
      if (graffe > 0 && ch === '/' && testo[i + 1] === '*') {
        const a = testo.indexOf('*/', i + 2);
        i = a < 0 ? testo.length : a + 1;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') quote = ch;
      else if (ch === '{') graffe++;
      else if (ch === '}') graffe--;
      else if (graffe === 0 && ch === '<') break; // non era un tag
      else if (graffe === 0 && ch === '>') { fine = i; break; }
    }
    if (fine > 0) tag.push({ nome: m[1], testo: testo.slice(m.index, fine + 1), riga: testo.slice(0, m.index).split('\n').length });
  }
  return tag;
}

let carteConsigliata = 0;
for (const rel of sorgenti.filter((r) => r.endsWith('.jsx'))) {
  for (const t of tagDiApertura(leggi(rel))) {
    const conDataEv = /\sdata-ev\s*=/.test(t.testo);
    const chiamaTraccia = /\btraccia(UnaVolta)?\s*\(/.test(t.testo);
    if (conDataEv && chiamaTraccia) {
      errori.push(`${rel}:${t.riga}: <${t.nome}> ha data-ev E chiama traccia(): un tocco conterebbe due volte`);
    }
    if (/className="[^"]*\bconsigliata-card\b/.test(t.testo)) {
      carteConsigliata++;
      if (conDataEv) errori.push(`${rel}:${t.riga}: la carta della consigliata ha data-ev: con tracciaUnaVolta conterebbe due volte`);
      if (!/tracciaUnaVolta\(\s*EV_CONSIGLIATA\[/.test(t.testo)) errori.push(`${rel}:${t.riga}: la carta della consigliata non chiama tracciaUnaVolta(EV_CONSIGLIATA[…])`);
    }
  }
}
if (carteConsigliata !== 1) errori.push(`carta della consigliata (className "consigliata-card"): attesa 1, trovate ${carteConsigliata}`);

/* ───────── Esito ───────── */

for (const a of avvisi) console.log(`avviso: ${a}`);
if (errori.length) {
  console.error(`\nEVENTI DELLE STATISTICHE: ${errori.length} ${errori.length === 1 ? 'problema' : 'problemi'}`);
  for (const e of errori) console.error(` - ${e}`);
  process.exit(1);
}
console.log(
  `Eventi delle statistiche: OK — ${EV.size} in EV, ${catalogo.size} a catalogo, ` +
  `${(torteConsigliate || []).length} torte già composte, ogni tocco un evento solo.`,
);
