/*
  impeccable:direction-contract /v5 (HomeV5) — seed 203a50ff, code-led.
  THESIS: la gelateria come vassoio della domenica — il pacchetto di carta
  paglia legato con lo spago che porti ai parenti; rifiutata la vetrina web
  generica e il minimal freddo.
  OWN-WORLD: carta paglia #e9dcc0, cartoncino panna a righe azzurre #bcd9ea,
  etichetta ovale dorata #c0894c, spago #a8845c, azzurro #2c7699, moro #32281f;
  Italiana + Gelasio + Cutive Mono (scontrino) + Caveat; bordi smerlati,
  velina, nastro adesivo, francobollo, cartolina, centrino.
  STORY: ricevi il pacchetto → lo scarti (velina, spago) → dentro c'è tutto
  (gusti, numeri, torta) → rispondi alla cartolina (WA).
  FIRST-VIEWPORT: etichetta ovale dorata con nome e claim; copy; due CTA; il
  pacchetto con la foto sotto la velina e LO SPAGO CHE SI ANNODA al load con
  fiocco (interazione firma).
  FINISH: unreviewed and undocumented is unfinished; this build ends with the
  finish review, the verdict, and the surface brief record.
*/
import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Menu as MenuIcon, X, Instagram, Facebook, Cake, ArrowDown } from 'lucide-react';
import {
  WA_URL, MAPS_URL, IG_URL, FB_URL, MAP_EMBED, VERSIONS,
  useMenu, useHours, todayKey, Counter, WaGlyph, usePageChrome,
} from './v-shared';
import CakePreview from '../components/CakePreview';
import CakeConfigurator from '../components/CakeConfigurator';
import { CakeDataProvider } from '../data/CakeDataProvider';
import QrCode from '../components/QrCode';
import '../styles/v5.css';

/* Fiocco di spago */
const Fiocco = ({ size = 30 }) => (
  <svg width={size} height={size * 0.72} viewBox="0 0 50 36" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M25 18C18 8 6 8 4 15s7 12 21 3" />
    <path d="M25 18c7-10 19-10 21-3s-7 12-21 3" />
    <circle cx="25" cy="18" r="3.5" fill="currentColor" />
    <path d="M22 21 14 33M28 21l8 12" />
  </svg>
);

const NAV_LINKS = [
  { href: '#vassoio', label: 'I gusti' },
  { href: '#scontrino', label: 'I numeri' },
  { href: '#storia', label: 'Storia' },
  { href: '#pacchettini', label: 'Servizi' },
  { href: '#torta', label: 'Torte' },
  { href: '#cartolina', label: 'Dove' },
  { href: '/allergeni', label: 'Allergeni' },
];

