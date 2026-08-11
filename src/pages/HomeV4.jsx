/*
  impeccable:direction-contract /v4 (HomeV4) — seed 6953f4c0, code-led.
  THESIS: la gelateria come bar storico italiano — pavimento in graniglia dove
  OGNI SCAGLIA È UN GUSTO (data-driven), lastre di marmo, ottone, targhette
  smaltate; rifiutata la vetrina pastello e il minimal freddo.
  OWN-WORLD: terrazzo chiaro #f0e9db con scaglie nei colori reali dei gusti,
  marmo #fcfbf7 con giunti in ottone #c0894c/#8a6733, smalto azzurro #2c7699,
  moro #362c22; Marcellus inciso + Cabin + Caveat; targa civica "46", medaglie,
  alzata per la torta, specchi ad arco.
  STORY: entri nel bar → riconosci il banco di sempre → ordini (gusti, torta, WA).
  FIRST-VIEWPORT: insegna incisa; "Il gelato che ti emoziona."; specchio ad
  arco con la coppetta; striscia di graniglia coi gusti del giorno che si
  posano una a una al load (interazione firma); due CTA.
  FINISH: unreviewed and undocumented is unfinished; this build ends with the
  finish review, the verdict, and the surface brief record.
*/
import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Menu as MenuIcon, X, Instagram, Facebook, MapPin, Phone, Clock,
  Bike, Cake, Snowflake, Heart, Award, Wheat, ArrowDown,
} from 'lucide-react';
import {
  WA_URL, MAPS_URL, IG_URL, FB_URL, MAP_EMBED, VERSIONS,
  useMenu, useHours, todayKey, Counter, WaGlyph, usePageChrome,
} from './v-shared';
import CakePreview from '../components/CakePreview';
import CakeConfigurator from '../components/CakeConfigurator';
import { CakeDataProvider } from '../data/CakeDataProvider';
import QrCode from '../components/QrCode';
import '../styles/v4.css';

/* Vite della targhetta smaltata */
const Vite = ({ size = 9 }) => (
  <svg className="vite" width={size} height={size} viewBox="0 0 10 10" aria-hidden="true">
    <circle cx="5" cy="5" r="4" fill="currentColor" opacity="0.9" />
    <line x1="2.6" y1="5" x2="7.4" y2="5" stroke="#235f7d" strokeWidth="1.4" transform="rotate(38 5 5)" />
  </svg>
);

function Targhetta({ children }) {
  return (
    <h2 className="v4-targhetta">
      <Vite /> {children} <Vite />
    </h2>
  );
}

const NAV_LINKS = [
  { href: '#banco', label: 'Il banco' },
  { href: '#primati', label: 'Primati' },
  { href: '#storia', label: 'Storia' },
  { href: '#servizi', label: 'Servizi' },
  { href: '#torta', label: 'Torte' },
  { href: '#dove', label: 'Dove' },
  { href: '/allergeni', label: 'Allergeni' },
];

