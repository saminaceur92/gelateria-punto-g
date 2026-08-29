import { useState, useEffect, useMemo, useRef, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, ArrowRight, Check, Cake, Shuffle, Instagram, Facebook, MessageCircle, CreditCard } from 'lucide-react';
import { useCakeData } from '../data/CakeDataProvider';
import { CRUMBLE_BASE_ID, isTallType } from '../data/cakeOptions';
import { supabase } from '../lib/supabase';
import { logAction } from '../lib/log';
import { traccia, tracciaUnaVolta, EV, EV_PASSO } from '../lib/analytics';
import { uploadCakePhotos } from '../lib/cakePhoto';
import { catturaTorta3D, ridimensiona, SFONDO_FOTO } from '../lib/cakeSnapshot';
import CakePreview from './CakePreview';
import Lightbox from './Lightbox';

// Ordine passi: tipo → n° persone → allergie → forma → base → [crumble] → gusti →
// inserto (farcitura) → copertura → decorazioni → scritta → dati → riepilogo.
// 'crumble' è l'unico passo CONDIZIONALE: compare solo se la base scelta è il
// crumble croccante. I passi effettivi si calcolano a runtime (vedi `steps` più
// sotto): usa sempre quelli, non STEPS, per numerazione e navigazione.
// Gli EXTRA (salame dolce, cabaret di pasticcini) NON sono un passo: si
// propongono a ordine finito, in una finestra a parte (vedi ProposteExtra),
// come la schermata delle offerte ai totem dei fast food.
const STEPS = [
  'type',       // tipo torta (semifreddo / gelato / crock / alte)
  'size',       // n° persone
  'allergies',  // allergie/intolleranze da evitare (ingrigisce le scelte dopo)
  'shape',      // forma
  'base',       // base sotto
  'crumble',    // tipo di crumble (solo se la base è il crumble croccante)
  'flavors',    // strati / gusti
  'filling',    // inserto (farcitura tra strati)
  'covering',   // copertura esterna
  'decoration', // decorazioni topping (+ colore, se previsto)
  'message',    // scritta + foto + candelina
  'details',    // dati cliente
  'review',     // riepilogo
];

// Passi effettivi del wizard (STEPS meno quelli non applicabili): reso
// disponibile agli step figli per la numerazione "Passo N di M".
const StepsCtx = createContext(STEPS);

/**
 * Tipi di torta che HANNO GIÀ la loro base nel nome: "Torta gelato con base
 * Salame al cioccolato" non può avere altro che quella. In questi casi la base
 * si imposta da sé e il passo non si chiede — farla scegliere quando c'è una
 * sola risposta possibile è solo un passaggio in più, e permette di ordinare
 * una torta che si contraddice nel nome.
 */
const BASE_OBBLIGATA = { crock: 'glutenfree' };
// Le torte "Alte" (semifreddo e gelato) consentono 4 gusti; le altre (basse) 2.
// Non e' un obbligo: si puo' fare una torta a un gusto solo. Il numero
// consigliato (GUSTI_CONSIGLIATI) e' quello che rende meglio in vetrina.
// L'elenco degli id sta in ../data/cakeOptions.js perché lo usa anche
// l'anteprima, che le disegna più alte.
const maxFlavorsFor = (typeId) => (isTallType(typeId) ? 4 : 2);
const GUSTI_CONSIGLIATI = 2;
const MAX_FLAVORS = 4; // cap assoluto (usato dal contatore combinazioni)
// Decorazioni: si possono scegliere insieme, ma non all'infinito — oltre cinque
// la torta diventa illeggibile (e impossibile da decorare bene a mano).
const MAX_DECORAZIONI = 5;
// Id dell'opzione "niente decorazioni": non finisce mai nella lista delle
// scelte (lista vuota = nessuna decorazione), serve solo come card da toccare.
const NO_DECO = 'nessuna';
const MAX_MESSAGE = 24; // si deve leggere bene nel centro della torta
// Tetto di sicurezza per gli extra: nessuno ordina 50 kg di salame dal sito.
const MAX_EXTRA_QTY = 20;

// Stili della scritta: arrivano dalla tabella `scritte` (opzionale). Se manca —
// o è vuota — si usa questa copia di sicurezza, così il passo funziona sempre.
const FALLBACK_SCRITTE = [
  { id: 'stampatello', name: 'Stampatello maiuscolo', family: "'Inter', sans-serif", sample: 'AUGURI!', uppercase: true, italic: false },
  { id: 'corsivo', name: 'Corsivo', family: "'Caveat', cursive", sample: 'Auguri!', uppercase: false, italic: false },
  { id: 'corsivo-scolastico', name: 'Corsivo scolastico', family: "'Fraunces', serif", sample: 'Auguri!', uppercase: false, italic: true },
];
const DEFAULT_FONT = 'corsivo';
// Vecchi id salvati negli ordini (e nei promemoria compleanno) → id della
// tabella `scritte`. Serve per "Rifai questa torta" sugli ordini storici.
const LEGACY_FONTS = { inter: 'stampatello', caveat: 'corsivo', fraunces: 'corsivo-scolastico' };
const normalizeFont = (id) => LEGACY_FONTS[id] || id || DEFAULT_FONT;
const scritteOf = (cake) => (cake.cakeScritte?.length ? cake.cakeScritte : FALLBACK_SCRITTE);

// Pallini colore per le decorazioni con scelta del colore: i nomi arrivano dai
// dati (rosa, oro, arcobaleno…), qui c'è solo la resa grafica del pallino.
// Ogni colore compare con entrambe le desinenze: la panna è "rossa/azzurra",
// perline e fiocchi sono "rosso/azzurro". Oro e argento sono metallici
// (sfumatura con riflesso), l'arcobaleno è a spicchi come nella torta 3D.
const COLOR_SWATCH = {
  rosa: '#f3a3c2',
  rossa: '#d13b3b', rosso: '#d13b3b',
  azzurra: '#7cb7d7', azzurro: '#7cb7d7',
  blu: '#2f4fa8',
  verde: '#5ba85b',
  nera: '#2a1a3e', nero: '#2a1a3e',
  gialla: '#f5d04a', giallo: '#f5d04a',
  oro: 'linear-gradient(135deg, #fff4c4 0%, #f0d27a 32%, #c9a227 62%, #8d6b14 100%)',
  argento: 'linear-gradient(135deg, #ffffff 0%, #e4e8ec 32%, #a9b1b8 64%, #767d84 100%)',
  bianca: '#ffffff', bianco: '#ffffff',
  arcobaleno: 'conic-gradient(#e84a6e, #f5d04a, #5ba85b, #7cb7d7, #b651e4, #e84a6e)',
};
// Colori chiari: sul fondo chiaro della scheda servono un bordino per vedersi.
const COLOR_PALE = new Set(['bianca', 'bianco', 'argento']);
const colorKey = (nome) => String(nome || '').trim().toLowerCase();
const swatchOf = (nome) =>
  COLOR_SWATCH[colorKey(nome)] || 'linear-gradient(135deg, #efe7da, #d8ccb8)';
// Stile completo del pallino: sfondo + bordino per i colori chiari (il bordo
// bianco del CSS li farebbe sparire sulla scheda).
const swatchStyle = (nome) => {
  const style = { background: swatchOf(nome) };
  if (COLOR_PALE.has(colorKey(nome))) {
    style.boxShadow = 'inset 0 0 0 1px rgba(42,26,62,0.28), 0 2px 5px rgba(0,0,0,0.15)';
  }
  return style;
};

// Colori davvero scegliibili per una decorazione: solo se prevede la scelta e
// solo quelli elencati a listino (le liste sono diverse da decorazione a
// decorazione, es. le perline sono solo oro/argento/rosa/bianco).
const colorsOf = (deco) => (deco?.colorChoice ? (deco.colors || []) : []);
// Ritrova un colore nella lista disponibile ignorando maiuscole e spazi, e ne
// restituisce la versione "ufficiale" (quella scritta a listino). Stringa vuota
// se quel colore non è (più) disponibile: così non resta mai appiccicato.
const matchColor = (colors, value) => {
  const k = colorKey(value);
  if (!k) return '';
  return (colors || []).find((c) => colorKey(c) === k) || '';
};

// Dalle decorazioni scelte (solo gli id, in ordine di scelta) alle righe di
// listino. Gli id non più a menù spariscono: un ordine dell'anno scorso o una
// decorazione tolta dalla dashboard non devono rompere niente.
// La lista si ripulisce PRIMA di leggere il listino, con gli stessi passi del
// server (decorationsOf in supabase/functions/_shared/price.ts): niente vuoti,
// niente 'nessuna', niente doppioni (raddoppierebbero il supplemento) e mai più
// di MAX_DECORAZIONI. È da qui che passa il totale mostrato al cliente: se qui
// si contasse una decorazione in più di là, il prezzo pagato non sarebbe quello
// visto sul sito. Il tetto si applica agli id, non alle righe trovate, perché
// così fa il server.
const chosenDecorations = (decorations, cakeDecorations) => {
  const ids = [];
  for (const raw of decorations || []) {
    const id = typeof raw === 'string' ? raw.trim() : '';
    if (!id || id === NO_DECO || ids.includes(id)) continue;
    ids.push(id);
    if (ids.length >= MAX_DECORAZIONI) break;
  }
  return ids.map((id) => (cakeDecorations || []).find((d) => d.id === id)).filter(Boolean);
};

// Elenco leggibile delle decorazioni scelte, ognuna col suo colore — per il
// riepilogo, la notifica Telegram e la mail di conferma.
// Es. "Fiocchi colorati (colore Rosso) · Macarons (colore Verde)".
const decorationsText = (decos, colori) =>
  (decos || []).length
    ? decos
        .map((d) => `${d.name}${(colori || {})[d.id] ? ` (colore ${colori[d.id]})` : ''}`)
        .join(' · ')
    : 'Nessuna';

// Quantità degli extra in formato italiano (1,5 e non 1.5).
const fmtQty = (n) => Number(n || 0).toLocaleString('it-IT', { maximumFractionDigits: 2 });

// Extra scelti in forma leggibile: dalla mappa { id: quantità } della config
// all'elenco con nome, prezzo unitario e totale parziale.
const chosenExtras = (extras, cakeExtras) =>
  Object.entries(extras || {})
    .map(([id, q]) => {
      const e = (cakeExtras || []).find((x) => x.id === id);
      const qty = Number(q) || 0;
      return e && qty > 0 ? { ...e, qty, total: qty * (e.price ?? 0) } : null;
    })
    .filter(Boolean);
const extraLabel = (e) => `${e.name} ×${fmtQty(e.qty)}${e.unit ? ` (${e.unit})` : ''} — €${e.total.toFixed(2)}`;

// N° persone ricavato dalla dimensione (id o etichetta).
const personeOf = (size) => {
  if (!size) return 0;
  return parseInt(size.id, 10) || parseInt(size.label, 10) || 0;
};
// La forma rettangolare è disponibile solo da 15 persone in su.
const RECT_MIN_PERSONE = 15;

// Preferenze alimentari dichiarate nello step "Allergie": non sono allergeni,
// filtrano al contrario (passa solo cio' che e' dichiarato adatto). L'elenco di
// cosa e' vegano o senza zuccheri aggiunti lo danno i titolari dal gestionale.
const DIETA_VEGAN = 'vegan';
const DIETA_NO_ZUCCHERO = 'senza-zucchero';
const DIETE = [
  { id: DIETA_VEGAN, emoji: '🌱', name: 'Vegan' },
  { id: DIETA_NO_ZUCCHERO, emoji: '🍃', name: 'Senza zuccheri aggiunti' },
];

// Consegna a domicilio della torta: sovrapprezzo e zone coperte.
const DELIVERY_FEE = 4;
const DELIVERY_ZONES = [
  'Comune di Carpi (fino a Gargallo, Santa Croce, Fossoli, San Marino)',
  'Rovereto, San Possidonio, Sant’Antonio, Novi',
  'Limidi e Soliera',
];

// Un'opzione è esclusa se contiene un allergene fra quelli da evitare oppure se
// non rispetta una preferenza dichiarata (vegan / senza zuccheri aggiunti).
// Attenzione alla differenza: gli allergeni ESCLUDONO (c'è dentro → fuori), le
// preferenze INCLUDONO (passa solo ciò che i titolari hanno dichiarato adatto).
// Su vegan e zuccheri non si deduce nulla: se il dato manca, l'opzione resta
// spenta finché in gestionale non viene spuntata.
const conflictsAllergies = (item, allergies, diets) => {
  if (!item) return false;
  if ((item.allergeni || []).some((a) => (allergies || []).includes(a))) return true;
  const d = diets || [];
  if (d.includes(DIETA_VEGAN) && !item.vegan) return true;
  if (d.includes(DIETA_NO_ZUCCHERO) && !item.senzaZucchero) return true;
  return false;
};

// ── Panna VEGETALE ──
// Le coperture e le decorazioni di panna hanno una gemella vegana con lo
// stesso id più "-veg" (righe in `coperture` e `decorazioni`, vedi la
// migrazione 2026-08-29-panna-vegetale.sql). Non stanno in lista tutte e due:
// a chi ha scelto Vegan o evita il latte si mostra la vegetale AL POSTO di
// quella con latte, agli altri solo quella con latte. Stesso posto in lista,
// stesso aspetto nella torta 3D (che toglie il suffisso, vedi Cake3D).
const SUFFISSO_VEG = '-veg';
const isVeg = (id) => String(id || '').endsWith(SUFFISSO_VEG);
const vuolePannaVeg = (allergies, diets) =>
  (diets || []).includes(DIETA_VEGAN) || (allergies || []).includes('latte');
/** La gemella vegetale di un'opzione, se esiste ed è compatibile; altrimenti null. */
const gemellaVeg = (item, list, allergies, diets) => {
  if (!item || isVeg(item.id)) return null;
  const g = (list || []).find((x) => x.id === item.id + SUFFISSO_VEG);
  return g && !conflictsAllergies(g, allergies, diets) ? g : null;
};
/**
 * Le opzioni da mostrare in un passo: le gemelle vegetali compaiono solo a chi
 * le vuole (o se una è già scelta, per non nasconderla sotto i suoi occhi), e
 * quando compaiono nascondono l'originale con latte.
 */
const conPannaVeg = (list, allergies, diets, sceltiIds) => {
  const veg = vuolePannaVeg(allergies, diets);
  const scelti = new Set(sceltiIds || []);
  const ids = new Set((list || []).map((x) => x.id));
  return (list || []).filter((x) => {
    if (isVeg(x.id)) return veg || scelti.has(x.id);
    return !(veg && ids.has(x.id + SUFFISSO_VEG));
  });
};

// Dove verrà mangiata la torta (passo "I tuoi dati"): true = in un locale,
// false = a casa, null = non ancora risposto. In chiaro per riepilogo, mail e
// Telegram.
const testoDoveSiMangia = (v) =>
  (v === true ? 'in un locale (ristorante, pizzeria…)' : v === false ? 'a casa' : '');

const emailOk = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((s || '').trim());

// Telefono valido: 10 cifre (es. 348 5556677), con prefisso +39 / 0039 opzionale.
const phoneOk = (s) => {
  let d = (s || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('39')) d = d.slice(2);
  if (d.length === 14 && d.startsWith('0039')) d = d.slice(4);
  return d.length === 10;
};
const toISO = (d) => d.toLocaleDateString('en-CA');
const todayISO = () => toISO(new Date());
const timeToMin = (s) => { const [h, m] = (s || '0:0').split(':').map(Number); return h * 60 + m; };

// Fasce orarie di ritiro per la data scelta: ogni ora, da un'ora dopo
// l'apertura a un'ora prima della chiusura (dagli orari della gelateria).
const GIORNI = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

// Orario di apertura (minuti da mezzanotte) per il giorno della data indicata.
function orarioRange(dateStr, orari) {
  let d;
  try { d = new Date(`${dateStr}T00:00:00`); } catch { return null; }
  if (Number.isNaN(d.getTime())) return null;
  const row = (orari || []).find((o) => o.giorno === GIORNI[d.getDay()]);
  const orario = (row && row.orario) || '11:00-23:00'; // fallback prudente
  const nums = orario.match(/\d{1,2}:\d{2}/g) || [];
  if (nums.length < 2) return null;
  return { open: timeToMin(nums[0]), close: timeToMin(nums[nums.length - 1]) };
}

function pickupSlots(dateStr, orari) {
  if (!dateStr) return [];
  const range = orarioRange(dateStr, orari);
  if (!range) return [];
  const slots = [];
  for (let t = range.open + 60; t <= range.close - 60; t += 60) {
    slots.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
  }
  return slots;
}

