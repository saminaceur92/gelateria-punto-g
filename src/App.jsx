import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Marquee from './components/Marquee';
import About from './components/About';
import Services from './components/Services';
import Menu from './components/Menu';
import CakeCTA from './components/CakeCTA';
import Gallery from './components/Gallery';
import Contact from './components/Contact';
import Footer from './components/Footer';
import WhatsAppFab from './components/WhatsAppFab';
import CakeConfigurator from './components/CakeConfigurator';
import PaymentResult from './components/PaymentResult';
import { CakeDataProvider } from './data/CakeDataProvider';
import { sendOrderEmail } from './lib/email';

export default function App() {
  const [cfg, setCfg] = useState({ open: false, initial: undefined });
  // openCfg può ricevere un filtro iniziale ({ allergies: [...] }) dai link "alternative".
  const openCfg = (initial) => setCfg({ open: true, initial: initial && initial.allergies ? initial : undefined });
  const closeCfg = () => setCfg((c) => ({ ...c, open: false }));

  // Esito ritorno da Stripe Checkout (?pagamento=ok | annullato)
  const [payResult, setPayResult] = useState(
    () => new URLSearchParams(window.location.search).get('pagamento'),
  );
  useEffect(() => {
    if (payResult === 'ok') {
      // Email di conferma (best-effort): i parametri sono stati salvati prima del redirect.
      // L'ordine è già stato salvato lato server dal webhook Stripe.
      try {
        const raw = sessionStorage.getItem('pg_order_email');
        if (raw) {
          sendOrderEmail(JSON.parse(raw));
          sessionStorage.removeItem('pg_order_email');
        }
      } catch { /* ignora */ }
    }
    if (payResult) window.history.replaceState({}, '', window.location.pathname);
  }, [payResult]);
  const clearPayResult = () => setPayResult(null);

  return (
    <>
      <Navbar onOpenConfigurator={openCfg} />
      <main>
        <Hero onOpenConfigurator={openCfg} />
        <Marquee />
        <About />
        <Services />
        <Menu />
        <CakeCTA onOpen={openCfg} />
        <Gallery />
        <Contact />
      </main>
      <Footer />
      <WhatsAppFab />
      <CakeDataProvider>
        <CakeConfigurator open={cfg.open} initial={cfg.initial} onClose={closeCfg} />
      </CakeDataProvider>
      <PaymentResult result={payResult} onClose={clearPayResult} />
    </>
  );
}
