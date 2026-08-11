/*
  impeccable:direction-contract /v3 (HomeV3) — seed b3b6573f, code-led.
  THESIS: la gelateria come festa di paese — la homepage è UN unico manifesto
  tipografico di sagra emiliana affisso al muro; rifiutata la vetrina a card.
  OWN-WORLD: carta manifesto #faf3e3 su muro azzurrino, due inchiostri (azzurro
  #2c7699 + legno #c0894c/#96683a), moro #32281f; Alfa Slab One (caratteri
  legno), Oswald condensed, Bitter, Caveat; cornice doppia, fregi, manicule,
  bandierine, vignette ovali, righe centrate.
  STORY: leggi la locandina → ti viene voglia di festa → vai (gusti, torta, WA).
  FIRST-VIEWPORT: bandierine; "GELATERIA PUNTO GI! PRESENTA"; titolo a righe
  alternate IL GELATO / CHE TI / EMOZIONA!; riga data-luogo con manicule; CTA;
  il manifesto si affigge al load (interazione firma).
  FINISH: unreviewed and undocumented is unfinished; this build ends with the
  finish review, the verdict, and the surface brief record.
*/
import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Menu as MenuIcon, X, Instagram, Facebook } from 'lucide-react';
import {
  WA_URL, MAPS_URL, IG_URL, FB_URL, MAP_EMBED, VERSIONS,
  useMenu, useHours, todayKey, Counter, WaGlyph, usePageChrome,
} from './v-shared';
import galleryImages from '../data/galleryImages';
import CakePreview from '../components/CakePreview';
import CakeConfigurator from '../components/CakeConfigurator';
import { CakeDataProvider } from '../data/CakeDataProvider';
import QrCode from '../components/QrCode';
import '../styles/v3.css';

/* ---------- Ornamenti del manifesto ---------- */

const Manicula = ({ size = 22, flip = false }) => (
  <svg
    className="manicula"
    width={size}
    height={size * 0.6}
    viewBox="0 0 44 26"
    fill="currentColor"
    aria-hidden="true"
    style={flip ? { transform: 'scaleX(-1)' } : undefined}
  >
    <path d="M1 10.5c0-1.4 1.1-2.5 2.5-2.5h14.2c.5 0 .9-.5.7-1l-1.6-3.4c-.6-1.3.3-2.8 1.7-2.8.7 0 1.4.4 1.7 1l4.3 7.4c.3.4.7.7 1.2.8l14.8 2.4c1.5.2 2.5 1.5 2.5 3 0 1.7-1.4 3.1-3.1 3.1h-9.4c-.6 0-.9.7-.5 1.1l.9 1c.9 1 .2 2.6-1.1 2.6h-3.3c-.4 0-.9.2-1.2.5l-1.6 1.6c-.6.6-1.4.9-2.2.9H8.7c-1 0-1.9-.5-2.5-1.3l-4.6-6.6C1.2 17.2 1 16.5 1 15.8v-5.3z" />
  </svg>
);

const Bunting = () => {
  const cols = ['#2c7699', '#c0894c', '#7cb7d7', '#96683a', '#2c7699', '#7cb7d7', '#c0894c', '#2c7699', '#7cb7d7', '#96683a', '#c0894c', '#2c7699'];
  return (
    <svg className="v3-bunting" viewBox="0 0 720 34" aria-hidden="true">
      <line x1="0" y1="3" x2="720" y2="3" stroke="#32281f" strokeWidth="2" />
      {cols.map((c, i) => (
        <path key={i} d={`M${i * 60 + 6} 4 L${i * 60 + 54} 4 L${i * 60 + 30} 32 Z`} fill={c} />
      ))}
    </svg>
  );
};

const Fregio = () => (
  <div className="v3-fregio" aria-hidden="true">
    <svg width="46" height="24" viewBox="0 0 46 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6.5a5 5 0 0 1 10 0" />
      <path d="M18 6.5h10L23 20z" />
      <path d="M2 12h10M34 12h10" />
    </svg>
  </div>
);

/* ---------- Nav ---------- */

const NAV_LINKS = [
  { href: '#programma', label: 'Programma' },
  { href: '#cifre', label: 'Cifre' },
  { href: '#storia', label: 'Storia' },
  { href: '#torta', label: 'La torta' },
  { href: '#dove', label: 'Dove' },
  { href: '/allergeni', label: 'Allergeni' },
];

