import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, ArrowRight, Check, Cake, Shuffle, Instagram, Facebook, MessageCircle, CreditCard } from 'lucide-react';
import { useCakeData } from '../data/CakeDataProvider';
import { supabase } from '../lib/supabase';
import { logAction } from '../lib/log';
import { sendOrderEmail } from '../lib/email';
import CakePreview from './CakePreview';

// Ordine passi: tipo → n° persone → allergie → forma → base → gusti →
// inserto (farcitura) → copertura → decorazioni → scritta → dati → riepilogo.
const STEPS = [
  'type',       // tipo torta (semifreddo / gelato / Gi Selection / Alta)
  'size',       // n° persone
  'allergies',  // allergie/intolleranze da evitare (ingrigisce le scelte dopo)
  'shape',      // forma
  'base',       // base sotto
  'flavors',    // strati / gusti
  'filling',    // inserto (farcitura tra strati)
  'covering',   // copertura esterna
  'decoration', // decorazioni topping
  'message',    // scritta + foto + candelina
  'details',    // dati cliente
  'review',     // riepilogo
];
// La torta "Alta" (id tipo 'piani') consente 4 gusti; le altre (basse) 3.
const TALL_TYPE = 'piani';
const maxFlavorsFor = (typeId) => (typeId === TALL_TYPE ? 4 : 3);
const MAX_FLAVORS = 4; // cap assoluto (usato dal contatore combinazioni)
const MAX_MESSAGE = 24; // si deve leggere bene nel centro della torta

// N° persone ricavato dalla dimensione (id o etichetta).
const personeOf = (size) => {
  if (!size) return 0;
  return parseInt(size.id, 10) || parseInt(size.label, 10) || 0;
};
// La forma rettangolare è disponibile solo da 15 persone in su.
const RECT_MIN_PERSONE = 15;

// Consegna a domicilio della torta: sovrapprezzo e zone coperte.
const DELIVERY_FEE = 4;
const DELIVERY_ZONES = [
  'Comune di Carpi (fino a Gargallo, Santa Croce, Fossoli, San Marino)',
  'Rovereto, San Possidonio, Sant’Antonio, Novi',
  'Limidi e Soliera',
];

// Un'opzione è in conflitto se contiene un allergene tra quelli da evitare.
const conflictsAllergies = (item, allergies) =>
  !!item && (item.allergeni || []).some((a) => (allergies || []).includes(a));

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

// Config iniziale calcolata dai dati disponibili (validi anche se il proprietario
// disattiva la dimensione/base/decorazione di default).
function makeInitialConfig(cake, initial = {}) {
  return {
    type: '',
    shape: cake.cakeShapes[0]?.id || 'tonda',
    sizeId: '', // scelta esplicita: sblocca "Sorprendimi" e le regole legate alle persone
    allergies: initial.allergies || [], // allergeni da evitare (ingrigiscono le scelte)
    flavors: [], // [{name,color}]
    baseId: cake.cakeBases[0]?.id || '',
    fillingId: 'nessuna',
    coveringId: '',
    decoration: cake.cakeDecorations[0]?.id || 'nessuna',
    message: '',
    messageFont: 'caveat',
    candle: false,
    occasion: '',
    photo: null,
    photoTransform: { zoom: 1, posX: 50, posY: 50 },
    pickupDate: '',
    pickupTime: '',
    delivery: false,      // consegna a domicilio (+€4) invece del ritiro
    deliveryAddress: '',  // indirizzo di consegna
    name: '',
    phone: '',
    email: '',
    notes: '',
  };
}

