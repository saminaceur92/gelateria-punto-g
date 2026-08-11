/*
  impeccable:direction-contract /v2 (HomeV2) — seed 4125aeb2, code-led.
  THESIS: la trasparenza è l'appetito — la homepage come etichetta alimentare
  italiana d'autore; rifiutata la vetrina di categoria crema+corsivo+pastello.
  OWN-WORLD: campo azzurrino chiaro #d8eaf3, bande e azioni azzurro profondo
  #2c7699/#235f7d (colori scelti dai proprietari), superfici etichetta panna
  #fdfaf2 con filetto, accento legno #c0894c, inchiostro testa di moro #32281f;
  Archivo condensed/expanded, Kode Mono per dati, Caveat per note a mano;
  filetti, tabelle, marchi tondi, timbri, QR. Il viola non è più brand.
  STORY: leggi l'etichetta → ti fidi (gusti, allergeni, numeri, orari veri) →
  agisci (carta gusti, torta, WhatsApp).
  FIRST-VIEWPORT: fascia produttore; "IL GELATO CHE TI EMOZIONA." gigante;
  coppetta annotata a linee di richiamo; celle dati; marchi SL/VEG/SG; due CTA;
  timbro "FRESCO DI OGGI" che si stampa al load (interazione firma).
  FINISH: unreviewed and undocumented is unfinished; this build ends with the
  finish review, the verdict, and DESIGN.md.
*/
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView, animate, useReducedMotion } from 'framer-motion';
import {
  MapPin, Phone, Instagram, Facebook, Clock, Menu as MenuIcon, X,
  ArrowRight, ArrowDown, Bike, Snowflake, Award, Cake,
} from 'lucide-react';
import { flavorCategories as fallbackCategories } from '../data/flavors';
import { openingHours as fallbackHours } from '../data/hours';
import { fetchMenu, fetchHours } from '../data/live';
import galleryImages from '../data/galleryImages';
import CakePreview from '../components/CakePreview';
import CakeConfigurator from '../components/CakeConfigurator';
import { CakeDataProvider } from '../data/CakeDataProvider';
import QrCode from '../components/QrCode';
import '../styles/v2.css';

const WA_URL = 'https://api.whatsapp.com/send?phone=393203306009';
const MAPS_URL = 'https://goo.gl/maps/s96Pk7NbEPJhneC66';
const IG_URL = 'https://www.instagram.com/gelateriapuntogicarpi/';
const FB_URL = 'https://www.facebook.com/gelateriapuntogicarpi';

/* ---------- Programma ornato: piccoli SVG nel tratto del mondo ---------- */

const orn = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

const OrnCono = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...orn} aria-hidden="true">
    <path d="M7.5 10.5 12 21l4.5-10.5" />
    <path d="M7.5 10.5a4.5 4.5 0 0 1 9 0" />
    <path d="m9 13 5-2M10 16l3.5-1.5" />
  </svg>
);
const OrnCoppetta = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...orn} aria-hidden="true">
    <path d="M5.5 12h13l-1.8 8H7.3z" />
    <path d="M7 12a3.2 3.2 0 0 1 3-4.5A3.4 3.4 0 0 1 12 5a3.4 3.4 0 0 1 2 2.5A3.2 3.2 0 0 1 17 12" />
  </svg>
);
const OrnGocciaNo = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...orn} aria-hidden="true">
    <path d="M12 3.5c2.9 3.5 5 6 5 8.5a5 5 0 1 1-10 0c0-2.5 2.1-5 5-8.5z" />
    <path d="M5 19 19 5" />
  </svg>
);
const OrnTorta = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...orn} aria-hidden="true">
    <path d="M4 20h16" />
    <path d="M5.5 20v-5h13v5" />
    <path d="M7 15v-4h10v4" />
    <path d="M12 11V8.5" />
    <circle cx="12" cy="7" r="1.2" />
  </svg>
);

const HeartMark = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 21s-7.5-4.9-9.5-9.2C1 8.2 3 5 6.2 5c2 0 3.6 1.1 4.4 2.7h2.8C14.2 6.1 15.8 5 17.8 5 21 5 23 8.2 21.5 11.8 19.5 16.1 12 21 12 21z" />
  </svg>
);

