/*
  impeccable:direction-contract /v8 (HomeV8) — direzione PINNATA DALL'UTENTE
  ("coerente con la loro gelateria", 4 foto reali in C:\Users\samin\Pictures\
  puntogi), code-led, niente roll: le foto sono il brief.
  THESIS: la homepage è il LORO negozio — parete tortora col motto 3D reale
  "GELATO MAKES YOU HAPPY", banco a pozzetti coperti, pannelli a pois, legno
  col medaglione; nessuna metafora: è casa loro.
  OWN-WORLD (misurato dalle foto): parete #6b6058 con lettere 3D bianche,
  pavimento marmo #ece7dc, pannello pois azzurrino #cfe4e0 con cerchi panna,
  legno rustico #b98d57 con medaglione del logo, coperchi pozzetti in acciaio,
  zoccolo moro #3a2f26, azioni azzurro brand #2c7699, tocco oro #c9a35c;
  Baloo 2 (le lettere bold e tonde del muro, dal post IG giugno 2024) con le
  COLATURE azzurrine #b5d8e6 che gocciolano sulla riga GELATO + Nunito Sans
  + Caveat.
  STORY: riconosci il negozio → sollevi un coperchio (i gusti veri) → ordini.
  FIRST-VIEWPORT: la parete col motto 3D + payoff; il banco con 8 POZZETTI
  COPERTI cliccabili — il coperchio si solleva e rivela il colore vero del
  gusto (interazione firma; il primo si apre da solo come invito); fronte
  legno+medaglione | pois; zoccolo; CTA.
  FINISH: unreviewed and undocumented is unfinished; this build ends with the
  finish review, the verdict, and the surface brief record.
*/
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Menu as MenuIcon, X, Instagram, Facebook, MapPin, Phone, Clock, Cake, ArrowDown, ArrowRight,
} from 'lucide-react';
import {
  WA_URL, MAPS_URL, IG_URL, FB_URL, MAP_EMBED, VERSIONS,
  useMenu, useHours, todayKey, Counter, WaGlyph, usePageChrome,
} from './v-shared';
import CakePreview from '../components/CakePreview';
import CakeConfigurator from '../components/CakeConfigurator';
import { CakeDataProvider } from '../data/CakeDataProvider';
import QrCode from '../components/QrCode';
import '../styles/v8.css';

/* Ornati del banco, tratto 2 coerente con lucide */
const orn = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const OrnCono = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...orn} aria-hidden="true">
    <path d="M7.5 10.5 12 21l4.5-10.5" />
    <path d="M7.5 10.5a4.5 4.5 0 0 1 9 0" />
    <path d="m9 13 5-2M10 16l3.5-1.5" />
  </svg>
);
const OrnVaschetta = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...orn} aria-hidden="true">
    <path d="M4 11h16l-1.5 8h-13z" />
    <path d="M4 11a4 4 0 0 1 5-3.9A3.5 3.5 0 0 1 12 5a3.5 3.5 0 0 1 3 2.1A4 4 0 0 1 20 11" />
  </svg>
);
const OrnGranita = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...orn} aria-hidden="true">
    <path d="M8 9h8l-1.2 12H9.2z" />
    <path d="M7 9a5 5 0 0 1 10 0" />
    <path d="M15.5 4 18 2" />
  </svg>
);
const OrnGocciaNo = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...orn} aria-hidden="true">
    <path d="M12 3.5c2.9 3.5 5 6 5 8.5a5 5 0 1 1-10 0c0-2.5 2.1-5 5-8.5z" />
    <path d="M5 19 19 5" />
  </svg>
);
const OrnCucchiaino = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...orn} aria-hidden="true">
    <ellipse cx="12" cy="6.5" rx="4.2" ry="5" />
    <path d="M12 11.5V21" />
  </svg>
);

/* Le colature di gelato sulla scritta, come sul muro vero: un'unica
   silhouette liquida (bordo ondulato, lingue che si gonfiano in gocce),
   con ombra di profondità, gocce staccate e riflessi di lucido */
