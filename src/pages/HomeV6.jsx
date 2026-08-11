/*
  impeccable:direction-contract /v6 (HomeV6) — direzione PINNATA DALL'UTENTE
  ("una V6 inerente al gelato e quindi una gelateria"), code-led, niente roll.
  THESIS: la homepage È il banco vetrina — i colori veri dei gusti del giorno
  (dati live) sono il materiale della pagina; rifiutata ogni metafora esterna.
  OWN-WORLD: sala acciaio chiaro #eef2f4 con righe spazzolate, vetrina in vetro
  con riflesso, carapine inox con cupole di gelato nei colori dei gusti,
  targhette piantate nel gelato su stecchino, bancone di legno #c0894c,
  azzurro #2c7699 per le azioni; Fredoka (tondo come le palline) + Nunito +
  Caveat; palline, coni SVG autorali, cucchiaini d'acciaio.
  STORY: guardi la vetrina → scegli il gusto (clic sulla carapina → carta) →
  ordini (torta, WhatsApp).
  FIRST-VIEWPORT: titolo + copy + CTA; la VETRINA con le carapine dei gusti
  del giorno, le targhette si piantano una a una (interazione firma); bancone.
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
import '../styles/v6.css';

/* Ornati del banco: cono e cucchiaino, tratto 2 coerente con lucide */
const orn = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const OrnCono = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...orn} aria-hidden="true">
    <path d="M7.5 10.5 12 21l4.5-10.5" />
    <path d="M7.5 10.5a4.5 4.5 0 0 1 9 0" />
    <path d="m9 13 5-2M10 16l3.5-1.5" />
  </svg>
);
const OrnVaschetta = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...orn} aria-hidden="true">
    <path d="M4 11h16l-1.5 8h-13z" />
    <path d="M4 11a4 4 0 0 1 5-3.9A3.5 3.5 0 0 1 12 5a3.5 3.5 0 0 1 3 2.1A4 4 0 0 1 20 11" />
    <path d="M9 15v1.5M15 15v1.5" />
  </svg>
);
const OrnGranita = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...orn} aria-hidden="true">
    <path d="M8 9h8l-1.2 12H9.2z" />
    <path d="M7 9a5 5 0 0 1 10 0" />
    <path d="M15.5 4 18 2" />
  </svg>
);
const OrnGocciaNo = ({ size = 24 }) => (
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

const NAV_LINKS = [
  { href: '#gusti', label: 'I gusti' },
  { href: '#numeri', label: 'Numeri' },
  { href: '#storia', label: 'Storia' },
  { href: '#servizi', label: 'Servizi' },
  { href: '#torta', label: 'Torte' },
  { href: '#dove', label: 'Dove' },
  { href: '/allergeni', label: 'Allergeni' },
];

function NavV6({ onOpenConfigurator }) {
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
      <header className={`v6-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="v6-wrap v6-nav-inner">
          <a href="#top" className="v6-brand">
            <img src="/logo.png" alt="Logo Gelateria Punto Gi!" />
            <span>
              <span className="nome">Punto Gi<span className="punto">!</span></span>
              <small>Gelateria · Carpi</small>
            </span>
          </a>
          <nav aria-label="Sommario">
            <ul className="v6-nav-links">
              {NAV_LINKS.map((l) => (
                <li key={l.href}><a href={l.href}>{l.label}</a></li>
              ))}
            </ul>
          </nav>
          <div className="v6-nav-cta">
            <button type="button" className="v6-btn v6-btn-azzurro" style={{ minHeight: 44, padding: '9px 18px', fontSize: '0.85rem', whiteSpace: 'nowrap' }} onClick={() => onOpenConfigurator()}>
              <Cake size={15} /> La tua torta
            </button>
            <button type="button" className="v6-nav-toggle" aria-label="Apri il sommario" onClick={() => setOpen(true)}>
              <MenuIcon size={20} />
            </button>
          </div>
        </div>
      </header>
      <AnimatePresence>
        {open && (
          <motion.div
            className="v6-mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <button type="button" className="v6-mobile-close" aria-label="Chiudi il sommario" onClick={() => setOpen(false)}>
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
  { title: 'Mantecato fresco', text: 'produzione quotidiana, mai scorte di magazzino' },
  { title: 'Per tutti', text: 'senza lattosio e senza glutine sempre disponibili' },
  { title: 'Materie prime top', text: 'pistacchio, nocciola e cioccolato scelti con cura' },
];

export default function HomeV6() {
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

  usePageChrome('Punto Gi! – La Vetrina (anteprima V6) | Carpi', '#235f7d', '#eef2f4');

  // La vetrina: i primi gusti del giorno, con la loro categoria per il clic
  const inVetrina = categories
    .flatMap((c) => c.flavors.map((f) => ({ ...f, catId: c.id })))
    .slice(0, 8);

  const scegliDallaVetrina = (catId) => {
    setActive(catId);
    menuRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  // Il FAB compare dopo l'hero: nel primo schermo mobile coprirebbe
  // una carapina della vetrina (rilievo della finish review).
  const [fabVisibile, setFabVisibile] = useState(false);
  useEffect(() => {
    const onScroll = () => setFabVisibile(window.scrollY > 420);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const imgs = ['/hero-cup.jpg', '/gelato.jpg', '/torte.jpg', '/semifreddi.jpg', '/pasticcini.jpg'];

  return (
    <div className="v6" id="top">
      <NavV6 onOpenConfigurator={openCfg} />
      <main>
        {/* Hero: il banco vetrina */}
        <section className="v6-hero">
          <div className="v6-wrap">
            <div className="v6-hero-testa">
              <div>
                <h1>Il gelato che ti <span className="em">emoziona</span><span className="punto">.</span></h1>
                <p className="v6-hero-copy" style={{ marginTop: 'var(--v6-s3)' }}>
                  Cremoso, corposo, denso come quello <em>"di una volta"</em> —
                  anche <strong>senza lattosio</strong> e <strong>vegan</strong>,
                  mantecato fresco ogni mattina.
                </p>
              </div>
              <div className="v6-hero-ctas">
                <a className="v6-btn v6-btn-azzurro" href="#gusti">
                  Tutta la carta <ArrowDown size={16} />
                </a>
                <button type="button" className="v6-btn v6-btn-vuoto" onClick={() => openCfg()}>
                  <Cake size={16} /> Crea la tua torta
                </button>
              </div>
            </div>

            <div className="v6-vetrina">
              <div className="v6-vetrina-vetro">
                <div className="v6-carapine">
                  {inVetrina.map((f, i) => (
                    <button
                      key={f.name}
                      type="button"
                      className="v6-carapina"
                      title={f.name}
                      aria-label={`Gusto ${f.name}: vai alla carta`}
                      onClick={() => scegliDallaVetrina(f.catId)}
                    >
                      <motion.span
                        className="v6-targhetta"
                        style={{ rotate: (i % 2 ? 2.2 : -2.8) + ((i % 3) - 1) * 1.1 }}
                        {...(reduce ? {} : {
                          initial: { opacity: 0, y: -22, scale: 0.6 },
                          animate: { opacity: 1, y: 0, scale: 1 },
                          transition: { type: 'spring', stiffness: 360, damping: 17, delay: 0.4 + i * 0.09 },
                        })}
                      >
                        {f.name}
                      </motion.span>
                      <span className="pozzetto">
                        <span
                          className="gelato"
                          style={{
                            background: `radial-gradient(ellipse ${38 + (i % 3) * 9}% ${26 + (i % 4) * 6}% at ${18 + (i % 4) * 16}% ${20 + (i % 3) * 9}%, rgba(255,255,255,0.42), transparent 70%), ${f.color}`,
                          }}
                        />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="v6-bancone" aria-hidden="true" />
              <div className="v6-vetrina-nota">
                <span className="v6-nota">La vetrina di oggi — tocca una carapina per la sua carta</span>
                <span className="v6-script">gusti veri, colori veri!</span>
              </div>
            </div>
          </div>
        </section>

        {/* La carta */}
        <section id="gusti" className="v6-section" ref={menuRef}>
          <div className="v6-wrap">
            <div className="v6-card">
              <div className="v6-head">
                <h2>La carta dei <span className="em">gusti</span></h2>
                <span className="v6-nota">Stagionale · aggiornata dallo staff</span>
              </div>
              <div className="v6-tabs" role="tablist" aria-label="Categorie di gusti">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={currentCat.id === c.id}
                    className={`v6-tab ${currentCat.id === c.id ? 'active' : ''}`}
                    onClick={() => setActive(c.id)}
                  >
                    {c.name}
                    <span className="count">{c.flavors.length}</span>
                  </button>
                ))}
              </div>
              <p className="v6-cat-desc">{currentCat.description}</p>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentCat.id}
                  className="v6-gusti"
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                >
                  {currentCat.flavors.map((f) => {
                    const firma = f.tag === 'firma';
                    return (
                      <div key={f.name} className={`v6-gusto ${firma ? 'firma' : ''}`}>
                        <span className="pallina" style={{ background: f.color }} />
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
              <div className="v6-menu-foot">
                <span className="v6-legenda">SL senza lattosio · SG senza glutine · VEG vegan · altri gusti stagionali in vetrina</span>
                <a className="v6-allergeni-link" href="/allergeni">Quaderno allergeni completo</a>
              </div>
            </div>
          </div>
        </section>

        {/* Numeri */}
        <section id="numeri" className="v6-section">
          <div className="v6-wrap v6-numeri-grid">
            <div className="v6-numeri-copy">
              <h2>Quanto gelato passa <span className="em">dal banco.</span></h2>
              <p>
                Artigianale non vuol dire poco: ecco quanto lavoriamo, fresco,
                ogni giorno — valori reali del laboratorio, per anno di produzione.
              </p>
            </div>
            <div className="v6-conta">
              <div className="v6-conto">
                <span className="cono"><OrnCono size={30} /></span>
                <strong>+<Counter to={12000} /> kg</strong>
                <span>di gelato mantecato</span>
              </div>
              <div className="v6-conto">
                <span className="cono"><OrnVaschetta size={30} /></span>
                <strong>+<Counter to={2000} /></strong>
                <span>torte create</span>
              </div>
              <div className="v6-conto">
                <span className="cono"><OrnCucchiaino size={30} /></span>
                <strong><Counter to={365} />/365</strong>
                <span>giorni di produzione</span>
              </div>
              <div className="v6-conto">
                <span className="cono"><OrnGranita size={30} /></span>
                <strong>ogni giorno</strong>
                <span>torte sfornate fresche</span>
              </div>
            </div>
          </div>
        </section>

        {/* Storia */}
        <section id="storia" className="v6-section">
          <div className="v6-wrap">
            <div className="v6-card">
              <div className="v6-head">
                <h2>Dietro il <span className="em">banco</span></h2>
                <span className="v6-nota">Via Remesina Interna 46 · dal laboratorio</span>
              </div>
              <div className="v6-storia-grid">
                <figure className="v6-storia-foto">
                  <img src="/gelato.jpg" alt="Gelato cremoso appena mantecato" />
                  <img className="seconda" src="/torte.jpg" alt="Torte gelato decorate a mano" />
                </figure>
                <div className="v6-storia-copy">
                  <p className="v6-script">"come quello di una volta"</p>
                  <p>
                    A Carpi, in via Remesina Interna, c'è un piccolo laboratorio dove
                    ogni mattina nasce qualcosa di speciale. Selezioniamo materie
                    prime di qualità, lavoriamo con tempi lenti e ci mettiamo
                    passione vera — quella che si sente al primo cucchiaio.
                  </p>
                  <div className="v6-passi">
                    {PASSI.map((p) => (
                      <div className="v6-passo" key={p.title}>
                        <span className="cucchiaino"><OrnCucchiaino /></span>
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
        <section id="servizi" className="v6-section">
          <div className="v6-wrap">
            <div className="v6-head" style={{ borderBottomColor: 'var(--v6-legno)' }}>
              <h2>Anche da <span className="em">asporto</span></h2>
              <span className="v6-nota">Tutto ciò che puoi desiderare</span>
            </div>
            <div className="v6-servizi">
              <a className="v6-servizio" href={WA_URL} target="_blank" rel="noopener noreferrer">
                <span className="orn"><OrnVaschetta size={26} /></span>
                <h3>Consegna a domicilio</h3>
                <p>Ordini su WhatsApp o sulle piattaforme partner e la vaschetta arriva da te.</p>
                <span className="go"><ArrowRight size={18} /></span>
              </a>
              <button type="button" className="v6-servizio" onClick={() => openCfg()}>
                <span className="orn"><Cake size={24} /></span>
                <h3>Torte su prenotazione</h3>
                <p>Compleanno, anniversario o pranzo dei parenti — anche CROCK.</p>
                <span className="go"><ArrowRight size={18} /></span>
              </button>
              <a className="v6-servizio" href="#gusti">
                <span className="orn"><OrnGranita size={26} /></span>
                <h3>Pasticceria a freddo</h3>
                <p>Granite siciliane, pasticcini, semifreddi, ghiaccioli, salame dolce.</p>
                <span className="go"><ArrowRight size={18} /></span>
              </a>
              <a className="v6-servizio" href="/allergeni">
                <span className="orn"><OrnGocciaNo size={26} /></span>
                <h3>Senza lattosio &amp; vegan</h3>
                <p>Varianti senza lattosio, senza glutine e 100% vegan.</p>
                <span className="go"><ArrowRight size={18} /></span>
              </a>
            </div>
          </div>
        </section>

        {/* Torta */}
        <section id="torta" className="v6-section">
          <div className="v6-wrap">
            <div className="v6-card">
              <div className="v6-head">
                <h2>La tua torta, <span className="em">su ordinazione</span></h2>
                <span className="v6-nota">Configuratore guidato · pronta in giornata</span>
              </div>
              <div className="v6-torta-grid">
                <div className="v6-torta-copy">
                  <p>
                    Scegli tipo, gusti, base, decorazioni e scritta passo per passo —
                    noi la prepariamo a mano per te. Niente stress, solo dolcezza.
                  </p>
                  <ul className="v6-torta-specs">
                    <li>Tutto personalizzato: gusti, decoro, scritta</li>
                    <li>Guidata, in 4 minuti</li>
                    <li>Preavviso minimo di 5 ore</li>
                    <li>Anche senza glutine, senza lattosio, vegana</li>
                  </ul>
                  <div className="v6-torta-ctas">
                    <button type="button" className="v6-btn v6-btn-azzurro" onClick={() => openCfg()}>
                      <Cake size={16} /> Inizia ora
                    </button>
                    <a className="v6-btn v6-btn-vuoto" href="#dove">Preferisco scrivere</a>
                  </div>
                </div>
                <figure className="v6-torta-frame">
                  <div className="teca">
                    <CakePreview config={DEMO_CAKE} />
                  </div>
                  <figcaption>In teca — anteprima dal configuratore</figcaption>
                </figure>
              </div>
            </div>
          </div>
        </section>

        {/* Gallery */}
        <section id="banco-foto" className="v6-section">
          <div className="v6-wrap">
            <div className="v6-head" style={{ borderBottomColor: 'var(--v6-legno)' }}>
              <h2>Usciti dal <span className="em">banco</span></h2>
              <span className="v6-nota">Cinque scatti veri</span>
            </div>
          </div>
          <div className="v6-wrap">
            <div className="v6-galleria">
              {imgs.map((src, i) => (
                <figure className="v6-scatto" key={src}>
                  <img src={src} alt={`Creazione della Gelateria Punto Gi! numero ${i + 1}`} loading="lazy" />
                  <figcaption>Scatto N. {String(i + 1).padStart(2, '0')}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Dove */}
        <section id="dove" className="v6-section">
          <div className="v6-wrap">
            <div className="v6-card">
              <div className="v6-head">
                <h2>Dove &amp; <span className="em">quando</span></h2>
                <span className="v6-nota">Vieni a trovarci al banco</span>
              </div>
              <div className="v6-dove-grid">
                <div className="v6-dove-col">
                  <h3>Recapiti</h3>
                  <div className="v6-recapito">
                    <span className="ic"><MapPin size={18} /></span>
                    <div>
                      <span className="tipo">Indirizzo</span>
                      <a href={MAPS_URL} target="_blank" rel="noopener noreferrer">Via Remesina Interna 46, 41012 Carpi (MO)</a>
                    </div>
                  </div>
                  <div className="v6-recapito">
                    <span className="ic"><Phone size={18} /></span>
                    <div>
                      <span className="tipo">Whatsappaci</span>
                      <a href={WA_URL} target="_blank" rel="noopener noreferrer">320 330 6009</a>
                    </div>
                  </div>
                  <div className="v6-recapito">
                    <span className="ic"><Instagram size={18} /></span>
                    <div>
                      <span className="tipo">Seguici</span>
                      <a href={IG_URL} target="_blank" rel="noopener noreferrer">@gelateriapuntogicarpi</a>
                    </div>
                  </div>
                  <div className="v6-qr">
                    <QrCode value={WA_URL} size={84} dark="#32281f" title="QR per scriverci su WhatsApp" />
                    <p>Inquadra il codice<br />e scrivici su WhatsApp</p>
                  </div>
                </div>
                <div className="v6-dove-col">
                  <h3><Clock size={15} style={{ verticalAlign: '-2px', marginRight: 8 }} />Orari di apertura</h3>
                  <table className="v6-orari">
                    <tbody>
                      {hours.map((o) => {
                        const isToday = o.day.toLowerCase().startsWith(oggi);
                        return (
                          <tr key={o.day} className={isToday ? 'today' : ''}>
                            <td>
                              {o.day}
                              {isToday && <span className="v6-oggi">Oggi</span>}
                            </td>
                            <td>{o.hours}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="v6-dove-col">
                  <h3>La mappa</h3>
                  <div className="v6-mappa">
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
              <div className="v6-dove-cta">
                <p className="v6-script">Un cucchiaio e ci conosci.</p>
                <a className="v6-btn v6-btn-legno" href={WA_URL} target="_blank" rel="noopener noreferrer">
                  <WaGlyph size={18} /> Scrivici su WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="v6-footer">
        <div className="v6-wrap v6-footer-inner">
          <p>© {new Date().getFullYear()} Gelateria Punto Gi! · Vetrina V6 in anteprima — la home attuale resta su "/"</p>
          <ul className="v6-versions">
            {VERSIONS.map((v) => (
              <li key={v.href}>
                <a href={v.href} className={v.href === '/v6' ? 'current' : ''}>{v.label}</a>
              </li>
            ))}
          </ul>
          <div className="v6-socials">
            <a href={IG_URL} aria-label="Instagram" target="_blank" rel="noopener noreferrer"><Instagram size={18} /></a>
            <a href={FB_URL} aria-label="Facebook" target="_blank" rel="noopener noreferrer"><Facebook size={18} /></a>
            <a href={WA_URL} aria-label="WhatsApp" target="_blank" rel="noopener noreferrer"><WaGlyph size={18} /></a>
          </div>
        </div>
      </footer>

      {fabVisibile && (
        <a className="v6-fab" href={WA_URL} target="_blank" rel="noopener noreferrer" aria-label="Contattaci su WhatsApp">
          <WaGlyph size={26} />
        </a>
      )}

      <CakeDataProvider>
        <CakeConfigurator open={cfg.open} initial={cfg.initial} onClose={closeCfg} />
      </CakeDataProvider>
    </div>
  );
}
