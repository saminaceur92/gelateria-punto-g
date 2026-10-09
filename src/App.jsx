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
import CollaboraInvito from './components/CollaboraInvito';
import Contact from './components/Contact';
import Footer from './components/Footer';
import WhatsAppFab from './components/WhatsAppFab';
import CakeConfigurator from './components/CakeConfigurator';
import PaymentResult from './components/PaymentResult';
import PromemoriaStop from './components/PromemoriaStop';
import { CakeDataProvider } from './data/CakeDataProvider';
import { tortaDaToken } from './lib/promemoria';
import { leggiLinkPromemoria } from './lib/promemoriaRegole';
import { tracciaUnaVolta, EV } from './lib/analytics';

export default function App() {
  const [cfg, setCfg] = useState({ open: false, initial: undefined });
  // openCfg può ricevere un filtro iniziale ({ allergies: [...] }) dai link "alternative".
  const openCfg = (initial) => setCfg({ open: true, initial: initial && initial.allergies ? initial : undefined });
  const closeCfg = () => setCfg((c) => ({ ...c, open: false }));

  // Promemoria compleanno e anniversario: ?torta=<token> riapre il
  // configuratore con la torta dell'anno scorso già impostata; ?togli=<token>
  // toglie solo quella festa, ?stop=<token> tutti i promemoria (sempre dopo
  // un clic di conferma, vedi PromemoriaStop).
  const [linkProm, setLinkProm] = useState(() => leggiLinkPromemoria(window.location.search));
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('torta');
    if (!token) return;
    window.history.replaceState({}, '', window.location.pathname);
    tortaDaToken(token).then((res) => {
      if (res?.config) {
        setCfg({ open: true, initial: { ...res.config, name: res.nome || '' } });
        // È l'unico modo di sapere se le mail di compleanno riportano davvero
        // gente a ordinare: qui il configuratore si apre da solo, senza che
        // nessuno clicchi una CTA, quindi nessun data-ev può accorgersene.
        // Senza questa riga la voce resterebbe a zero per sempre in dashboard
        // e sembrerebbe che il promemoria non funzioni — e in più le chiusure
        // del configuratore supererebbero le aperture.
        tracciaUnaVolta(EV.TORTA_APRE_PROMEMORIA);
      }
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
        {/* Il configuratore è il cuore del sito: la sua sezione sta subito
            dopo la prima schermata, prima della storia (Lucia, 29-08). */}
        <CakeCTA onOpen={openCfg} />
        <About />
        <Stats />
        <Services onOpenConfigurator={openCfg} />
        <Menu />
        <Gallery />
        {/* Invito a collaborare: il modulo vero è nella pagina /collabora. */}
        <CollaboraInvito />
        <Contact />
      </main>
      <Footer />
      <WhatsAppFab />
      <CakeDataProvider>
        <CakeConfigurator open={cfg.open} initial={cfg.initial} onClose={closeCfg} />
      </CakeDataProvider>
      <PaymentResult result={payResult} delivery={payDelivery} onClose={clearPayResult} />
      {linkProm && (
        <PromemoriaStop
          link={linkProm}
          onClose={() => {
            setLinkProm(null);
            window.history.replaceState({}, '', window.location.pathname);
          }}
        />
      )}
    </>
  );
}
