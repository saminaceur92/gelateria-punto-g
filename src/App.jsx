import { useState } from 'react';
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
import { CakeDataProvider } from './data/CakeDataProvider';

export default function App() {
  const [cfgOpen, setCfgOpen] = useState(false);
  const openCfg = () => setCfgOpen(true);
  const closeCfg = () => setCfgOpen(false);

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
        <CakeConfigurator open={cfgOpen} onClose={closeCfg} />
      </CakeDataProvider>
    </>
  );
}
