/*
  impeccable:direction-contract /v7 (HomeV7) — RIFINITURA, non redesign.
  THESIS: la home attuale, tenuta identica nell'identità (crema, Fraunces,
  azzurro, blob, badge fluttuanti) e rifinita dove serviva davvero.
  MIGLIORIE (tutte via override .v7, la v1 su "/" resta intatta):
  1. titolo hero in azzurro pieno (via il gradient-text segnalato dal detector)
  2. nav senza animazione di padding (layout thrash segnalato)
  3. focus/scrollbar/caret a tema · 4. contrasto numeri hero
  5. tocco 44px sulle linguette · 6. mobile: hero compatto, CTA piene,
  scroll-cue via · 7. barra versioni · 8. riduci-animazioni totale.
  Riusa ESATTAMENTE i componenti della v1: zero fork.
  FINISH: unreviewed and undocumented is unfinished; this build ends with the
  finish review, the verdict, and the surface brief record.
*/
import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Marquee from '../components/Marquee';
import About from '../components/About';
import Stats from '../components/Stats';
import Services from '../components/Services';
import Menu from '../components/Menu';
import CakeCTA from '../components/CakeCTA';
import Gallery from '../components/Gallery';
import Contact from '../components/Contact';
import Footer from '../components/Footer';
import WhatsAppFab from '../components/WhatsAppFab';
import CakeConfigurator from '../components/CakeConfigurator';
import { CakeDataProvider } from '../data/CakeDataProvider';
import { VERSIONS } from './v-shared';
import '../styles/v7.css';

export default function HomeV7() {
  const [cfg, setCfg] = useState({ open: false, initial: undefined });
  const openCfg = (initial) => setCfg({ open: true, initial: initial && initial.allergies ? initial : undefined });
  const closeCfg = () => setCfg((c) => ({ ...c, open: false }));

  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Punto Gi! – Classica+ (anteprima V7) | Carpi';
    // La scrollbar del documento si tematizza da <html> (review, fix 2)
    document.documentElement.classList.add('v7-root');
    return () => {
      document.title = prevTitle;
      document.documentElement.classList.remove('v7-root');
    };
  }, []);

  return (
    <div className="v7">
      <Navbar onOpenConfigurator={openCfg} />
      <main>
        <Hero onOpenConfigurator={openCfg} />
        <Marquee />
        <About />
        <Stats />
        <Services />
        <Menu />
        <CakeCTA onOpen={openCfg} />
        <Gallery />
        <Contact />
      </main>
      <nav className="v7-versioni" aria-label="Confronta le versioni della homepage">
        <div className="v7-versioni-inner">
          <span className="lbl">Confronta le versioni:</span>
          {VERSIONS.map((v) => (
            <a key={v.href} href={v.href} className={v.href === '/v7' ? 'current' : ''}>{v.label}</a>
          ))}
        </div>
      </nav>
      <Footer />
      <WhatsAppFab />
      <CakeDataProvider>
        <CakeConfigurator open={cfg.open} initial={cfg.initial} onClose={closeCfg} />
      </CakeDataProvider>
    </div>
  );
}