function NavV5() {
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
      <header className={`v5-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="v5-wrap v5-nav-inner">
          <a href="#top" className="v5-brand">
            <img src="/logo.png" alt="Logo Gelateria Punto Gi!" />
            <span>
              <span className="nome">Punto Gi<span className="punto">!</span></span>
              <small>Gelateria · Carpi</small>
            </span>
          </a>
          <nav aria-label="Sommario">
            <ul className="v5-nav-links">
              {NAV_LINKS.map((l) => (
                <li key={l.href}><a href={l.href}>{l.label}</a></li>
              ))}
            </ul>
          </nav>
          <button type="button" className="v5-nav-toggle" aria-label="Apri il sommario" onClick={() => setOpen(true)}>
            <MenuIcon size={20} />
          </button>
        </div>
      </header>
      <AnimatePresence>
        {open && (
          <motion.div
            className="v5-mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <button type="button" className="v5-mobile-close" aria-label="Chiudi il sommario" onClick={() => setOpen(false)}>
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

/* Spunta a matita, disegnata a mano */
const Spunta = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 13.5c2.2 1.6 3.6 3.2 4.4 5C10.5 12.5 15 6.5 20.5 3.6" />
  </svg>
);

const DOLCEZZE = [
  { title: 'Ricetta di famiglia', text: 'sviluppata e affinata negli anni nel nostro laboratorio' },
  { title: 'Mantecato fresco', text: 'produzione quotidiana, mai scorte di magazzino' },
  { title: 'Per tutti', text: 'senza lattosio e senza glutine sempre disponibili' },
  { title: 'Materie prime top', text: 'pistacchio, nocciola e cioccolato scelti con cura' },
];

export default function HomeV5() {
  const reduce = useReducedMotion();
  const categories = useMenu();
  const hours = useHours();
  const oggi = todayKey();
  const [active, setActive] = useState(null);
  const currentCat = categories.find((c) => c.id === active) || categories[0];
  const [cfg, setCfg] = useState({ open: false, initial: undefined });
  const openCfg = (initial) => setCfg({ open: true, initial: initial && initial.allergies ? initial : undefined });
  const closeCfg = () => setCfg((c) => ({ ...c, open: false }));

  usePageChrome('Punto Gi! – Il Vassoio (anteprima V5) | Carpi', '#235f7d', '#e9dcc0');

  // Solo fotografie vere: le grafiche social col lettering spezzerebbero
  // l'album di famiglia (rilievo della finish review).
  const imgs = ['/hero-cup.jpg', '/gelato.jpg', '/torte.jpg', '/semifreddi.jpg', '/pasticcini.jpg'];
  // Lo spago si annoda quando il pacchetto entra in vista: così l'interazione
  // firma si vede su ogni viewport (rilievo della finish review).
  const spagoDraw = reduce ? {} : {
    initial: { pathLength: 0 },
    whileInView: { pathLength: 1 },
    viewport: { once: true, amount: 0.45 },
    transition: { duration: 1.1, delay: 0.2, ease: [0.16, 1, 0.3, 1] },
  };

  return (
    <div className="v5" id="top">
      <NavV5 />
      <main>
        {/* Hero: il pacchetto */}
        <section className="v5-hero">
          <div className="v5-wrap v5-hero-grid">
            <div className="v5-hero-intro">
              <div className="v5-ovale">
                <span className="sopra">Gelateria artigianale · Carpi (MO)</span>
                <h1>Punto Gi!</h1>
                <span className="claim">il gelato che ti emoziona</span>
              </div>
            </div>
            <div className="v5-hero-body">
              <p className="v5-hero-copy">
                Come il vassoio della domenica: una ricetta unica, perfezionata
                negli anni — cremoso, corposo, denso come quello{' '}
                <em>"di una volta"</em>, anche <strong>senza lattosio</strong> e{' '}
                <strong>vegan</strong>. Mantecato fresco ogni mattina, legato con
                cura, portato con orgoglio.
              </p>
              <div className="v5-hero-ctas">
                <a className="v5-btn v5-btn-azzurro" href="#vassoio">
                  Scarta i gusti <ArrowDown size={16} />
                </a>
                <button type="button" className="v5-btn v5-btn-filo" onClick={() => openCfg()}>
                  <Cake size={16} /> Crea la tua torta
                </button>
              </div>
            </div>
            <figure className="v5-pacchetto">
              <div className="foto">
                <img src="/hero-cup.jpg" alt="Coppetta di gelato artigianale Punto Gi!" />
                <span className="velina" aria-hidden="true" />
              </div>
              <svg className="v5-spago-svg" viewBox="0 0 100 110" preserveAspectRatio="none" aria-hidden="true">
                <motion.path className="ombra" strokeWidth="4.5" d="M50 1 V109 M1 52 H99" vectorEffect="non-scaling-stroke" {...spagoDraw} />
                <motion.path strokeWidth="3" d="M50 0 V108 M0 51 H98" vectorEffect="non-scaling-stroke" {...spagoDraw} />
                <motion.path className="luce" strokeWidth="1" d="M49.4 0 V108 M0 50.4 H98" vectorEffect="non-scaling-stroke" {...spagoDraw} />
              </svg>
              {/* Centrato con margini negativi: framer sovrascrive transform
                  quando anima scale, quindi niente translate(-50%,-50%). */}
              <motion.span
                className="v5-fiocco-hero"
                style={{ position: 'absolute', left: '50%', top: '46%', marginLeft: -40, marginTop: -29, color: '#7f5f37', zIndex: 2 }}
                {...(reduce ? {} : {
                  initial: { opacity: 0, scale: 0.2 },
                  whileInView: { opacity: 1, scale: 1 },
                  viewport: { once: true, amount: 0.45 },
                  transition: { type: 'spring', stiffness: 300, damping: 15, delay: 1.2 },
                })}
              >
                <Fiocco size={80} />
              </motion.span>
              <figcaption>Legato a mano · da scartare con calma</figcaption>
            </figure>
          </div>
        </section>

        {/* Dentro il vassoio (menu) */}
        <section id="vassoio" className="v5-section">
          <div className="v5-wrap">
            <div className="v5-carta">
              <span className="v5-tape" aria-hidden="true" />
              <div className="v5-head">
                <h2>Dentro il <em>vassoio</em></h2>
                <span className="v5-etichetta-voce">Stagionale · aggiornato dallo staff</span>
              </div>
              <div className="v5-stickers" role="tablist" aria-label="Categorie di gusti">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={currentCat.id === c.id}
                    className={`v5-sticker ${currentCat.id === c.id ? 'active' : ''}`}
                    onClick={() => setActive(c.id)}
                  >
                    {c.name}
                    <span className="count">{c.flavors.length}</span>
                  </button>
                ))}
              </div>
              <p className="v5-cat-desc">{currentCat.description}</p>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentCat.id}
                  className="v5-gusti"
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                >
                  {currentCat.flavors.map((f) => {
                    const firma = f.tag === 'firma';
                    return (
                      <div key={f.name} className={`v5-gusto ${firma ? 'firma' : ''}`}>
                        <span className="dot" style={{ background: f.color }} />
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
              <div className="v5-menu-foot">
                <span className="v5-legenda">SL senza lattosio · SG senza glutine · VEG vegan · altri gusti stagionali in vetrina</span>
                <a className="v5-allergeni-link" href="/allergeni">Quaderno allergeni completo</a>
              </div>
            </div>
          </div>
        </section>

        {/* Lo scontrino */}
        <section id="scontrino" className="v5-section">
          <div className="v5-wrap v5-scontrino-zona">
            <div className="v5-scontrino-copy">
              <h2>Piccolo laboratorio,<br /><em>conto alto.</em></h2>
              <p>
                Sul vassoio lasciamo sempre lo scontrino: questi sono i numeri
                veri del nostro laboratorio, per anno di produzione. Nessun
                trucco, tutta panna.
              </p>
            </div>
            <div className="v5-scontrino" role="figure" aria-label="Scontrino con i numeri del laboratorio">
              <p className="testata">Gelateria Punto Gi! · Carpi<br />Via Remesina Interna 46</p>
              <p className="riga"><span>Gelato mantecato</span><strong>+<Counter to={12000} /> kg</strong></p>
              <p className="riga"><span>Torte create</span><strong>+<Counter to={2000} /></strong></p>
              <p className="riga"><span>Giorni di produzione</span><strong><Counter to={365} />/365</strong></p>
              <p className="riga"><span>Torte fresche</span><strong>ogni giorno</strong></p>
              <p className="totale"><span>Totale</span><span>emozione</span></p>
              <p className="nota">* documento poetico ma con valori reali — grazie e a prestissssimo!</p>
            </div>
          </div>
        </section>

        {/* Storia */}
        <section id="storia" className="v5-section">
          <div className="v5-wrap">
            <div className="v5-carta v5-carta-bianca">
              <span className="v5-tape" aria-hidden="true" />
              <div className="v5-head">
                <h2>La <em>ricetta</em> di famiglia</h2>
                <span className="v5-etichetta-voce">Via Remesina Interna 46 · dal laboratorio</span>
              </div>
              <div className="v5-storia-grid">
                <figure className="v5-storia-foto">
                  <img src="/gelato.jpg" alt="Gelato cremoso appena mantecato" />
                  <img className="seconda" src="/torte.jpg" alt="Torte gelato decorate a mano" />
                </figure>
                <div className="v5-storia-copy">
                  <p className="v5-script">"come quello di una volta"</p>
                  <p>
                    A Carpi, in via Remesina Interna, c'è un piccolo laboratorio dove
                    ogni mattina nasce qualcosa di speciale. Selezioniamo materie
                    prime di qualità, lavoriamo con tempi lenti e ci mettiamo
                    passione vera — quella che si sente al primo cucchiaio.
                  </p>
                  <div className="v5-dolcezze">
                    {DOLCEZZE.map((d) => (
                      <div className="v5-dolcezza" key={d.title}>
                        <span className="spunta"><Spunta /></span>
                        <div>
                          <h3>{d.title}</h3>
                          <p>— {d.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pacchettini (servizi) */}
        <section id="pacchettini" className="v5-section">
          <div className="v5-wrap">
            <div className="v5-head" style={{ borderBottomColor: 'var(--v5-moro)' }}>
              <h2>I nostri <em>pacchettini</em></h2>
              <span className="v5-etichetta-voce">Tutto ciò che puoi desiderare</span>
            </div>
            <div className="v5-pacchettini">
              <a className="v5-pacchettino" href={WA_URL} target="_blank" rel="noopener noreferrer">
                <span className="fiocco"><Fiocco size={34} /></span>
                <h3>Consegna a domicilio</h3>
                <p>Ordini su WhatsApp o piattaforme partner: il vassoio arriva da te.</p>
              </a>
              <button type="button" className="v5-pacchettino" onClick={() => openCfg()}>
                <span className="fiocco"><Fiocco size={34} /></span>
                <h3>Torte su prenotazione</h3>
                <p>Compleanni, anniversari, pranzi dei parenti — anche CROCK.</p>
              </button>
              <a className="v5-pacchettino" href="#vassoio">
                <span className="fiocco"><Fiocco size={34} /></span>
                <h3>Pasticceria a freddo</h3>
                <p>Granite siciliane, pasticcini, semifreddi, ghiaccioli, salame dolce.</p>
              </a>
              <a className="v5-pacchettino" href="/allergeni">
                <span className="fiocco"><Fiocco size={34} /></span>
                <h3>Senza lattosio &amp; vegan</h3>
                <p>Varianti senza lattosio, senza glutine e 100% vegan.</p>
              </a>
            </div>
          </div>
        </section>

        {/* Torta sul centrino */}
        <section id="torta" className="v5-section">
          <div className="v5-wrap">
            <div className="v5-carta">
              <span className="v5-tape" aria-hidden="true" />
              <div className="v5-head">
                <h2>La tua torta, <em>su ordinazione</em></h2>
                <span className="v5-etichetta-voce">Configuratore guidato · pronta in giornata</span>
              </div>
              <div className="v5-torta-grid">
                <div className="v5-torta-copy">
                  <p>
                    Scegli tipo, gusti, base, decorazioni e scritta passo per passo —
                    noi la prepariamo a mano e la leghiamo col fiocco.
                  </p>
                  <ul className="v5-torta-specs">
                    <li>Tutto personalizzato: gusti, decoro, scritta</li>
                    <li>Guidata, in 4 minuti</li>
                    <li>Preavviso minimo di 5 ore</li>
                    <li>Anche senza glutine, senza lattosio, vegana</li>
                  </ul>
                  <div className="v5-torta-ctas">
                    <button type="button" className="v5-btn v5-btn-azzurro" onClick={() => openCfg()}>
                      <Cake size={16} /> Inizia ora
                    </button>
                    <a className="v5-btn v5-btn-filo" href="#cartolina">Preferisco scrivere</a>
                  </div>
                </div>
                <figure className="v5-centrino">
                  <div className="pizzo">
                    <CakePreview config={DEMO_CAKE} />
                  </div>
                  <figcaption>Sul centrino — anteprima dal configuratore</figcaption>
                </figure>
              </div>
            </div>
          </div>
        </section>

        {/* Album dei vassoi */}
        <section id="album" className="v5-section">
          <div className="v5-wrap">
            <div className="v5-head" style={{ borderBottomColor: 'var(--v5-moro)' }}>
              <h2>I vassoi <em>usciti oggi</em></h2>
              <span className="v5-etichetta-voce">Scorri l'album</span>
            </div>
          </div>
          <div className="v5-wrap">
            <div className="v5-album">
              {imgs.map((src, i) => (
                <figure className="v5-fotina" key={src}>
                  <img src={src} alt={`Creazione della Gelateria Punto Gi! numero ${i + 1}`} loading="lazy" />
                  <figcaption>
                    <span>Vassoio N. {String(i + 1).padStart(2, '0')}</span>
                    <span>Punto Gi!</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Cartolina */}
        <section id="cartolina" className="v5-section">
          <div className="v5-wrap">
            <div className="v5-cartolina">
              <div className="v5-cartolina-grid">
                <div className="v5-messaggio">
                  <p className="v5-script">Cara amica, caro amico,</p>
                  <p>
                    un cucchiaio e ci conosci: ti aspettiamo in gelateria per farti
                    emozionare. Trovi granite, torte, semifreddi e il banco pieno
                    di gusti — anche senza lattosio e vegan.
                  </p>
                  <p className="v5-script" style={{ fontSize: '1.5rem', marginTop: 'var(--v5-s3)' }}>a prestissssimo!</p>
                  <table className="v5-orari">
                    <tbody>
                      {hours.map((o) => {
                        const isToday = o.day.toLowerCase().startsWith(oggi);
                        return (
                          <tr key={o.day} className={isToday ? 'today' : ''}>
                            <td>
                              {o.day}
                              {isToday && <span className="v5-oggi">Oggi</span>}
                            </td>
                            <td>{o.hours}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="v5-cartolina-sep" aria-hidden="true" />
                <div className="v5-indirizzo-blocco">
                  <span className="v5-francobollo">
                    <img src="/logo.png" alt="" />
                    <span>Carpi (MO) · Italia</span>
                  </span>
                  <div className="v5-indirizzo-righe">
                    <p className="v5-indirizzo-riga">
                      <span className="tipo">A</span>
                      Gelateria Punto Gi!
                    </p>
                    <p className="v5-indirizzo-riga">
                      <span className="tipo">Indirizzo</span>
                      <a href={MAPS_URL} target="_blank" rel="noopener noreferrer">Via Remesina Interna 46, 41012 Carpi (MO)</a>
                    </p>
                    <p className="v5-indirizzo-riga">
                      <span className="tipo">Whatsappaci</span>
                      <a href={WA_URL} target="_blank" rel="noopener noreferrer">320 330 6009</a>
                    </p>
                    <p className="v5-indirizzo-riga">
                      <span className="tipo">Seguici</span>
                      <a href={IG_URL} target="_blank" rel="noopener noreferrer">@gelateriapuntogicarpi</a>
                    </p>
                  </div>
                  <div className="v5-mappa">
                    <iframe
                      title="Mappa Gelateria Punto Gi! Carpi"
                      src={MAP_EMBED}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      allowFullScreen
                    />
                  </div>
                  <div className="v5-qr">
                    <QrCode value={WA_URL} size={80} dark="#32281f" title="QR per scriverci su WhatsApp" />
                    <p>Inquadra il codice<br />e rispondi alla cartolina</p>
                  </div>
                </div>
              </div>
              <div className="v5-cartolina-cta">
                <span className="v5-etichetta-voce">Affrancatura offerta dalla casa</span>
                <a className="v5-btn v5-btn-oro" href={WA_URL} target="_blank" rel="noopener noreferrer">
                  <WaGlyph size={18} /> Scrivici su WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="v5-footer">
        <div className="v5-wrap v5-footer-inner">
          <p>© {new Date().getFullYear()} Gelateria Punto Gi! · Vassoio V5 in anteprima — la home attuale resta su "/"</p>
          <ul className="v5-versions">
            {VERSIONS.map((v) => (
              <li key={v.href}>
                <a href={v.href} className={v.href === '/v5' ? 'current' : ''}>{v.label}</a>
              </li>
            ))}
          </ul>
          <div className="v5-socials">
            <a href={IG_URL} aria-label="Instagram" target="_blank" rel="noopener noreferrer"><Instagram size={18} /></a>
            <a href={FB_URL} aria-label="Facebook" target="_blank" rel="noopener noreferrer"><Facebook size={18} /></a>
            <a href={WA_URL} aria-label="WhatsApp" target="_blank" rel="noopener noreferrer"><WaGlyph size={18} /></a>
          </div>
        </div>
      </footer>

      <a className="v5-fab" href={WA_URL} target="_blank" rel="noopener noreferrer" aria-label="Contattaci su WhatsApp">
        <WaGlyph size={26} />
      </a>

      <CakeDataProvider>
        <CakeConfigurator open={cfg.open} initial={cfg.initial} onClose={closeCfg} />
      </CakeDataProvider>
    </div>
  );
}