const MELT = 'M0 0 H400 V9 '
  + 'C396 13 392 14 386 13 C381 12 379 16 379 21 C379 30 374 34 369 34 C364 34 359 30 359 21 C359 16 357 12 351 12 '
  + 'C344 12 342 11 336 11 C330 11 328 14 328 22 C328 38 322 44 316 44 C310 44 304 38 304 22 C304 14 302 11 296 11 '
  + 'C289 11 287 12 281 12 C275 12 273 15 273 19 C273 26 269 29 265 29 C261 29 257 26 257 19 C257 15 255 12 249 12 '
  + 'C242 12 240 11 234 11 C228 11 226 14 226 20 C226 33 221 38 216 38 C211 38 206 33 206 20 C206 14 204 11 198 11 '
  + 'C191 11 189 12 183 12 C177 12 175 15 175 19 C175 24 171 26 168 26 C165 26 161 24 161 19 C161 15 159 12 153 12 '
  + 'C146 12 144 11 138 11 C132 11 130 14 130 23 C130 42 124 48 118 48 C112 48 106 42 106 23 C106 14 104 11 98 11 '
  + 'C91 11 89 12 83 12 C77 12 75 15 75 20 C75 28 71 31 67 31 C63 31 59 28 59 20 C59 15 57 12 51 12 '
  + 'C44 12 42 13 36 13 C30 13 28 16 28 22 C28 34 23 38 18 38 C13 38 8 34 8 22 C8 16 6 13 0 12 Z';

const Drips = () => (
  <svg className="drips" viewBox="0 0 400 70" preserveAspectRatio="none" aria-hidden="true">
    {/* ombra di profondità della colatura */}
    <g transform="translate(0 2.6)" fill="#8fb9cc" opacity="0.55">
      <path d={MELT} />
      <circle cx="118" cy="60" r="5.5" />
      <circle cx="316" cy="54" r="5" />
      <circle cx="67" cy="41" r="4" />
    </g>
    {/* la colatura */}
    <g fill="currentColor">
      <path d={MELT} />
      <circle cx="118" cy="60" r="5.5" />
      <circle cx="316" cy="54" r="5" />
      <circle cx="67" cy="41" r="4" />
    </g>
    {/* lucido */}
    <g fill="rgba(255,255,255,0.45)">
      <rect x="8" y="2.5" width="382" height="3" rx="1.5" />
      <ellipse cx="114" cy="26" rx="3" ry="7" />
      <ellipse cx="312" cy="23" rx="2.6" ry="6" />
      <ellipse cx="212" cy="21" rx="2.4" ry="5" />
    </g>
  </svg>
);

const NAV_LINKS = [
  { href: '#gusti', label: 'I gusti' },
  { href: '#numeri', label: 'Numeri' },
  { href: '#storia', label: 'Storia' },
  { href: '#servizi', label: 'Servizi' },
  { href: '#torta', label: 'Torte' },
  { href: '#dove', label: 'Dove' },
  { href: '/allergeni', label: 'Allergeni' },
];

