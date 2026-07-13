import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu as MenuIcon, X } from 'lucide-react';

const links = [
  { href: '#about', label: 'La nostra storia' },
  { href: '#servizi', label: 'Servizi' },
  { href: '#menu', label: 'Gusti' },
  { href: '/allergeni', label: 'Allergeni' },
  { href: '#torte', label: 'Crea la torta' },
  { href: '#gallery', label: 'Gallery' },
  { href: '#contatti', label: 'Contatti' },
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
              <img src="/logo.png" alt="Gelateria Punto Gi! logo" />
            </span>
            <span>
              Punto Gi<span style={{ color: 'var(--orange)' }}>!</span>
              <small>Gelateria · Carpi</small>
            </span>
          </a>

          <nav>
            <ul className="nav-links">
              {links.map((l) => (
                <li key={l.href}>
                  <a href={l.href}>{l.label}</a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="nav-cta">
            <button className="btn btn-primary" onClick={onOpenConfigurator}>
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
              <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </a>
            ))}
            <a
              className="cta"
              href="#torte"
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