function NavV4({ onOpenConfigurator }) {
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
      <header className={`v4-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="v4-wrap v4-nav-inner">
          <a href="#top" className="v4-brand">
            <img src="/logo.png" alt="Logo Gelateria Punto Gi!" />
            <span>
              Punto Gi<span className="punto">!</span>
              <small>Gelateria · Carpi</small>
            </span>
          </a>
          <nav aria-label="Sommario">
            <ul className="v4-nav-links">
              {NAV_LINKS.map((l) => (
                <li key={l.href}><a href={l.href}>{l.label}</a></li>
              ))}
            </ul>
          </nav>
          <div className="v4-nav-cta">
            <button type="button" className="v4-btn v4-btn-smalto" style={{ minHeight: 44, padding: '9px 16px', fontSize: '0.78rem', whiteSpace: 'nowrap' }} onClick={() => onOpenConfigurator()}>
              <Cake size={15} /> La tua torta
            </button>
            <button type="button" className="v4-nav-toggle" aria-label="Apri il sommario" onClick={() => setOpen(true)}>
              <MenuIcon size={20} />
            </button>
          </div>
        </div>
      </header>
      <AnimatePresence>
        {open && (
          <motion.div
            className="v4-mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <button type="button" className="v4-mobile-close" aria-label="Chiudi il sommario" onClick={() => setOpen(false)}>
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

const PREGI = [
  { icon: <Heart size={18} />, title: 'Ricetta di famiglia', text: 'Sviluppata e affinata negli anni nel nostro laboratorio.' },
  { icon: <Snowflake size={18} />, title: 'Mantecato fresco', text: 'Produzione quotidiana, mai scorte di magazzino.' },
  { icon: <Wheat size={18} />, title: 'Per tutti', text: 'Versioni senza lattosio e senza glutine sempre disponibili.' },
  { icon: <Award size={18} />, title: 'Materie prime top', text: 'Pistacchio, nocciola e cioccolato selezionati con cura.' },
];

export default function HomeV4() {
  const reduce = useReducedMotion();
  const categories = useMenu();
  const hours = useHours();
  const oggi = todayKey();
  const [active, setActive] = useState(null);
  const currentCat = categories.find((c) => c.id === active) || categories[0];
  const [cfg, setCfg] = useState({ open: false, initial: undefined });
  const openCfg = (initial) => setCfg({ open: true, initial: initial && initial.allergies ? initial : undefined });
  const closeCfg = () => setCfg((c) => ({ ...c, open: false }));

  usePageChrome('Punto Gi! – Il Bar di Marmo (anteprima V4) | Carpi', '#235f7d', '#f0e9db');

  // Le scaglie della striscia: i gusti reali del giorno (tutte le categorie)
  const scaglie = categories.flatMap((c) => c.flavors).slice(0, 26);
  // Solo fotografie vere del banco: le grafiche social con lettering
  // spezzerebbero il mondo del marmo; la coppetta resta solo nell'arco
  // dell'hero, mai duplicata qui (rilievi della finish review).
  const imgs = ['/gelato.jpg', '/torte.jpg', '/semifreddi.jpg', '/pasticcini.jpg'];

  return (
    <div className="v4" id="top">
      <NavV4 onOpenConfigurator={openCfg} />
      <main>
        {/* Hero: il banco */}
        <section className="v4-hero">
          <div className="v4-wrap">
            <div className="v4-lastra v4-hero-lastra">
              <div className="v4-hero-grid">
                <div>
                  <p className="v4-insegna v4-inciso">
                    <span className="long">Gelateria artigianale · Carpi · dal laboratorio di Via Remesina</span>
                    <span className="short">Gelateria artigianale · Carpi</span>
                  </p>
                  <h1>Il gelato che ti <em>emoziona.</em></h1>
                  <p className="v4-hero-lead">
                    Una ricetta unica, perfezionata negli anni: cremoso, corposo,
                    denso come quello <em>"di una volta"</em> — anche{' '}
                    <strong>senza lattosio</strong> e <strong>vegan</strong>,
                    mantecato fresco ogni mattina.
                  </p>
                  <div className="v4-hero-ctas">
                    <a className="v4-btn v4-btn-smalto" href="#banco">
                      Scopri i gusti <ArrowDown size={16} />
                    </a>
                    <button type="button" className="v4-btn v4-btn-inciso" onClick={() => openCfg()}>
                      <Cake size={16} /> Crea la tua torta
                    </button>
                  </div>
                  <div className="v4-graniglia">
                    <div className="v4-graniglia-strip" aria-label="I gusti di oggi come scaglie di graniglia">
                      {scaglie.map((f, i) => (
                        <motion.span
                          key={f.name}
                          className="v4-scaglia"
                          style={{ background: f.color }}
                          title={f.name}
                          {...(reduce ? {} : {
                            initial: { opacity: 0, scale: 0, y: -14 },
                            animate: { opacity: 1, scale: 1, y: 0 },
                            transition: { type: 'spring', stiffness: 380, damping: 18, delay: 0.5 + i * 0.045 },
                          })}
                        />
                      ))}
                    </div>
                    <p className="v4-graniglia-legenda">Il pavimento del bar: ogni scaglia è un gusto di oggi</p>
                  </div>
                </div>
                <figure className="v4-arco">
                  <img src="/hero-cup.jpg" alt="Coppetta di gelato artigianale Punto Gi!" />
                  <figcaption>Fresco ogni giorno</figcaption>
                </figure>
              </div>
            </div>
          </div>
        </section>

        {/* Il banco (menu) */}
        <section id="banco" className="v4-section">
          <div className="v4-wrap">
            <div className="v4-lastra v4-section-lastra">
              <div className="v4-sec-head">
                <Targhetta>Il banco dei gusti</Targhetta>
                <span className="v4-sec-note">Stagionale · aggiornato dallo staff</span>
              </div>
              <div className="v4-tabs" role="tablist" aria-label="Categorie di gusti">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={currentCat.id === c.id}
                    className={`v4-tab ${currentCat.id === c.id ? 'active' : ''}`}
                    onClick={() => setActive(c.id)}
                  >
                    {c.name}
                    <span className="count">{c.flavors.length}</span>
                  </button>
                ))}
              </div>
              <p className="v4-cat-desc">{currentCat.description}</p>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentCat.id}
                  className="v4-gusti"
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                >
                  {currentCat.flavors.map((f) => {
                    const firma = f.tag === 'firma';
                    return (
                      <div key={f.name} className={`v4-gusto ${firma ? 'firma' : ''}`}>
                        <span className="scaglia" style={{ background: f.color }} />
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
              <div className="v4-menu-foot">
                <span className="v4-legenda">SL senza lattosio · SG senza glutine · VEG vegan · altri gusti stagionali in vetrina</span>
                <a className="v4-allergeni-link" href="/allergeni">Quaderno allergeni completo</a>
              </div>
            </div>
          </div>
        </section>

        {/* Targa dei primati */}
        <section id="primati" className="v4-section">
          <div className="v4-wrap">
            <div className="v4-targa">
              <div className="vite-row" aria-hidden="true"><Vite size={12} /><Vite size={12} /></div>
              <h2>Targa dei primati</h2>
              <div className="v4-primati">
                <div className="v4-primato">
                  <strong>+<Counter to={12000} /></strong>
                  <span className="lbl">kg di gelato / anno</span>
                </div>
                <div className="v4-primato">
                  <strong>+<Counter to={2000} /></strong>
                  <span className="lbl">torte create / anno</span>
                </div>
                <div className="v4-primato">
                  <strong><Counter to={365} /></strong>
                  <span className="lbl">giorni di produzione</span>
                </div>
                <div className="v4-primato">
                  <strong style={{ fontSize: 'clamp(1.3rem, 2.6vw, 1.9rem)', paddingTop: '0.5em' }}>ogni giorno</strong>
                  <span className="lbl">torte sfornate fresche</span>
                </div>
              </div>
              <div className="vite-row" style={{ marginTop: 'var(--v4-s3)', marginBottom: 0 }} aria-hidden="true"><Vite size={12} /><Vite size={12} /></div>
            </div>
          </div>
        </section>

        {/* Storia */}
        <section id="storia" className="v4-section">
          <div className="v4-wrap">
            <div className="v4-lastra v4-section-lastra">
              <div className="v4-sec-head">
                <Targhetta>La ricetta di famiglia</Targhetta>
                <span className="v4-sec-note">Via Remesina Interna 46 · dal laboratorio</span>
              </div>
              <div className="v4-storia-grid">
                <figure className="v4-storia-foto">
                  <img src="/gelato.jpg" alt="Gelato cremoso appena mantecato" />
                  <img className="seconda" src="/torte.jpg" alt="Torte gelato decorate a mano" />
                </figure>
                <div className="v4-storia-copy">
                  <p className="v4-script">"come quello di una volta"</p>
                  <p>
                    A Carpi, in via Remesina Interna, c'è un piccolo laboratorio dove
                    ogni mattina nasce qualcosa di speciale. Selezioniamo materie
                    prime di qualità, lavoriamo con tempi lenti e ci mettiamo
                    passione vera — quella che si sente al primo cucchiaio.
                  </p>
                  <div className="v4-pregi">
                    {PREGI.map((p) => (
                      <div className="v4-pregio" key={p.title}>
                        <span className="medaglia">{p.icon}</span>
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

        {/* Servizi */}
        <section id="servizi" className="v4-section">
          <div className="v4-wrap">
            <div className="v4-sec-head">
              <Targhetta>I servizi del bar</Targhetta>
            </div>
            <div className="v4-servizi">
              <a className="v4-servizio" href={WA_URL} target="_blank" rel="noopener noreferrer">
                <span className="v4-medaglione"><Bike size={22} /></span>
                <h3>Consegna a domicilio</h3>
                <p>Ordini su WhatsApp o sulle piattaforme partner e il gelato arriva da te.</p>
              </a>
              <button type="button" className="v4-servizio" onClick={() => openCfg()}>
                <span className="v4-medaglione"><Cake size={22} /></span>
                <h3>Torte su prenotazione</h3>
                <p>Compleanno, anniversario o pranzo dei parenti: prenota la torta perfetta, anche CROCK.</p>
              </button>
              <a className="v4-servizio" href="#banco">
                <span className="v4-medaglione"><Snowflake size={22} /></span>
                <h3>Pasticceria a freddo</h3>
                <p>Granite siciliane, pasticcini, semifreddi, ghiaccioli, salame dolce e tante altre leccornie.</p>
              </a>
              <a className="v4-servizio" href="/allergeni">
                <span className="v4-medaglione"><Wheat size={22} /></span>
                <h3>Senza lattosio &amp; vegan</h3>
                <p>Intolleranze o scelte di gusto? Varianti senza lattosio, senza glutine e 100% vegan.</p>
              </a>
            </div>
          </div>
        </section>

        {/* Torta sull'alzata */}
        <section id="torta" className="v4-section">
          <div className="v4-wrap">
            <div className="v4-lastra v4-section-lastra">
              <div className="v4-sec-head">
                <Targhetta>La tua torta, su ordinazione</Targhetta>
                <span className="v4-sec-note">Configuratore guidato · pronta in giornata</span>
              </div>
              <div className="v4-torta-grid">
                <div className="v4-torta-copy">
                  <p>
                    Scegli tipo, gusti, base, decorazioni e scritta passo per passo —
                    noi la prepariamo a mano per te. Niente stress, solo dolcezza.
                  </p>
                  <ul className="v4-torta-specs">
                    <li>Tutto personalizzato: gusti, decoro, scritta</li>
                    <li>Guidata, in 4 minuti</li>
                    <li>Preavviso minimo di 5 ore</li>
                    <li>Anche senza glutine, senza lattosio, vegana</li>
                  </ul>
                  <div className="v4-torta-ctas">
                    <button type="button" className="v4-btn v4-btn-smalto" onClick={() => openCfg()}>
                      <Cake size={16} /> Inizia ora
                    </button>
                    <a className="v4-btn v4-btn-inciso" href="#dove">Preferisco scrivere</a>
                  </div>
                </div>
                <figure className="v4-alzata">
                  <div className="v4-alzata-piatto">
                    <CakePreview config={DEMO_CAKE} />
                  </div>
                  <div className="v4-alzata-piede" aria-hidden="true" />
                  <figcaption>Servita sull'alzata — anteprima dal configuratore</figcaption>
                </figure>
              </div>
            </div>
          </div>
        </section>

        {/* Specchio del banco */}
        <section id="galleria" className="v4-section">
          <div className="v4-wrap">
            <div className="v4-sec-head">
              <Targhetta>Lo specchio del banco</Targhetta>
              <span className="v4-sec-note">Il banco in quattro riflessi</span>
            </div>
          </div>
          <div className="v4-wrap">
            <div className="v4-specchio">
              {imgs.map((src, i) => (
                <figure className="v4-riflesso" key={src}>
                  <img src={src} alt={`Creazione della Gelateria Punto Gi! numero ${i + 1}`} loading="lazy" />
                  <figcaption>Riflesso N. {String(i + 1).padStart(2, '0')}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Dove & quando */}
        <section id="dove" className="v4-section">
          <div className="v4-wrap">
            <div className="v4-lastra v4-section-lastra">
              <div className="v4-sec-head">
                <Targhetta>Dove &amp; quando</Targhetta>
              </div>
              <div className="v4-dove-grid">
                <div className="v4-dove-col">
                  <div className="v4-civica">
                    <div className="numero">46</div>
                    <p className="via">
                      <a href={MAPS_URL} target="_blank" rel="noopener noreferrer">Via Remesina Interna · Carpi (MO)</a>
                    </p>
                  </div>
                  <div className="v4-recapiti">
                    <div className="v4-recapito">
                      <span className="ic"><Phone size={18} /></span>
                      <div>
                        <span className="tipo">Whatsappaci</span>
                        <a href={WA_URL} target="_blank" rel="noopener noreferrer">320 330 6009</a>
                      </div>
                    </div>
                    <div className="v4-recapito">
                      <span className="ic"><Instagram size={18} /></span>
                      <div>
                        <span className="tipo">Seguici</span>
                        <a href={IG_URL} target="_blank" rel="noopener noreferrer">@gelateriapuntogicarpi</a>
                      </div>
                    </div>
                    <div className="v4-recapito">
                      <span className="ic"><MapPin size={18} /></span>
                      <div>
                        <span className="tipo">Ritiro torte</span>
                        <span>In negozio, con preavviso di 5 ore</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="v4-dove-col">
                  <h3><Clock size={14} style={{ verticalAlign: '-2px', marginRight: 8 }} />Orari di apertura</h3>
                  <table className="v4-orari">
                    <tbody>
                      {hours.map((o) => {
                        const isToday = o.day.toLowerCase().startsWith(oggi);
                        return (
                          <tr key={o.day} className={isToday ? 'today' : ''}>
                            <td>
                              {o.day}
                              {isToday && <span className="v4-oggi">Oggi</span>}
                            </td>
                            <td>{o.hours}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="v4-dove-col">
                  <h3>La mappa</h3>
                  <div className="v4-mappa">
                    <iframe
                      title="Mappa Gelateria Punto Gi! Carpi"
                      src={MAP_EMBED}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      allowFullScreen
                    />
                  </div>
                  <div className="v4-qr">
                    <QrCode value={WA_URL} size={84} dark="#362c22" title="QR per scriverci su WhatsApp" />
                    <p>Inquadra il codice<br />e scrivici su WhatsApp</p>
                  </div>
                </div>
              </div>
              <div className="v4-dove-cta">
                <p className="v4-script">Un cucchiaio e ci conosci.</p>
                <a className="v4-btn v4-btn-ottone" href={WA_URL} target="_blank" rel="noopener noreferrer">
                  <WaGlyph size={18} /> Scrivici su WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="v4-footer">
        <div className="v4-wrap v4-footer-inner">
          <p>© {new Date().getFullYear()} Gelateria Punto Gi! · Bar di Marmo V4 in anteprima — la home attuale resta su "/"</p>
          <ul className="v4-versions">
            {VERSIONS.map((v) => (
              <li key={v.href}>
                <a href={v.href} className={v.href === '/v4' ? 'current' : ''}>{v.label}</a>
              </li>
            ))}
          </ul>
          <div className="v4-socials">
            <a href={IG_URL} aria-label="Instagram" target="_blank" rel="noopener noreferrer"><Instagram size={18} /></a>
            <a href={FB_URL} aria-label="Facebook" target="_blank" rel="noopener noreferrer"><Facebook size={18} /></a>
            <a href={WA_URL} aria-label="WhatsApp" target="_blank" rel="noopener noreferrer"><WaGlyph size={18} /></a>
          </div>
        </div>
      </footer>

      <a className="v4-fab" href={WA_URL} target="_blank" rel="noopener noreferrer" aria-label="Contattaci su WhatsApp">
        <WaGlyph size={26} />
      </a>

      <CakeDataProvider>
        <CakeConfigurator open={cfg.open} initial={cfg.initial} onClose={closeCfg} />
      </CakeDataProvider>
    </div>
  );
}