function NavV3() {
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
      <header className={`v3-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="v3-nav-inner">
          <a href="#top" className="v3-brand">
            <img src="/logo.png" alt="Logo Gelateria Punto Gi!" />
            <span>Punto Gi<span className="punto">!</span></span>
          </a>
          <nav aria-label="Sommario del manifesto">
            <ul className="v3-nav-links">
              {NAV_LINKS.map((l) => (
                <li key={l.href}><a href={l.href}>{l.label}</a></li>
              ))}
            </ul>
          </nav>
          <button type="button" className="v3-nav-toggle" aria-label="Apri il sommario" onClick={() => setOpen(true)}>
            <MenuIcon size={20} />
          </button>
        </div>
      </header>
      <AnimatePresence>
        {open && (
          <motion.div
            className="v3-mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <button type="button" className="v3-mobile-close" aria-label="Chiudi il sommario" onClick={() => setOpen(false)}>
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

/* ---------- Pagina ---------- */

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

export default function HomeV3() {
  const reduce = useReducedMotion();
  const categories = useMenu();
  const hours = useHours();
  const oggi = todayKey();
  const [cfg, setCfg] = useState({ open: false, initial: undefined });
  const openCfg = (initial) => setCfg({ open: true, initial: initial && initial.allergies ? initial : undefined });
  const closeCfg = () => setCfg((c) => ({ ...c, open: false }));

  usePageChrome('Punto Gi! – La Sagra (anteprima V3) | Carpi', '#235f7d', '#d8eaf3');

  const imgs = galleryImages?.length ? [...galleryImages.slice(9), ...galleryImages.slice(0, 9)] : ['/hero-cup.jpg', '/torte.jpg', '/gelato.jpg'];

  return (
    <div className="v3" id="top">
      <NavV3 />
      <main className="v3-wall">
        <motion.article
          className="v3-poster"
          {...(reduce ? {} : {
            initial: { opacity: 0, y: -22, rotate: -0.8 },
            animate: { opacity: 1, y: 0, rotate: 0 },
            transition: { type: 'spring', stiffness: 120, damping: 16, mass: 1.1 },
          })}
        >
          <div className="v3-frame">
            <Bunting />

            {/* Testata */}
            <p className="v3-kick">La Gelateria Punto Gi! di Carpi presenta</p>
            <h1 className="v3-hero-title">
              <span className="r1">Il gelato</span>
              <span className="r2">— che ti —</span>
              <span className="r3">Emoziona!</span>
            </h1>
            <p className="v3-dateline">
              <Manicula /> Aperto ogni giorno
              <span aria-hidden="true">·</span>
              Via Remesina Interna 46, Carpi (MO)
              <span className="v3-manicula-fine"><Manicula flip /></span>
            </p>
            <p className="v3-hero-note">
              Una ricetta unica, perfezionata negli anni: cremoso, corposo, denso
              come quello <em>"di una volta"</em> — anche <strong>senza lattosio</strong> e{' '}
              <strong>vegan</strong>. Mantecato fresco ogni mattina.
            </p>
            <div className="v3-ctas">
              <a className="v3-btn v3-btn-primary" href="#programma">Scopri i gusti</a>
              <button type="button" className="v3-btn v3-btn-ghost" onClick={() => openCfg()}>
                Crea la tua torta
              </button>
            </div>
            <figure className="v3-oval">
              <img src="/hero-cup.jpg" alt="Coppetta di gelato artigianale Punto Gi!" />
              <span className="ribbon">Fresco ogni giorno</span>
              <figcaption>Fig. unica — la rinomata coppetta</figcaption>
            </figure>

            {/* Programma dei gusti */}
            <Fregio />
            <section id="programma" aria-label="Programma dei gusti">
              <h2 className="v3-sec-title">Programma dei <span className="blu">gusti</span></h2>
              <p className="v3-sec-sub">Specialità artigianali · aggiornato dallo staff</p>
              <div className="v3-programma">
                {categories.map((c) => (
                  <div className="v3-cat" key={c.id}>
                    <h3>{c.name}</h3>
                    <p className="desc">{c.description}</p>
                    {c.flavors.map((f) => {
                      const firma = f.tag === 'firma';
                      return (
                        <div key={f.name} className={`v3-voce ${firma ? 'firma' : ''}`}>
                          <span className="dot" style={{ background: f.color }} />
                          <span>{f.name}</span>
                          {firma && <span className="diet">Gusto firma</span>}
                          {!firma && f.tag && <span className="diet">{f.tag}</span>}
                          {f.diet?.map((d) => (
                            <span key={d.short} className="diet" title={d.label}>{d.short}</span>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <p className="v3-menu-nota">
                Altri gusti stagionali in vetrina · per intolleranze consultare il{' '}
                <a href="/allergeni">Quaderno Allergeni</a>
              </p>
            </section>

            {/* Cifre */}
            <Fregio />
            <section id="cifre" aria-label="Le nostre cifre">
              <h2 className="v3-sec-title">Straordinarie <span className="blu">cifre</span></h2>
              <p className="v3-sec-sub">Valori reali del laboratorio · per anno di produzione</p>
              <div className="v3-cifre">
                <p className="v3-cifra-riga">
                  <strong>+<Counter to={12000} /></strong>
                  <span>chili di gelato mantecato</span>
                </p>
                <p className="v3-cifra-riga">
                  <strong>+<Counter to={2000} /></strong>
                  <span>torte create</span>
                </p>
                <p className="v3-cifra-riga">
                  <strong><Counter to={365} /></strong>
                  <span>giorni di produzione, su 365</span>
                </p>
                <p className="v3-cifra-riga">
                  <strong>ogni giorno</strong>
                  <span>torte sfornate fresche</span>
                </p>
              </div>
            </section>

            {/* Storia */}
            <Fregio />
            <section id="storia" aria-label="La nostra storia">
              <h2 className="v3-sec-title">La nostra <span className="blu">storia</span></h2>
              <div className="v3-storia-foto">
                <figure className="v3-vignetta">
                  <img src="/gelato.jpg" alt="Gelato cremoso appena mantecato" />
                  <figcaption>Veduta I — il mantecato</figcaption>
                </figure>
                <figure className="v3-vignetta">
                  <img src="/pasticcini.jpg" alt="Pasticcini e dolci al cucchiaio della gelateria" />
                  <figcaption>Veduta II — la pasticceria</figcaption>
                </figure>
              </div>
              <p className="v3-storia-testo">
                A Carpi, in via Remesina Interna, c'è un piccolo laboratorio dove ogni
                mattina nasce qualcosa di speciale. Selezioniamo materie prime di
                qualità, lavoriamo con tempi lenti e ci mettiamo passione vera —
                quella che si sente al primo cucchiaio.
              </p>
              <p className="v3-script" style={{ marginTop: 'var(--v3-s3)' }}>Ti aspettiamo per farti emozionare!</p>
            </section>

            {/* Servizi */}
            <Fregio />
            <section id="servizi" aria-label="I nostri servizi">
              <h2 className="v3-sec-title">Servizi della <span className="blu">festa</span></h2>
              <div className="v3-servizi">
                <a className="v3-servizio" href={WA_URL} target="_blank" rel="noopener noreferrer">
                  <Manicula size={20} />
                  <h3>Consegna a domicilio</h3>
                  <p>ordini su WhatsApp o piattaforme partner, il gelato arriva da te</p>
                </a>
                <button type="button" className="v3-servizio" onClick={() => openCfg()}>
                  <Manicula size={20} />
                  <h3>Torte su prenotazione</h3>
                  <p>compleanni, anniversari e pranzi dei parenti — anche CROCK</p>
                </button>
                <a className="v3-servizio" href="#programma">
                  <Manicula size={20} />
                  <h3>Pasticceria a freddo</h3>
                  <p>granite siciliane, pasticcini, semifreddi, ghiaccioli, salame dolce</p>
                </a>
                <a className="v3-servizio" href="/allergeni">
                  <Manicula size={20} />
                  <h3>Senza lattosio &amp; vegan</h3>
                  <p>tante varianti senza lattosio, senza glutine e 100% vegan</p>
                </a>
              </div>
            </section>

            {/* Torta */}
            <Fregio />
            <section id="torta" aria-label="La tua torta">
              <h2 className="v3-sec-title">La torta dei <span className="blu">sogni</span></h2>
              <div className="v3-torta-grid">
                <div className="v3-torta-copy">
                  <p>
                    Configuratore guidato passo per passo: scegli tipo, gusti, base,
                    decorazioni e scritta — noi la prepariamo a mano per te.
                  </p>
                  <ul className="v3-torta-specs">
                    <li><Manicula size={18} /> Tutto personalizzato: gusti, decoro, scritta</li>
                    <li><Manicula size={18} /> Guidata, in 4 minuti</li>
                    <li><Manicula size={18} /> Preavviso minimo di 5 ore</li>
                    <li><Manicula size={18} /> Anche senza glutine, senza lattosio, vegana</li>
                  </ul>
                  <div className="v3-torta-ctas">
                    <button type="button" className="v3-btn v3-btn-primary" onClick={() => openCfg()}>Inizia ora</button>
                    <a className="v3-btn v3-btn-ghost" href="#dove">Preferisco scrivere</a>
                  </div>
                </div>
                <figure className="v3-torta-frame">
                  <CakePreview config={DEMO_CAKE} />
                  <figcaption>Anteprima dal configuratore — poi la facciamo a mano</figcaption>
                </figure>
              </div>
            </section>

            {/* Vedute */}
            <Fregio />
            <section id="banco" aria-label="Le nostre creazioni">
              <h2 className="v3-sec-title">Vedute del <span className="blu">banco</span></h2>
              <p className="v3-sec-sub">Scorri le fotografie</p>
              <div className="v3-vedute">
                {imgs.map((src, i) => (
                  <figure className="v3-veduta" key={src}>
                    <img src={src} alt={`Creazione della Gelateria Punto Gi! numero ${i + 1}`} loading="lazy" />
                    <figcaption>Veduta N. {String(i + 1).padStart(2, '0')}</figcaption>
                  </figure>
                ))}
              </div>
            </section>

            {/* Dove & quando */}
            <Fregio />
            <section id="dove" aria-label="Dove e quando">
              <h2 className="v3-sec-title">Dove &amp; <span className="blu">quando</span></h2>
              <div className="v3-dove-grid">
                <div className="v3-dove-col">
                  <h3>Recapiti</h3>
                  <div className="v3-recapito">
                    <Manicula size={18} />
                    <div>
                      <span className="tipo">Indirizzo</span>
                      <a href={MAPS_URL} target="_blank" rel="noopener noreferrer">Via Remesina Interna 46, 41012 Carpi (MO)</a>
                    </div>
                  </div>
                  <div className="v3-recapito">
                    <Manicula size={18} />
                    <div>
                      <span className="tipo">Whatsappaci</span>
                      <a href={WA_URL} target="_blank" rel="noopener noreferrer">320 330 6009</a>
                    </div>
                  </div>
                  <div className="v3-recapito">
                    <Manicula size={18} />
                    <div>
                      <span className="tipo">Seguici</span>
                      <a href={IG_URL} target="_blank" rel="noopener noreferrer">@gelateriapuntogicarpi</a>
                    </div>
                  </div>
                  <h3 style={{ marginTop: 'var(--v3-s4)' }}>Orari di apertura</h3>
                  <table className="v3-orari">
                    <tbody>
                      {hours.map((o) => {
                        const isToday = o.day.toLowerCase().startsWith(oggi);
                        return (
                          <tr key={o.day} className={isToday ? 'today' : ''}>
                            <td>
                              {o.day}
                              {isToday && <span className="v3-oggi">Oggi</span>}
                            </td>
                            <td>{o.hours}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="v3-dove-col">
                  <h3>La mappa</h3>
                  <div className="v3-mappa">
                    <iframe
                      title="Mappa Gelateria Punto Gi! Carpi"
                      src={MAP_EMBED}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      allowFullScreen
                    />
                  </div>
                  <div className="v3-qr">
                    <QrCode value={WA_URL} size={88} dark="#32281f" title="QR per scriverci su WhatsApp" />
                    <p>Inquadra il codice<br />e scrivici su WhatsApp</p>
                  </div>
                  <div className="v3-ctas" style={{ marginTop: 'var(--v3-s4)' }}>
                    <a className="v3-btn v3-btn-legno" href={WA_URL} target="_blank" rel="noopener noreferrer">
                      <WaGlyph size={18} /> Scrivici su WhatsApp
                    </a>
                  </div>
                </div>
              </div>
            </section>

            <div className="v3-chiusa">
              <p className="v3-script">a prestissssimo!</p>
              <p>
                Si ringrazia la spettabile clientela. — Gelateria Punto Gi!,
                Carpi (MO). Ingresso libero, uscita difficile.
              </p>
            </div>

            <Bunting />
          </div>
        </motion.article>
      </main>

      <footer className="v3-footer">
        <div className="v3-footer-inner">
          <p>© {new Date().getFullYear()} Gelateria Punto Gi! · Manifesto V3 in anteprima — la home attuale resta su "/"</p>
          <ul className="v3-versions">
            {VERSIONS.map((v) => (
              <li key={v.href}>
                <a href={v.href} className={v.href === '/v3' ? 'current' : ''}>{v.label}</a>
              </li>
            ))}
          </ul>
          <div className="v3-socials">
            <a href={IG_URL} aria-label="Instagram" target="_blank" rel="noopener noreferrer"><Instagram size={18} /></a>
            <a href={FB_URL} aria-label="Facebook" target="_blank" rel="noopener noreferrer"><Facebook size={18} /></a>
            <a href={WA_URL} aria-label="WhatsApp" target="_blank" rel="noopener noreferrer"><WaGlyph size={18} /></a>
          </div>
        </div>
      </footer>

      <a className="v3-fab" href={WA_URL} target="_blank" rel="noopener noreferrer" aria-label="Contattaci su WhatsApp">
        <WaGlyph size={26} />
      </a>

      <CakeDataProvider>
        <CakeConfigurator open={cfg.open} initial={cfg.initial} onClose={closeCfg} />
      </CakeDataProvider>
    </div>
  );
}