const WaGlyph = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
    <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.842 2.708.842.36 0 .724-.075 1.062-.244.5-.247 1.232-.823 1.434-1.43.057-.148.057-.295.072-.443-.067-.115-.247-.18-.434-.247z" />
    <path d="M16.04 0h-.083C7.176 0 .002 7.176.002 16.005c0 3.5 1.13 6.74 3.045 9.376L1.038 31.405l6.243-1.99a15.93 15.93 0 0 0 8.76 2.61c8.78 0 15.957-7.176 15.957-16.005C32 7.18 24.824 0 16.04 0zm0 28.526c-2.81 0-5.42-.85-7.6-2.31l-5.297 1.69 1.722-5.13a13.14 13.14 0 0 1-2.55-7.793c0-7.27 5.94-13.18 13.215-13.18 7.27 0 13.225 5.91 13.225 13.18 0 7.275-5.955 13.18-13.225 13.18z" />
  </svg>
);

/* Marchio tondo tipo certificazione (SL / VEG / SG) */
function CertMark({ id, abbr, label }) {
  const ring = `GELATERIA PUNTO GI · ${label} · `;
  return (
    <span className="v2-mark" title={label}>
      <svg width="88" height="88" viewBox="0 0 88 88" role="img" aria-label={`Marchio: ${label}`}>
        <circle cx="44" cy="44" r="42" fill="var(--v2-label)" stroke="var(--v2-ink)" strokeWidth="2" />
        <circle cx="44" cy="44" r="27" fill="none" stroke="var(--v2-ink)" strokeWidth="1.5" />
        <defs>
          <path id={`ring-${id}`} d="M44 10.5a33.5 33.5 0 1 1 0 67 33.5 33.5 0 1 1 0-67" />
        </defs>
        <text style={{ font: '600 7.5px "Kode Mono", monospace', letterSpacing: '0.12em', fill: 'var(--v2-ink-soft)', textTransform: 'uppercase' }}>
          <textPath href={`#ring-${id}`}>{ring}</textPath>
        </text>
        <text x="44" y="51" textAnchor="middle" style={{ font: '900 20px Archivo, sans-serif', fill: 'var(--v2-mare)', letterSpacing: '-0.02em' }}>
          {abbr}
        </text>
      </svg>
    </span>
  );
}

/* Codice a barre decorativo */
function Barcode() {
  const bars = [3, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 3, 1, 2, 1, 1, 2, 3, 1, 2, 1, 3, 1, 2, 2, 1, 3, 1];
  let x = 0;
  return (
    <svg className="v2-barcode" width="164" height="46" viewBox="0 0 164 46" aria-hidden="true">
      {bars.map((w, i) => {
        const bar = <rect key={i} x={x} y="0" width={w * 1.8} height="32" fill="currentColor" />;
        x += w * 1.8 + 2.4;
        return bar;
      })}
      <text x="0" y="43">PUNTO·GI·41012·CARPI</text>
    </svg>
  );
}

/* Contatore che parte quando entra a schermo (rispetta riduci-animazioni) */
function Counter({ to, duration = 1.8 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return undefined;
    if (reduce) { setN(to); return undefined; }
    const controls = animate(0, to, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setN(Math.round(v)) });
    return () => controls.stop();
  }, [inView, to, duration, reduce]);
  return <span ref={ref}>{String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</span>;
}

/* ---------- Nav ---------- */

const NAV_LINKS = [
  { href: '#gusti', label: 'La carta' },
  { href: '#ricetta', label: 'La ricetta' },
  { href: '#servizi', label: 'Servizi' },
  { href: '#torta', label: 'Torte' },
  { href: '#banco', label: 'Il banco' },
  { href: '#dove', label: 'Dove' },
  { href: '/allergeni', label: 'Allergeni' },
];