function NavV8({ onOpenConfigurator }) {
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
      <header className={`v8-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="v8-wrap v8-nav-inner">
          <a href="#top" className="v8-brand">
            <img src="/logo.png" alt="Logo Gelateria Punto Gi!" />
            <span>
              <span className="nome">Punto Gi<span className="punto">!</span></span>
              <small>Gelateria · Carpi</small>
            </span>
          </a>
          <nav aria-label="Sommario">
            <ul className="v8-nav-links">
              {NAV_LINKS.map((l) => (
                <li key={l.href}><a href={l.href}>{l.label}</a></li>
              ))}
            </ul>
          </nav>
          <div className="v8-nav-cta">
            <button type="button" className="v8-btn v8-btn-azzurro" style={{ minHeight: 44, padding: '9px 18px', fontSize: '0.85rem', whiteSpace: 'nowrap' }} onClick={() => onOpenConfigurator()}>
              <Cake size={15} /> La tua torta
            </button>
            <button type="button" className="v8-nav-toggle" aria-label="Apri il sommario" onClick={() => setOpen(true)}>
              <MenuIcon size={20} />
            </button>
          </div>
        </div>
      </header>
      <AnimatePresence>
        {open && (
          <motion.div
            className="v8-mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <button type="button" className="v8-mobile-close" aria-label="Chiudi il sommario" onClick={() => setOpen(false)}>
              <X size={26} />
            </button>
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

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

const PASSI = [
  { title: 'Ricetta di famiglia', text: 'sviluppata e affinata negli anni nel nostro laboratorio' },
  { title: 'Mantecato fresco', text: 'nei pozzetti coperti, come da tradizione: si conserva meglio' },
  { title: 'Per tutti', text: 'senza lattosio e senza glutine sempre disponibili' },
  { title: 'Materie prime top', text: 'pistacchio, nocciola e cioccolato scelti con cura' },
];

export default function HomeV8() {
  const reduce = useReducedMotion();
  const categories = useMenu();
  const hours = useHours();
  const oggi = todayKey();
  const [active, setActive] = useState(null);
  const currentCat = categories.find((c) => c.id === active) || categories[0];
  const [cfg, setCfg] = useState({ open: false, initial: undefined });
  const openCfg = (initial) => setCfg({ open: true, initial: initial && initial.allergies ? initial : undefined });
  const closeCfg = () => setCfg((c) => ({ ...c, open: false }));
  const menuRef = useRef(null);

  usePageChrome('Punto Gi! – Il Negozio (anteprima V8) | Carpi', '#574e47', '#ece7dc');

  // I pozzetti: i primi 8 gusti del giorno, coperti come al banco vero
  const pozzetti = categories
    .flatMap((c) => c.flavors.map((f) => ({ ...f, catId: c.id })))
    .slice(0, 8);
  const [aperti, setAperti] = useState(() => new Set());
  const toggleLid = (i) => {
    setAperti((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };
  // Invito: il primo coperchio si solleva da solo dopo un attimo
  useEffect(() => {
    const t = setTimeout(() => setAperti((prev) => (prev.size ? prev : new Set([0]))), 1300);
    return () => clearTimeout(t);
  }, []);

  const vaiAllaCarta = (catId) => {
    setActive(catId);
    menuRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  // Il FAB compare dopo l'hero: nel primo schermo mobile coprirebbe le CTA
  // (regressione segnalata dalla finish review).
  const [fabVisibile, setFabVisibile] = useState(false);
  useEffect(() => {
    const onScroll = () => setFabVisibile(window.scrollY > 480);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const imgs = [
    { src: '/hero-cup.jpg', nome: 'La coppetta del giorno' },
    { src: '/gelato.jpg', nome: 'Il mantecato appena fatto' },
    { src: '/torte.jpg', nome: 'Le torte decorate a mano' },
    { src: '/semifreddi.jpg', nome: 'I semifreddi' },
    { src: '/pasticcini.jpg', nome: 'La pasticceria a freddo' },
  ];

  return (
    <div className="v8" id="top">
      <NavV8 onOpenConfigurator={openCfg} />
      <main>
        {/* Hero: la parete e il banco */}
        <section className="v8-hero">
          <div className="v8-parete">
            <h1 className="v8-lettere3d">
              <span className="v8-drip-line">Gelato<Drips /></span>
              <br />makes you happy
            </h1>
            <p className="payoff">
              È scritto sul muro della nostra gelateria — e il nostro{' '}
              <strong>ti emoziona</strong>: cremoso, denso come quello{' '}
              <em>"di una volta"</em>, anche <strong>senza lattosio</strong> e{' '}
              <strong>vegan</strong>.
            </p>
            <p className="v8-script" style={{ position: 'relative', zIndex: 1, marginTop: '10px' }}>benvenuti al banco!</p>
          </div>

          <div className="v8-wrap v8-banco">
            <div className="v8-banco-piano">
              <div className="v8-pozzetti">
                {pozzetti.map((f, i) => {
                  const aperto = aperti.has(i);
                  return (
                    <button
                      key={f.name}
                      type="button"
                      className={`v8-pozzetto ${aperto ? 'aperto' : ''}`}
                      aria-pressed={aperto}
                      aria-label={aperto ? `${f.name}: vai alla sua carta` : `Solleva il coperchio del pozzetto ${i + 1}`}
                      title={aperto ? f.name : 'Solleva il coperchio'}
                      onClick={() => (aperto ? vaiAllaCarta(f.catId) : toggleLid(i))}
                    >
                      <span className="vano">
                        <span
                          className="gelato"
                          style={{
                            background: `radial-gradient(circle at ${32 + (i % 4) * 9}% ${26 + (i % 3) * 8}%, rgba(255,255,255,0.42), transparent 42%), ${f.color}`,
                          }}
                        />
                      </span>
                      <motion.span
                        className="coperchio"
                        animate={reduce
                          ? { opacity: aperto ? 0 : 1 }
                          : (aperto
                            ? { y: -34, x: 14, rotate: 16, opacity: 0.95 }
                            : { y: 0, x: 0, rotate: 0, opacity: 1 })}
                        transition={{ type: 'spring', stiffness: 320, damping: 20 }}
                      />
                      <span className="nome-chip">{f.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="v8-banco-fronte">
              <div className="v8-fronte-legno">
                <span className="v8-medaglione"><img src="/logo.png" alt="" /></span>
              </div>
              <div className="v8-fronte-pois" aria-hidden="true" />
            </div>
            <div className="v8-zoccolo" aria-hidden="true" />
            <div className="v8-banco-nota">
              <span className="v8-nota">Il banco di oggi — solleva un coperchio, poi tocca il gusto per la sua carta</span>
              <span className="v8-script" style={{ fontSize: '1.5rem' }}>coperti come da tradizione!</span>
            </div>
            <div className="v8-hero-ctas">
              <a className="v8-btn v8-btn-azzurro" href="#gusti">
                Tutta la carta <ArrowDown size={16} />
              </a>
              <button type="button" className="v8-btn v8-btn-vuoto" onClick={() => openCfg()}>
                <Cake size={16} /> Crea la tua torta
              </button>
            </div>
          </div>
        </section>

        {/* La carta */}
        <section id="gusti" className="v8-section" ref={menuRef}>
          <div className="v8-wrap">
            <div className="v8-card">
              <div className="v8-head">
                <h2>La carta dei <span className="em">gusti</span></h2>
                <span className="v8-nota">Stagionale · aggiornata dallo staff</span>
              </div>
              <div className="v8-tabs" role="tablist" aria-label="Categorie di gusti">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={currentCat.id === c.id}
                    className={`v8-tab ${currentCat.id === c.id ? 'active' : ''}`}
                    onClick={() => setActive(c.id)}
                  >
                    {c.name}
                    <span className="count">{c.flavors.length}</span>
                  </button>
                ))}
              </div>
              <p className="v8-cat-desc">{currentCat.description}</p>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentCat.id}
                  className="v8-gusti"
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                >
                  {currentCat.flavors.map((f) => {
                    const firma = f.tag === 'firma';
                    return (
                      <div key={f.name} className={`v8-gusto ${firma ? 'firma' : ''}`}>
                        <span className="tondino" style={{ background: f.color }} />
                        <span className="nome">{f.name}</span>
                        <span className="fill" />
                        {firma && <span className="firma-tag">Gusto firma</span>}
                        {!firma && f.tag && <span className="diet">{f.tag}</span>}
                        {f.diet?.map((d) => (
                          <span key={d.short} className="diet" title={d.label}>{d.short}</span>
                        ))}
                      </div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
              <div className="v8-menu-foot">
                <span className="v8-legenda">SL senza lattosio · SG senza glutine · VEG vegan · altri gusti nei pozzetti</span>
                <a className="v8-allergeni-link" href="/allergeni">Quaderno allergeni completo</a>
              </div>
            </div>
          </div>
        </section>

        {/* I pois che contano */}
        <section id="numeri" className="v8-section">
          <div className="v8-wrap">
            <div className="v8-pois-band">
              <h2>I pois del banco, <span style={{ color: 'var(--v8-azzurro)' }}>contati.</span></h2>
              <p className="sotto">Valori reali del laboratorio, per anno di produzione</p>
              <div className="v8-cerchi">
                <div className="v8-cerchio">
                  <strong>+<Counter to={12000} /> kg</strong>
                  <span>di gelato mantecato</span>
                </div>
                <div className="v8-cerchio">
                  <strong>+<Counter to={2000} /></strong>
                  <span>torte create</span>
                </div>
                <div className="v8-cerchio">
                  <strong><Counter to={365} />/365</strong>
                  <span>giorni di produzione</span>
                </div>
                <div className="v8-cerchio">
                  <strong style={{ fontSize: 'clamp(1.2rem, 2.4vw, 1.6rem)' }}>ogni giorno</strong>
                  <span>torte sfornate fresche</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Storia: il pannello di legno */}
        <section id="storia" className="v8-section">
          <div className="v8-wrap">
            <div className="v8-storia">
              <div className="v8-storia-grid">
                <figure className="v8-storia-foto">
                  <img src="/gelato.jpg" alt="Gelato cremoso appena mantecato" />
                  <img className="seconda" src="/torte.jpg" alt="Torte gelato decorate a mano" />
                </figure>
                <div className="v8-card-int">
                  <h2>Dietro il <span className="em">medaglione</span></h2>
                  <p className="v8-script" style={{ marginTop: '10px' }}>"come quello di una volta"</p>
                  <p>
                    A Carpi, in via Remesina Interna, c'è un piccolo laboratorio dove
                    ogni mattina nasce qualcosa di speciale. Selezioniamo materie
                    prime di qualità, lavoriamo con tempi lenti e ci mettiamo
                    passione vera — quella che si sente al primo cucchiaio.
                  </p>
                  <div className="v8-passi">
                    {PASSI.map((p) => (
                      <div className="v8-passo" key={p.title}>
                        <span className="medaglietta"><OrnCucchiaino /></span>
                        <div>
                          <h3>{p.title}</h3>
                          <p>{p.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Servizi: il listino del banco */}
        <section id="servizi" className="v8-section">
          <div className="v8-wrap">
            <div className="v8-card">
              <div className="v8-head">
                <h2>I servizi del <span className="em">banco</span></h2>
                <span className="v8-nota">Tutto ciò che puoi desiderare</span>
              </div>
              <a className="v8-servizio" href={WA_URL} target="_blank" rel="noopener noreferrer">
                <span className="medaglietta"><OrnVaschetta /></span>
                <h3>Consegna a domicilio</h3>
                <p>Ordini su WhatsApp o sulle piattaforme partner e la vaschetta arriva da te.</p>
                <span className="go"><ArrowRight size={18} /></span>
              </a>
              <button type="button" className="v8-servizio" onClick={() => openCfg()}>
                <span className="medaglietta"><Cake size={22} /></span>
                <h3>Torte su prenotazione</h3>
                <p>Compleanno, anniversario o pranzo dei parenti — anche CROCK.</p>
                <span className="go"><ArrowRight size={18} /></span>
              </button>
              <a className="v8-servizio" href="#gusti">
                <span className="medaglietta"><OrnGranita /></span>
                <h3>Pasticceria a freddo</h3>
                <p>Granite siciliane, pasticcini, semifreddi, ghiaccioli, salame dolce.</p>
                <span className="go"><ArrowRight size={18} /></span>
              </a>
              <a className="v8-servizio" href="/allergeni">
                <span className="medaglietta"><OrnGocciaNo /></span>
                <h3>Senza lattosio &amp; vegan</h3>
                <p>Varianti senza lattosio, senza glutine e 100% vegan.</p>
                <span className="go"><ArrowRight size={18} /></span>
              </a>
            </div>
          </div>
        </section>

        {/* Torta nella teca */}
        <section id="torta" className="v8-section">
          <div className="v8-wrap">
            <div className="v8-card">
              <div className="v8-head">
                <h2>La tua torta, <span className="em">su ordinazione</span></h2>
                <span className="v8-nota">Configuratore guidato · pronta in giornata</span>
              </div>
              <div className="v8-torta-grid">
                <div className="v8-torta-copy">
                  <p>
                    Scegli tipo, gusti, base, decorazioni e scritta passo per passo —
                    noi la prepariamo a mano per te. Niente stress, solo dolcezza.
                  </p>
                  <ul className="v8-torta-specs">
                    <li>Tutto personalizzato: gusti, decoro, scritta</li>
                    <li>Guidata, in 4 minuti</li>
                    <li>Preavviso minimo di 5 ore</li>
                    <li>Anche senza glutine, senza lattosio, vegana</li>
                  </ul>
                  <div className="v8-torta-ctas">
                    <button type="button" className="v8-btn v8-btn-azzurro" onClick={() => openCfg()}>
                      <Cake size={16} /> Inizia ora
                    </button>
                    <a className="v8-btn v8-btn-vuoto" href="#dove">Preferisco scrivere</a>
                  </div>
                </div>
                <figure className="v8-teca">
                  <div className="vetro">
                    <CakePreview config={DEMO_CAKE} />
                  </div>
                  <figcaption>Nella teca del banco — anteprima dal configuratore</figcaption>
                </figure>
              </div>
            </div>
          </div>
        </section>

        {/* Gallery */}
        <section id="foto" className="v8-section">
          <div className="v8-wrap">
            <div className="v8-head" style={{ borderBottomColor: 'var(--v8-legno)' }}>
              <h2>Appena usciti dal <span className="em">banco</span></h2>
              <span className="v8-nota">Cinque scatti veri</span>
            </div>
          </div>
          <div className="v8-wrap">
            <div className="v8-galleria">
              {imgs.map((f) => (
                <figure className="v8-scatto" key={f.src}>
                  <img src={f.src} alt={`${f.nome} — Gelateria Punto Gi!`} loading="lazy" />
                  <figcaption>{f.nome}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Dove: di nuovo davanti alla parete */}
        <section id="dove" className="v8-section">
          <div className="v8-wrap">
            <div className="v8-dove-parete">
              <span className="v8-lettere3d">Vieni a trovarci</span>
              <div className="v8-dove-grid">
                <div className="v8-dove-col">
                  <h3>Recapiti</h3>
                  <div className="v8-recapito">
                    <span className="ic"><MapPin size={18} /></span>
                    <div>
                      <span className="tipo">Indirizzo</span>
                      <a href={MAPS_URL} target="_blank" rel="noopener noreferrer">Via Remesina Interna 46, 41012 Carpi (MO)</a>
                    </div>
                  </div>
                  <div className="v8-recapito">
                    <span className="ic"><Phone size={18} /></span>
                    <div>
                      <span className="tipo">Whatsappaci</span>
                      <a href={WA_URL} target="_blank" rel="noopener noreferrer">320 330 6009</a>
                    </div>
                  </div>
                  <div className="v8-recapito">
                    <span className="ic"><Instagram size={18} /></span>
                    <div>
                      <span className="tipo">Seguici</span>
                      <a href={IG_URL} target="_blank" rel="noopener noreferrer">@gelateriapuntogicarpi</a>
                    </div>
                  </div>
                  <div className="v8-qr">
                    <QrCode value={WA_URL} size={84} dark="#3a2f26" title="QR per scriverci su WhatsApp" />
                    <p>Inquadra il codice<br />e scrivici su WhatsApp</p>
                  </div>
                </div>
                <div className="v8-dove-col">
                  <h3><Clock size={15} style={{ verticalAlign: '-2px', marginRight: 8 }} />Orari di apertura</h3>
                  <table className="v8-orari">
                    <tbody>
                      {hours.map((o) => {
                        const isToday = o.day.toLowerCase().startsWith(oggi);
                        return (
                          <tr key={o.day} className={isToday ? 'today' : ''}>
                            <td>
                              {o.day}
                              {isToday && <span className="v8-oggi">Oggi</span>}
                            </td>
                            <td>{o.hours}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="v8-dove-col">
                  <h3>La mappa</h3>
                  <div className="v8-mappa">
                    <iframe
                      title="Mappa Gelateria Punto Gi! Carpi"
                      src={MAP_EMBED}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      allowFullScreen
                    />
                  </div>
                </div>
              </div>
              <div className="v8-dove-cta">
                <p className="v8-script">Un cucchiaio e ci conosci.</p>
                <a className="v8-btn v8-btn-legno" href={WA_URL} target="_blank" rel="noopener noreferrer">
                  <WaGlyph size={18} /> Scrivici su WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="v8-footer">
        <div className="v8-wrap v8-footer-inner">
          <p>© {new Date().getFullYear()} Gelateria Punto Gi! · Il Negozio V8 in anteprima — la home attuale resta su "/"</p>
          <ul className="v8-versions">
            {VERSIONS.map((v) => (
              <li key={v.href}>
                <a href={v.href} className={v.href === '/v8' ? 'current' : ''}>{v.label}</a>
              </li>
            ))}
          </ul>
          <div className="v8-socials">
            <a href={IG_URL} aria-label="Instagram" target="_blank" rel="noopener noreferrer"><Instagram size={18} /></a>
            <a href={FB_URL} aria-label="Facebook" target="_blank" rel="noopener noreferrer"><Facebook size={18} /></a>
            <a href={WA_URL} aria-label="WhatsApp" target="_blank" rel="noopener noreferrer"><WaGlyph size={18} /></a>
          </div>
        </div>
      </footer>

      {fabVisibile && (
        <a className="v8-fab" href={WA_URL} target="_blank" rel="noopener noreferrer" aria-label="Contattaci su WhatsApp">
          <WaGlyph size={26} />
        </a>
      )}

      <CakeDataProvider>
        <CakeConfigurator open={cfg.open} initial={cfg.initial} onClose={closeCfg} />
      </CakeDataProvider>
    </div>
  );
}
