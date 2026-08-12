import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu as MenuIcon, X } from 'lucide-react';

// ev: chiave delle statistiche. Le voci senza ev non si contano (non esiste una
// chiave per "La nostra storia" e "Servizi"): data-ev={undefined} e React non
// scrive l'attributo. La stessa lista serve il menu grande e quello del
// telefono, quindi una voce cliccata da un menu o dall'altro finisce sotto la
// stessa chiave: è voluto, l'elenco EV non distingue i due menu per i link.
const links = [
  { href: '#about', label: 'La nostra storia' },
  { href: '#servizi', label: 'Servizi' },
  { href: '#menu', label: 'Gusti', ev: 'nav_gusti' },
  { href: '/allergeni', label: 'Allergeni', ev: 'allergeni_navbar' },
  { href: '#torte', label: 'Crea la torta', ev: 'nav_torte' },
  { href: '/consegna', label: 'Ordina a domicilio', ev: 'nav_consegna' },
  // /galleria = la pagina con TUTTE le foto. La striscia in fondo alla home
  // (#gallery) è solo un assaggio: chi cerca "Gallery" nel menu vuole vederle
  // tutte, non essere portato in fondo alla pagina.
  { href: '/galleria', label: 'Gallery', ev: 'nav_galleria' },
  { href: '#contatti', label: 'Contatti', ev: 'nav_contatti' },
];

export default function Navbar({ onOpenConfigurator }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
  }, [open]);

  return (
    <>
      <motion.header
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className={`nav ${scrolled ? 'scrolled' : ''}`}
      >
        <div className="container nav-inner">
          <a href="#top" className="brand">
            <span className="brand-mark">
              <img src="/logo.png" alt="Gelateria Punto Gi logo" />
            </span>
            <span>
              Punto Gi
              <small>Gelateria · Carpi</small>
            </span>
          </a>

          <nav>
            <ul className="nav-links">
              {links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} data-ev={l.ev}>{l.label}</a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="nav-cta">
            <button className="btn btn-primary" onClick={onOpenConfigurator} data-ev="torta_apre_navbar">
              Crea la tua torta
            </button>
            <button className="nav-toggle" aria-label="Apri menu" onClick={() => setOpen(true)}>
              <MenuIcon size={20} />
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            className="mobile-menu"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35 }}
          >
            <button
              aria-label="Chiudi menu"
              onClick={() => setOpen(false)}
              style={{ position: 'absolute', top: 24, right: 24, color: 'var(--cream)' }}
            >
              <X size={32} />
            </button>
            {links.map((l) => (
              <a key={l.href} href={l.href} data-ev={l.ev} onClick={() => setOpen(false)}>
                {l.label}
              </a>
            ))}
            <a
              className="cta"
              href="#torte"
              data-ev="torta_apre_menu_mobile"
              onClick={() => {
                setOpen(false);
                if (onOpenConfigurator) setTimeout(onOpenConfigurator, 350);
              }}
            >
              Crea la tua torta
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
