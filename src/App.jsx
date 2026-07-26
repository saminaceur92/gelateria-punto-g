import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Marquee from './components/Marquee';
import About from './components/About';
import Stats from './components/Stats';
import Services from './components/Services';
import Menu from './components/Menu';
import CakeCTA from './components/CakeCTA';
import Gallery from './components/Gallery';
import Contact from './components/Contact';
import Footer from './components/Footer';
import WhatsAppFab from './components/WhatsAppFab';
import CakeConfigurator from './components/CakeConfigurator';
import PaymentResult from './components/PaymentResult';
import PromemoriaStop from './components/PromemoriaStop';
import { CakeDataProvider } from './data/CakeDataProvider';
import { tortaDaToken } from './lib/promemoria';

export default function App() {
  const [cfg, setCfg] = useState({ open: false, initial: undefined });
  // openCfg può ricevere un filtro iniziale ({ allergies: [...] }) dai link "alternative".
  const openCfg = (initial) => setCfg({ open: true, initial: initial && initial.allergies ? initial : undefined });
  const closeCfg = () => setCfg((c) => ({ ...c, open: false }));

  // Promemoria compleanno: ?torta=<token> riapre il configuratore con la torta
  // dell'anno scorso già impostata, ?stop=<token> disiscrive dai promemoria.
  const [stopToken, setStopToken] = useState(
    () => new URLSearchParams(window.location.search).get('stop'),
  );
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('torta');
    if (!token) return;
    window.history.replaceState({}, '', window.location.pathname);
    tortaDaToken(token).then((res) => {
      if (res?.config) setCfg({ open: true, initial: { ...res.config, name: res.nome || '' } });
    });
  }, []);

  // Esito ritorno da Stripe Checkout (?pagamento=ok | annullato)
  const [payResult, setPayResult] = useState(
    () => new URLSearchParams(window.location.search).get('pagamento'),
  );
  // Consegna a domicilio? (salvato prima del redirect: cambia il testo di conferma)
  const [payDelivery] = useState(() => sessionStorage.getItem('pg_order_delivery') === '1');
  useEffect(() => {
    // L'ordine e la mail di conferma li gestisce il server (webhook Stripe +
    // trigger sul database): qui resta solo la schermata di esito.
    if (payResult === 'ok') sessionStorage.removeItem('pg_order_delivery');
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
        <Stats />
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
      <PaymentResult result={payResult} delivery={payDelivery} onClose={clearPayResult} />
      {stopToken && (
        <PromemoriaStop
          token={stopToken}
          onClose={() => {
            setStopToken(null);
            window.history.replaceState({}, '', window.location.pathname);
          }}
        />
      )}
    </>
  );
}