// Aggiunge `hoursNeeded` ore di APERTURA a partire da `from`, saltando gli orari
// di chiusura. Restituisce il primo istante di ritiro possibile (minimo di preavviso).
function addWorkingHours(from, hoursNeeded, orari) {
  let remaining = hoursNeeded * 60; // minuti di apertura ancora da coprire
  const cur = new Date(from);
  let guard = 0;
  while (remaining > 0 && guard < 60) {
    guard++;
    const range = orarioRange(toISO(cur), orari);
    const minutesOfDay = cur.getHours() * 60 + cur.getMinutes();
    if (range && minutesOfDay < range.close) {
      if (minutesOfDay < range.open) {
        cur.setHours(Math.floor(range.open / 60), range.open % 60, 0, 0);
      }
      const nowMin = cur.getHours() * 60 + cur.getMinutes();
      const avail = range.close - nowMin;
      if (avail >= remaining) {
        cur.setTime(cur.getTime() + remaining * 60000);
        return cur;
      }
      remaining -= avail;
    }
    // giornata finita (o chiusa): riparti dall'apertura del giorno dopo
    cur.setDate(cur.getDate() + 1);
    cur.setHours(0, 0, 0, 0);
  }
  return cur;
}

// Campi che si possono precompilare da fuori: dai link "alternative" (allergie)
// e dal link "Rifai questa torta" del promemoria compleanno. Fuori da questa
// lista non si precompila nulla: dati di contatto e date si reinseriscono sempre.
// L'ordine conta: prima si riprende il formato VECCHIO a decorazione singola
// ('decoration' + 'decorationColor', quello degli ordini già salvati), poi
// l'eventuale formato nuovo a più decorazioni, che ha sempre l'ultima parola.
// I colori si validano sulle decorazioni già riprese.
const PREFILL_KEYS = [
  'type', 'shape', 'sizeId', 'allergies', 'flavors', 'baseId', 'crumbleId',
  'fillingId', 'coveringId', 'decoration', 'decorationColor',
  'decorations', 'decorationColors', 'extras',
  'message', 'messageFont', 'candle', 'occasion', 'name',
];

// Config iniziale calcolata dai dati disponibili (validi anche se il proprietario
// disattiva la dimensione/base/decorazione di default).
function makeInitialConfig(cake, initial = {}) {
  const base = {
    type: '',
    shape: cake.cakeShapes[0]?.id || 'tonda',
    sizeId: '', // scelta esplicita: sblocca "Sorprendimi" e le regole legate alle persone
    allergies: initial.allergies || [], // allergeni da evitare (ingrigiscono le scelte)
    // Il passo allergie va risposto: o si sceglie almeno un allergene, o si
    // dichiara di non averne. Non si prosegue lasciandolo in bianco.
    noAllergies: false,
    diets: [],           // preferenze alimentari: vegan, senza zuccheri aggiunti
    flavors: [], // [{name,color}]
    baseId: cake.cakeBases[0]?.id || '',
    crumbleId: '', // tipo di crumble: usato solo con la base crumble croccante
    fillingId: 'nessuna',
    coveringId: '',
    // Decorazioni: scelta MULTIPLA (fino a MAX_DECORAZIONI), in ordine di scelta.
    // Lista vuota = nessuna decorazione.
    decorations: [],
    // Colore scelto per ogni decorazione che lo prevede: { idDecorazione: 'Rosso' }.
    decorationColors: {},
    extras: {},          // extra dell'ordine: mappa { idExtra: quantità }
    message: '',
    messageFont: DEFAULT_FONT,
    candle: false,
    occasion: '',
    surprise: false,     // "è una sorpresa": si somma all'occasione
    gift: false,         // "è un regalo": idem
    photo: null,
    photoTransform: { zoom: 1, posX: 50, posY: 50 },
    pickupDate: '',
    pickupTime: '',
    delivery: false,      // consegna a domicilio (+€4) invece del ritiro
    deliveryAddress: '',  // indirizzo di consegna
    inLocale: null,       // dove si mangia: true = in un locale, false = a casa, null = da rispondere
    name: '',
    phone: '',
    email: '',
    notes: '',
    // Codice sconto applicato: { codice, tipo, valore, descrizione }.
    // È solo quello che si VEDE — l'importo addebitato lo ricalcola il server.
    sconto: null,
  };

  // Precompilazione (es. torta dell'anno scorso): solo i campi previsti e solo
  // se l'opzione esiste ancora a menù, altrimenti resta il valore di partenza.
  const exists = (list, id) => !id || (list || []).some((x) => x.id === id);
  for (const k of PREFILL_KEYS) {
    const v = initial[k];
    if (v === undefined || v === null) continue;
    if (k === 'type' && !exists(cake.cakeTypes, v)) continue;
    if (k === 'shape' && !exists(cake.cakeShapes, v)) continue;
    if (k === 'sizeId' && !exists(cake.cakeSizes, v)) continue;
    if (k === 'baseId' && !exists(cake.cakeBases, v)) continue;
    if (k === 'crumbleId' && !exists(cake.cakeCrumbles, v)) continue;
    if (k === 'fillingId' && !exists(cake.cakeFillings, v)) continue;
    if (k === 'coveringId' && !exists(cake.cakeCoverings, v)) continue;
    if (k === 'decoration') {
      // FORMATO VECCHIO (ordini già salvati e link "Rifai questa torta"): una
      // sola decorazione, in una stringa. Diventa una lista di una decorazione.
      // 'nessuna' — come una decorazione tolta dal menù — resta lista vuota.
      if (typeof v !== 'string' || !v || v === NO_DECO) continue;
      if (!exists(cake.cakeDecorations, v)) continue;
      base.decorations = [v];
      continue;
    }
    if (k === 'decorationColor') {
      // Colore del formato vecchio: appartiene alla decorazione appena ripresa,
      // e si tiene solo se quella decorazione prevede ancora quel colore (le
      // liste si sono ristrette, un colore dell'ordine dell'anno scorso può non
      // esserci più). Si riprende con la grafia di oggi (es. "rosa" → "Rosa").
      const id = base.decorations[0];
      if (!id) continue;
      const d = (cake.cakeDecorations || []).find((x) => x.id === id);
      const colore = matchColor(colorsOf(d), v);
      if (!colore) continue;
      base.decorationColors = { [id]: colore };
      continue;
    }
    if (k === 'decorations') {
      // FORMATO NUOVO: lista di id. Si tengono solo quelli ancora a listino,
      // senza doppioni, senza 'nessuna' e fino al massimo consentito.
      if (!Array.isArray(v)) continue;
      base.decorations = [
        ...new Set(
          v.filter((id) => typeof id === 'string' && id && id !== NO_DECO && exists(cake.cakeDecorations, id))
        ),
      ].slice(0, MAX_DECORAZIONI);
      // I colori ripresi dal formato vecchio non valgono per questa lista.
      base.decorationColors = {};
      continue;
    }
    if (k === 'decorationColors') {
      // Colori del formato nuovo: uno per decorazione, tenuti solo se quella
      // decorazione è fra le scelte e prevede ancora quel colore.
      const colori = {};
      for (const id of base.decorations) {
        const d = (cake.cakeDecorations || []).find((x) => x.id === id);
        const colore = matchColor(colorsOf(d), (v || {})[id]);
        if (colore) colori[id] = colore;
      }
      base.decorationColors = colori;
      continue;
    }
    if (k === 'extras') {
      // Extra: si tengono solo quelli ancora a listino, con quantità positiva.
      base.extras = Object.fromEntries(
        Object.entries(v || {})
          .filter(([id, q]) => exists(cake.cakeExtras, id) && Number(q) > 0)
          .map(([id, q]) => [id, Number(q)])
      );
      continue;
    }
    if (k === 'messageFont') {
      // Ordini vecchi: gli id caveat/fraunces/inter diventano quelli di `scritte`.
      const font = normalizeFont(v);
      base.messageFont = scritteOf(cake).some((f) => f.id === font) ? font : DEFAULT_FONT;
      continue;
    }
    if (k === 'flavors') {
      // I gusti cambiano nel tempo: tiene solo quelli ancora a menù, riprendendo
      // colore e allergeni aggiornati di oggi (non quelli salvati allora).
      // Confronto senza maiuscole/minuscole: i nomi si modificano dalla dashboard
      // (es. "Fior di latte" → "Fior di Latte") e l'ordine è di un anno fa.
      base.flavors = (Array.isArray(v) ? v : [])
        .map((f) => {
          const n = String(f?.name || '').trim().toLowerCase();
          return (cake.cakeFlavors || []).find((x) => x.name.trim().toLowerCase() === n);
        })
        .filter(Boolean);
      continue;
    }
    base[k] = v;
  }
  return base;
}

