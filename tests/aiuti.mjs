// Aiuti comuni dei test dei pagamenti (node --test tests/*.test.mjs).
//
// tests/fixtures/listino.json = il listino VERO al 2026-10-09: tutte le righe
// delle 14 tabelle (anche le spente), lette con GET e la chiave pubblica,
// come le legge caricaListino (select('*')). È il menù pubblico, nessun dato
// personale. Per aggiornarlo basta rileggere le stesse tabelle.
import { readFileSync } from 'node:fs';

export const LISTINO = JSON.parse(readFileSync(new URL('./fixtures/listino.json', import.meta.url), 'utf8'));
export const OGGI = '2026-10-09';
export const SUPABASE = 'https://bqmoxdeagqpzvcblpcbm.supabase.co';
export const FOTO = (ruolo) => `${SUPABASE}/storage/v1/object/public/torte/2026-10/0b1c2d3e-aaaa-bbbb-cccc-1234567890ab-${ruolo}.jpg`;

/** Copia profonda del listino, da modificare in un test senza toccare gli altri. */
export const listino = () => JSON.parse(JSON.stringify(LISTINO));

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const accesa = (r) => r.attivo === true;
const splitList = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);

/**
 * Il listino come lo vede il SITO: stessa lettura e stessa forma di
 * fetchCakeOptions in src/data/live.js (solo le righe accese e i campi che
 * servono a prezzo e riepilogo).
 */
export function listinoDelSito(L = LISTINO) {
  const perTorte = L.allergeni_prodotti.filter((r) => accesa(r) && r.per_torte);
  return {
    cakeTypes: L.tipi_torta.filter(accesa).map((t) => ({ id: t.id, name: t.nome, basePrice: num(t.prezzo_base) })),
    cakeSizes: L.dimensioni.filter(accesa).map((s) => ({
      id: s.id, label: s.etichetta, diameter: num(s.diametro), priceDelta: num(s.supplemento),
      misure: s.misure && typeof s.misure === 'object' ? s.misure : {}, alta: !!s.alta,
    })),
    cakeShapes: L.forme.filter(accesa).map((s) => ({
      id: s.id, name: s.nome, priceDelta: num(s.supplemento),
      ...(s.per_normali !== undefined ? { perNormali: s.per_normali !== false } : {}),
      ...(s.per_alte !== undefined ? { perAlte: s.per_alte !== false } : {}),
    })),
    cakeBases: L.basi.filter(accesa).map((b) => ({ id: b.id, name: b.nome, desc: b.descrizione || '', priceDelta: num(b.supplemento) })),
    cakeCrumbles: L.crumble.filter(accesa).map((c) => ({ id: c.id, name: c.nome, priceDelta: num(c.supplemento) })),
    cakeFillings: L.farciture.filter(accesa).map((f) => ({ id: f.id, name: f.nome, priceDelta: num(f.supplemento) })),
    cakeCoverings: L.coperture.filter(accesa).map((c) => ({ id: c.id, name: c.nome, priceDelta: num(c.supplemento) })),
    cakeDecorations: L.decorazioni.filter(accesa).map((d) => ({
      id: d.id, name: d.nome, priceDelta: num(d.supplemento), colorChoice: !!d.scelta_colore, colors: splitList(d.colori),
    })),
    cakeExtras: L.extra.filter(accesa).map((e) => ({
      id: e.id, name: e.nome, price: num(e.prezzo), unit: e.unita || '', step: num(e.passo ?? e.step) || (/kg/i.test(e.unita || '') ? 0.5 : 1),
    })),
    cakeFlavors: perTorte.length
      ? perTorte.map((r) => ({ name: r.gusto, color: r.colore || '#f5d97a' }))
      : L.gusti_torte.filter(accesa).map((f) => ({ name: f.nome, color: f.colore })),
    cakeScritte: L.scritte.filter(accesa).map((s) => ({ id: s.id, name: s.nome })),
    cakeOccasions: L.occasioni.filter(accesa).map((o) => o.nome).filter(Boolean),
    cakeAllergens: L.allergeni.filter(accesa).map((a) => ({ id: a.id, name: a.nome })),
  };
}

