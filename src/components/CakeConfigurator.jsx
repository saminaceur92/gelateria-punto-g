import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, ArrowRight, Check, Send, Cake, Shuffle } from 'lucide-react';
import { useCakeData } from '../data/CakeDataProvider';
import { supabase } from '../lib/supabase';
import CakePreview from './CakePreview';

const STEPS = [
  'type',       // tipo torta (semifreddo / gelato / crock / a piani)
  'shape',      // forma
  'size',       // dimensione
  'base',       // base sotto (tra le prime scelte)
  'flavors',    // strati / gusti
  'filling',    // farcitura tra strati
  'covering',   // copertura esterna
  'decoration', // decorazioni topping
  'message',    // scritta + foto + candelina
  'details',    // dati cliente
  'review',     // riepilogo
];
const MAX_FLAVORS = 4;
const MAX_MESSAGE = 24; // si deve leggere bene nel centro della torta
const WHATSAPP = '393203306009';

// Config iniziale calcolata dai dati disponibili (validi anche se il proprietario
// disattiva la dimensione/base/decorazione di default).
function makeInitialConfig(cake) {
  return {
    type: '',
    shape: cake.cakeShapes[0]?.id || 'tonda',
    sizeId: (cake.cakeSizes.find((s) => s.popular) || cake.cakeSizes[0])?.id || '',
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
    name: '',
    phone: '',
    notes: '',
  };
}