export default function CakeConfigurator({ open, onClose, staff = false, initial, operatore = null }) {
  const cake = useCakeData();
  const {
    cakeShapes,
    cakeTypes,
    cakeSizes,
    cakeFlavors,
    cakeBases,
    cakeCrumbles = [],
    cakeFillings,
    cakeCoverings,
    cakeDecorations,
    // Tabelle nuove (opzionali): finché non esistono, la finestra delle proposte
    // extra non compare e la scritta usa la copia di sicurezza.
    cakeExtras = [],
    cakeScritte = [],
    cakeAllergens,
    cakeRecipes,
  } = cake;
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState(() => makeInitialConfig(cake, initial));
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const bodyRef = useRef(null);
  // Ultima ricetta proposta da "Sorprendimi": serve a non riproporla due volte
  // di fila, che è la cosa che fa sembrare il pulsante sempre uguale.
  const ultimaRicetta = useRef(-1);
  const [showAllerg, setShowAllerg] = useState(false);
  const [orari, setOrari] = useState([]);
  // Finestra delle proposte extra (salame, cabaret): si apre al primo tocco sul
  // pulsante finale, PRIMA che l'ordine parta. `propostaFatta` ricorda che è già
  // stata mostrata, così non si ripropone più per questo ordine — nemmeno se un
  // invio fallisce e il cliente riprova.
  const [showProposte, setShowProposte] = useState(false);
  const propostaFatta = useRef(false);

  // Orari di apertura (per calcolare le fasce di ritiro)
  useEffect(() => {
    if (!supabase) return;
    supabase.from('orari').select('giorno, orario').eq('attivo', true).then(({ data }) => {
      if (data) setOrari(data);
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    // reset del wizard all'apertura
    setStep(0);
    setConfig(makeInitialConfig(cake, initial));
    setSent(false);
    setSubmitting(false);
    setSubmitError('');
    // Ordine nuovo: la proposta degli extra è tutta da fare.
    setShowProposte(false);
    propostaFatta.current = false;
    // Blocca lo scroll della pagina dietro (robusto anche su iOS): fissa il body
    // e ripristina la posizione alla chiusura, così non "scrolla dietro".
    const y = window.scrollY;
    const b = document.body.style;
    b.position = 'fixed'; b.top = `-${y}px`; b.left = '0'; b.right = '0'; b.width = '100%'; b.overflow = 'hidden';
    return () => {
      b.position = ''; b.top = ''; b.left = ''; b.right = ''; b.width = ''; b.overflow = '';
      window.scrollTo(0, y);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    // Esc chiude il configuratore, ma non quando sopra c'è la finestra delle
    // proposte extra: lì l'Esc chiude solo quella (vedi ProposteExtra).
    const onKey = (e) => e.key === 'Escape' && !showProposte && onClose();
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, showProposte]);

  // Configuratore chiuso: si conta alla chiusura dell'overlay, così valgono
  // tutte le uscite (✕, Esc, clic fuori, "Torna al sito") con un punto solo e
  // senza toccare i loro handler. Il pagamento non passa di qui: il redirect a
  // Stripe scarica la pagina e React non esegue le pulizie.
  useEffect(() => {
    if (!open) return undefined;
    return () => traccia(EV.TORTA_CHIUSA);
  }, [open]);

  // Se cambiano le allergie, rimuovi automaticamente le scelte diventate incompatibili.
  useEffect(() => {
    setConfig((c) => {
      const patch = {};
      const base = cakeBases.find((b) => b.id === c.baseId);
      if (conflictsAllergies(base, c.allergies, c.diets)) {
        patch.baseId = cakeBases.find((b) => !conflictsAllergies(b, c.allergies, c.diets))?.id || '';
        patch.crumbleId = '';
      }
      const crumble = cakeCrumbles.find((x) => x.id === c.crumbleId);
      if (conflictsAllergies(crumble, c.allergies, c.diets)) patch.crumbleId = '';
      const filling = cakeFillings.find((f) => f.id === c.fillingId);
      if (conflictsAllergies(filling, c.allergies, c.diets)) patch.fillingId = 'nessuna';
      const covering = cakeCoverings.find((cc) => cc.id === c.coveringId);
      if (conflictsAllergies(covering, c.allergies, c.diets)) {
        // Panna con latte a chi ora evita il latte: si passa alla gemella
        // vegetale (stesso aspetto) invece di lasciarlo senza copertura.
        patch.coveringId = gemellaVeg(covering, cakeCoverings, c.allergies, c.diets)?.id || '';
      }
      // Decorazioni in conflitto: se hanno la gemella vegetale si scambiano
      // (il colore scelto passa alla gemella), altrimenti si tolgono dalla
      // lista con il loro colore; le altre restano scelte.
      const decorations = [];
      const colori = { ...(c.decorationColors || {}) };
      let cambiate = false;
      for (const id of c.decorations || []) {
        const d = cakeDecorations.find((x) => x.id === id);
        if (!conflictsAllergies(d, c.allergies, c.diets)) { decorations.push(id); continue; }
        cambiate = true;
        const g = gemellaVeg(d, cakeDecorations, c.allergies, c.diets);
        if (g) {
          decorations.push(g.id);
          if (colori[id] !== undefined) colori[g.id] = colori[id];
        }
        delete colori[id];
      }
      if (cambiate) {
        patch.decorations = decorations;
        patch.decorationColors = Object.fromEntries(
          Object.entries(colori).filter(([id]) => decorations.includes(id))
        );
      }
      // Extra in conflitto: si tolgono dalla lista degli extra scelti.
      const extras = Object.fromEntries(
        Object.entries(c.extras || {}).filter(
          ([id]) => !conflictsAllergies(cakeExtras.find((e) => e.id === id), c.allergies, c.diets)
        )
      );
      if (Object.keys(extras).length !== Object.keys(c.extras || {}).length) patch.extras = extras;
      const flavors = c.flavors.filter((f) => !conflictsAllergies(f, c.allergies, c.diets));
      if (flavors.length !== c.flavors.length) patch.flavors = flavors;
      return Object.keys(patch).length ? { ...c, ...patch } : c;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.allergies, config.diets]);

  // Il colore appartiene alla decorazione, non alla torta: appena una
  // decorazione esce dalle scelte (o la sua lista colori si restringe / arriva
  // da Supabase dopo il primo render) il suo colore sparisce dalla mappa. Senza
  // questo, togliendo per esempio "Fiocchi · Rosso" e rimettendoli resterebbe
  // appiccicato il rosso di prima, e un colore non più a listino passerebbe
  // dritto fino all'ordine.
  useEffect(() => {
    setConfig((c) => {
      const colori = c.decorationColors || {};
      const ids = Object.keys(colori);
      if (!ids.length) return c;
      const puliti = {};
      let cambiato = false;
      for (const id of ids) {
        const deco = (c.decorations || []).includes(id)
          ? cakeDecorations.find((d) => d.id === id)
          : null;
        const colore = matchColor(colorsOf(deco), colori[id]);
        if (colore) puliti[id] = colore;
        if (colore !== colori[id]) cambiato = true;
      }
      return cambiato ? { ...c, decorationColors: puliti } : c;
    });
  }, [config.decorations, config.decorationColors, cakeDecorations]);

  // Accetta sia un oggetto sia una funzione (config attuale) => patch: la forma a
  // funzione serve quando il patch dipende da com'è la config ADESSO (es. le
  // decorazioni e i loro colori). Con due tocchi ravvicinati — il 3D è pesante e
  // può ritardare il render — la forma a oggetto perderebbe il primo dei due.
  const set = (patch) =>
    setConfig((c) => ({ ...c, ...(typeof patch === 'function' ? patch(c) : patch) }));

  // Passo "crumble": solo se la base scelta è il crumble croccante e se in
  // dashboard esiste almeno un tipo di crumble attivo.
  const showCrumble = config.baseId === CRUMBLE_BASE_ID && cakeCrumbles.length > 0;

  // Base già decisa dal tipo di torta (vedi BASE_OBBLIGATA). Si salta il passo
  // solo se quella base è compatibile con le intolleranze dichiarate: se non lo
  // è, il passo resta e il cliente vede la carta sbarrata col perché — meglio
  // che imporgli di nascosto un ingrediente che ha detto di non poter mangiare.
  const baseImposta = BASE_OBBLIGATA[config.type] || '';
  const baseImpostaOk =
    !!baseImposta &&
    !conflictsAllergies(
      cakeBases.find((b) => b.id === baseImposta),
      config.allergies,
      config.diets
    );

  useEffect(() => {
    if (baseImpostaOk && config.baseId !== baseImposta) {
      set({ baseId: baseImposta, crumbleId: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseImpostaOk, baseImposta, config.baseId]);

  const steps = useMemo(
    () => STEPS.filter((s) => (s !== 'crumble' || showCrumble) && (s !== 'base' || !baseImpostaOk)),
    [showCrumble, baseImpostaOk]
  );

  // Extra che ha senso proporre: quelli a listino compatibili con le allergie
  // indicate. Se non ne resta nessuno, la finestra delle proposte non compare
  // (proporre roba che il cliente non può mangiare è peggio che non proporre).
  const extraProponibili = useMemo(
    () => cakeExtras.filter((e) => !conflictsAllergies(e, config.allergies, config.diets)),
    [cakeExtras, config.allergies]
  );

  // Se i passi si accorciano (base cambiata) l'indice resta sempre valido.
  useEffect(() => {
    setStep((s) => Math.min(s, steps.length - 1));
  }, [steps.length]);

  // Funnel: si conta il passo che ENTRA IN SCENA, non il click su "Avanti".
  // I passi effettivi sono 11/12/13 a seconda della torta e chi sceglie una
  // consigliata salta avanti: contando "Avanti" quel percorso sparirebbe.
  useEffect(() => {
    if (!open) return;
    const evento = EV_PASSO[steps[step]];
    if (evento) tracciaUnaVolta(evento);
  }, [open, steps, step]);

  // Preavviso minimo: 5 ore di apertura da adesso (sito). In gelateria (staff): da subito.
  const earliest = useMemo(
    () => (staff ? new Date() : addWorkingHours(new Date(), 5, orari)),
    [staff, orari]
  );
  const earliestISO = toISO(earliest);
  const earliestMin = earliest.getHours() * 60 + earliest.getMinutes();

  // "Sorprendimi" si sblocca solo dopo aver scelto il numero di persone.
  const canSurprise = !!config.sizeId;

  const total = useMemo(() => {
    const type = cakeTypes.find((t) => t.id === config.type);
    const size = cakeSizes.find((s) => s.id === config.sizeId);
    const base = cakeBases.find((b) => b.id === config.baseId);
    const crumble = config.baseId === CRUMBLE_BASE_ID ? cakeCrumbles.find((c) => c.id === config.crumbleId) : null;
    const shape = cakeShapes.find((sh) => sh.id === config.shape);
    const filling = cakeFillings.find((f) => f.id === config.fillingId);
    const covering = cakeCoverings.find((c) => c.id === config.coveringId);
    // Decorazioni: si paga il supplemento di OGNUNA di quelle scelte.
    const decos = chosenDecorations(config.decorations, cakeDecorations);
    let p =
      (type?.basePrice ?? 0) +
      (size?.priceDelta ?? 0) +
      (base?.priceDelta ?? 0) +
      (crumble?.priceDelta ?? 0) +
      (shape?.priceDelta ?? 0) +
      (filling?.priceDelta ?? 0) +
      (covering?.priceDelta ?? 0) +
      decos.reduce((s, d) => s + (d.priceDelta ?? 0), 0);
    // I gusti sono TUTTI compresi nel prezzo della torta (nessun supplemento per
    // gli strati in più) e la candelina è un regalo della gelateria.
    // ⚠️ Stessa regola lato server: supabase/functions/_shared/price.ts.
    if (config.photo) p += 5;
    if (config.delivery) p += DELIVERY_FEE; // consegna a domicilio
    // Extra dell'ordine (salame al kg, cabaret di pasticcini): prezzo × quantità
    p += chosenExtras(config.extras, cakeExtras).reduce((s, e) => s + e.total, 0);
    return Math.round(p * 100) / 100; // niente code decimali dai passi da 0,5 kg
    // Dipende anche dai listini: arrivano da Supabase DOPO il primo render, e senza
    // di loro il totale resterebbe fermo ai prezzi della copia di sicurezza.
  }, [config, cakeTypes, cakeSizes, cakeBases, cakeCrumbles, cakeShapes, cakeFillings, cakeCoverings, cakeDecorations, cakeExtras]);

  // Sconto del codice, ricalcolato sul totale corrente: se il cliente torna
  // indietro e cambia la torta, la cifra resta coerente da sola.
  // ⚠️ Questa è la cifra MOSTRATA. Quella addebitata la ricalcola il server
  // (supabase/functions/_shared/price.ts), che riverifica il codice da capo:
  // scrivere un codice a mano nel browser non fa pagare di meno.
  const scontoEuro = useMemo(() => {
    const s = config.sconto;
    if (!s) return 0;
    const v = s.tipo === 'percentuale' ? (total * Number(s.valore || 0)) / 100 : Number(s.valore || 0);
    return Math.min(Math.max(Math.round(v * 100) / 100, 0), total);
  }, [config.sconto, total]);
  const totaleFinale = Math.round((total - scontoEuro) * 100) / 100;

  // Allergeni: unione di gusti + base (+ crumble) + farcitura + copertura +
  // TUTTE le decorazioni scelte + extra scelti (indicativi)
  const allergeni = useMemo(() => {
    const base = cakeBases.find((b) => b.id === config.baseId);
    const crumble = config.baseId === CRUMBLE_BASE_ID ? cakeCrumbles.find((c) => c.id === config.crumbleId) : null;
    const filling = cakeFillings.find((f) => f.id === config.fillingId);
    const covering = cakeCoverings.find((c) => c.id === config.coveringId);
    const decos = chosenDecorations(config.decorations, cakeDecorations);
    return [
      ...new Set([
        ...config.flavors.flatMap((f) => f.allergeni || []),
        ...(base?.allergeni || []),
        ...(crumble?.allergeni || []),
        ...(filling?.allergeni || []),
        ...(covering?.allergeni || []),
        ...decos.flatMap((d) => d.allergeni || []),
        ...chosenExtras(config.extras, cakeExtras).flatMap((e) => e.allergeni || []),
      ]),
    ];
  }, [config.flavors, config.baseId, config.crumbleId, config.fillingId, config.coveringId, config.decorations, config.extras, cakeDecorations]);

  // Conteggio combinazioni teoriche (effetto wow)
  const combos = useMemo(() => {
    const flavorsCombos = (cakeFlavors.length ** 2) * 4; // 1-4 strati
    return (
      cakeShapes.length *
      cakeSizes.length *
      flavorsCombos *
      cakeFillings.length *
      cakeCoverings.length *
      cakeBases.length *
      cakeDecorations.length
    );
  }, []);

  const canNext = useMemo(() => {
    const size = cakeSizes.find((s) => s.id === config.sizeId);
    switch (steps[step]) {
      case 'type': return !!config.type;
      case 'size': return !!config.sizeId;
      // Va data una risposta: allergeni scelti oppure "Nessuna intolleranza".
      // Le preferenze (vegan, senza zuccheri) da sole non bastano: sono un'altra
      // domanda, e per la gelateria conta avere la dichiarazione sulle allergie.
      case 'allergies': return config.noAllergies || config.allergies.length > 0;
      case 'shape':
        return !!config.shape &&
          (config.shape !== 'rettangolare' || personeOf(size) >= RECT_MIN_PERSONE);
      case 'flavors': return config.flavors.length >= 1;
      case 'filling': return !!config.fillingId;
      case 'covering': return !!config.coveringId;
      case 'base': return !!config.baseId;
      case 'crumble': return !!config.crumbleId;
      case 'decoration': {
        // Nessuna decorazione va benissimo. Se però una di quelle scelte prevede
        // la scelta del colore, quel colore va indicato (e dev'essere uno di
        // quelli davvero disponibili per QUELLA decorazione).
        return chosenDecorations(config.decorations, cakeDecorations).every((d) => {
          const colors = colorsOf(d);
          return !colors.length || !!matchColor(colors, (config.decorationColors || {})[d.id]);
        });
      }
      // Anche "dove si mangia" va risposto: i titolari lo vogliono per ogni ordine.
      case 'details': return config.name.trim() && phoneOk(config.phone) && emailOk(config.email) && !!config.pickupDate && config.pickupDate >= earliestISO && !!config.pickupTime && (!config.delivery || config.deliveryAddress.trim()) && config.inLocale !== null;
      default: return true;
    }
  }, [step, steps, config, staff, earliestISO, cakeSizes]);

  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  // Gli strati si possono ripetere (crema, cioccolato, crema) e l'ordine è
  // quello con cui si toccano: toccare un gusto AGGIUNGE uno strato in cima,
  // si toglie dall'elenco degli strati sotto la griglia.
  const addFlavor = (f) => {
    if (config.flavors.length >= maxFlavorsFor(config.type)) return;
    set({ flavors: [...config.flavors, f] });
  };
  const removeFlavorAt = (i) => set({ flavors: config.flavors.filter((_, k) => k !== i) });

  const surpriseMe = () => {
    const max = maxFlavorsFor(config.type);
    // Pesca una ricetta diversa da quella appena proposta (se ce n'è più d'una).
    let idx = Math.floor(Math.random() * cakeRecipes.length);
    if (cakeRecipes.length > 1 && idx === ultimaRicetta.current) {
      idx = (idx + 1 + Math.floor(Math.random() * (cakeRecipes.length - 1))) % cakeRecipes.length;
    }
    ultimaRicetta.current = idx;
    const recipe = cakeRecipes[idx];
    // rispetta le allergie scelte e il numero massimo di gusti del tipo.
    // Match per nome case-insensitive: i gusti sono editabili dalla dashboard,
    // quindi un nome della ricetta potrebbe non combaciare più.
    const ok = (f) => f && !conflictsAllergies(f, config.allergies, config.diets);
    let flavors = recipe.flavors
      .map((n) => cakeFlavors.find((f) => f.name.toLowerCase() === n.toLowerCase()))
      .filter(ok);
    // Se la ricetta dà troppo pochi gusti (nomi cambiati o esclusi dalle allergie),
    // completa con gusti disponibili a caso: "Sorprendimi" non resta mai vuoto.
    // Quanti gusti vuole la ricetta, senza superare il massimo del tipo di torta.
    const want = Math.min(Math.max(2, recipe.flavors.length), max);
    if (flavors.length < want) {
      const pool = cakeFlavors
        .filter(ok)
        .filter((f) => !flavors.some((x) => x.name === f.name));
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      while (flavors.length < want && pool.length) flavors.push(pool.shift());
    }
    flavors = flavors.slice(0, max);
    const filling = cakeFillings.find((f) => f.id === recipe.filling);
    const covering = cakeCoverings.find((c) => c.id === recipe.covering);
    // La decorazione: le ricette ne dichiarano UNA sola, quindi la lista che ne
    // esce ne ha una. Se è incompatibile con le allergie (o non è più a menù)
    // si resta senza decorazioni.
    // Se è di panna con latte e il cliente evita il latte, vale la gemella vegetale.
    const decoRicetta = cakeDecorations.find((d) => d.id === recipe.decoration);
    const deco = decoRicetta && conflictsAllergies(decoRicetta, config.allergies, config.diets)
      ? gemellaVeg(decoRicetta, cakeDecorations, config.allergies, config.diets)
      : decoRicetta;
    const decorations = deco && !conflictsAllergies(deco, config.allergies, config.diets) ? [deco.id] : [];
    // Se la decorazione vuole un colore, ne scegliamo uno fra quelli davvero
    // disponibili: altrimenti "Sorprendimi" lascerebbe il passo a metà, con la
    // domanda "di che colore la vuoi?" senza risposta.
    const colori = decorations.length ? colorsOf(deco) : [];
    const decorationColors = colori.length
      ? { [deco.id]: colori[Math.floor(Math.random() * colori.length)] }
      : {};
    // Anche la FORMA fa parte della sorpresa. La dichiarano solo le ricette
    // che ce l'hanno nel tema ("Romantica", "Cuore di fragola"… restano
    // cuori); per le altre si pesca alla pari fra le forme in listino — il
    // cuore escluso, che la sua parte l'ha già dalle ricette a tema. Quando
    // la forma era scritta su tutte le ricette (13 tonde su 16), quadrata e
    // rettangolare non uscivano MAI ("mi escono maggiormente tonde e cuore").
    // La rettangolare resta riservata alle torte grandi.
    const size = cakeSizes.find((s) => s.id === config.sizeId);
    const rettOk = personeOf(size) >= RECT_MIN_PERSONE;
    const dichiarata =
      recipe.shape &&
      cakeShapes.some((s) => s.id === recipe.shape) &&
      (recipe.shape !== 'rettangolare' || rettOk);
    const altreForme = cakeShapes.filter(
      (s) => s.id !== 'cuore' && (s.id !== 'rettangolare' || rettOk)
    );
    const formaSorpresa = dichiarata
      ? recipe.shape
      : altreForme.length
        ? altreForme[Math.floor(Math.random() * altreForme.length)].id
        : config.shape;
    set({
      flavors,
      shape: formaSorpresa,
      fillingId: conflictsAllergies(filling, config.allergies, config.diets) ? 'nessuna' : recipe.filling,
      // Copertura di panna con latte a chi evita il latte: la gemella vegetale
      // (stesso aspetto); se non c'è, resta quella già scelta.
      coveringId: conflictsAllergies(covering, config.allergies, config.diets)
        ? gemellaVeg(covering, cakeCoverings, config.allergies, config.diets)?.id || config.coveringId
        : recipe.covering,
      decorations,
      decorationColors,
    });
  };

  // Una "consigliata" (torta già composta, dal passo della forma): applica
  // tutta la torta e salta dritti a scritta/foto/candelina. I passi vanno
  // ricalcolati con la TORTA NUOVA, non con quelli correnti: la scelta può far
  // comparire il passo del crumble (base croccante) o togliere quello della
  // base, e l'indice di "scritta" si sposta con loro — con l'elenco vecchio si
  // atterrava sul passo sbagliato.
  const applicaConsigliata = (patch) => {
    set(patch);
    const baseImp = BASE_OBBLIGATA[patch.type] || '';
    const futuri = STEPS.filter(
      (s) =>
        (s !== 'crumble' || patch.baseId === CRUMBLE_BASE_ID) &&
        (s !== 'base' || baseImp !== patch.baseId)
    );
    setStep(Math.max(0, futuri.indexOf('message')));
  };

  // `extraFinali` (opzionale): mappa { idExtra: quantità } con cui far partire
  // l'ordine, usata dalla finestra delle proposte quando il cliente sceglie "No
  // grazie" dopo aver toccato un +/-. Serve perché lo stato React si aggiorna
  // solo al render successivo, mentre l'ordine parte adesso.
  // `cfg` differisce da `config` SOLO per gli extra: per tutto il resto i due
  // sono la stessa cosa.
  const submitOrder = async (extraFinali) => {
    const cfg = extraFinali ? { ...config, extras: extraFinali } : config;
    const type = cakeTypes.find((t) => t.id === config.type);
    const shape = cakeShapes.find((sh) => sh.id === config.shape);
    const size = cakeSizes.find((s) => s.id === config.sizeId);
    const base = cakeBases.find((b) => b.id === config.baseId);
    const crumble = config.baseId === CRUMBLE_BASE_ID ? cakeCrumbles.find((c) => c.id === config.crumbleId) : null;
    const filling = cakeFillings.find((f) => f.id === config.fillingId);
    const covering = cakeCoverings.find((c) => c.id === config.coveringId);
    // Decorazioni scelte (possono essere più d'una) con il colore di ciascuna.
    const decos = chosenDecorations(config.decorations, cakeDecorations);
    const decoColori = config.decorationColors || {};
    const decoRiga = decorationsText(decos, decoColori);
    const decoLabel = decos.length > 1 ? 'Decorazioni' : 'Decorazione';
    // Prima scelta: è quella che finisce nei campi vecchi del payload, letti
    // ancora dal gestionale e dalle notifiche.
    const primaDeco = decos[0] || null;
    const primoColore = primaDeco ? decoColori[primaDeco.id] || '' : '';
    const scritta = scritteOf(cake).find((f) => f.id === normalizeFont(config.messageFont));
    // Extra definitivi dell'ordine (dalla finestra delle proposte, se ha detto
    // la sua) e totale coerente: il resto della torta non cambia, quindi basta
    // sostituire nel totale la quota degli extra. Senza proposte è `total`.
    const extras = chosenExtras(cfg.extras, cakeExtras);
    const lordo = extraFinali
      ? Math.round(
          (total
            - chosenExtras(config.extras, cakeExtras).reduce((s, e) => s + e.total, 0)
            + extras.reduce((s, e) => s + e.total, 0)) * 100
        ) / 100
      : total;
    // Lo sconto si ricalcola sul totale definitivo (gli extra dell'ultima
    // finestra possono averlo cambiato), sempre entro i limiti.
    const scontoOrdine = config.sconto
      ? Math.min(
          Math.max(
            Math.round(
              (config.sconto.tipo === 'percentuale'
                ? (lordo * Number(config.sconto.valore || 0)) / 100
                : Number(config.sconto.valore || 0)) * 100
            ) / 100,
            0
          ),
          lordo
        )
      : 0;
    const totale = Math.round((lordo - scontoOrdine) * 100) / 100;
    // Allergeni scelti dal cliente, in MAIUSCOLO (per riepilogo/Telegram/mail)
    const allergNames = (config.allergies || []).map((id) => (cakeAllergens || []).find((a) => a.id === id)?.name || id);
    const allergLine = allergNames.length ? allergNames.join(', ').toUpperCase() : '';
    // Preferenze alimentari e "sorpresa/regalo": informazioni che cambiano il
    // lavoro in laboratorio (e come si consegna), quindi viaggiano con l'ordine.
    const dietLine = (config.diets || []).map((id) => DIETE.find((d) => d.id === id)?.name || id).join(', ').toUpperCase();
    const noteConsegna = [config.surprise && 'è una sorpresa', config.gift && 'è un regalo'].filter(Boolean).join(' · ');
    // Dove verrà mangiata (a casa / in un locale): i titolari lo vogliono per
    // ogni ordine, quindi viaggia con l'ordine come la sorpresa/regalo.
    const doveSiMangia = testoDoveSiMangia(config.inLocale);

    const msg = [
      staff ? `🎂 *Nuovo ordine in gelateria — Punto Gi*` : `🎂 *Nuova richiesta torta — Punto Gi*`,
      ``,
      allergLine ? `⚠️ *ALLERGENI:* ${allergLine}` : '',
      dietLine ? `🌱 *PREFERENZE:* ${dietLine}` : '',
      `*Tipo:* ${type?.name}`,
      `*Forma:* ${shape?.name}`,
      `*Dimensione:* ${size?.label} (Ø ${size?.diameter}cm)`,
      // Con la base croccante la descrizione ("scegli sotto il gusto del
      // crumble") è un'istruzione per chi ordina, non per il laboratorio — e la
      // riga sotto dice già quale crumble. Per le altre basi resta.
      `*Base:* ${base?.name}${base?.desc && base.id !== CRUMBLE_BASE_ID ? ` (${base.desc})` : ''}`,
      crumble ? `*Tipo di crumble:* ${crumble.name}` : '',
      `*Strati / Gusti:* ${config.flavors.map((f) => f.name).join(', ')}`,
      filling && filling.id !== 'nessuna' ? `*Farcitura:* ${filling.name}` : '',
      covering ? `*Copertura:* ${covering.name}` : '',
      `*${decoLabel}:* ${decoRiga}`,
      extras.length ? `*Extra:* ${extras.map(extraLabel).join(' · ')}` : '',
      config.message ? `*Scritta:* "${config.message}"${scritta ? ` (${scritta.name})` : ''}` : '',
      config.photo ? `*Foto su cialda:* sì (verrà inviata a parte)` : '',
      config.candle ? `*Candelina:* sì` : '',
      config.occasion ? `*Occasione:* ${config.occasion}` : '',
      scontoOrdine > 0 ? `*Sconto:* ${config.sconto?.codice} (−€${scontoOrdine.toFixed(2)})` : '',
      noteConsegna ? `*Attenzione:* ${noteConsegna}` : '',
      ``,
      config.delivery
        ? `*Consegna a domicilio:* ${config.pickupDate}${config.pickupTime ? ` alle ${config.pickupTime}` : ''}`
        : `*Da ritirare:* ${config.pickupDate}${config.pickupTime ? ` alle ${config.pickupTime}` : ''}`,
      config.delivery ? `*Indirizzo:* ${config.deliveryAddress}` : '',
      config.delivery ? `*Sovrapprezzo consegna:* €${DELIVERY_FEE}` : '',
      doveSiMangia ? `*Dove si mangia:* ${doveSiMangia}` : '',
      `*Cliente:* ${config.name}`,
      `*Telefono:* ${config.phone}`,
      config.email ? `*Email:* ${config.email}` : '',
      config.notes ? `*Note:* ${config.notes}` : '',
      ``,
      staff ? `💰 *Importo da pagare:* €${totale.toFixed(2)}` : `💰 *Importo pagato:* €${totale.toFixed(2)}`,
      ``,
      staff ? `_Ordine creato in gelateria_` : `_Richiesta inviata dal sito gelateriapuntogcarpi_`,
    ].filter(Boolean).join('\n');

    // Miniatura della torta 3D per la lista ordini. NON è la foto da scaricare:
    // download e Telegram devono usare esclusivamente `config.photo`, cioè il
    // file caricato dal cliente per la cialda alimentare.
    let immagine = null;
    try {
      const canvas = document.querySelector('.cfg-preview canvas');
      const grande = catturaTorta3D(canvas, { maxPx: 900 });
      if (grande) {
        immagine = ridimensiona(grande, 480).toDataURL('image/jpeg', 0.8);
      } else if (canvas) {
        // 3D non ancora registrato: cattura semplice del canvas com'è a schermo
        immagine = ridimensiona(canvas, 480, SFONDO_FOTO).toDataURL('image/jpeg', 0.8);
      }
    } catch {
      /* se la cattura fallisce, l'ordine si salva comunque senza immagine */
    }

    // Foto cialda e anteprima 3D vanno su Storage con ruoli distinti. La foto
    // cliente sta in `dettagli.fotoCialdaUrl`; l'anteprima in `immagine`.
    const foto = await uploadCakePhotos({ customer: config.photo, preview: immagine });
    const immagineUrl = foto.preview;

    // Riga ordine. Per gli ordini pagati la salva il webhook (imposta lì il
    // totale); lo staff invece salva subito qui.
    const { photo, ...dettagli } = cfg;
    const insertBase = {
      immagine: immagineUrl,
      stato: 'da_fare',
      // Sconto: qui c'è quello CHIESTO dal cliente. Per gli ordini pagati online
      // il webhook lo riscrive con quello davvero applicato dal server.
      sconto_codice: config.sconto?.codice || null,
      sconto_euro: scontoOrdine || null,
      cliente_nome: config.name,
      cliente_telefono: config.phone,
      cliente_email: config.email || null,
      ritiro_data: config.pickupDate || null,
      ritiro_ora: config.pickupTime || null,
      tipo: type?.name || null,
      riepilogo: msg,
      // dettagli: la config così com'è (extras, decorations, decorationColors,
      // messageFont inclusi) + le voci nuove già in chiaro, per la dashboard e
      // il laboratorio.
      dettagli: {
        ...dettagli,
        conFoto: !!photo,
        // Foto caricata dal cliente per la cialda: solo questa viene scaricata
        // dalla dashboard e inviata su Telegram.
        fotoCialdaUrl: foto.customer || null,
        scrittaStile: scritta?.name || null,
        // COMPATIBILITÀ: il gestionale, le notifiche Telegram e il link "Rifai
        // questa torta" leggono ancora la decorazione singola. Ci mettiamo la
        // PRIMA scelta; l'elenco completo sta in decorations/decorationColors.
        decoration: primaDeco?.id || NO_DECO,
        decorationColor: primoColore,
        coloreDecorazione: primoColore || null,
        // Decorazioni in chiaro, in ordine di scelta: nome e colore già pronti
        // da leggere in laboratorio.
        decorazioniScelte: decos.map((d) => ({
          id: d.id, nome: d.name, colore: decoColori[d.id] || '',
        })),
        extraScelti: extras.map((e) => ({
          id: e.id, nome: e.name, quantita: e.qty, unita: e.unit || '', prezzo: e.price ?? 0, totale: e.total,
        })),
      },
      note: config.notes || null,
    };

    // Parametri della mail di conferma. Li prepara il sito (qui ci sono i nomi
    // di gusti, forme, basi…) ma la mail la spedisce il DATABASE appena l'ordine
    // è salvato (trigger notify_order_email): così parte sempre, anche se il
    // cliente chiude la pagina appena pagato.
    const quando = config.pickupDate ? `${config.pickupDate.split('-').reverse().join('/')}${config.pickupTime ? ` alle ${config.pickupTime}` : ''}` : '';
    const ordineEmail = [
      allergLine ? `ALLERGENI: ${allergLine}` : '',
      dietLine ? `PREFERENZE: ${dietLine}` : '',
      `Tipo: ${type?.name}`,
      `Forma: ${shape?.name}`,
      `Dimensione: ${size?.label} (Ø ${size?.diameter}cm)`,
      `Base: ${base?.name}`,
      crumble ? `Tipo di crumble: ${crumble.name}` : '',
      `Gusti: ${config.flavors.map((f) => f.name).join(', ')}`,
      filling && filling.id !== 'nessuna' ? `Farcitura: ${filling.name}` : '',
      covering ? `Copertura: ${covering.name}` : '',
      `${decoLabel}: ${decoRiga}`,
      extras.length ? `Extra: ${extras.map(extraLabel).join(', ')}` : '',
      config.message ? `Scritta: "${config.message}"${scritta ? ` (${scritta.name})` : ''}` : '',
      config.photo ? `Foto su cialda: sì` : '',
      config.candle ? `Candelina: sì` : '',
      config.occasion ? `Occasione: ${config.occasion}` : '',
      scontoOrdine > 0 ? `Sconto ${config.sconto?.codice}: -€${scontoOrdine.toFixed(2)}` : '',
      noteConsegna ? `Attenzione: ${noteConsegna}` : '',
      config.delivery ? `Consegna a domicilio (+€${DELIVERY_FEE}) — ${config.deliveryAddress}` : '',
      quando ? `${config.delivery ? 'Consegna' : 'Ritiro'}: ${quando}` : '',
      doveSiMangia ? `Dove si mangia: ${doveSiMangia}` : '',
      config.notes ? `Note: ${config.notes}` : '',
    ].filter(Boolean).join(' · ');
    const emailParams = config.email ? {
      email: config.email,
      cliente: config.name,
      ordine: ordineEmail,
      ritiro: config.delivery ? `Consegna a domicilio${quando ? ` il ${quando}` : ''} — ${config.deliveryAddress}` : quando,
      modalita: (config.delivery ? '🛵 Consegna a domicilio' : '📅 Ritiro in gelateria') + (quando ? ` — ${quando}` : ''),
      saluto: config.delivery
        ? 'Ti consegneremo la torta all’indirizzo e all’orario indicato 🛵'
        : 'Ti aspettiamo in gelateria per il ritiro 🍰',
      importo: totale.toFixed(2),
    } : null;
    insertBase.email_params = emailParams;

    if (!supabase) { setSent(true); return; }
    setSubmitError('');
    setSubmitting(true);

    // STAFF: ordine creato in gelateria, nessun pagamento online → salva subito.
    if (staff) {
      // Se il caricamento su Storage non è riuscito, per lo staff si ripiega
      // sull'immagine grezza (che qui ci sta: non passa dai metadata Stripe).
      const { error } = await supabase.from('ordini').insert({
        // creato_da: chi ha preso l'ordine al banco. Il nome arriva dal codice
        // personale, verificato dal database prima di aprire il configuratore.
        ...insertBase, totale, immagine: immagineUrl || immagine, creato_da: operatore || null,
      });
      if (error) {
        console.warn('[ordine] non salvato:', error.message);
        setSubmitError("Non è stato possibile creare l'ordine. Riprova.");
        setSubmitting(false);
        return;
      }
      logAction('Torta creata', config.name || 'cliente');
      setSubmitting(false);
      setSent(true);
      return;
    }

    // CLIENTE: paga con Stripe. L'ordine lo salva il webhook a pagamento
    // avvenuto; da lì partono sia la notifica Telegram sia la mail di conferma.
    try {
      sessionStorage.setItem('pg_order_delivery', config.delivery ? '1' : '0');
      traccia(EV.TORTA_CHECKOUT_AVVIATO);
      // Il server ricalcola il prezzo da `config` (computeOrder): deve ricevere
      // gli extra definitivi, altrimenti Stripe farebbe pagare un altro totale.
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        // Il codice sconto va mandato: il server lo riverifica da capo e
        // ricalcola l'importo. Non mandiamo mai un totale, solo le scelte.
        body: { config: { ...cfg, scontoCodice: config.sconto?.codice || null }, insert: insertBase },
      });
      if (error) throw error;
      if (data?.url) { window.location.href = data.url; return; }
      throw new Error(data?.error || 'Risposta non valida dal server');
    } catch (e) {
      traccia(EV.TORTA_CHECKOUT_ERRORE);
      setSubmitError(e?.message || 'Errore durante il pagamento. Riprova.');
      setSubmitting(false);
    }
  };

  // Pulsante finale del riepilogo. La PRIMA volta, se c'è ancora qualcosa da
  // proporre e il cliente non ha già aggiunto un extra, l'ordine non parte: si
  // apre la finestra delle proposte (come ai totem dei fast food, la schermata
  // che spunta a ordine finito). Premuto una seconda volta, l'ordine parte e
  // basta: la proposta si fa una volta sola.
  const inviaOrdine = () => {
    const daProporre =
      !propostaFatta.current &&
      extraProponibili.length > 0 &&
      chosenExtras(config.extras, cakeExtras).length === 0;
    if (daProporre) {
      propostaFatta.current = true; // proposta fatta: non si insiste più
      setShowProposte(true);
      return;
    }
    submitOrder();
  };

  // Uscite della finestra. "No grazie": si ordina senza aggiungere niente —
  // anche se il cliente aveva toccato un +/- e poi ci ha ripensato, quindi il
  // carrello degli extra si svuota (e la mappa vuota viaggia subito con
  // l'ordine, senza aspettare il render successivo).
  const ordinaSenzaExtra = () => {
    setShowProposte(false);
    set({ extras: {} });
    submitOrder({});
  };
  // "Aggiungi e ordina": si ordina con quello che ha messo nel carrello (le
  // quantità sono già nella config, aggiornate a ogni +/-).
  const ordinaConExtra = () => {
    setShowProposte(false);
    submitOrder();
  };
  // Esc, clic fuori e ✕: la proposta è declinata e non tornerà più, ma l'ordine
  // NON parte da solo — si torna al riepilogo (dove gli eventuali extra aggiunti
  // restano in elenco) e il pulsante finale, ripremuto, invia e basta.
  const chiudiProposte = () => setShowProposte(false);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className={`cfg-overlay ${staff ? 'cfg-staff' : ''}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
        role="dialog"
        aria-modal="true"
        aria-label="Configuratore torte"
      >
        <motion.div
          className="cfg-modal"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <header className="cfg-header">
            <div className="cfg-title">
              <Cake size={20} color="var(--violet-deep)" />
              {staff ? 'Nuovo ordine' : 'Crea la tua torta'}
              <small style={{ marginLeft: '0.5rem' }}>· Punto Gi</small>
            </div>
            {!sent && (
              <div className="cfg-stepper" aria-hidden="true">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={`seg ${i < step ? 'done' : ''} ${i === step ? 'active' : ''}`}
                  />
                ))}
              </div>
            )}
            <button className="cfg-close" onClick={onClose} aria-label="Chiudi">
              <X size={20} />
            </button>
          </header>

          <aside className="cfg-preview">
            {/* combos in alto (mobile): sopra la torta, non occupa spazio sotto */}
            <div className="combo-counter combo-counter-top">
              1 di <strong>{combos.toLocaleString('it-IT')}</strong> combinazioni
            </div>
            <div className="cfg-preview-stage">
              {/* Le decorazioni viaggiano in coppia: `decorations` dice QUALI
                  sono (in ordine di scelta), `decorationColors` con che colore
                  ognuna di quelle che lo prevede. */}
              <CakePreview
                config={config}
                decorations={config.decorations}
                decorationColors={config.decorationColors}
              />
            </div>
            <div className="cfg-preview-info">
              <div className="combo-counter">
                1 di <strong>{combos.toLocaleString('it-IT')}</strong> combinazioni
              </div>
              <div className="price-row">
                <div className="price">
                  €{totaleFinale.toFixed(0)}
                  <small>totale</small>
                </div>
                {config.flavors.length > 0 && (
                  <button type="button" className="allergeni-btn" data-ev="torta_allergeni_aperti" onClick={() => setShowAllerg(true)}>
                    <span className="allergeni-btn-i" aria-hidden="true">i</span> Allergeni
                  </button>
                )}
              </div>
              {!sent && (
                <button
                  type="button"
                  className="cfg-btn cfg-btn-back"
                  data-ev="torta_sorprendimi"
                  onClick={surpriseMe}
                  disabled={!canSurprise}
                  title={canSurprise ? '' : 'Scegli prima il numero di persone'}
                  style={{ marginTop: '0.6rem', opacity: canSurprise ? 1 : 0.5, cursor: canSurprise ? 'pointer' : 'not-allowed' }}
                >
                  <Shuffle size={14} /> Sorprendimi!
                </button>
              )}
            </div>

            {/* NB: su schermi grandi il riepilogo NON si ripete qui: la card
                sopra racconta già la torta ("farcito con…", "coperto da…").
                Su telefono la card è compattata e quelle righe spariscono,
                quindi lì il riepilogo c'è, nella barretta in fondo. */}
          </aside>

          <StepsCtx.Provider value={steps}>
          <div className="cfg-body" ref={bodyRef}>
            {sent ? (
              <SuccessView name={config.name} onClose={onClose} staff={staff} delivery={config.delivery} />
            ) : (
              <AnimatePresence mode="wait" onExitComplete={() => bodyRef.current?.scrollTo({ top: 0 })}>
                <motion.div
                  key={step}
                  className="cfg-step"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                >
                  {steps[step] === 'type' && <StepType config={config} set={set} />}
                  {steps[step] === 'size' && <StepSize config={config} set={set} />}
                  {steps[step] === 'allergies' && <StepAllergies config={config} set={set} />}
                  {steps[step] === 'shape' && <StepShape config={config} set={set} consigliata={applicaConsigliata} />}
                  {steps[step] === 'base' && <StepBase config={config} set={set} />}
                  {steps[step] === 'crumble' && <StepCrumble config={config} set={set} />}
                  {steps[step] === 'flavors' && <StepFlavors config={config} add={addFlavor} removeAt={removeFlavorAt} />}
                  {steps[step] === 'filling' && <StepFilling config={config} set={set} />}
                  {steps[step] === 'covering' && <StepCovering config={config} set={set} />}
                  {steps[step] === 'decoration' && <StepDecoration config={config} set={set} />}
                  {steps[step] === 'message' && <StepMessage config={config} set={set} staff={staff} />}
                  {steps[step] === 'details' && <StepDetails config={config} set={set} staff={staff} orari={orari} earliestISO={earliestISO} earliestMin={earliestMin} />}
                  {steps[step] === 'review' && (
                    <StepReview config={config} total={total} sconto={scontoEuro} set={set} staff={staff} />
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
          </StepsCtx.Provider>

          {!sent && submitError && (
            <div className="cfg-submit-error">⚠️ {submitError}</div>
          )}

          {!sent && (
            <footer className="cfg-footer">
              {/* Solo su telefono: barretta che apre il riepilogo (su schermi
                  grandi il riepilogo sta già nella colonna di sinistra). */}
              <RiepilogoBarra config={config} total={totaleFinale} staff={staff} steps={steps} step={step} />
              <div className="price-tag">
                <span>Prezzo totale</span>
                <strong>€{totaleFinale.toFixed(2)}</strong>
              </div>
              {/* su mobile, al posto del totale, c'è Sorprendimi (sbloccato dopo il n° persone) */}
              <button
                type="button"
                className="cfg-btn cfg-btn-surprise"
                data-ev="torta_sorprendimi"
                onClick={surpriseMe}
                disabled={!canSurprise}
                title={canSurprise ? '' : 'Scegli prima il numero di persone'}
              >
                <Shuffle size={15} /> Sorprendimi!
              </button>
              <div className="cfg-footer-actions">
                <button className="cfg-btn cfg-btn-back" onClick={back} disabled={step === 0}>
                  <ArrowLeft size={16} /> Indietro
                </button>
                {step < steps.length - 1 ? (
                  <button className="cfg-btn cfg-btn-next" onClick={next} disabled={!canNext}>
                    Avanti <ArrowRight size={16} />
                  </button>
                ) : (
                  <button className="cfg-btn cfg-btn-send" onClick={inviaOrdine} disabled={!canNext || submitting}>
                    {submitting
                      ? (staff ? 'Invio…' : 'Attendi…')
                      : staff
                        ? (<><Check size={16} /> Crea ordine</>)
                        : (<><CreditCard size={16} /> Ordina e paga €{totaleFinale.toFixed(2)}</>)}
                  </button>
                )}
              </div>
            </footer>
          )}

          {/* Proposta finale degli extra: sovrapposta al riepilogo, come la
              schermata delle offerte ai totem dei fast food. */}
          {showProposte && (
            <ProposteExtra
              config={config}
              set={set}
              staff={staff}
              listino={extraProponibili}
              total={totaleFinale}
              onOrdinaSenza={ordinaSenzaExtra}
              onOrdinaCon={ordinaConExtra}
              onChiudi={chiudiProposte}
            />
          )}

          {showAllerg && (
            <div
              className="allergeni-pop-overlay"
              onClick={(e) => e.target === e.currentTarget && setShowAllerg(false)}
            >
              <div className="allergeni-pop" role="dialog" aria-label="Allergeni">
                <h4>Allergeni</h4>
                {allergeni.length > 0 ? (
                  <ul className="allergeni-pop-list">
                    {allergeni.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="allergeni-pop-empty">Nessuno tra i principali.</p>
                )}
                <p className="allergeni-pop-note">
                  Valori indicativi in base ai gusti scelti. Chiedi sempre conferma allo staff per
                  intolleranze e allergie.
                </p>
                <button type="button" className="allergeni-pop-close" onClick={() => setShowAllerg(false)}>
                  Chiudi
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ───────── Step components ───────── */

function StepHeader({ stepKey, num, title, lead }) {
  // I passi effettivi (senza quelli non applicabili, es. crumble) vengono dal
  // configuratore: così la numerazione "Passo N di M" è sempre coerente.
  const steps = useContext(StepsCtx);
  const n = stepKey ? steps.indexOf(stepKey) + 1 : num;
  return (
    <>
      <span className="cfg-step-num">Passo {n} di {steps.length}</span>
      <h2>{title}</h2>
      {lead && <p className="lead">{lead}</p>}
    </>
  );
}

function StepType({ config, set }) {
  const { cakeTypes } = useCakeData();
  return (
    <>
      <StepHeader stepKey="type" title="Che torta vuoi creare?" lead="Scegli la base, poi la rendiamo unica insieme." />
      <div className="opt-grid cols-2">
        {cakeTypes.map((t) => (
          <button
            key={t.id}
            className={`opt-card ${config.type === t.id ? 'selected' : ''}`}
            onClick={() => set({ type: t.id })}
          >
            <div className="opt-name">
              <span className="opt-dot" style={{ '--dot-size': '14px', background: t.color }} />
              {t.name}
            </div>
            <div className="opt-desc">{t.desc}</div>
            <div className="opt-meta">da €{t.basePrice}</div>
          </button>
        ))}
      </div>
    </>
  );
}

function StepShape({ config, set, consigliata }) {
  const {
    cakeShapes, cakeSizes, cakeTypes, cakeFlavors, cakeBases, cakeCrumbles,
    cakeFillings, cakeCoverings, cakeDecorations, torteConsigliate,
  } = useCakeData();
  const persone = personeOf(cakeSizes.find((s) => s.id === config.sizeId));
  // Quale gruppo di consigliate è aperto ('' = nessuno, si vedono solo i tasti).
  const [gruppoAperto, setGruppoAperto] = useState('');

  // "Le nostre consigliate": ogni carta si risolve CONTRO IL LISTINO VERO —
  // gusti per nome, il resto per id. Se un ingrediente non c'è più (spento
  // dalla dashboard) la carta sparisce: meglio niente che promettere una torta
  // che il configuratore non sa comporre. Se invece è in conflitto con le
  // intolleranze dichiarate al passo prima, la carta resta ma sbarrata, con
  // scritto cosa contiene — stessa regola delle altre scelte.
  const consigliate = useMemo(() => (torteConsigliate || []).map((t) => {
    const flavors = (t.flavors || []).map((n) =>
      cakeFlavors.find((f) => f.name.toLowerCase() === String(n).toLowerCase())
    );
    const base = cakeBases.find((b) => b.id === t.baseId);
    const crumble = t.crumbleId ? cakeCrumbles.find((c) => c.id === t.crumbleId) : null;
    const filling = cakeFillings.find((f) => f.id === t.fillingId);
    const covering = cakeCoverings.find((c) => c.id === t.coveringId);
    const decos = (t.decorations || []).map((id) => cakeDecorations.find((d) => d.id === id));
    const type = cakeTypes.find((x) => x.id === t.type);
    if (
      !type || !base || (t.crumbleId && !crumble) || !filling || !covering ||
      flavors.some((f) => !f) || decos.some((d) => !d)
    ) return null;
    // Il tipo di torta non entra nel controllo: le allergie si dichiarano DOPO
    // averlo scelto, e non è un ingrediente.
    const parti = [base, crumble, ...flavors, filling, covering, ...decos].filter(Boolean);
    const contro = [...new Set(
      parti.flatMap((p) => (p.allergeni || []).filter((a) => (config.allergies || []).includes(a)))
    )];
    const bloccata = parti.some((p) => conflictsAllergies(p, config.allergies, config.diets));
    return { ...t, _flavors: flavors, bloccata, contro };
  }).filter(Boolean), [
    torteConsigliate, cakeTypes, cakeFlavors, cakeBases, cakeCrumbles,
    cakeFillings, cakeCoverings, cakeDecorations, config.allergies, config.diets,
  ]);

  const gruppi = [
    { id: 'gelato', titolo: '🍦 Torte gelato' },
    { id: 'semifreddo', titolo: '🍰 Semifreddi' },
  ];

  return (
    <>
      <StepHeader stepKey="shape" title="Che forma vuoi?" lead="Tonda, a cuore, quadrata o rettangolare per i buffet più generosi." />
      <div className="opt-grid cols-2">
        {cakeShapes.map((sh) => {
          const blocked = sh.id === 'rettangolare' && persone > 0 && persone < RECT_MIN_PERSONE;
          return (
            <button
              key={sh.id}
              className={`opt-card ${config.shape === sh.id ? 'selected' : ''}`}
              onClick={() => !blocked && set({ shape: sh.id })}
              disabled={blocked}
              style={blocked ? { opacity: 0.45, cursor: 'not-allowed' } : {}}
            >
              <div className="opt-name">
                <span style={{ fontSize: '1.3rem' }}>{sh.emoji}</span> {sh.name}
              </div>
              <div className="opt-desc">{blocked ? `Solo da ${RECT_MIN_PERSONE} persone in su` : sh.desc}</div>
              <div className="opt-meta">{sh.priceDelta > 0 ? `+ €${sh.priceDelta}` : 'inclusa'}</div>
            </button>
          );
        })}
      </div>

      {consigliate.length > 0 && (
        <div className="consigliate">
          <h3 className="consigliate-titolo">Se non sai cosa scegliere, ecco le nostre consigliate</h3>
          <p className="consigliate-sotto">
            Torte già pensate da noi: scegli prima se la vuoi gelato o semifreddo, poi toccane una
            e ti resta solo da decidere la scritta e la foto, se le desideri!
          </p>
          {/* Prima si sceglie il tipo, poi compaiono le sue torte: tutte e nove
              insieme facevano una pagina lunghissima da scorrere. I due tasti si
              escludono a vicenda; ritoccare quello aperto lo richiude. */}
          <div className="consigliate-tasti" role="group" aria-label="Tipo di torta consigliata">
            {gruppi.map((g) => {
              const quante = consigliate.filter((t) => t.gruppo === g.id).length;
              if (!quante) return null;
              const aperto = gruppoAperto === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  className={`consigliate-tasto ${aperto ? 'aperto' : ''}`}
                  aria-pressed={aperto}
                  onClick={() => setGruppoAperto(aperto ? '' : g.id)}
                >
                  {g.titolo} <span className="consigliate-quante">{quante}</span>
                </button>
              );
            })}
          </div>
          {gruppi.map((g) => {
            const lista = consigliate.filter((t) => t.gruppo === g.id);
            if (!lista.length || gruppoAperto !== g.id) return null;
            return (
              <div key={g.id} className="consigliate-gruppo">
                <div className="opt-grid cols-2">
                  {lista.map((t) => (
                    <button
                      key={t.id}
                      className="opt-card consigliata-card"
                      data-ev="torta_consigliata"
                      disabled={t.bloccata}
                      style={t.bloccata ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                      onClick={() => !t.bloccata && consigliata({
                        type: t.type,
                        baseId: t.baseId,
                        crumbleId: t.crumbleId || '',
                        flavors: t._flavors,
                        fillingId: t.fillingId,
                        coveringId: t.coveringId,
                        decorations: [...(t.decorations || [])],
                        decorationColors: {},
                      })}
                    >
                      <div className="opt-name">{t.name}</div>
                        <div className="opt-desc">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function StepSize({ config, set }) {
  const { cakeSizes } = useCakeData();
  return (
    <>
      <StepHeader stepKey="size" title="Per quante persone?" lead="Una stima abbondante: meglio un cucchiaio in più che in meno. Da qui in poi si sblocca «Sorprendimi»." />
      <div className="opt-grid cols-3">
        {cakeSizes.map((s) => (
          <button
            key={s.id}
            className={`opt-card ${config.sizeId === s.id ? 'selected' : ''}`}
            onClick={() => set({ sizeId: s.id })}
          >
            {s.popular && <span className="badge-popular">Più scelta</span>}
            <div className="opt-name">{s.label}</div>
            <div className="opt-desc">Ø {s.diameter} cm</div>
            <div className="opt-meta">{s.priceDelta > 0 ? `+ €${s.priceDelta}` : 'incluso'}</div>
          </button>
        ))}
      </div>
    </>
  );
}

// Etichette leggibili per gli allergeni tecnici.
function StepAllergies({ config, set }) {
  const { cakeAllergens } = useCakeData();
  const toggle = (id) => {
    const has = config.allergies.includes(id);
    set({
      allergies: has ? config.allergies.filter((x) => x !== id) : [...config.allergies, id],
      // Indicare un allergene smentisce "non ne ho": le due risposte si escludono.
      noAllergies: false,
    });
  };
  const toggleDieta = (id) => {
    const scelte = config.diets || [];
    set({ diets: scelte.includes(id) ? scelte.filter((x) => x !== id) : [...scelte, id] });
  };
  const chosenNames = config.allergies.map((id) => cakeAllergens.find((a) => a.id === id)?.name || id);
  const dietNames = (config.diets || []).map((id) => DIETE.find((d) => d.id === id)?.name || id);
  return (
    <>
      <StepHeader
        stepKey="allergies"
        title="Allergie o intolleranze?"
        lead="Questa risposta ci serve sempre: indica cosa evitare, oppure dichiara che non ci sono intolleranze. Le opzioni incompatibili si spengono da sole nei passi successivi."
      />
      <div className="toggle-row">
        {cakeAllergens.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`toggle-pill ${config.allergies.includes(a.id) ? 'active' : ''}`}
            onClick={() => toggle(a.id)}
          >
            {a.emoji ? `${a.emoji} ` : ''}{a.name}
          </button>
        ))}
      </div>

      {/* Dichiarazione esplicita: si esclude a vicenda con gli allergeni qui sopra,
          così non si va avanti senza aver risposto. */}
      <div className="toggle-row" style={{ marginTop: '0.9rem' }}>
        <button
          type="button"
          className={`toggle-pill toggle-pill-ok ${config.noAllergies ? 'active' : ''}`}
          onClick={() => set({ noAllergies: !config.noAllergies, allergies: [] })}
        >
          ✅ Nessuna intolleranza
        </button>
      </div>

      <div className="cfg-field" style={{ marginTop: '1.6rem' }}>
        <label>Preferenze alimentari (facoltative)</label>
        <div className="toggle-row">
          {DIETE.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`toggle-pill ${(config.diets || []).includes(d.id) ? 'active' : ''}`}
              onClick={() => toggleDieta(d.id)}
            >
              {d.emoji} {d.name}
            </button>
          ))}
        </div>
      </div>

      {config.allergies.length > 0 && (
        <div className="flavor-hint" style={{ marginTop: '1.2rem' }}>
          Segnaleremo: <strong>{chosenNames.join(', ')}</strong>. Le scelte incompatibili appariranno in grigio.
        </div>
      )}
      {(config.diets || []).length > 0 && (
        <div className="flavor-hint" style={{ marginTop: '0.8rem' }}>
          Ti mostreremo solo ciò che è <strong>{dietNames.join(' e ')}</strong>: restano spenti gli ingredienti
          per cui non abbiamo questa garanzia.
        </div>
      )}

      <div className="cfg-avviso" role="note">
        <span className="cfg-avviso-ico" aria-hidden="true">⚠️</span>
        <div>
          <strong>Sicurezza alimentare</strong>
          <p>
            Tutti i nostri prodotti sono lavorati nello stesso laboratorio: non possiamo garantire l'assenza
            totale di contaminazioni crociate. Ogni torta può contenere tracce di glutine, latte, uova, soia,
            frutta a guscio e arachidi. <strong>Per allergie gravi conferma sempre con lo staff.</strong>
          </p>
        </div>
      </div>
    </>
  );
}

function StepFlavors({ config, add, removeAt }) {
  const { cakeFlavors } = useCakeData();
  const max = maxFlavorsFor(config.type);
  const pieno = config.flavors.length >= max;
  // Lo stesso gusto si può ripetere: qui conto quante volte è già stato usato,
  // così la card mostra "×2" invece di sembrare semplicemente "selezionata".
  const quante = (nome) => config.flavors.filter((x) => x.name === nome).length;
  const disponibili = cakeFlavors.filter((f) => !conflictsAllergies(f, config.allergies, config.diets));
  return (
    <>
      <StepHeader
        stepKey="flavors"
        title="Scegli i gusti degli strati"
        // Il massimo non si scrive: non è un traguardo da raggiungere. Quando è
        // pieno lo dice la card, che smette di rispondere e spiega perché.
        lead={`Consigliati ${GUSTI_CONSIGLIATI} gusti. L'ordine è quello degli strati, dal basso verso l'alto — e lo stesso gusto si può ripetere.`}
      />

      {/* Strati scelti, in ordine: è anche il posto da cui si tolgono, visto che
          toccare una card ora aggiunge sempre (i gusti si possono ripetere). */}
      {config.flavors.length > 0 && (
        <div className="strati-scelti">
          {config.flavors.map((f, i) => (
            <button
              key={`${f.name}-${i}`}
              type="button"
              className="strato-chip"
              onClick={() => removeAt(i)}
              title="Togli questo strato"
            >
              <span className="flavor-dot" style={{ background: f.color }} />
              <span className="strato-num">{i + 1}</span>
              {f.name}
              <span className="strato-x" aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}

      {disponibili.length === 0 && (
        <div className="cfg-avviso" role="note">
          <span className="cfg-avviso-ico" aria-hidden="true">😕</span>
          <div>
            <strong>Nessun gusto disponibile con queste scelte</strong>
            <p>
              Con le allergie e le preferenze che hai indicato non ci resta nessun gusto da proporti.
              Torna indietro e togline qualcuna, oppure scrivici: troviamo una soluzione insieme.
            </p>
          </div>
        </div>
      )}

      <div className="opt-grid cols-flavors">
        {cakeFlavors.map((f) => {
          const usato = quante(f.name);
          const allergic = conflictsAllergies(f, config.allergies, config.diets);
          const disabled = allergic || pieno;
          return (
            <button
              key={f.name}
              className={`opt-card opt-flavor ${usato ? 'selected' : ''}`}
              onClick={() => !disabled && add(f)}
              disabled={disabled}
              title={allergic ? `Contiene: ${f.allergeni.join(', ')}` : pieno ? `Hai già ${max} strati: togline uno per cambiarlo` : 'Aggiungi uno strato di questo gusto'}
              style={disabled ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
            >
              <span className="flavor-dot" style={{ background: f.color }} />
              <span className="flavor-name">{f.name}</span>
              {usato > 0 && <span className="flavor-pos">{usato > 1 ? `×${usato}` : '1'}</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}

function StepFilling({ config, set }) {
  const { cakeFillings } = useCakeData();
  return (
    <>
      <StepHeader
        stepKey="filling"
        title="Inserto tra gli strati"
        lead="Un cuore goloso tra uno strato e l'altro: salse, creme o granelle. Oppure niente, per gusti puri."
      />
      <div className="opt-grid cols-3">
        {cakeFillings.map((f) => {
          const blocked = conflictsAllergies(f, config.allergies, config.diets);
          return (
            <button
              key={f.id}
              className={`opt-card ${config.fillingId === f.id ? 'selected' : ''}`}
              onClick={() => !blocked && set({ fillingId: f.id })}
              disabled={blocked}
              style={blocked ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
            >
              <div className="opt-name">
                {f.color && (
                  <span className="opt-dot" style={{ background: f.color }} />
                )}
                {f.name}
              </div>
              <div className="opt-desc">{f.desc}</div>
              <div className="opt-meta">{f.priceDelta > 0 ? `+ €${f.priceDelta}` : 'inclusa'}</div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function StepCovering({ config, set }) {
  const { cakeCoverings } = useCakeData();
  // Panna vegetale al posto di quella con latte, per chi la vuole (vedi conPannaVeg).
  const lista = conPannaVeg(cakeCoverings, config.allergies, config.diets, [config.coveringId]);
  // Foto di esempio aperta a tutto schermo (null = chiusa). È la foto vera
  // caricata dai titolari nella scheda Coperture della dashboard.
  const [fotoAperta, setFotoAperta] = useState(null);
  return (
    <>
      <StepHeader
        stepKey="covering"
        title="Copertura esterna"
        lead="Quello che vede l'occhio prima del primo morso. Lucida, soffice, fiammeggiata… o nuda."
      />
      <div className="opt-grid cols-2">
        {lista.map((c) => {
          const blocked = conflictsAllergies(c, config.allergies, config.diets);
          const scelta = config.coveringId === c.id;
          return (
            // La card e il collegamento alla foto sono DUE bottoni separati (uno
            // dentro l'altro non si può): il div tiene loro due il posto di una
            // cella sola nella griglia.
            <div key={c.id} className="opt-cella">
              <button
                className={`opt-card ${scelta ? 'selected' : ''}`}
                onClick={() => !blocked && set({ coveringId: c.id })}
                disabled={blocked}
                style={blocked ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
              >
                <div className="opt-name">
                  {c.color && (
                    <span className="opt-dot" style={{ background: c.color, border: '1px solid rgba(0,0,0,0.1)' }} />
                  )}
                  {c.name}
                </div>
                <div className="opt-desc">{c.desc}</div>
                <div className="opt-meta">{c.priceDelta > 0 ? `+ €${c.priceDelta}` : 'inclusa'}</div>
              </button>
              {/* Il collegamento compare solo sulla copertura SCELTA, e solo se
                  in dashboard le hanno caricato la foto. */}
              {scelta && c.foto && (
                <button type="button" className="opt-foto-link" onClick={() => setFotoAperta(c)}>
                  📷 Clicca qui per vedere un&rsquo;immagine a scopo illustrativo della copertura
                </button>
              )}
            </div>
          );
        })}
      </div>
      {fotoAperta && (
        <Lightbox
          foto={[{ url: fotoAperta.foto, titolo: `${fotoAperta.name} — immagine a scopo illustrativo` }]}
          indice={0}
          onCambia={() => {}}
          onChiudi={() => setFotoAperta(null)}
        />
      )}
    </>
  );
}

function StepBase({ config, set }) {
  const { cakeBases } = useCakeData();
  return (
    <>
      <StepHeader stepKey="base" title="Quale base preferisci?" lead="Quello che sostiene la torta sotto: dalla classica al salame al cioccolato, o senza base." />
      <div className="opt-grid cols-2">
        {cakeBases.map((b) => {
          const blocked = conflictsAllergies(b, config.allergies, config.diets);
          return (
            <button
              key={b.id}
              className={`opt-card ${config.baseId === b.id ? 'selected' : ''}`}
              // Cambiando base che non sia il crumble, il tipo di crumble si azzera.
              onClick={() => !blocked && set({ baseId: b.id, ...(b.id === CRUMBLE_BASE_ID ? {} : { crumbleId: '' }) })}
              disabled={blocked}
              style={blocked ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
            >
              <div className="opt-name">
                <span className="opt-dot" style={{ background: b.color }} />
                {b.name}
              </div>
              <div className="opt-desc">{b.desc}</div>
              <div className="opt-meta">{b.priceDelta > 0 ? `+ €${b.priceDelta}` : 'inclusa'}</div>
            </button>
          );
        })}
      </div>
    </>
  );
}

// Tipi di crumble: passo che compare solo se la base scelta è il crumble
// croccante. La lista si gestisce dalla dashboard (scheda "Crumble").
function StepCrumble({ config, set }) {
  const { cakeCrumbles = [] } = useCakeData();
  return (
    <>
      <StepHeader
        stepKey="crumble"
        title="Quale crumble?"
        lead="Hai scelto la base croccante: dicci di che tipo la vuoi."
      />
      <div className="opt-grid cols-2">
        {cakeCrumbles.map((c) => {
          const blocked = conflictsAllergies(c, config.allergies, config.diets);
          return (
            <button
              key={c.id}
              className={`opt-card ${config.crumbleId === c.id ? 'selected' : ''}`}
              onClick={() => !blocked && set({ crumbleId: c.id })}
              disabled={blocked}
              style={blocked ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
            >
              <div className="opt-name">
                {c.color && (
                  <span className="opt-dot" style={{ background: c.color }} />
                )}
                {c.name}
              </div>
              <div className="opt-desc">{c.desc}</div>
              <div className="opt-meta">{c.priceDelta > 0 ? `+ €${c.priceDelta}` : 'incluso'}</div>
            </button>
          );
        })}
      </div>
    </>
  );
}

// Decorazioni: scelta MULTIPLA, fino a MAX_DECORAZIONI. Le card funzionano a
// interruttore (si tocca per aggiungere, si ritocca per togliere); "Nessuna"
// svuota tutto ed è selezionata quando non c'è nessuna decorazione.
function StepDecoration({ config, set }) {
  const { cakeDecorations } = useCakeData();
  const scelte = config.decorations || [];
  // Panna vegetale al posto di quella con latte, per chi la vuole (vedi conPannaVeg).
  const disponibili = conPannaVeg(cakeDecorations, config.allergies, config.diets, scelte);
  const colori = config.decorationColors || {};
  const pieno = scelte.length >= MAX_DECORAZIONI;

  // I patch si calcolano sulla config del momento (forma a funzione): due tocchi
  // ravvicinati su due card non si mangiano a vicenda.
  const toggle = (d) => {
    if (d.id === NO_DECO) {
      // "Nessuna" = niente decorazioni: svuota la lista (e i colori).
      if (scelte.length) set({ decorations: [], decorationColors: {} });
      return;
    }
    set((c) => {
      const lista = c.decorations || [];
      const tinte = c.decorationColors || {};
      if (lista.includes(d.id)) {
        // Tolta: se ne va anche il suo colore, così non torna appiccicato dopo.
        const { [d.id]: _via, ...resto } = tinte;
        return { decorations: lista.filter((x) => x !== d.id), decorationColors: resto };
      }
      if (lista.length >= MAX_DECORAZIONI) return {}; // tetto: prima se ne toglie una
      // Scegliendo una decorazione qualsiasi, "Nessuna" si spegne da sé (non è
      // mai nella lista): basta aggiungere in coda, nell'ordine di scelta.
      return { decorations: [...lista, d.id] };
    });
  };

  // Decorazioni scelte che vogliono anche il colore: una palette per ognuna.
  const daColorare = chosenDecorations(scelte, cakeDecorations).filter((d) => colorsOf(d).length > 0);
  const mancaColore = daColorare.some((d) => !colori[d.id]);
  // Le palette stanno in fondo a una lista lunga: quando ne compare una senza
  // colore la portiamo a vista, altrimenti sembra che "Avanti" non funzioni.
  const colorRef = useRef(null);
  useEffect(() => {
    if (mancaColore) colorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scelte.join('|')]);

  return (
    <>
      <StepHeader
        stepKey="decoration"
        title="Decorazioni"
        lead={`Puoi sceglierne fino a ${MAX_DECORAZIONI}, si sommano sulla torta. Le immagini sono indicative — ogni torta è decorata a mano dal nostro staff.`}
      />
      <div className="flavor-hint">
        {scelte.length === 0
          ? <>Nessuna decorazione per ora. Tocca quelle che vuoi, fino a {MAX_DECORAZIONI}.</>
          : <>Hai scelto <strong>{scelte.length}</strong> di {MAX_DECORAZIONI} decorazioni. Ritocca una card per toglierla.</>}
        {pieno && ' Hai raggiunto il massimo: togline una per cambiarla.'}
      </div>
      <div className="opt-grid cols-3">
        {disponibili.map((d) => {
          const blocked = conflictsAllergies(d, config.allergies, config.diets);
          const nessuna = d.id === NO_DECO;
          // "Nessuna" è accesa quando non c'è nessuna decorazione scelta.
          const selected = nessuna ? scelte.length === 0 : scelte.includes(d.id);
          // Col massimo raggiunto le altre card si spengono (ma quelle già
          // scelte restano toccabili, per poterle togliere).
          const maxed = !selected && !nessuna && pieno;
          const disabled = blocked || maxed;
          return (
            <button
              key={d.id}
              className={`opt-card deco-card ${selected ? 'selected' : ''} ${maxed ? 'maxed' : ''}`}
              onClick={() => !disabled && toggle(d)}
              disabled={disabled}
              title={maxed ? `Puoi scegliere fino a ${MAX_DECORAZIONI} decorazioni` : ''}
              aria-pressed={selected}
              style={blocked ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
            >
              <div className="opt-name">
                <span style={{ fontSize: '1.2rem' }}>{d.emoji}</span> {d.name}
              </div>
              <div className="opt-desc">
                {maxed && !blocked
                  ? `Puoi scegliere fino a ${MAX_DECORAZIONI} decorazioni`
                  : d.desc}
              </div>
              <div className="opt-meta">{d.priceDelta > 0 ? `+ €${d.priceDelta}` : 'inclusa'}</div>
            </button>
          );
        })}
      </div>

      {daColorare.length > 0 && (
        <div className="cfg-field cfg-color-pick" ref={colorRef}>
          <label>{daColorare.length > 1 ? 'Di che colore le vuoi? *' : 'Di che colore la vuoi? *'}</label>
          {/* Una palette per ogni decorazione colorata, con il suo nome sopra:
              con due o tre insieme si deve capire a colpo d'occhio quale è quale. */}
          <div className="deco-colors">
            {daColorare.map((d) => (
              <div key={d.id} className={`deco-color-block ${colori[d.id] ? 'done' : ''}`}>
                <span className="deco-color-title">
                  <span aria-hidden="true">{d.emoji}</span> {d.name}
                </span>
                <div className="color-row">
                  {colorsOf(d).map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`color-chip ${colori[d.id] === c ? 'selected' : ''}`}
                      onClick={() =>
                        set((cfg) => ({ decorationColors: { ...(cfg.decorationColors || {}), [d.id]: c } }))}
                    >
                      <span className="color-dot" style={swatchStyle(c)} />
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="hint">
            Le sfumature di questi colori non sono garantite, ma possono essere richieste
            nelle note della torta.
          </p>
        </div>
      )}
    </>
  );
}

/* ───────── Proposta finale: extra dell'ordine ─────────
   Salame dolce al kg e cabaret di pasticcini. NON è un passo del wizard: è la
   finestra che compare a ordine ormai fatto, quando il cliente preme il
   pulsante finale del riepilogo — come la schermata coi panini che ti sparano
   ai totem dei fast food dopo che hai ordinato.
   La quantità si muove a passi di `step`: 0,5 per il salame (si vende al kg),
   1 per i cabaret (pezzi interi). Le quantità finiscono subito in config.extras,
   così il totale mostrato è già quello vero. */
function ProposteExtra({ config, set, staff, listino, total, onOrdinaSenza, onOrdinaCon, onChiudi }) {
  const extras = config.extras || {};
  const qtyOf = (id) => Number(extras[id]) || 0;
  const stepOf = (e) => (Number(e.step) > 0 ? Number(e.step) : 1);

  const setQty = (e, q) => {
    const v = Math.round(Math.max(0, Math.min(MAX_EXTRA_QTY, q)) * 100) / 100;
    // Forma a funzione: due tocchi ravvicinati su due extra non si mangiano
    // a vicenda (il 3D dietro è pesante e può ritardare il render).
    set((c) => {
      const next = { ...(c.extras || {}) };
      if (v > 0) next[e.id] = v;
      else delete next[e.id];
      return { extras: next };
    });
  };

  const scelti = chosenExtras(extras, listino);
  const totaleExtra = scelti.reduce((s, e) => s + e.total, 0);

  // Esc chiude solo questa finestra (il configuratore sotto resta aperto: il
  // suo listener si mette da parte finché la proposta è a video) e il riquadro
  // prende il fuoco, così si naviga subito con Tab.
  const boxRef = useRef(null);
  // Il fuoco si dà UNA volta sola, all'apertura: rifarlo a ogni render lo
  // ruberebbe ai pulsanti +/- a ogni tocco.
  useEffect(() => {
    boxRef.current?.focus();
  }, []);
  // La proposta è entrata in scena: non è un click, quindi si conta da codice.
  useEffect(() => {
    tracciaUnaVolta(EV.TORTA_EXTRA_VISTI);
  }, []);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onChiudi();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onChiudi]);

  return (
    <div
      className="extra-pop-overlay"
      onClick={(e) => e.target === e.currentTarget && onChiudi()}
    >
      <div
        className="extra-pop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="extra-pop-title"
        tabIndex={-1}
        ref={boxRef}
      >
        <button type="button" className="extra-pop-x" onClick={onChiudi} aria-label="Chiudi la proposta">
          <X size={18} />
        </button>

        <span className="extra-pop-kicker">Un’ultima golosità 🍫</span>
        <h3 id="extra-pop-title">Vuoi aggiungere altro?</h3>
        <p className="extra-pop-lead">
          Li prepariamo insieme alla torta e li trovi pronti al ritiro. Nessun obbligo:
          puoi ordinare solo la torta.
        </p>

        <div className="extra-pop-list">
          {listino.map((e) => {
            const qty = qtyOf(e.id);
            const passo = stepOf(e);
            const prezzo = Number(e.price ?? 0);
            return (
              <div key={e.id} className={`extra-pop-item ${qty > 0 ? 'selected' : ''}`}>
                <div className="extra-pop-info">
                  <span className="extra-pop-name">{e.name}</span>
                  {e.desc && <span className="extra-pop-desc">{e.desc}</span>}
                  <span className="extra-pop-price">
                    €{prezzo.toFixed(2)}{e.unit ? ` ${e.unit}` : ''}
                  </span>
                </div>
                <div className="extra-pop-side">
                  <div className="qty-row">
                    <button
                      type="button"
                      className="qty-btn"
                      onClick={() => setQty(e, qty - passo)}
                      disabled={qty <= 0}
                      aria-label={`Togli ${e.name}`}
                    >
                      −
                    </button>
                    <span className="qty-value">{qty > 0 ? fmtQty(qty) : '—'}</span>
                    <button
                      type="button"
                      className="qty-btn"
                      onClick={() => setQty(e, qty + passo)}
                      disabled={qty >= MAX_EXTRA_QTY}
                      aria-label={`Aggiungi ${e.name}`}
                    >
                      +
                    </button>
                  </div>
                  {qty > 0 && (
                    <div className="extra-total">
                      {fmtQty(qty)} × €{prezzo.toFixed(2)} = €{(qty * prezzo).toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="extra-pop-total">
          <span className="extra-pop-total-label">
            {scelti.length
              ? `Extra aggiunti: €${totaleExtra.toFixed(2)}`
              : 'Niente di aggiunto, per ora.'}
          </span>
          <span className="extra-pop-total-order">
            Totale ordine <strong>€{total.toFixed(2)}</strong>
          </span>
        </div>

        <div className="extra-pop-actions">
          <button type="button" className="extra-pop-skip" data-ev="torta_extra_rifiutati" onClick={onOrdinaSenza}>
            No grazie, {staff ? "crea l'ordine" : 'ordina'}
          </button>
          <button
            type="button"
            className="extra-pop-add"
            data-ev="torta_extra_aggiunti"
            onClick={onOrdinaCon}
            disabled={!scelti.length}
          >
            {staff
              ? "Aggiungi e crea l'ordine"
              : `Aggiungi e ordina €${total.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// Anteprima dello stile: i corsivi hanno l'occhio più piccolo, si compensa.
const fontPreviewSize = (family) =>
  /caveat/i.test(family || '') ? '1.4rem' : /fraunces/i.test(family || '') ? '1.15rem' : '1rem';

function StepMessage({ config, set, staff }) {
  const cake = useCakeData();
  const { cakeOccasions } = cake;
  // Stili della scritta dalla tabella `scritte` (con copia di sicurezza).
  const fonts = scritteOf(cake);
  const currentFont = normalizeFont(config.messageFont); // ordini vecchi: id rimappato
  return (
    <>
      <StepHeader stepKey="message" title="Scritta, foto e candelina" lead="Una frase importante? Aggiungi anche una foto: la stampiamo su cialda alimentare e la posiamo sulla torta." />

      <div className="cfg-field">
        <label>Foto da stampare (opzionale, +€5)</label>
        <PhotoUploader
          value={config.photo}
          onChange={(p) => set({ photo: p })}
          transform={config.photoTransform}
          onTransform={(tf) => set({ photoTransform: tf })}
          shape={config.shape}
        />
        <p className="hint">JPG o PNG, max 4 MB. Stampata su cialda alimentare commestibile.</p>
      </div>

      <div className="cfg-field">
        <label>Scritta sulla torta (max {MAX_MESSAGE} caratteri)</label>
        <input
          type="text"
          maxLength={MAX_MESSAGE}
          placeholder="Es. Buon compleanno Anna!"
          value={config.message}
          onChange={(e) => set({ message: e.target.value })}
        />
        <p className="hint">{config.message.length}/{MAX_MESSAGE} caratteri</p>
      </div>

      {config.message && (
        <div className="cfg-field">
          <label>Stile della scritta</label>
          <div className="font-grid">
            {fonts.map((f) => (
              <button
                key={f.id}
                className={`font-card ${currentFont === f.id ? 'selected' : ''}`}
                onClick={() => set({ messageFont: f.id })}
              >
                <span
                  className="font-preview"
                  style={{
                    fontFamily: f.family,
                    fontSize: fontPreviewSize(f.family),
                    fontStyle: f.italic ? 'italic' : 'normal',
                    fontWeight: f.uppercase ? 700 : 600,
                    letterSpacing: f.uppercase ? '0.08em' : 'normal',
                    textTransform: f.uppercase ? 'uppercase' : 'none',
                  }}
                >
                  {f.sample || 'Auguri!'}
                </span>
                <span className="font-label">{f.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="cfg-field">
        <label>Candelina</label>
        <div className="toggle-row">
          <button
            className={`toggle-pill ${!config.candle ? 'active' : ''}`}
            onClick={() => set({ candle: false })}
          >
            No, grazie
          </button>
          <button
            className={`toggle-pill ${config.candle ? 'active' : ''}`}
            onClick={() => set({ candle: true })}
          >
            Aggiungi candelina (in regalo)
          </button>
        </div>
      </div>

      <div className="cfg-field">
        <label>Occasione</label>
        <div className="toggle-row">
          {cakeOccasions.map((o) => (
            <button
              key={o}
              className={`toggle-pill ${config.occasion === o ? 'active' : ''}`}
              onClick={() => set({ occasion: config.occasion === o ? '' : o })}
            >
              {/* "Nessuna" non è un'occasione triste: le diamo comunque un cuore. */}
              {o === 'Nessuna' ? '💙 Nessuna' : o}
            </button>
          ))}
        </div>
        {/* Si sommano all'occasione: una torta di compleanno può benissimo essere
            anche una sorpresa e un regalo. Per il laboratorio cambia parecchio. */}
        <div className="toggle-row" style={{ marginTop: '0.7rem' }}>
          <button
            className={`toggle-pill ${config.surprise ? 'active' : ''}`}
            onClick={() => set({ surprise: !config.surprise })}
          >
            🤫 È una sorpresa
          </button>
          <button
            className={`toggle-pill ${config.gift ? 'active' : ''}`}
            onClick={() => set({ gift: !config.gift })}
          >
            🎁 È un regalo
          </button>
        </div>
      </div>
    </>
  );
}

function StepDetails({ config, set, staff, orari, earliestISO, earliestMin }) {
  const minDate = earliestISO;
  const phoneInvalid = config.phone.trim() && !phoneOk(config.phone);
  const emailInvalid = config.email.trim() && !emailOk(config.email);
  const allSlots = pickupSlots(config.pickupDate, orari);
  // Sul primo giorno utile mostra solo le fasce oltre il preavviso minimo (5 ore lavorative).
  const slots = config.pickupDate === earliestISO
    ? allSlots.filter((s) => timeToMin(s) >= earliestMin)
    : allSlots;
  return (
    <>
      <StepHeader
        stepKey="details"
        title={staff ? 'Dati cliente' : 'I tuoi dati'}
        lead={staff
          ? 'Inserisci i dati del cliente e la data di ritiro (da oggi in poi).'
          : 'Per le torte serve un minimo di 5 ore lavorative di preavviso. Ti contattiamo per confermare.'}
      />
      <div className="cfg-field-row">
        <div className="cfg-field">
          <label>Nome e cognome *</label>
          <input
            type="text"
            placeholder="Mario Rossi"
            value={config.name}
            onChange={(e) => set({ name: e.target.value })}
            required
          />
        </div>
        <div className="cfg-field">
          <label>Telefono *</label>
          <input
            type="tel"
            placeholder="348 5556677"
            value={config.phone}
            onChange={(e) => set({ phone: e.target.value })}
            required
          />
          {phoneInvalid && <p className="hint" style={{ color: '#b03a3a' }}>Numero non valido: servono 10 cifre (es. 348 5556677).</p>}
        </div>
      </div>

      <div className="cfg-field">
        <label>Email *</label>
        <input
          type="email"
          placeholder="nome@esempio.it"
          value={config.email}
          onChange={(e) => set({ email: e.target.value })}
          required
        />
        <p className="hint" style={emailInvalid ? { color: '#b03a3a' } : undefined}>
          {emailInvalid ? "Inserisci un'email valida." : 'Ti invieremo qui la conferma dell’ordine.'}
        </p>
        {/* Avviso promemoria: obbligatorio informare, visto che la mail dell'anno
            dopo è promozionale. La disiscrizione è in ogni promemoria. */}
        {config.occasion === 'Compleanno' && !staff && (
          <p className="hint cfg-reminder-note">
            🎂 Tra un anno ti scriveremo qui per ricordarti il compleanno, con la torta che hai
            scelto oggi. Ti basterà un clic per non riceverlo più.
          </p>
        )}
      </div>

      <div className="cfg-field">
        <label>Come vuoi la torta?</label>
        <div className="toggle-row">
          <button
            type="button"
            className={`toggle-pill ${!config.delivery ? 'active' : ''}`}
            data-ev="torta_ritiro"
            onClick={() => set({ delivery: false })}
          >
            🏪 Ritiro in gelateria
          </button>
          <button
            type="button"
            className={`toggle-pill ${config.delivery ? 'active' : ''}`}
            data-ev="torta_domicilio"
            onClick={() => set({ delivery: true })}
          >
            🛵 Consegna a domicilio (+ €{DELIVERY_FEE})
          </button>
        </div>
      </div>

      {config.delivery && (
        <div className="cfg-field">
          <label>Indirizzo di consegna *</label>
          <textarea
            placeholder="Via e numero civico, città, campanello…"
            value={config.deliveryAddress}
            onChange={(e) => set({ deliveryAddress: e.target.value })}
            required
          />
          <div className="delivery-zones">
            <span className="delivery-zones-title">Zone servite:</span>
            <ul>
              {DELIVERY_ZONES.map((z) => (
                <li key={z}>{z}</li>
              ))}
            </ul>
            <p className="hint">Se il tuo indirizzo è fuori zona ti ricontattiamo per accordarci.</p>
          </div>
        </div>
      )}

      {/* Dove verrà mangiata: i titolari lo vogliono sapere per ogni ordine.
          Va risposto, come il ritiro/consegna: senza, "Avanti" resta spento. */}
      <div className="cfg-field">
        <label>Dove verrà mangiata la torta? *</label>
        <div className="toggle-row">
          <button
            type="button"
            className={`toggle-pill ${config.inLocale === false ? 'active' : ''}`}
            onClick={() => set({ inLocale: false })}
          >
            🏠 A casa
          </button>
          <button
            type="button"
            className={`toggle-pill ${config.inLocale === true ? 'active' : ''}`}
            onClick={() => set({ inLocale: true })}
          >
            🍽️ In un locale (ristorante, pizzeria…)
          </button>
        </div>
      </div>

      <div className="cfg-field-row">
        <div className="cfg-field">
          <label>{config.delivery ? 'Giorno di consegna *' : 'Giorno di ritiro *'}</label>
          <input
            type="date"
            min={minDate}
            value={config.pickupDate}
            onChange={(e) => set({ pickupDate: e.target.value, pickupTime: '' })}
            required
          />
          <p className="hint">{staff ? 'Da oggi in poi (anche oggi stesso).' : 'Minimo 5 ore lavorative da adesso.'}</p>
        </div>
        <div className="cfg-field">
          <label>{config.delivery ? 'Ora di consegna *' : 'Ora di ritiro *'}</label>
          <select
            value={config.pickupTime}
            onChange={(e) => set({ pickupTime: e.target.value })}
            disabled={!config.pickupDate || slots.length === 0}
            required
          >
            <option value="">
              {!config.pickupDate ? 'Scegli prima il giorno' : slots.length ? 'Scegli un orario…' : 'Chiuso quel giorno'}
            </option>
            {slots.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <p className="hint">Fasce ogni ora, negli orari di apertura.</p>
        </div>
      </div>

      <div className="cfg-field">
        <label>Note aggiuntive</label>
        <textarea
          placeholder="Allergie, intolleranze, preferenze decorative…"
          value={config.notes}
          onChange={(e) => set({ notes: e.target.value })}
        />
        <div className="cfg-avviso cfg-avviso-dolce" role="note">
          <span className="cfg-avviso-ico" aria-hidden="true">💙</span>
          <div>
            <p>
              Faremo di tutto per assecondare le tue richieste. L'ordine potrà subire modifiche
              secondo le disponibilità.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Voci del riepilogo che si popola mentre si sceglie.
 * Restituisce solo quello che è stato DAVVERO scelto: finché il cliente non ha
 * deciso, la riga non c'è (un riepilogo pieno di "—" non aiuta nessuno).
 * L'ordine segue quello dei passi, così si legge come il percorso fatto.
 */
function vociRiepilogo(config, cake, steps, step) {
  const nomeDi = (list, id) => (list || []).find((x) => x.id === id)?.name || '';
  const v = [];
  // Una voce compare solo quando si è arrivati al passo che la decide: forma e
  // base hanno un valore di partenza, ma finché il cliente non ci passa non è
  // una SUA scelta e nel riepilogo sarebbe solo rumore.
  const visto = (stepKey) => {
    const i = (steps || []).indexOf(stepKey);
    return i !== -1 && i <= step;
  };
  const push = (stepKey, k, val) => { if (val && visto(stepKey)) v.push([k, val]); };

  push('type', 'Tipo', nomeDi(cake.cakeTypes, config.type));
  push('size', 'Dimensione', (cake.cakeSizes || []).find((s) => s.id === config.sizeId)?.label);

  if (config.noAllergies) push('allergies', 'Allergie', 'nessuna');
  else if (config.allergies?.length) {
    push('allergies', 'Allergie', config.allergies
      .map((id) => (cake.cakeAllergens || []).find((a) => a.id === id)?.name || id)
      .join(', '));
  }
  if (config.diets?.length) {
    push('allergies', 'Preferenze', config.diets.map((id) => DIETE.find((d) => d.id === id)?.name || id).join(', '));
  }

  push('shape', 'Forma', nomeDi(cake.cakeShapes, config.shape));
  push('base', 'Base', nomeDi(cake.cakeBases, config.baseId));
  push('crumble', 'Crumble', nomeDi(cake.cakeCrumbles, config.crumbleId));
  // Gli strati si possono ripetere: si elencano nell'ordine scelto.
  if (config.flavors?.length) push('flavors', 'Strati', config.flavors.map((f) => f.name).join(' · '));
  if (config.fillingId && config.fillingId !== 'nessuna') push('filling', 'Inserto', nomeDi(cake.cakeFillings, config.fillingId));
  push('covering', 'Copertura', nomeDi(cake.cakeCoverings, config.coveringId));
  if (config.decorations?.length) {
    push('decoration', 'Decorazioni', config.decorations
      .map((id) => {
        const col = (config.decorationColors || {})[id];
        return nomeDi(cake.cakeDecorations, id) + (col ? ` (${col})` : '');
      })
      .join(' · '));
  }
  if (config.message) push('message', 'Scritta', `"${config.message}"`);
  if (config.photo) push('message', 'Foto', 'su cialda');
  if (config.candle) push('message', 'Candelina', 'sì, in regalo');
  push('message', 'Occasione', config.occasion);
  push('message', 'Attenzione', [config.surprise && 'è una sorpresa', config.gift && 'è un regalo'].filter(Boolean).join(' · '));
  if (config.pickupDate) {
    push('details', config.delivery ? 'Consegna' : 'Ritiro', `${config.pickupDate}${config.pickupTime ? ` alle ${config.pickupTime}` : ''}`);
  }
  push('details', 'Si mangia', testoDoveSiMangia(config.inLocale));
  return v;
}

/** Elenco del riepilogo (usato sia nella colonna sinistra sia nella barretta). */
function RiepilogoVivo({ config, steps, step }) {
  const cake = useCakeData();
  const voci = vociRiepilogo(config, cake, steps, step);
  if (!voci.length) {
    return <p className="riepilogo-vuoto">Le tue scelte compariranno qui, una alla volta.</p>;
  }
  return (
    <dl className="riepilogo-lista">
      {voci.map(([k, val]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{val}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Barretta in fondo allo schermo (solo telefono): si tocca e si apre. */
function RiepilogoBarra({ config, total, staff, steps, step }) {
  const [aperto, setAperto] = useState(false);
  const cake = useCakeData();
  const n = vociRiepilogo(config, cake, steps, step).length;
  return (
    <>
      <button
        type="button"
        className="riepilogo-barra"
        onClick={() => setAperto((a) => !a)}
        aria-expanded={aperto}
      >
        <span className="riepilogo-barra-tit">
          {aperto ? '▼' : '▲'} La tua torta{n > 0 ? ` · ${n} ${n === 1 ? 'scelta' : 'scelte'}` : ''}
        </span>
        <span className="riepilogo-barra-prezzo">€{total.toFixed(2)}</span>
      </button>
      {aperto && (
        <div className="riepilogo-sheet" role="dialog" aria-label="Riepilogo della tua torta">
          <div className="riepilogo-sheet-head">
            <strong>La tua torta</strong>
            <button type="button" onClick={() => setAperto(false)} aria-label="Chiudi il riepilogo">
              <X size={18} />
            </button>
          </div>
          <div className="riepilogo-sheet-body">
            <RiepilogoVivo config={config} steps={steps} step={step} />
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Campo del codice sconto, in fondo al riepilogo.
 * Il codice NON si verifica qui dentro con una lista scaricata dal browser
 * (sarebbe come lasciare l'elenco degli sconti in vetrina): si chiede al
 * database, che risponde solo su quel codice. E comunque l'importo vero lo
 * ricalcola il server al momento del pagamento.
 */
function CampoSconto({ config, set, total }) {
  const [codice, setCodice] = useState(config.sconto?.codice || '');
  const [stato, setStato] = useState(null); // { ok, messaggio }
  const [busy, setBusy] = useState(false);

  async function applica() {
    const c = codice.trim();
    if (!c) return;
    if (!supabase) {
      setStato({ ok: false, messaggio: 'Non riesco a verificare il codice adesso.' });
      return;
    }
    setBusy(true);
    setStato(null);
    const { data, error } = await supabase.rpc('verifica_sconto', { p_codice: c, p_totale: total });
    setBusy(false);
    if (error) {
      setStato({ ok: false, messaggio: 'Non riesco a verificare il codice adesso. Riprova.' });
      return;
    }
    if (!data?.valido) {
      set({ sconto: null });
      setStato({ ok: false, messaggio: data?.motivo || 'Codice non valido.' });
      // Delle statistiche esce SOLO l'esito: il codice non viaggia mai (alcuni
      // sono nominativi).
      traccia(EV.TORTA_SCONTO_KO);
      return;
    }
    set({ sconto: { codice: data.codice, tipo: data.tipo, valore: data.valore, descrizione: data.descrizione } });
    setStato({ ok: true, messaggio: `Codice applicato: −€${Number(data.sconto).toFixed(2)}` });
    traccia(EV.TORTA_SCONTO_OK);
  }

  function togli() {
    set({ sconto: null });
    setCodice('');
    setStato(null);
  }

  return (
    <div className="cfg-field sconto-box">
      <label htmlFor="codice-sconto">Hai un codice sconto?</label>
      <div className="sconto-riga">
        <input
          id="codice-sconto"
          type="text"
          value={codice}
          onChange={(e) => setCodice(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applica())}
          placeholder="Es. ESTATE10"
          autoComplete="off"
          spellCheck="false"
          disabled={!!config.sconto || busy}
        />
        {config.sconto ? (
          <button type="button" className="cfg-btn cfg-btn-back" onClick={togli}>Togli</button>
        ) : (
          <button type="button" className="cfg-btn cfg-btn-next" onClick={applica} disabled={busy || !codice.trim()}>
            {busy ? 'Verifico…' : 'Applica'}
          </button>
        )}
      </div>
      {stato && (
        <p className={stato.ok ? 'sconto-ok' : 'sconto-ko'}>
          {stato.ok ? '✅ ' : '⚠️ '}{stato.messaggio}
        </p>
      )}
    </div>
  );
}

function StepReview({ config, total, sconto = 0, set, staff }) {
  const cake = useCakeData();
  const { cakeShapes, cakeTypes, cakeSizes, cakeBases, cakeCrumbles = [], cakeFillings, cakeCoverings, cakeDecorations, cakeExtras = [], cakeAllergens } = cake;
  const allergNames = (config.allergies || []).map((id) => (cakeAllergens || []).find((a) => a.id === id)?.name || id);
  const type = cakeTypes.find((t) => t.id === config.type);
  const shape = cakeShapes.find((sh) => sh.id === config.shape);
  const size = cakeSizes.find((s) => s.id === config.sizeId);
  const base = cakeBases.find((b) => b.id === config.baseId);
  const crumble = config.baseId === CRUMBLE_BASE_ID ? cakeCrumbles.find((c) => c.id === config.crumbleId) : null;
  const filling = cakeFillings.find((f) => f.id === config.fillingId);
  const covering = cakeCoverings.find((c) => c.id === config.coveringId);
  // Decorazioni scelte: si elencano tutte, ognuna con il suo colore.
  const decos = chosenDecorations(config.decorations, cakeDecorations);
  const scritta = scritteOf(cake).find((f) => f.id === normalizeFont(config.messageFont));
  const extras = chosenExtras(config.extras, cakeExtras);
  return (
    <>
      <StepHeader stepKey="review" title="Riepilogo" lead={staff ? "Controlla i dettagli e crea l'ordine: finirà tra gli ordini da fare." : 'Controlla tutto e conferma il tuo ordine.'} />
      <div className="summary-box">
        <dl>
          {allergNames.length > 0 && (<><dt>Allergeni</dt><dd>{allergNames.join(', ').toUpperCase()}</dd></>)}
          <dt>Tipo</dt><dd>{type?.name}</dd>
          <dt>Forma</dt><dd>{shape?.name}</dd>
          <dt>Dimensione</dt><dd>{size?.label} · Ø {size?.diameter}cm</dd>
          <dt>Base</dt><dd>{base?.name}</dd>
          {crumble && (<><dt>Crumble</dt><dd>{crumble.name}</dd></>)}
          <dt>Strati</dt><dd>{config.flavors.map((f) => f.name).join(' · ') || '—'}</dd>
          {filling && filling.id !== 'nessuna' && (<><dt>Inserto</dt><dd>{filling.name}</dd></>)}
          <dt>Copertura</dt><dd>{covering?.name}</dd>
          <dt>{decos.length > 1 ? 'Decorazioni' : 'Decorazione'}</dt>
          <dd>{decorationsText(decos, config.decorationColors)}</dd>
          {extras.length > 0 && (<><dt>Extra</dt><dd>{extras.map(extraLabel).join(' · ')}</dd></>)}
          {config.message && (<><dt>Scritta</dt><dd>"{config.message}"{scritta ? ` · ${scritta.name}` : ''}</dd></>)}
          {config.photo && (<><dt>Foto</dt><dd>su cialda alimentare</dd></>)}
          {config.candle && (<><dt>Candelina</dt><dd>sì</dd></>)}
          {config.occasion && (<><dt>Occasione</dt><dd>{config.occasion}</dd></>)}
          {config.sconto && (<><dt>Codice sconto</dt><dd>{config.sconto.codice}</dd></>)}
          {(config.surprise || config.gift) && (
            <><dt>Attenzione</dt><dd>{[config.surprise && 'è una sorpresa', config.gift && 'è un regalo'].filter(Boolean).join(' · ')}</dd></>
          )}
          <dt>{config.delivery ? 'Consegna' : 'Ritiro'}</dt><dd>{config.pickupDate || '—'}{config.pickupTime ? ` alle ${config.pickupTime}` : ''}</dd>
          {config.delivery && (<><dt>Indirizzo</dt><dd>{config.deliveryAddress || '—'}</dd></>)}
          {config.inLocale !== null && (<><dt>Si mangia</dt><dd>{testoDoveSiMangia(config.inLocale)}</dd></>)}
          <dt>Cliente</dt><dd>{config.name}</dd>
          <dt>Tel</dt><dd>{config.phone}</dd>
          {config.notes && (<><dt>Note</dt><dd>{config.notes}</dd></>)}
        </dl>
      </div>
      <div className="summary-box" style={{ background: 'var(--cream-warm)', borderColor: 'rgba(124,183,215,0.2)' }}>
        {sconto > 0 && (
          <p style={{ margin: '0 0 0.3rem', fontSize: '0.9rem', color: 'var(--grey)' }}>
            Prezzo pieno €{total.toFixed(2)} — codice <strong>{config.sconto?.codice}</strong>: −€{sconto.toFixed(2)}
          </p>
        )}
        <p style={{ margin: 0, fontSize: '1rem', color: 'var(--ink)' }}>
          <strong style={{ color: 'var(--violet-deep)' }}>Prezzo totale: €{(total - sconto).toFixed(2)}</strong>
        </p>
      </div>

      {/* Il codice sconto si mette alla fine, quando il prezzo è già sotto agli
          occhi: è lì che uno si ricorda di averne uno. */}
      <CampoSconto config={config} set={set} total={total} />
    </>
  );
}

const SOCIALS = [
  { id: 'ig', label: 'Instagram', href: 'https://www.instagram.com/gelateriapuntogicarpi/', Icon: Instagram, ev: 'instagram_post_ordine' },
  { id: 'fb', label: 'Facebook', href: 'https://www.facebook.com/gelateriapuntogicarpi', Icon: Facebook, ev: 'facebook_post_ordine' },
  { id: 'wa', label: 'WhatsApp', href: 'https://api.whatsapp.com/send?phone=393203306009', Icon: MessageCircle, ev: 'whatsapp_post_ordine' },
];

function SuccessView({ name, onClose, staff, delivery }) {
  const chiusura = delivery
    ? 'Ti consegneremo la torta all’indirizzo e all’orario indicato 🛵'
    : 'Ti aspettiamo in gelateria per il ritiro 🍰';
  return (
    <div className="cfg-success">
      <div className="check"><Check size={36} /></div>
      <h2>{staff ? 'Ordine creato!' : 'Ordine confermato! 🎉'}</h2>
      <p className="lead" style={{ maxWidth: 420 }}>
        {staff
          ? `Ordine per ${name?.split(' ')[0] || 'il cliente'} salvato: lo trovi tra gli ordini "Da fare".`
          : `Grazie ${name?.split(' ')[0] || ''}! Il tuo ordine è stato confermato e inviato alla gelateria. ${chiusura}`}
      </p>
      {!staff && (
        <div className="cfg-socials">
          <span className="cfg-socials-label">Seguici e taggaci nella tua festa 🎉</span>
          <div className="cfg-socials-row">
            {SOCIALS.map(({ id, label, href, Icon, ev }) => (
              <a key={id} className="cfg-social" href={href} target="_blank" rel="noopener noreferrer" aria-label={label} data-ev={ev}>
                <Icon size={18} /> {label}
              </a>
            ))}
          </div>
        </div>
      )}
      <button className="cfg-btn cfg-btn-next" onClick={onClose} style={{ marginTop: '1rem' }}>
        {staff ? 'Chiudi' : 'Torna al sito'}
      </button>
    </div>
  );
}

const DEFAULT_PHOTO_TF = { zoom: 1, posX: 50, posY: 50 };

const photoAspectFor = (shape) =>
  shape === 'rettangolare' ? 1.85 / 1.1 : shape === 'cuore' ? 2 / 1.74 : 1;

function PhotoUploader({ value, onChange, transform, onTransform, shape }) {
  const t = transform || DEFAULT_PHOTO_TF;
  const aspect = photoAspectFor(shape);
  const cropKind = shape === 'cuore' ? 'heart' : shape === 'quadrata' || shape === 'rettangolare' ? 'rect' : 'circle';
  const cropRef = useRef(null);
  const [dim, setDim] = useState(null);

  useEffect(() => {
    if (!value) { setDim(null); return; }
    const im = new Image();
    im.onload = () => setDim({ w: im.naturalWidth, h: im.naturalHeight });
    im.src = value;
  }, [value]);

  const onFile = (file) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      alert('Foto troppo grande (max 4 MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Risoluzione utile anche per la stampa sulla cialda, restando sotto il
        // limite di 2 MB del bucket grazie alla conversione JPEG.
        const max = 1600;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = img.width * scale;
        const h = img.height * scale;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        onChange(canvas.toDataURL('image/jpeg', 0.85));
        onTransform({ ...DEFAULT_PHOTO_TF });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const clamp = (v) => Math.max(0, Math.min(100, v));
  const startDrag = (e) => {
    if (!cropRef.current) return;
    e.preventDefault();
    const rect = cropRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const sPosX = t.posX;
    const sPosY = t.posY;
    const z = t.zoom;
    const move = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      onTransform({
        zoom: z,
        posX: clamp(sPosX - (dx / rect.width) * 100 / z),
        posY: clamp(sPosY - (dy / rect.height) * 100 / z),
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  if (value) {
    // dimensioni per riprodurre lo stesso ritaglio (e aspetto) della torta
    let bgSize = 'cover';
    if (dim) {
      const a = dim.w / dim.h;
      const winWpx = (a >= aspect ? dim.h * aspect : dim.w) / t.zoom;
      bgSize = `${(dim.w / winWpx) * 100}% auto`;
    }
    return (
      <div className="photo-editor">
        {cropKind === 'heart' && (
          <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
            <clipPath id="photoHeartClip" clipPathUnits="objectBoundingBox">
              <path d="M0.5,1 C0.35,0.85 0,0.62 0,0.35 C0,0.13 0.22,0.04 0.38,0.16 C0.45,0.21 0.5,0.28 0.5,0.33 C0.5,0.28 0.55,0.21 0.62,0.16 C0.78,0.04 1,0.13 1,0.35 C1,0.62 0.65,0.85 0.5,1 Z" />
            </clipPath>
          </svg>
        )}
        <div
          className={`photo-crop ${cropKind}`}
          ref={cropRef}
          onPointerDown={startDrag}
          style={{
            width: 220,
            height: 220 / aspect,
            backgroundImage: `url(${value})`,
            backgroundSize: bgSize,
            backgroundPosition: `${t.posX}% ${t.posY}%`,
            backgroundRepeat: 'no-repeat',
          }}
        />
        <input
          type="range"
          className="photo-zoom"
          min="1"
          max="3"
          step="0.02"
          value={t.zoom}
          onChange={(e) => onTransform({ ...t, zoom: parseFloat(e.target.value) })}
          aria-label="Zoom foto"
        />
        <p className="hint" style={{ textAlign: 'center' }}>
          Trascina per posizionare · slider per lo zoom
        </p>
        <button type="button" className="toggle-pill" onClick={() => onChange(null)}>
          Rimuovi foto
        </button>
      </div>
    );
  }

  return (
    <label
      className="photo-drop"
      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag'); }}
      onDragLeave={(e) => e.currentTarget.classList.remove('drag')}
      onDrop={(e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('drag');
        onFile(e.dataTransfer.files?.[0]);
      }}
    >
      <input
        type="file"
        accept="image/*"
        onChange={(e) => onFile(e.target.files?.[0])}
        style={{ display: 'none' }}
      />
      <span className="photo-drop-icon" aria-hidden="true">🖼️</span>
      <span className="photo-drop-label">Tocca per caricare una foto</span>
      <span className="photo-drop-hint">o trascinala qui</span>
    </label>
  );
}