function NavV2({ onOpenConfigurator }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      <p className="v2-topline">
        <span className="long">Gelateria artigianale · mantecato ogni mattina in Via Remesina Interna 46, Carpi (MO)</span>
        <span className="short">Gelateria artigianale · Carpi (MO)</span>
      </p>
      <header className={`v2-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="v2-wrap v2-nav-inner">
          <a href="#top" className="v2-brand">
            <img src="/logo.png" alt="Logo Gelateria Punto Gi!" />
            <span>
              Punto Gi<span className="dot">!</span>
              <small>Etichetta N. 2 · Carpi</small>
            </span>
          </a>
          <nav aria-label="Sommario">
            <ul className="v2-nav-links">
              {NAV_LINKS.map((l) => (
                <li key={l.href}><a href={l.href}>{l.label}</a></li>
              ))}
            </ul>
          </nav>
          <div className="v2-nav-cta">
            <button type="button" className="v2-btn v2-btn-primary" onClick={() => onOpenConfigurator()}>
              <Cake size={16} /> La tua torta
            </button>
            <button type="button" className="v2-nav-toggle" aria-label="Apri il sommario" onClick={() => setOpen(true)}>
              <MenuIcon size={20} />
            </button>
          </div>
        </div>
      </header>
      <AnimatePresence>
        {open && (
          <motion.div
            className="v2-mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <button type="button" className="v2-mobile-close" aria-label="Chiudi il sommario" onClick={() => setOpen(false)}>
              <X size={26} />
            </button>
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </a>
            ))}
            <a
              className="cta"
              href="#torta"
              onClick={() => { setOpen(false); setTimeout(() => onOpenConfigurator(), 300); }}
            >
              La tua torta <small>configuratore</small>
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ---------- Hero: l'etichetta ---------- */

function HeroLabel({ onOpenConfigurator, reduce }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const lotto = `LOTTO PG-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

  const fade = (delay = 0) => (reduce ? {} : {
    initial: { opacity: 0, y: 22 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] },
  });

  return (
    <section id="top" className="v2-hero">
      <div className="v2-wrap">
        <motion.div
          className="v2-sheet v2-hero-sheet"
          {...(reduce ? {} : {
            initial: { opacity: 0, y: 30 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
          })}
        >
          <div className="v2-hero-topline">
            <span className="v2-campo">Gelateria Punto Gi! · Carpi (MO)</span>
            <span className="v2-campo">{lotto}</span>
          </div>

          <div className="v2-hero-grid">
            <div className="v2-hero-lead">
              <motion.p className="v2-campo" style={{ color: 'var(--v2-ink-soft)', marginTop: 'var(--v2-s4)' }} {...fade(0.15)}>
                Denominazione di vendita
              </motion.p>
              <motion.h1 className="v2-display" {...fade(0.25)}>
                Il gelato<br />che ti<br />
                <span className="accent">emoziona</span><span className="dot">.</span>
              </motion.h1>
            </div>

            <div className="v2-hero-visual">
              <motion.figure
                className="v2-photo-window"
                style={{ margin: 0 }}
                {...(reduce ? {} : {
                  initial: { clipPath: 'inset(100% 0 0 0)' },
                  animate: { clipPath: 'inset(0% 0 0 0)' },
                  transition: { duration: 1, delay: 0.35, ease: [0.16, 1, 0.3, 1] },
                })}
              >
                <img src="/hero-cup.jpg" alt="Coppetta di gelato artigianale Punto Gi!" />
                <figcaption className="v2-photo-caption">Fig. 1 — La coppetta</figcaption>
                <motion.div
                  className="v2-stamp v2-stamp-hero"
                  {...(reduce ? {} : {
                    initial: { opacity: 0, scale: 2.2, rotate: 3 },
                    animate: { opacity: 1, scale: 1, rotate: -7 },
                    transition: { type: 'spring', stiffness: 300, damping: 16, delay: 1.1 },
                  })}
                >
                  Fresco di oggi
                  <small>{dateStr} · Carpi (MO)</small>
                </motion.div>
              </motion.figure>

              <motion.div className="v2-annos" {...fade(0.9)} aria-hidden="true">
                <span className="v2-anno" style={{ top: '-16px', left: '-4%' }}>cremoso e denso, come una volta</span>
                <svg className="v2-anno-line" style={{ top: '34px', left: '18%' }} width="40" height="46">
                  <line className="halo" x1="6" y1="0" x2="30" y2="40" />
                  <line x1="6" y1="0" x2="30" y2="40" />
                  <circle cx="30" cy="40" r="3.5" />
                </svg>
                <span className="v2-anno" style={{ top: '38%', right: '-14px' }}>mantecato di stamattina</span>
                <svg className="v2-anno-line" style={{ top: '46%', right: '30%' }} width="52" height="34">
                  <line className="halo" x1="52" y1="4" x2="6" y2="28" />
                  <line x1="52" y1="4" x2="6" y2="28" />
                  <circle cx="6" cy="28" r="3.5" />
                </svg>
              </motion.div>
              <div className="v2-annos-fallback">
                <span>cremoso e denso, come una volta</span>
                <span>mantecato di stamattina</span>
              </div>

            </div>

            <div className="v2-data-cells">
              <div className="v2-data-cell">
                <strong>12.000+</strong>
                <span>kg / anno</span>
              </div>
              <div className="v2-data-cell">
                <strong>30+</strong>
                <span>gusti in carta</span>
              </div>
              <div className="v2-data-cell">
                <strong>365</strong>
                <span>giorni freschi</span>
              </div>
            </div>

            <motion.p className="v2-ingredienti" {...fade(0.45)}>
                <strong>INGREDIENTI:</strong> gelato mantecato ogni mattina; una ricetta
                unica, creata e perfezionata da noi negli anni; cremoso, corposo, denso
                come quello <em>"di una volta"</em>; leggero da digerire. Disponibile
                anche <strong>SENZA LATTOSIO</strong> e <strong>VEGAN</strong>.
              </motion.p>

              <motion.div className="v2-hero-ctas" {...fade(0.6)}>
                <a className="v2-btn v2-btn-primary" href="#gusti">
                  Scopri i gusti <ArrowDown size={16} />
                </a>
                <button type="button" className="v2-btn v2-btn-ghost" onClick={() => onOpenConfigurator()}>
                  <Cake size={16} /> Crea la tua torta
                </button>
              </motion.div>

            <motion.div className="v2-hero-stamp-row" {...fade(0.75)}>
              <div className="v2-marks">
                <CertMark id="sl" abbr="SL" label="Senza lattosio" />
                <CertMark id="veg" abbr="VEG" label="Vegan friendly" />
                <CertMark id="sg" abbr="SG" label="Senza glutine" />
              </div>
              <Barcode />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- Nastro ---------- */

const TAPE_ITEMS = [
  'Artigianale', 'Senza lattosio', 'Vegan friendly', 'Fresco ogni giorno',
  'Made in Carpi', 'Torte su misura', 'Granite siciliane', 'Pasticceria a freddo',
];

function Tape() {
  return (
    <div className="v2-tape" aria-hidden="true">
      <div className="v2-tape-track">
        {[0, 1].map((half) => (
          <span key={half}>
            {TAPE_ITEMS.map((it) => (
              <span key={it} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--v2-s4)' }}>
                {it}
                <OrnGocciaNo size={15} />
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- La carta dei gusti ---------- */

function CartaGusti({ reduce }) {
  const [categories, setCategories] = useState(fallbackCategories);
  const [active, setActive] = useState(fallbackCategories[0].id);

  useEffect(() => {
    let alive = true;
    fetchMenu().then((data) => {
      if (alive && data?.length) setCategories(data);
    });
    return () => { alive = false; };
  }, []);

  const current = categories.find((c) => c.id === active) || categories[0];

  return (
    <section id="gusti" className="v2-section">
      <div className="v2-wrap">
        <div className="v2-sheet v2-section-sheet">
          <div className="v2-head">
            <h2 className="v2-display">La carta dei gusti</h2>
            <span className="v2-campo">Stagionale · aggiornata dallo staff</span>
          </div>

          <div className="v2-tabs" role="tablist" aria-label="Categorie di gusti">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={active === c.id}
                className={`v2-tab ${active === c.id ? 'active' : ''}`}
                onClick={() => setActive(c.id)}
              >
                {c.name}
                <span className="count">{c.flavors.length}</span>
              </button>
            ))}
          </div>

          <p className="v2-cat-desc">{current.description}</p>

          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              className="v2-flavors"
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              {current.flavors.map((f) => {
                const firma = f.tag === 'firma';
                return (
                  <div key={f.name} className={`v2-flavor ${firma ? 'firma' : ''}`}>
                    <span className="v2-flavor-chip" style={{ background: f.color }} />
                    <span className="v2-flavor-name">{f.name}</span>
                    <span className="v2-flavor-fill" />
                    {firma && <span className="v2-firma-tag">Gusto firma</span>}
                    {!firma && f.tag && <span className="v2-diet-mark">{f.tag}</span>}
                    {f.diet?.map((d) => (
                      <span key={d.short} className="v2-diet-mark" title={d.label}>{d.short}</span>
                    ))}
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>

          <div className="v2-menu-foot">
            <span className="v2-legend">SL senza lattosio · SG senza glutine · VEG vegan · altri gusti stagionali in vetrina</span>
            <a className="v2-allergeni-link" href="/allergeni">
              Quaderno allergeni completo <ArrowRight size={15} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Dichiarazione del laboratorio ---------- */

const FACTS = [
  { label: 'Gelato mantecato', value: 12000, suffix: ' kg', prefix: '+' },
  { label: 'Torte create', value: 2000, prefix: '+' },
  { label: 'Giorni di produzione', value: 365, suffix: ' /365' },
  { label: 'Torte sfornate fresche', text: 'ogni giorno' },
];

function ValoriLab() {
  return (
    <section id="valori" className="v2-section">
      <div className="v2-wrap v2-valori-grid">
        <div className="v2-valori-copy">
          <h2 className="v2-display">Piccolo laboratorio,<br /><em>grandi numeri.</em></h2>
          <p>
            Artigianale non vuol dire poco: ecco quanto lavoriamo, fresco, ogni
            giorno. Li dichiariamo come su un'etichetta — perché sono veri.
          </p>
        </div>
        <div className="v2-facts">
          <p className="v2-facts-title">Dichiarazione del laboratorio</p>
          <p className="v2-facts-sub">Valori medi per anno di produzione</p>
          {FACTS.map((f) => (
            <div className="v2-fact" key={f.label}>
              <span className="v2-fact-label">{f.label}</span>
              <span className="v2-fact-value">
                {f.text ? f.text : (
                  <>
                    {f.prefix}<Counter to={f.value} /><small>{f.suffix}</small>
                  </>
                )}
              </span>
            </div>
          ))}
          <p className="v2-facts-note">* Valori reali del nostro laboratorio di Via Remesina Interna, Carpi.</p>
        </div>
      </div>
    </section>
  );
}

/* ---------- La ricetta ---------- */

const CLAUSOLE = [
  { icon: <OrnCono size={20} />, title: 'Ricetta di famiglia', text: 'Sviluppata e affinata negli anni nel nostro laboratorio.' },
  { icon: <Snowflake size={20} />, title: 'Mantecato fresco', text: 'Produzione quotidiana, mai scorte di magazzino.' },
  { icon: <OrnGocciaNo size={20} />, title: 'Per tutti', text: 'Versioni senza lattosio e senza glutine sempre disponibili.' },
  { icon: <Award size={20} />, title: 'Materie prime top', text: 'Pistacchio, nocciola e cioccolato selezionati con cura.' },
];

function Ricetta() {
  return (
    <section id="ricetta" className="v2-section">
      <div className="v2-wrap">
        <div className="v2-sheet v2-section-sheet">
          <div className="v2-head">
            <h2 className="v2-display">La ricetta</h2>
            <span className="v2-campo">Via Remesina Interna 46 · dal laboratorio</span>
          </div>
          <div className="v2-ricetta-grid">
            <div className="v2-ricetta-photos">
              <figure className="v2-campione v2-campione-1" style={{ margin: 0 }}>
                <img src="/gelato.jpg" alt="Gelato cremoso artigianale appena mantecato" />
                <figcaption>Campione fotografico N. 1 — il mantecato</figcaption>
              </figure>
              <figure className="v2-campione v2-campione-2" style={{ margin: 0 }}>
                <img src="/torte.jpg" alt="Torte gelato decorate a mano" />
                <figcaption>Campione N. 2 — le torte</figcaption>
              </figure>
            </div>
            <div className="v2-ricetta-copy">
              <p className="v2-script">"come quello di una volta"</p>
              <p>
                A Carpi, in via Remesina Interna, c'è un piccolo laboratorio dove
                ogni mattina nasce qualcosa di speciale. Selezioniamo materie prime
                di qualità, lavoriamo con tempi lenti e ci mettiamo passione vera —
                quella che si sente al primo cucchiaio.
              </p>
              <div className="v2-disciplinare">
                {CLAUSOLE.map((c) => (
                  <div className="v2-clausola" key={c.title}>
                    <span className="orn">{c.icon}</span>
                    <div>
                      <h4>{c.title}</h4>
                      <p>{c.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="v2-script" style={{ marginTop: 'var(--v2-s4)', transform: 'rotate(-2deg)' }}>
                Ti aspettiamo per farti emozionare!
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Servizi ---------- */

function Servizi({ onOpenConfigurator }) {
  return (
    <section id="servizi" className="v2-section">
      <div className="v2-wrap">
        <div className="v2-head v2-head-inverse">
          <h2 className="v2-display">Servizi del banco</h2>
          <span className="v2-campo">Tutto ciò che puoi desiderare</span>
        </div>
        <div className="v2-servizi-rows">
          <a className="v2-servizio" href={WA_URL} target="_blank" rel="noopener noreferrer">
            <span className="orn"><Bike size={26} /></span>
            <h3>Consegna a domicilio</h3>
            <p>Ordini su WhatsApp o sulle piattaforme partner e il gelato arriva da te.</p>
            <span className="go"><ArrowRight size={18} /></span>
          </a>
          <button type="button" className="v2-servizio" onClick={() => onOpenConfigurator()}>
            <span className="orn"><OrnTorta size={26} /></span>
            <h3>Torte su prenotazione</h3>
            <p>Compleanno, anniversario o pranzo dei parenti: prenota la torta perfetta, anche CROCK.</p>
            <span className="go"><ArrowRight size={18} /></span>
          </button>
          <a className="v2-servizio" href="#gusti">
            <span className="orn"><OrnCoppetta size={26} /></span>
            <h3>Pasticceria a freddo</h3>
            <p>Granite siciliane, pasticcini, semifreddi, ghiaccioli, salame dolce e tante altre leccornie.</p>
            <span className="go"><ArrowRight size={18} /></span>
          </a>
          <a className="v2-servizio" href="/allergeni">
            <span className="orn"><OrnGocciaNo size={26} /></span>
            <h3>Senza lattosio &amp; vegan</h3>
            <p>Intolleranze o scelte di gusto? Tante varianti senza lattosio, senza glutine e 100% vegan.</p>
            <span className="go"><ArrowRight size={18} /></span>
          </a>
        </div>
      </div>
    </section>
  );
}

/* ---------- La tua torta ---------- */

const DEMO_CAKE = {
  type: 'crock',
  sizeId: '10',
  flavors: [
    { name: 'Pistacchio', color: '#7ea15a' },
    { name: 'Cioccolato fondente', color: '#2a160e' },
  ],
  decoration: 'frutta',
  message: 'Buon Compleanno!',
  candle: true,
};

function TortaSection({ onOpenConfigurator }) {
  return (
    <section id="torta" className="v2-section">
      <div className="v2-wrap">
        <div className="v2-sheet v2-section-sheet">
          <div className="v2-head">
            <h2 className="v2-display">La tua torta, su ordinazione</h2>
            <span className="v2-campo">Configuratore guidato · pronta in giornata</span>
          </div>
          <div className="v2-torta-grid">
            <div className="v2-torta-copy">
              <p>
                Scegli tipo, gusti, base, decorazioni e scritta passo per passo —
                noi la prepariamo a mano per te. Niente stress, solo dolcezza.
              </p>
              <div className="v2-torta-specs">
                <div className="v2-spec">
                  <strong>Personalizzata</strong>
                  <span>gusti · decoro · scritta</span>
                </div>
                <div className="v2-spec">
                  <strong>Passo per passo</strong>
                  <span>4 minuti, guidati</span>
                </div>
                <div className="v2-spec">
                  <strong>Min. 5 ore</strong>
                  <span>preavviso di ritiro</span>
                </div>
              </div>
              <div className="v2-diet-chips">
                <span className="lbl">Alternative:</span>
                <button type="button" className="v2-chip" onClick={() => onOpenConfigurator({ allergies: ['glutine'] })}>
                  Senza glutine
                </button>
                <button type="button" className="v2-chip" onClick={() => onOpenConfigurator({ allergies: ['latte'] })}>
                  Senza lattosio
                </button>
                <button type="button" className="v2-chip" onClick={() => onOpenConfigurator({ allergies: ['latte', 'uova'] })}>
                  Vegana
                </button>
              </div>
              <div className="v2-torta-ctas">
                <button type="button" className="v2-btn v2-btn-primary" onClick={() => onOpenConfigurator()}>
                  <Cake size={16} /> Inizia ora
                </button>
                <a className="v2-btn v2-btn-ghost" href="#dove">Preferisco scrivere</a>
              </div>
            </div>
            <div className="v2-torta-visual">
              <div className="v2-stamp v2-torta-stamp">
                Min. 5 ore
                <small>preavviso</small>
              </div>
              <figure className="v2-torta-frame" style={{ margin: 0 }}>
                <CakePreview config={DEMO_CAKE} />
                <figcaption>Anteprima dal configuratore — poi la facciamo a mano</figcaption>
              </figure>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Il banco di oggi ---------- */

function Banco() {
  // Le prime foto del batch ritraggono le coppette viola d'epoca: si parte più
  // avanti nel rullino perché il brand oggi è azzurro+legno (scelta dei titolari).
  const base = galleryImages?.length ? galleryImages : ['/hero-cup.jpg', '/torte.jpg', '/semifreddi.jpg', '/pasticcini.jpg', '/gelato.jpg'];
  const imgs = base.length > 12 ? [...base.slice(9), ...base.slice(0, 9)] : base;
  return (
    <section id="banco" className="v2-gallery">
      <div className="v2-wrap v2-gallery-head">
        <div className="v2-head v2-head-inverse">
          <h2 className="v2-display">Il banco di oggi</h2>
          <span className="v2-scroll-hint">Scorri i campioni <ArrowRight size={14} /></span>
        </div>
      </div>
      <div className="v2-gallery-strip" aria-label="Le nostre creazioni">
        {imgs.map((src, i) => (
          <figure className="v2-shot" key={src}>
            <img src={src} alt={`Creazione della Gelateria Punto Gi! numero ${i + 1}`} loading="lazy" />
            <figcaption>
              <span>Campione N. {String(i + 1).padStart(2, '0')}</span>
              <span>Punto Gi!</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/* ---------- Dove & quando ---------- */

function Dove() {
  const [hours, setHours] = useState(fallbackHours);
  useEffect(() => {
    let alive = true;
    fetchHours().then((data) => {
      if (alive && data?.length) setHours(data);
    });
    return () => { alive = false; };
  }, []);

  const todayName = new Date().toLocaleDateString('it-IT', { weekday: 'long' }).toLowerCase().slice(0, 3);

  return (
    <section id="dove" className="v2-section">
      <div className="v2-wrap">
        <div className="v2-sheet v2-section-sheet">
          <div className="v2-head">
            <h2 className="v2-display">Dove &amp; quando</h2>
            <span className="v2-campo">Prodotto e venduto da Gelateria Punto Gi!</span>
          </div>
          <div className="v2-dove-grid">
            <div className="v2-dove-col">
              <h3>Recapiti</h3>
              <div className="v2-info-row">
                <span className="ic"><MapPin size={19} /></span>
                <div>
                  <span className="sub">Indirizzo</span>
                  <a href={MAPS_URL} target="_blank" rel="noopener noreferrer">
                    Via Remesina Interna 46<br />41012 Carpi (MO)
                  </a>
                </div>
              </div>
              <div className="v2-info-row">
                <span className="ic"><Phone size={19} /></span>
                <div>
                  <span className="sub">Whatsappaci</span>
                  <a href={WA_URL} target="_blank" rel="noopener noreferrer">320 330 6009</a>
                </div>
              </div>
              <div className="v2-info-row">
                <span className="ic"><Instagram size={19} /></span>
                <div>
                  <span className="sub">Seguici</span>
                  <a href={IG_URL} target="_blank" rel="noopener noreferrer">@gelateriapuntogicarpi</a>
                </div>
              </div>
              <div className="v2-qr-row">
                <QrCode value={WA_URL} size={92} dark="#32281f" title="QR per scriverci su WhatsApp" />
                <p>Inquadra il codice<br />e scrivici<br />su WhatsApp</p>
              </div>
            </div>

            <div className="v2-dove-col">
              <h3><Clock size={16} style={{ verticalAlign: '-2px', marginRight: 8 }} />Orari di apertura</h3>
              <table className="v2-hours">
                <tbody>
                  {hours.map((o) => {
                    const isToday = o.day.toLowerCase().startsWith(todayName);
                    return (
                      <tr key={o.day} className={isToday ? 'today' : ''}>
                        <td>
                          {o.day}
                          {isToday && <span className="v2-oggi-badge">Oggi</span>}
                        </td>
                        <td>{o.hours}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="v2-dove-col">
              <h3>La mappa</h3>
              <div className="v2-map-window">
                <iframe
                  title="Mappa Gelateria Punto Gi! Carpi"
                  src="https://www.google.com/maps?q=Via+Remesina+Interna+46,+Carpi+MO&output=embed"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
            </div>
          </div>

          <div className="v2-dove-cta">
            <span className="v2-script">Un cucchiaio e ci conosci.</span>
            <a className="v2-btn v2-btn-accent" href={WA_URL} target="_blank" rel="noopener noreferrer">
              <WaGlyph size={18} /> Scrivici su WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */

function FooterV2() {
  const year = new Date().getFullYear();
  return (
    <footer className="v2-footer">
      <div className="v2-wrap">
        <div className="v2-footer-grid">
          <div>
            <a href="#top" className="v2-brand" style={{ color: 'var(--v2-label)' }}>
              <img src="/logo.png" alt="" />
              <span>
                Punto Gi<span className="dot">!</span>
                <small style={{ color: 'var(--v2-cielo)' }}>Gelateria · Carpi</small>
              </span>
            </a>
            <p style={{ marginTop: 'var(--v2-s3)' }}>
              Il gelato che ti emoziona. Artigianale, cremoso, fresco ogni giorno —
              anche senza lattosio e vegan.
            </p>
          </div>
          <ul className="v2-footer-links">
            <li><a href="/">Classica</a></li>
            <li><a href="/v3">V3 · Sagra</a></li>
            <li><a href="/v4">V4 · Marmo</a></li>
            <li><a href="/v5">V5 · Vassoio</a></li>
            <li><a href="/allergeni">Allergeni</a></li>
            <li><a href="#gusti">La carta</a></li>
            <li><a href="#dove">Dove &amp; quando</a></li>
          </ul>
          <div className="v2-socials">
            <a href={IG_URL} aria-label="Instagram" target="_blank" rel="noopener noreferrer"><Instagram size={18} /></a>
            <a href={FB_URL} aria-label="Facebook" target="_blank" rel="noopener noreferrer"><Facebook size={18} /></a>
            <a href={WA_URL} aria-label="WhatsApp" target="_blank" rel="noopener noreferrer"><WaGlyph size={18} /></a>
          </div>
        </div>
        <div className="v2-footer-bottom">
          <span>© {year} Gelateria Punto Gi! · Tutti i diritti riservati</span>
          <span>Etichetta N. 2 in anteprima — la home attuale resta su "/"</span>
          <span>Fatto con <span className="heart"><HeartMark /></span> a Carpi</span>
        </div>
      </div>
    </footer>
  );
}

/* ---------- Pagina ---------- */

export default function HomeV2() {
  const reduce = useReducedMotion();
  const [cfg, setCfg] = useState({ open: false, initial: undefined });
  const openCfg = (initial) => setCfg({ open: true, initial: initial && initial.allergies ? initial : undefined });
  const closeCfg = () => setCfg((c) => ({ ...c, open: false }));

  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Punto Gi! – La nuova etichetta (anteprima) | Carpi';
    const meta = document.querySelector('meta[name="theme-color"]');
    const prevTheme = meta?.getAttribute('content');
    meta?.setAttribute('content', '#235f7d');
    const prevBg = document.body.style.background;
    document.body.style.background = '#d8eaf3';
    return () => {
      document.title = prevTitle;
      if (meta && prevTheme) meta.setAttribute('content', prevTheme);
      document.body.style.background = prevBg;
    };
  }, []);

  return (
    <div className="v2">
      <NavV2 onOpenConfigurator={openCfg} />
      <main>
        <HeroLabel onOpenConfigurator={openCfg} reduce={reduce} />
        <Tape />
        <CartaGusti reduce={reduce} />
        <ValoriLab />
        <Ricetta />
        <Servizi onOpenConfigurator={openCfg} />
        <TortaSection onOpenConfigurator={openCfg} />
        <Banco />
        <Dove />
      </main>
      <FooterV2 />
      <a
        className="v2-fab"
        href={WA_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contattaci su WhatsApp"
      >
        <WaGlyph size={26} />
      </a>
      <CakeDataProvider>
        <CakeConfigurator open={cfg.open} initial={cfg.initial} onClose={closeCfg} />
      </CakeDataProvider>
    </div>
  );
}
