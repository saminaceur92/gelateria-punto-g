import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, ArrowRight, Check, Send, Cake } from 'lucide-react';
import {
  cakeTypes,
  cakeSizes,
  cakeFlavors,
  cakeBases,
  cakeDecorations,
  cakeOccasions,
} from '../data/cakeOptions';
import CakePreview from './CakePreview';

const STEPS = ['type', 'size', 'flavors', 'base', 'decoration', 'message', 'details', 'review'];
const MAX_FLAVORS = 4;
const WHATSAPP = '393203306009';

const initialConfig = {
  type: '',
  sizeId: '8',
  flavors: [], // [{name,color}]
  baseId: 'classica',
  decoration: 'minimal',
  message: '',
  candle: false,
  occasion: '',
  pickupDate: '',
  name: '',
  phone: '',
  notes: '',
};

export default function CakeConfigurator({ open, onClose }) {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState(initialConfig);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      setStep(0);
      setConfig(initialConfig);
      setSent(false);
    }
  }, [open]);

  // ESC chiude
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
    let p = (type?.basePrice ?? 0) + (size?.priceDelta ?? 0) + (base?.priceDelta ?? 0);
    if (config.candle) p += 1;
    return p;
  }, [config]);

  const canNext = useMemo(() => {
    switch (STEPS[step]) {
      case 'type': return !!config.type;
      case 'size': return !!config.sizeId;
      case 'flavors': return config.flavors.length >= 1;
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

  const sendWhatsApp = () => {
    const type = cakeTypes.find((t) => t.id === config.type);
    const size = cakeSizes.find((s) => s.id === config.sizeId);
    const base = cakeBases.find((b) => b.id === config.baseId);
    const deco = cakeDecorations.find((d) => d.id === config.decoration);

    const msg = [
      `🎂 *Nuova richiesta torta — Punto G!*`,
      ``,
      `*Tipo:* ${type?.name}`,
      `*Dimensione:* ${size?.label} (Ø ${size?.diameter}cm)`,
      `*Base:* ${base?.name}`,
      `*Gusti:* ${config.flavors.map((f) => f.name).join(', ')}`,
      `*Decorazione:* ${deco?.name}`,
      config.message ? `*Scritta:* "${config.message}"` : '',
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
          {/* HEADER */}
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

          {/* PREVIEW (sempre visibile, anche su mobile) */}
          <aside className="cfg-preview">
            <div className="cfg-preview-stage">
              <CakePreview config={config} />
            </div>
            <div className="cfg-preview-info">
              <h3>{cakeTypes.find((t) => t.id === config.type)?.name || 'La tua torta'}</h3>
              <p>
                {config.flavors.length > 0
                  ? config.flavors.map((f) => f.name).join(' · ')
                  : 'Inizia scegliendo il tipo'}
              </p>
              <div className="price">
                €{total.toFixed(0)}
                <small>stima</small>
              </div>
            </div>
          </aside>

          {/* BODY */}
          <div className="cfg-body">
            {sent ? (
              <SuccessView name={config.name} onClose={onClose} />
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  className="cfg-step"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.35 }}
                >
                  {STEPS[step] === 'type' && <StepType config={config} set={set} />}
                  {STEPS[step] === 'size' && <StepSize config={config} set={set} />}
                  {STEPS[step] === 'flavors' && <StepFlavors config={config} toggle={toggleFlavor} />}
                  {STEPS[step] === 'base' && <StepBase config={config} set={set} />}
                  {STEPS[step] === 'decoration' && <StepDecoration config={config} set={set} />}
                  {STEPS[step] === 'message' && <StepMessage config={config} set={set} />}
                  {STEPS[step] === 'details' && <StepDetails config={config} set={set} />}
                  {STEPS[step] === 'review' && <StepReview config={config} total={total} />}
                </motion.div>
              </AnimatePresence>
            )}
          </div>

          {/* FOOTER */}
          {!sent && (
            <footer className="cfg-footer">
              <div className="price-tag">
                <span>Totale stimato</span>
                <strong>€{total.toFixed(2)}</strong>
              </div>
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
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ───────── Step components ───────── */

function StepHeader({ num, title, lead }) {
  return (
    <>
      <span className="cfg-step-num">Passo {num} di 8</span>
      <h2>{title}</h2>
      {lead && <p className="lead">{lead}</p>}
    </>
  );
}

function StepType({ config, set }) {
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

function StepSize({ config, set }) {
  return (
    <>
      <StepHeader num={2} title="Per quante persone?" lead="Una stima abbondante: meglio un cucchiaio in più che in meno." />
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
  return (
    <>
      <StepHeader
        num={3}
        title="Scegli i gusti"
        lead={`Da 1 a ${MAX_FLAVORS} gusti — gli strati seguono l'ordine di scelta.`}
      />
      <div className="flavor-hint">
        Hai scelto <strong>{config.flavors.length}</strong> di {MAX_FLAVORS} gusti.{' '}
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

function StepBase({ config, set }) {
  return (
    <>
      <StepHeader num={4} title="Quale base preferisci?" />
      <div className="opt-grid cols-2">
        {cakeBases.map((b) => (
          <button
            key={b.id}
            className={`opt-card ${config.baseId === b.id ? 'selected' : ''}`}
            onClick={() => set({ baseId: b.id })}
          >
            <div className="opt-name">{b.name}</div>
            <div className="opt-desc">{b.desc}</div>
            <div className="opt-meta">{b.priceDelta > 0 ? `+ €${b.priceDelta}` : 'inclusa'}</div>
          </button>
        ))}
      </div>
    </>
  );
}

function StepDecoration({ config, set }) {
  return (
    <>
      <StepHeader num={5} title="Decorazione" lead="Lo stile che vedi sopra. Le immagini sono indicative — ogni torta è decorata a mano." />
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
  return (
    <>
      <StepHeader num={6} title="Scritta e candelina" lead="Una frase importante? Divertente, romantica, dolce, scherzosa…" />

      <div className="cfg-field">
        <label>Scritta sulla torta (max 30 caratteri)</label>
        <input
          type="text"
          maxLength={30}
          placeholder="Es. Buon compleanno Anna!"
          value={config.message}
          onChange={(e) => set({ message: e.target.value })}
        />
        <p className="hint">{config.message.length}/30 — appare in anteprima a sinistra ✨</p>
      </div>

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
  // Data minima: domani
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return (
    <>
      <StepHeader
        num={7}
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
  const type = cakeTypes.find((t) => t.id === config.type);
  const size = cakeSizes.find((s) => s.id === config.sizeId);
  const base = cakeBases.find((b) => b.id === config.baseId);
  const deco = cakeDecorations.find((d) => d.id === config.decoration);
  return (
    <>
      <StepHeader num={8} title="Riepilogo" lead="Controlla tutto e invia la richiesta su WhatsApp. Ti rispondiamo a mano!" />
      <div className="summary-box">
        <dl>
          <dt>Tipo</dt><dd>{type?.name}</dd>
          <dt>Dimensione</dt><dd>{size?.label} · Ø {size?.diameter}cm</dd>
          <dt>Base</dt><dd>{base?.name}</dd>
          <dt>Gusti</dt><dd>{config.flavors.map((f) => f.name).join(', ') || '—'}</dd>
          <dt>Decoraz.</dt><dd>{deco?.name}</dd>
          {config.message && (<><dt>Scritta</dt><dd>"{config.message}"</dd></>)}
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