/** Una torta normale e completa, come la manda il configuratore. */
export const tortaBase = () => ({
  type: 'semifreddo', sizeId: '10', shape: 'tonda', baseId: 'classica', crumbleId: '',
  allergies: ['latte'], noAllergies: false, diets: [],
  flavors: [{ name: 'Crema', color: '#f5d97a', allergeni: ['latte', 'uova'] }, { name: 'Nocciola', color: '#8a5a3b' }],
  fillingId: 'nutella', coveringId: 'panna',
  decorations: ['fiocchi', 'macarons'], decorationColors: { fiocchi: 'Rosso' },
  extras: { 'salame-dolce': 1.5 }, message: 'Auguri Anna', messageFont: 'corsivo', candle: true,
  occasion: 'Compleanno', surprise: true, gift: false,
  photo: true, photoTransform: { zoom: 1.2, posX: 40, posY: 55 },
  pickupDate: '2026-10-12', pickupTime: '16:00', delivery: false, deliveryAddress: '', inLocale: false,
  pagamentoStaff: null, name: 'Mario Rossi', phone: '348 555 6677', email: 'mario_rossi@example.com',
  notes: 'Senza frutta secca sopra', sconto: null,
});

// ── Copia del calcolo `total` del configuratore (CakeConfigurator.jsx) ──
// Tenuta qui di proposito: il test di parità confronta il server con il
// sito. Se cambi `total` nel configuratore, cambia anche questa copia (e
// prezzoOrdine nel server).
const NO_DECO = 'nessuna';
const MAX_DECORAZIONI = 5;
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
const chosenExtras = (extras, cakeExtras) =>
  Object.entries(extras || {})
    .map(([id, q]) => {
      const e = (cakeExtras || []).find((x) => x.id === id);
      const qty = Number(q) || 0;
      return e && qty > 0 ? { ...e, qty, total: qty * (e.price ?? 0) } : null;
    })
    .filter(Boolean);
export function totaleDelSito(config, S) {
  const type = S.cakeTypes.find((t) => t.id === config.type);
  const size = S.cakeSizes.find((s) => s.id === config.sizeId);
  const base = S.cakeBases.find((b) => b.id === config.baseId);
  const crumble = config.baseId === 'crock' ? S.cakeCrumbles.find((c) => c.id === config.crumbleId) : null;
  const shape = S.cakeShapes.find((sh) => sh.id === config.shape);
  const filling = S.cakeFillings.find((f) => f.id === config.fillingId);
  const covering = S.cakeCoverings.find((c) => c.id === config.coveringId);
  const decos = chosenDecorations(config.decorations, S.cakeDecorations);
  let p =
    (type?.basePrice ?? 0) + (size?.priceDelta ?? 0) + (base?.priceDelta ?? 0) + (crumble?.priceDelta ?? 0) +
    (shape?.priceDelta ?? 0) + (filling?.priceDelta ?? 0) + (covering?.priceDelta ?? 0) +
    decos.reduce((s, d) => s + (d.priceDelta ?? 0), 0);
  if (config.photo) p += 5;
  if (config.delivery) p += 4;
  p += chosenExtras(config.extras, S.cakeExtras).reduce((s, e) => s + e.total, 0);
  return Math.round(p * 100) / 100;
}
export { chosenDecorations, chosenExtras };

/** Client Supabase finto per caricaListino/computeOrder: solo letture e rpc. */
export function supabaseFinto(L = LISTINO, { errori = {}, sconto = null } = {}) {
  const chiamate = [];
  return {
    chiamate,
    from(tabella) {
      return {
        select(colonne) {
          chiamate.push(['select', tabella, colonne]);
          if (errori[tabella]) return Promise.resolve({ data: null, error: errori[tabella] });
          if (!(tabella in L)) return Promise.resolve({ data: null, error: { code: 'PGRST205', message: `manca ${tabella}` } });
          return Promise.resolve({ data: JSON.parse(JSON.stringify(L[tabella])), error: null });
        },
      };
    },
    rpc(nome, parametri) {
      chiamate.push(['rpc', nome, parametri]);
      if (errori[nome]) return Promise.resolve({ data: null, error: errori[nome] });
      if (nome === 'verifica_sconto') return Promise.resolve({ data: sconto ? sconto(parametri) : { valido: false }, error: null });
      return Promise.resolve({ data: null, error: null });
    },
  };
}