export default function CakeConfigurator({ open, onClose, staff = false, initial }) {
  const cake = useCakeData();
  const {
    cakeShapes,
    cakeTypes,
    cakeSizes,
    cakeFlavors,
    cakeBases,
    cakeFillings,
    cakeCoverings,
    cakeDecorations,
    cakeAllergens,
    cakeRecipes,
  } = cake;
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState(() => makeInitialConfig(cake, initial));
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const bodyRef = useRef(null);
  const [showAllerg, setShowAllerg] = useState(false);
  const [orari, setOrari] = useState([]);

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
    const onKey = (e) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Se cambiano le allergie, rimuovi automaticamente le scelte diventate incompatibili.
  useEffect(() => {
    setConfig((c) => {
      const patch = {};
      const base = cakeBases.find((b) => b.id === c.baseId);
      if (conflictsAllergies(base, c.allergies)) {
        patch.baseId = cakeBases.find((b) => !conflictsAllergies(b, c.allergies))?.id || '';
      }
      const filling = cakeFillings.find((f) => f.id === c.fillingId);
      if (conflictsAllergies(filling, c.allergies)) patch.fillingId = 'nessuna';
      const covering = cakeCoverings.find((cc) => cc.id === c.coveringId);
      if (conflictsAllergies(covering, c.allergies)) patch.coveringId = '';
      const flavors = c.flavors.filter((f) => !conflictsAllergies(f, c.allergies));
      if (flavors.length !== c.flavors.length) patch.flavors = flavors;
      return Object.keys(patch).length ? { ...c, ...patch } : c;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.allergies]);

  const set = (patch) => setConfig((c) => ({ ...c, ...patch }));

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
    const shape = cakeShapes.find((sh) => sh.id === config.shape);
    const filling = cakeFillings.find((f) => f.id === config.fillingId);
    const covering = cakeCoverings.find((c) => c.id === config.coveringId);
    let p =
      (type?.basePrice ?? 0) +
      (size?.priceDelta ?? 0) +
      (base?.priceDelta ?? 0) +
      (shape?.priceDelta ?? 0) +
      (filling?.priceDelta ?? 0) +
      (covering?.priceDelta ?? 0);
    // Gusti extra: dopo il primo, +2€ ciascuno
    if (config.flavors.length > 1) p += (config.flavors.length - 1) * 2;
    if (config.candle) p += 1;
    if (config.photo) p += 5;
    if (config.delivery) p += DELIVERY_FEE; // consegna a domicilio
    return p;
  }, [config]);

  // Allergeni: unione di gusti + base + farcitura + copertura (indicativi)
  const allergeni = useMemo(() => {
    const base = cakeBases.find((b) => b.id === config.baseId);
    const filling = cakeFillings.find((f) => f.id === config.fillingId);
    const covering = cakeCoverings.find((c) => c.id === config.coveringId);
    return [
      ...new Set([
        ...config.flavors.flatMap((f) => f.allergeni || []),
        ...(base?.allergeni || []),
        ...(filling?.allergeni || []),
        ...(covering?.allergeni || []),
      ]),
    ];
  }, [config.flavors, config.baseId, config.fillingId, config.coveringId]);

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
    switch (STEPS[step]) {
      case 'type': return !!config.type;
      case 'size': return !!config.sizeId;
      case 'allergies': return true; // opzionale
      case 'shape':
        return !!config.shape &&
          (config.shape !== 'rettangolare' || personeOf(size) >= RECT_MIN_PERSONE);
      case 'flavors': return config.flavors.length >= 1;
      case 'filling': return !!config.fillingId;
      case 'covering': return !!config.coveringId;
      case 'base': return !!config.baseId;
      case 'details': return config.name.trim() && phoneOk(config.phone) && (staff || emailOk(config.email)) && !!config.pickupDate && config.pickupDate >= earliestISO && !!config.pickupTime && (!config.delivery || config.deliveryAddress.trim());
      default: return true;
    }
  }, [step, config, staff, earliestISO, cakeSizes]);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const toggleFlavor = (f) => {
    const max = maxFlavorsFor(config.type);
    const exists = config.flavors.find((x) => x.name === f.name);
    if (exists) {
      set({ flavors: config.flavors.filter((x) => x.name !== f.name) });
    } else if (config.flavors.length < max) {
      set({ flavors: [...config.flavors, f] });
    }
  };

  const surpriseMe = () => {
    const max = maxFlavorsFor(config.type);
    const recipe = cakeRecipes[Math.floor(Math.random() * cakeRecipes.length)];
    // rispetta le allergie scelte e il numero massimo di gusti del tipo
    const flavors = recipe.flavors
      .map((n) => cakeFlavors.find((f) => f.name === n))
      .filter(Boolean)
      .filter((f) => !conflictsAllergies(f, config.allergies))
      .slice(0, max);
    const filling = cakeFillings.find((f) => f.id === recipe.filling);
    const covering = cakeCoverings.find((c) => c.id === recipe.covering);
    set({
      flavors,
      fillingId: conflictsAllergies(filling, config.allergies) ? 'nessuna' : recipe.filling,
      coveringId: conflictsAllergies(covering, config.allergies) ? config.coveringId : recipe.covering,
      decoration: recipe.decoration,
    });
  };

  const submitOrder = async () => {
    const type = cakeTypes.find((t) => t.id === config.type);
    const shape = cakeShapes.find((sh) => sh.id === config.shape);
    const size = cakeSizes.find((s) => s.id === config.sizeId);
    const base = cakeBases.find((b) => b.id === config.baseId);
    const filling = cakeFillings.find((f) => f.id === config.fillingId);
    const covering = cakeCoverings.find((c) => c.id === config.coveringId);
    const deco = cakeDecorations.find((d) => d.id === config.decoration);
    // Allergeni scelti dal cliente, in MAIUSCOLO (per riepilogo/Telegram/mail)
    const allergNames = (config.allergies || []).map((id) => (cakeAllergens || []).find((a) => a.id === id)?.name || id);
    const allergLine = allergNames.length ? allergNames.join(', ').toUpperCase() : '';

    const msg = [
      staff ? `🎂 *Nuovo ordine in gelateria — Punto Gi!*` : `🎂 *Nuova richiesta torta — Punto Gi!*`,
      ``,
      allergLine ? `⚠️ *ALLERGENI:* ${allergLine}` : '',
      `*Tipo:* ${type?.name}`,
      `*Forma:* ${shape?.name}`,
      `*Dimensione:* ${size?.label} (Ø ${size?.diameter}cm)`,
      `*Base:* ${base?.name}${base?.desc ? ` (${base.desc})` : ''}`,
      `*Strati / Gusti:* ${config.flavors.map((f) => f.name).join(', ')}`,
      filling && filling.id !== 'nessuna' ? `*Farcitura:* ${filling.name}` : '',
      covering ? `*Copertura:* ${covering.name}` : '',
      `*Decorazione:* ${deco?.name}`,
      config.message ? `*Scritta:* "${config.message}"` : '',
      config.photo ? `*Foto su cialda:* sì (verrà inviata a parte)` : '',
      config.candle ? `*Candelina:* sì` : '',
      config.occasion ? `*Occasione:* ${config.occasion}` : '',
      ``,
      config.delivery
        ? `*Consegna a domicilio:* ${config.pickupDate}${config.pickupTime ? ` alle ${config.pickupTime}` : ''}`
        : `*Da ritirare:* ${config.pickupDate}${config.pickupTime ? ` alle ${config.pickupTime}` : ''}`,
      config.delivery ? `*Indirizzo:* ${config.deliveryAddress}` : '',
      config.delivery ? `*Sovrapprezzo consegna:* €${DELIVERY_FEE}` : '',
      `*Cliente:* ${config.name}`,
      `*Telefono:* ${config.phone}`,
      config.email ? `*Email:* ${config.email}` : '',
      config.notes ? `*Note:* ${config.notes}` : '',
      ``,
      staff ? '' : `💰 *Importo pagato:* €${total.toFixed(2)}`,
      ``,
      staff ? `_Ordine creato in gelateria_` : `_Richiesta inviata dal sito gelateriapuntogcarpi_`,
    ].filter(Boolean).join('\n');

    // Cattura l'immagine 3D della torta configurata (ridotta, per la dashboard)
    let immagine = null;
    try {
      const canvas = document.querySelector('.cfg-preview canvas');
      if (canvas) {
        const max = 380;
        const scale = Math.min(1, max / Math.max(canvas.width, canvas.height));
        const off = document.createElement('canvas');
        off.width = Math.round(canvas.width * scale);
        off.height = Math.round(canvas.height * scale);
        off.getContext('2d').drawImage(canvas, 0, 0, off.width, off.height);
        immagine = off.toDataURL('image/jpeg', 0.72);
      }
    } catch {
      /* se la cattura fallisce, l'ordine si salva comunque senza immagine */
    }

    // Riga ordine (senza immagine). Per gli ordini pagati la salva il webhook
    // (imposta lì totale/immagine); lo staff invece salva subito qui.
    const { photo, ...dettagli } = config;
    const insertBase = {
      stato: 'da_fare',
      cliente_nome: config.name,
      cliente_telefono: config.phone,
      cliente_email: config.email || null,
      ritiro_data: config.pickupDate || null,
      ritiro_ora: config.pickupTime || null,
      tipo: type?.name || null,
      riepilogo: msg,
      dettagli: { ...dettagli, conFoto: !!photo },
      note: config.notes || null,
    };

    // Parametri email di conferma (staff: subito; cliente: al ritorno dal pagamento)
    const quando = config.pickupDate ? `${config.pickupDate.split('-').reverse().join('/')}${config.pickupTime ? ` alle ${config.pickupTime}` : ''}` : '';
    const ordineEmail = [
      allergLine ? `ALLERGENI: ${allergLine}` : '',
      `Tipo: ${type?.name}`,
      `Forma: ${shape?.name}`,
      `Dimensione: ${size?.label} (Ø ${size?.diameter}cm)`,
      `Base: ${base?.name}`,
      `Gusti: ${config.flavors.map((f) => f.name).join(', ')}`,
      filling && filling.id !== 'nessuna' ? `Farcitura: ${filling.name}` : '',
      covering ? `Copertura: ${covering.name}` : '',
      `Decorazione: ${deco?.name}`,
      config.message ? `Scritta: "${config.message}"` : '',
      config.photo ? `Foto su cialda: sì` : '',
      config.candle ? `Candelina: sì` : '',
      config.occasion ? `Occasione: ${config.occasion}` : '',
      config.delivery ? `Consegna a domicilio (+€${DELIVERY_FEE}) — ${config.deliveryAddress}` : '',
      quando ? `${config.delivery ? 'Consegna' : 'Ritiro'}: ${quando}` : '',
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
      importo: total.toFixed(2),
    } : null;

    if (!supabase) { setSent(true); return; }
    setSubmitError('');
    setSubmitting(true);

    // STAFF: ordine creato in gelateria, nessun pagamento online → salva subito.
    if (staff) {
      const { error } = await supabase.from('ordini').insert({ ...insertBase, totale: total, immagine });
      if (error) {
        console.warn('[ordine] non salvato:', error.message);
        setSubmitError("Non è stato possibile creare l'ordine. Riprova.");
        setSubmitting(false);
        return;
      }
      logAction('Torta creata', config.name || 'cliente');
      if (emailParams) sendOrderEmail(emailParams);
      setSubmitting(false);
      setSent(true);
      return;
    }

    // CLIENTE: paga con Stripe. L'ordine lo salva il webhook a pagamento avvenuto
    // (+ trigger Telegram); l'email di conferma parte al ritorno sul sito.
    try {
      if (emailParams) sessionStorage.setItem('pg_order_email', JSON.stringify(emailParams));
      sessionStorage.setItem('pg_order_delivery', config.delivery ? '1' : '0');
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { config, insert: insertBase },
      });
      if (error) throw error;
      if (data?.url) { window.location.href = data.url; return; }
      throw new Error(data?.error || 'Risposta non valida dal server');
    } catch (e) {
      setSubmitError(e?.message || 'Errore durante il pagamento. Riprova.');
      setSubmitting(false);
    }
  };

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
              <small style={{ marginLeft: '0.5rem' }}>· Punto Gi!</small>
            </div>
            {!sent && (
              <div className="cfg-stepper" aria-hidden="true">
                {STEPS.map((_, i) => (
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
              <CakePreview config={config} />
            </div>
            <div className="cfg-preview-info">
              <div className="combo-counter">
                1 di <strong>{combos.toLocaleString('it-IT')}</strong> combinazioni
              </div>
              <div className="price-row">
                <div className="price">
                  €{total.toFixed(0)}
                  <small>totale</small>
                </div>
                {config.flavors.length > 0 && (
                  <button type="button" className="allergeni-btn" onClick={() => setShowAllerg(true)}>
                    <span className="allergeni-btn-i" aria-hidden="true">i</span> Allergeni
                  </button>
                )}
              </div>
              {!sent && (
                <button
                  type="button"
                  className="cfg-btn cfg-btn-back"
                  onClick={surpriseMe}
                  disabled={!canSurprise}
                  title={canSurprise ? '' : 'Scegli prima il numero di persone'}
                  style={{ marginTop: '0.6rem', opacity: canSurprise ? 1 : 0.5, cursor: canSurprise ? 'pointer' : 'not-allowed' }}
                >
                  <Shuffle size={14} /> Sorprendimi!
                </button>
              )}
            </div>
          </aside>

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
                  {STEPS[step] === 'type' && <StepType config={config} set={set} />}
                  {STEPS[step] === 'size' && <StepSize config={config} set={set} />}
                  {STEPS[step] === 'allergies' && <StepAllergies config={config} set={set} />}
                  {STEPS[step] === 'shape' && <StepShape config={config} set={set} />}
                  {STEPS[step] === 'base' && <StepBase config={config} set={set} />}
                  {STEPS[step] === 'flavors' && <StepFlavors config={config} toggle={toggleFlavor} staff={staff} />}
                  {STEPS[step] === 'filling' && <StepFilling config={config} set={set} />}
                  {STEPS[step] === 'covering' && <StepCovering config={config} set={set} />}
                  {STEPS[step] === 'decoration' && <StepDecoration config={config} set={set} />}
                  {STEPS[step] === 'message' && <StepMessage config={config} set={set} staff={staff} />}
                  {STEPS[step] === 'details' && <StepDetails config={config} set={set} staff={staff} orari={orari} earliestISO={earliestISO} earliestMin={earliestMin} />}
                  {STEPS[step] === 'review' && <StepReview config={config} total={total} staff={staff} />}
                </motion.div>
              </AnimatePresence>
            )}
          </div>

          {!sent && submitError && (
            <div className="cfg-submit-error">⚠️ {submitError}</div>
          )}

          {!sent && (
            <footer className="cfg-footer">
              <div className="price-tag">
                <span>Prezzo totale</span>
                <strong>€{total.toFixed(2)}</strong>
              </div>
              {/* su mobile, al posto del totale, c'è Sorprendimi (sbloccato dopo il n° persone) */}
              <button
                type="button"
                className="cfg-btn cfg-btn-surprise"
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
                {step < STEPS.length - 1 ? (
                  <button className="cfg-btn cfg-btn-next" onClick={next} disabled={!canNext}>
                    Avanti <ArrowRight size={16} />
                  </button>
                ) : (
                  <button className="cfg-btn cfg-btn-send" onClick={submitOrder} disabled={!canNext || submitting}>
                    {submitting
                      ? (staff ? 'Invio…' : 'Attendi…')
                      : staff
                        ? (<><Check size={16} /> Crea ordine</>)
                        : (<><CreditCard size={16} /> Ordina e paga €{total.toFixed(2)}</>)}
                  </button>
                )}
              </div>
            </footer>
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
  const n = stepKey ? STEPS.indexOf(stepKey) + 1 : num;
  return (
    <>
      <span className="cfg-step-num">Passo {n} di {STEPS.length}</span>
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
              <span style={{ width: 14, height: 14, borderRadius: '50%', background: t.color, display: 'inline-block' }} />
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

function StepShape({ config, set }) {
  const { cakeShapes, cakeSizes } = useCakeData();
  const persone = personeOf(cakeSizes.find((s) => s.id === config.sizeId));
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
    set({ allergies: has ? config.allergies.filter((x) => x !== id) : [...config.allergies, id] });
  };
  const chosenNames = config.allergies.map((id) => cakeAllergens.find((a) => a.id === id)?.name || id);
  return (
    <>
      <StepHeader
        stepKey="allergies"
        title="Allergie o intolleranze?"
        lead="Seleziona cosa vuoi evitare: lo segnaliamo al laboratorio e ingrigiamo le opzioni incompatibili. Se non ne hai, vai avanti."
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
      {config.allergies.length > 0 && (
        <div className="flavor-hint" style={{ marginTop: '1.2rem' }}>
          Segnaleremo: <strong>{chosenNames.join(', ')}</strong>. Le scelte incompatibili appariranno in grigio.
        </div>
      )}
      <p className="cfg-field hint" style={{ marginTop: '1rem', fontSize: '0.78rem', color: 'var(--grey)', lineHeight: 1.5 }}>
        ⚠️ <strong>Sicurezza alimentare:</strong> tutti i nostri prodotti sono lavorati nello stesso laboratorio,
        quindi non possiamo garantire l'assenza totale di contaminazioni crociate — ogni torta può contenere
        tracce di glutine, latte, uova, soia, frutta a guscio e arachidi. Per allergie gravi conferma sempre con lo staff.
      </p>
    </>
  );
}

function StepFlavors({ config, toggle, staff }) {
  const { cakeFlavors } = useCakeData();
  const max = maxFlavorsFor(config.type);
  return (
    <>
      <StepHeader
        stepKey="flavors"
        title="Scegli i gusti degli strati"
        lead={`Da 1 a ${max} gusti — l'ordine determina gli strati (dal basso verso l'alto).${staff ? '' : ' Ogni gusto extra: +2€.'}`}
      />
      <div className="flavor-hint">
        Hai scelto <strong>{config.flavors.length}</strong> di {max} strati.{' '}
        {config.flavors.length === 0 && 'Tocca un gusto per aggiungerlo.'}
      </div>
      <div className="opt-grid cols-flavors">
        {cakeFlavors.map((f) => {
          const idx = config.flavors.findIndex((x) => x.name === f.name);
          const selected = idx !== -1;
          const allergic = conflictsAllergies(f, config.allergies);
          const disabled = allergic || (!selected && config.flavors.length >= max);
          return (
            <button
              key={f.name}
              className={`opt-card opt-flavor ${selected ? 'selected' : ''}`}
              onClick={() => !disabled && toggle(f)}
              disabled={disabled}
              title={allergic ? `Contiene: ${f.allergeni.join(', ')}` : ''}
              style={disabled ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
            >
              <span className="flavor-dot" style={{ background: f.color }} />
              <span className="flavor-name">{f.name}</span>
              {selected && <span className="flavor-pos">{idx + 1}</span>}
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
          const blocked = conflictsAllergies(f, config.allergies);
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
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: f.color, display: 'inline-block' }} />
                )}
                {f.name}
              </div>
              <div className="opt-desc">{blocked ? `Contiene: ${f.allergeni.join(', ')}` : f.desc}</div>
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
  return (
    <>
      <StepHeader
        stepKey="covering"
        title="Copertura esterna"
        lead="Quello che vede l'occhio prima del primo morso. Lucida, soffice, fiammeggiata… o nuda."
      />
      <div className="opt-grid cols-2">
        {cakeCoverings.map((c) => {
          const blocked = conflictsAllergies(c, config.allergies);
          return (
            <button
              key={c.id}
              className={`opt-card ${config.coveringId === c.id ? 'selected' : ''}`}
              onClick={() => !blocked && set({ coveringId: c.id })}
              disabled={blocked}
              style={blocked ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
            >
              <div className="opt-name">
                {c.color && (
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: c.color, display: 'inline-block', border: '1px solid rgba(0,0,0,0.1)' }} />
                )}
                {c.name}
              </div>
              <div className="opt-desc">{blocked ? `Contiene: ${c.allergeni.join(', ')}` : c.desc}</div>
              <div className="opt-meta">{c.priceDelta > 0 ? `+ €${c.priceDelta}` : 'inclusa'}</div>
            </button>
          );
        })}
      </div>
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
          const blocked = conflictsAllergies(b, config.allergies);
          return (
            <button
              key={b.id}
              className={`opt-card ${config.baseId === b.id ? 'selected' : ''}`}
              onClick={() => !blocked && set({ baseId: b.id })}
              disabled={blocked}
              style={blocked ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
            >
              <div className="opt-name">
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: b.color, display: 'inline-block' }} />
                {b.name}
              </div>
              <div className="opt-desc">{blocked ? `Contiene: ${b.allergeni.join(', ')}` : b.desc}</div>
              <div className="opt-meta">{b.priceDelta > 0 ? `+ €${b.priceDelta}` : 'inclusa'}</div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function StepDecoration({ config, set }) {
  const { cakeDecorations } = useCakeData();
  return (
    <>
      <StepHeader stepKey="decoration" title="Decorazioni" lead="Le immagini sono indicative — ogni torta è decorata a mano dal nostro staff." />
      <div className="opt-grid cols-3">
        {cakeDecorations.map((d) => (
          <button
            key={d.id}
            className={`opt-card ${config.decoration === d.id ? 'selected' : ''}`}
            onClick={() => set({ decoration: d.id })}
          >
            <div className="opt-name">
              <span style={{ fontSize: '1.2rem' }}>{d.emoji}</span> {d.name}
            </div>
            <div className="opt-desc">{d.desc}</div>
          </button>
        ))}
      </div>
    </>
  );
}

function StepMessage({ config, set, staff }) {
  const { cakeOccasions } = useCakeData();
  const fonts = [
    { id: 'caveat', label: 'Calligrafica', preview: 'Auguri!', family: "'Caveat', cursive", size: '1.4rem' },
    { id: 'fraunces', label: 'Elegante', preview: 'Auguri!', family: "'Fraunces', serif", size: '1.15rem', italic: true },
    { id: 'inter', label: 'Moderna', preview: 'AUGURI!', family: "'Inter', sans-serif", size: '1rem', weight: 700, letterSpacing: '0.08em' },
  ];
  return (
    <>
      <StepHeader stepKey="message" title="Scritta, foto e candelina" lead="Una frase importante? Aggiungi anche una foto: la stampiamo su cialda alimentare e la posiamo sulla torta." />

      <div className="cfg-field">
        <label>Foto da stampare (opzionale{staff ? '' : ', +€5'})</label>
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
                className={`font-card ${config.messageFont === f.id ? 'selected' : ''}`}
                onClick={() => set({ messageFont: f.id })}
              >
                <span
                  className="font-preview"
                  style={{
                    fontFamily: f.family,
                    fontSize: f.size,
                    fontStyle: f.italic ? 'italic' : 'normal',
                    fontWeight: f.weight || 600,
                    letterSpacing: f.letterSpacing || 'normal',
                  }}
                >
                  {f.preview}
                </span>
                <span className="font-label">{f.label}</span>
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
            Aggiungi candelina{staff ? '' : ' (+ €1)'}
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
              {o}
            </button>
          ))}
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
        <label>Email {staff ? '(facoltativa)' : '*'}</label>
        <input
          type="email"
          placeholder="nome@esempio.it"
          value={config.email}
          onChange={(e) => set({ email: e.target.value })}
          required={!staff}
        />
        <p className="hint" style={emailInvalid ? { color: '#b03a3a' } : undefined}>
          {emailInvalid ? "Inserisci un'email valida." : 'Ti invieremo qui la conferma dell’ordine.'}
        </p>
      </div>

      <div className="cfg-field">
        <label>Come vuoi la torta?</label>
        <div className="toggle-row">
          <button
            type="button"
            className={`toggle-pill ${!config.delivery ? 'active' : ''}`}
            onClick={() => set({ delivery: false })}
          >
            🏪 Ritiro in gelateria
          </button>
          <button
            type="button"
            className={`toggle-pill ${config.delivery ? 'active' : ''}`}
            onClick={() => set({ delivery: true })}
          >
            🛵 Consegna a domicilio{staff ? '' : ` (+ €${DELIVERY_FEE})`}
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
      </div>
    </>
  );
}

function StepReview({ config, total, staff }) {
  const { cakeShapes, cakeTypes, cakeSizes, cakeBases, cakeFillings, cakeCoverings, cakeDecorations, cakeAllergens } = useCakeData();
  const allergNames = (config.allergies || []).map((id) => (cakeAllergens || []).find((a) => a.id === id)?.name || id);
  const type = cakeTypes.find((t) => t.id === config.type);
  const shape = cakeShapes.find((sh) => sh.id === config.shape);
  const size = cakeSizes.find((s) => s.id === config.sizeId);
  const base = cakeBases.find((b) => b.id === config.baseId);
  const filling = cakeFillings.find((f) => f.id === config.fillingId);
  const covering = cakeCoverings.find((c) => c.id === config.coveringId);
  const deco = cakeDecorations.find((d) => d.id === config.decoration);
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
          <dt>Strati</dt><dd>{config.flavors.map((f) => f.name).join(' · ') || '—'}</dd>
          {filling && filling.id !== 'nessuna' && (<><dt>Inserto</dt><dd>{filling.name}</dd></>)}
          <dt>Copertura</dt><dd>{covering?.name}</dd>
          <dt>Decorazione</dt><dd>{deco?.name}</dd>
          {config.message && (<><dt>Scritta</dt><dd>"{config.message}"</dd></>)}
          {config.photo && (<><dt>Foto</dt><dd>su cialda alimentare</dd></>)}
          {config.candle && (<><dt>Candelina</dt><dd>sì</dd></>)}
          {config.occasion && (<><dt>Occasione</dt><dd>{config.occasion}</dd></>)}
          <dt>{config.delivery ? 'Consegna' : 'Ritiro'}</dt><dd>{config.pickupDate || '—'}{config.pickupTime ? ` alle ${config.pickupTime}` : ''}</dd>
          {config.delivery && (<><dt>Indirizzo</dt><dd>{config.deliveryAddress || '—'}</dd></>)}
          <dt>Cliente</dt><dd>{config.name}</dd>
          <dt>Tel</dt><dd>{config.phone}</dd>
          {config.notes && (<><dt>Note</dt><dd>{config.notes}</dd></>)}
        </dl>
      </div>
      {!staff && (
        <div className="summary-box" style={{ background: 'var(--cream-warm)', borderColor: 'rgba(124,183,215,0.2)' }}>
          <p style={{ margin: 0, fontSize: '1rem', color: 'var(--ink)' }}>
            <strong style={{ color: 'var(--violet-deep)' }}>Prezzo totale: €{total.toFixed(2)}</strong>
          </p>
        </div>
      )}
    </>
  );
}

const SOCIALS = [
  { id: 'ig', label: 'Instagram', href: 'https://www.instagram.com/gelateriapuntogicarpi/', Icon: Instagram },
  { id: 'fb', label: 'Facebook', href: 'https://www.facebook.com/gelateriapuntogicarpi', Icon: Facebook },
  { id: 'wa', label: 'WhatsApp', href: 'https://api.whatsapp.com/send?phone=393203306009', Icon: MessageCircle },
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
            {SOCIALS.map(({ id, label, href, Icon }) => (
              <a key={id} className="cfg-social" href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
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
        const max = 700;
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