export default function CakeConfigurator({ open, onClose }) {
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
    cakeRecipes,
  } = cake;
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState(() => makeInitialConfig(cake));
  const [sent, setSent] = useState(false);
  const bodyRef = useRef(null);
  const [showAllerg, setShowAllerg] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      setStep(0);
      setConfig(makeInitialConfig(cake));
      setSent(false);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const set = (patch) => setConfig((c) => ({ ...c, ...patch }));

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
    switch (STEPS[step]) {
      case 'type': return !!config.type;
      case 'shape': return !!config.shape;
      case 'size': return !!config.sizeId;
      case 'flavors': return config.flavors.length >= 1;
      case 'filling': return !!config.fillingId;
      case 'covering': return !!config.coveringId;
      case 'base': return !!config.baseId;
      case 'details': return config.name.trim() && config.phone.trim() && config.pickupDate;
      default: return true;
    }
  }, [step, config]);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const toggleFlavor = (f) => {
    const exists = config.flavors.find((x) => x.name === f.name);
    if (exists) {
      set({ flavors: config.flavors.filter((x) => x.name !== f.name) });
    } else if (config.flavors.length < MAX_FLAVORS) {
      set({ flavors: [...config.flavors, f] });
    }
  };

  const surpriseMe = () => {
    const recipe = cakeRecipes[Math.floor(Math.random() * cakeRecipes.length)];
    const flavors = recipe.flavors.map((n) => cakeFlavors.find((f) => f.name === n)).filter(Boolean);
    // mantiene la forma già scelta: randomizza tutto il resto DENTRO quella forma
    set({
      flavors,
      fillingId: recipe.filling,
      coveringId: recipe.covering,
      decoration: recipe.decoration,
    });
  };

  const sendWhatsApp = () => {
    const type = cakeTypes.find((t) => t.id === config.type);
    const shape = cakeShapes.find((sh) => sh.id === config.shape);
    const size = cakeSizes.find((s) => s.id === config.sizeId);
    const base = cakeBases.find((b) => b.id === config.baseId);
    const filling = cakeFillings.find((f) => f.id === config.fillingId);
    const covering = cakeCoverings.find((c) => c.id === config.coveringId);
    const deco = cakeDecorations.find((d) => d.id === config.decoration);

    const msg = [
      `🎂 *Nuova richiesta torta — Punto G!*`,
      ``,
      `*Tipo:* ${type?.name}`,
      `*Forma:* ${shape?.name}`,
      `*Dimensione:* ${size?.label} (Ø ${size?.diameter}cm)`,
      `*Base:* ${base?.name}`,
      `*Strati / Gusti:* ${config.flavors.map((f) => f.name).join(', ')}`,
      filling && filling.id !== 'nessuna' ? `*Farcitura:* ${filling.name}` : '',
      covering ? `*Copertura:* ${covering.name}` : '',
      `*Decorazione:* ${deco?.name}`,
      config.message ? `*Scritta:* "${config.message}"` : '',
      config.photo ? `*Foto su cialda:* sì (verrà inviata a parte)` : '',
      config.candle ? `*Candelina:* sì` : '',
      config.occasion ? `*Occasione:* ${config.occasion}` : '',
      ``,
      `*Da ritirare:* ${config.pickupDate}`,
      `*Cliente:* ${config.name}`,
      `*Telefono:* ${config.phone}`,
      config.notes ? `*Note:* ${config.notes}` : '',
      ``,
      `💰 *Stima:* €${total.toFixed(2)}`,
      ``,
      `_Richiesta inviata dal sito gelateriapuntogcarpi_`,
    ].filter(Boolean).join('\n');

    // Salva l'ordine su Supabase (non blocca l'invio WhatsApp se fallisce)
    if (supabase) {
      const { photo, ...dettagli } = config;
      supabase
        .from('ordini')
        .insert({
          stato: 'nuovo',
          cliente_nome: config.name,
          cliente_telefono: config.phone,
          ritiro_data: config.pickupDate || null,
          totale: total,
          tipo: type?.name || null,
          riepilogo: msg,
          dettagli: { ...dettagli, conFoto: !!photo },
          note: config.notes || null,
        })
        .then(({ error }) => {
          if (error) console.warn('[ordine] non salvato:', error.message);
        });
    }

    const url = `https://api.whatsapp.com/send?phone=${WHATSAPP}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setSent(true);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="cfg-overlay"
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
              Crea la tua torta
              <small style={{ marginLeft: '0.5rem' }}>· Punto G!</small>
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
                  <small>stima</small>
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
                  style={{ marginTop: '0.6rem' }}
                >
                  <Shuffle size={14} /> Sorprendimi!
                </button>
              )}
            </div>
          </aside>

          <div className="cfg-body" ref={bodyRef}>
            {sent ? (
              <SuccessView name={config.name} onClose={onClose} />
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
                  {STEPS[step] === 'shape' && <StepShape config={config} set={set} />}
                  {STEPS[step] === 'size' && <StepSize config={config} set={set} />}
                  {STEPS[step] === 'flavors' && <StepFlavors config={config} toggle={toggleFlavor} />}
                  {STEPS[step] === 'filling' && <StepFilling config={config} set={set} />}
                  {STEPS[step] === 'covering' && <StepCovering config={config} set={set} />}
                  {STEPS[step] === 'base' && <StepBase config={config} set={set} />}
                  {STEPS[step] === 'decoration' && <StepDecoration config={config} set={set} />}
                  {STEPS[step] === 'message' && <StepMessage config={config} set={set} />}
                  {STEPS[step] === 'details' && <StepDetails config={config} set={set} />}
                  {STEPS[step] === 'review' && <StepReview config={config} total={total} />}
                </motion.div>
              </AnimatePresence>
            )}
          </div>

          {!sent && (
            <footer className="cfg-footer">
              <div className="price-tag">
                <span>Totale stimato</span>
                <strong>€{total.toFixed(2)}</strong>
              </div>
              {/* su mobile, al posto del totale, c'è Sorprendimi */}
              <button type="button" className="cfg-btn cfg-btn-surprise" onClick={surpriseMe}>
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
                  <button className="cfg-btn cfg-btn-send" onClick={sendWhatsApp} disabled={!canNext}>
                    <Send size={16} /> Invia su WhatsApp
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

function StepHeader({ num, title, lead }) {
  return (
    <>
      <span className="cfg-step-num">Passo {num} di {STEPS.length}</span>
      <h2>{title}</h2>
      {lead && <p className="lead">{lead}</p>}
    </>
  );
}

function StepType({ config, set }) {
  const { cakeTypes } = useCakeData();
  return (
    <>
      <StepHeader num={1} title="Che torta vuoi creare?" lead="Scegli la base, poi la rendiamo unica insieme." />
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
  const { cakeShapes } = useCakeData();
  return (
    <>
      <StepHeader num={2} title="Che forma vuoi?" lead="Tonda, a cuore, quadrata o rettangolare per i buffet più generosi." />
      <div className="opt-grid cols-2">
        {cakeShapes.map((sh) => (
          <button
            key={sh.id}
            className={`opt-card ${config.shape === sh.id ? 'selected' : ''}`}
            onClick={() => set({ shape: sh.id })}
          >
            <div className="opt-name">
              <span style={{ fontSize: '1.3rem' }}>{sh.emoji}</span> {sh.name}
            </div>
            <div className="opt-desc">{sh.desc}</div>
            <div className="opt-meta">{sh.priceDelta > 0 ? `+ €${sh.priceDelta}` : 'inclusa'}</div>
          </button>
        ))}
      </div>
    </>
  );
}

function StepSize({ config, set }) {
  const { cakeSizes } = useCakeData();
  return (
    <>
      <StepHeader num={3} title="Per quante persone?" lead="Una stima abbondante: meglio un cucchiaio in più che in meno." />
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

function StepFlavors({ config, toggle }) {
  const { cakeFlavors } = useCakeData();
  const tagLabels = {
    gelato: '🍨 Gelato',
    semifreddo: '✨ Semifreddo',
    sorbetto: '🍋 Sorbetto',
    vegano: '🌱 Vegano',
    sg: '🌾 Senza glutine',
  };
  return (
    <>
      <StepHeader
        num={5}
        title="Scegli i gusti degli strati"
        lead={`Da 1 a ${MAX_FLAVORS} gusti — l'ordine determina gli strati (dal basso verso l'alto). Ogni gusto extra: +2€.`}
      />
      <div className="flavor-hint">
        Hai scelto <strong>{config.flavors.length}</strong> di {MAX_FLAVORS} strati.{' '}
        {config.flavors.length === 0 && 'Tocca un gusto per aggiungerlo.'}
      </div>
      <div className="opt-grid cols-flavors">
        {cakeFlavors.map((f) => {
          const idx = config.flavors.findIndex((x) => x.name === f.name);
          const selected = idx !== -1;
          const disabled = !selected && config.flavors.length >= MAX_FLAVORS;
          return (
            <button
              key={f.name}
              className={`opt-card opt-flavor ${selected ? 'selected' : ''}`}
              onClick={() => toggle(f)}
              disabled={disabled}
              style={disabled ? { opacity: 0.45, cursor: 'not-allowed' } : {}}
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
        num={6}
        title="Farcitura tra gli strati"
        lead="Un cuore goloso tra uno strato e l'altro: salse, creme o granelle. Oppure niente, per gusti puri."
      />
      <div className="opt-grid cols-3">
        {cakeFillings.map((f) => (
          <button
            key={f.id}
            className={`opt-card ${config.fillingId === f.id ? 'selected' : ''}`}
            onClick={() => set({ fillingId: f.id })}
          >
            <div className="opt-name">
              {f.color && (
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: f.color, display: 'inline-block' }} />
              )}
              {f.name}
            </div>
            <div className="opt-desc">{f.desc}</div>
            <div className="opt-meta">{f.priceDelta > 0 ? `+ €${f.priceDelta}` : 'inclusa'}</div>
          </button>
        ))}
      </div>
    </>
  );
}

function StepCovering({ config, set }) {
  const { cakeCoverings } = useCakeData();
  return (
    <>
      <StepHeader
        num={7}
        title="Copertura esterna"
        lead="Quello che vede l'occhio prima del primo morso. Lucida, soffice, fiammeggiata… o nuda."
      />
      <div className="opt-grid cols-2">
        {cakeCoverings.map((c) => (
          <button
            key={c.id}
            className={`opt-card ${config.coveringId === c.id ? 'selected' : ''}`}
            onClick={() => set({ coveringId: c.id })}
          >
            <div className="opt-name">
              {c.color && (
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: c.color, display: 'inline-block', border: '1px solid rgba(0,0,0,0.1)' }} />
              )}
              {c.name}
            </div>
            <div className="opt-desc">{c.desc}</div>
            <div className="opt-meta">{c.priceDelta > 0 ? `+ €${c.priceDelta}` : 'inclusa'}</div>
          </button>
        ))}
      </div>
    </>
  );
}

function StepBase({ config, set }) {
  const { cakeBases } = useCakeData();
  return (
    <>
      <StepHeader num={4} title="Quale base preferisci?" lead="Quello che sostiene la torta sotto: dal classico pan di Spagna al senza glutine." />
      <div className="opt-grid cols-2">
        {cakeBases.map((b) => (
          <button
            key={b.id}
            className={`opt-card ${config.baseId === b.id ? 'selected' : ''}`}
            onClick={() => set({ baseId: b.id })}
          >
            <div className="opt-name">
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: b.color, display: 'inline-block' }} />
              {b.name}
            </div>
            <div className="opt-desc">{b.desc}</div>
            <div className="opt-meta">{b.priceDelta > 0 ? `+ €${b.priceDelta}` : 'inclusa'}</div>
          </button>
        ))}
      </div>
    </>
  );
}

function StepDecoration({ config, set }) {
  const { cakeDecorations } = useCakeData();
  return (
    <>
      <StepHeader num={8} title="Decorazioni" lead="Le immagini sono indicative — ogni torta è decorata a mano dal nostro staff." />
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

function StepMessage({ config, set }) {
  const { cakeOccasions } = useCakeData();
  const fonts = [
    { id: 'caveat', label: 'Calligrafica', preview: 'Auguri!', family: "'Caveat', cursive", size: '1.4rem' },
    { id: 'fraunces', label: 'Elegante', preview: 'Auguri!', family: "'Fraunces', serif", size: '1.15rem', italic: true },
    { id: 'inter', label: 'Moderna', preview: 'AUGURI!', family: "'Inter', sans-serif", size: '1rem', weight: 700, letterSpacing: '0.08em' },
  ];
  return (
    <>
      <StepHeader num={9} title="Scritta, foto e candelina" lead="Una frase importante? Aggiungi anche una foto: la stampiamo su cialda alimentare e la posiamo sulla torta." />

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
            Aggiungi candelina (+ €1)
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

function StepDetails({ config, set }) {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return (
    <>
      <StepHeader
        num={10}
        title="I tuoi dati"
        lead="Per torte personalizzate servono almeno 24h di preavviso. Ti contattiamo per confermare."
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
            placeholder="+39 ..."
            value={config.phone}
            onChange={(e) => set({ phone: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="cfg-field">
        <label>Quando vuoi ritirarla? *</label>
        <input
          type="date"
          min={tomorrow}
          value={config.pickupDate}
          onChange={(e) => set({ pickupDate: e.target.value })}
          required
        />
        <p className="hint">Minimo 24h dall'ordine. Ti chiameremo per concordare l'orario.</p>
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

function StepReview({ config, total }) {
  const { cakeTypes, cakeSizes, cakeBases, cakeFillings, cakeCoverings, cakeDecorations } = useCakeData();
  const type = cakeTypes.find((t) => t.id === config.type);
  const shape = cakeShapes.find((sh) => sh.id === config.shape);
  const size = cakeSizes.find((s) => s.id === config.sizeId);
  const base = cakeBases.find((b) => b.id === config.baseId);
  const filling = cakeFillings.find((f) => f.id === config.fillingId);
  const covering = cakeCoverings.find((c) => c.id === config.coveringId);
  const deco = cakeDecorations.find((d) => d.id === config.decoration);
  return (
    <>
      <StepHeader num={11} title="Riepilogo" lead="Controlla tutto e invia la richiesta su WhatsApp. Ti rispondiamo a mano!" />
      <div className="summary-box">
        <dl>
          <dt>Tipo</dt><dd>{type?.name}</dd>
          <dt>Forma</dt><dd>{shape?.name}</dd>
          <dt>Dimensione</dt><dd>{size?.label} · Ø {size?.diameter}cm</dd>
          <dt>Base</dt><dd>{base?.name}</dd>
          <dt>Strati</dt><dd>{config.flavors.map((f) => f.name).join(' · ') || '—'}</dd>
          {filling && filling.id !== 'nessuna' && (<><dt>Farcitura</dt><dd>{filling.name}</dd></>)}
          <dt>Copertura</dt><dd>{covering?.name}</dd>
          <dt>Decorazione</dt><dd>{deco?.name}</dd>
          {config.message && (<><dt>Scritta</dt><dd>"{config.message}"</dd></>)}
          {config.photo && (<><dt>Foto</dt><dd>su cialda alimentare</dd></>)}
          {config.candle && (<><dt>Candelina</dt><dd>sì</dd></>)}
          {config.occasion && (<><dt>Occasione</dt><dd>{config.occasion}</dd></>)}
          <dt>Ritiro</dt><dd>{config.pickupDate || '—'}</dd>
          <dt>Cliente</dt><dd>{config.name}</dd>
          <dt>Tel</dt><dd>{config.phone}</dd>
          {config.notes && (<><dt>Note</dt><dd>{config.notes}</dd></>)}
        </dl>
      </div>
      <div className="summary-box" style={{ background: 'var(--cream-warm)', borderColor: 'rgba(182,81,228,0.2)' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--ink)' }}>
          <strong style={{ color: 'var(--violet-deep)' }}>Totale stimato: €{total.toFixed(2)}</strong>
          <br />
          Il prezzo definitivo viene confermato dal nostro staff in base alle decorazioni richieste.
        </p>
      </div>
    </>
  );
}

function SuccessView({ name, onClose }) {
  return (
    <div className="cfg-success">
      <div className="check"><Check size={36} /></div>
      <h2>Richiesta inviata!</h2>
      <p className="lead" style={{ maxWidth: 420 }}>
        Grazie {name?.split(' ')[0] || ''}! La tua richiesta è stata aperta su WhatsApp.
        Inviala per confermare e ti rispondiamo entro poche ore per finalizzare l'ordine.
      </p>
      <button className="cfg-btn cfg-btn-next" onClick={onClose} style={{ marginTop: '1rem' }}>
        Torna al sito
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
