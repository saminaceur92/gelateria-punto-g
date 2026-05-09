import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Marquee from './components/Marquee';
import About from './components/About';
import Services from './components/Services';
import Menu from './components/Menu';
import Gallery from './components/Gallery';
import Contact from './components/Contact';
import Footer from './components/Footer';
import WhatsAppFab from './components/WhatsAppFab';

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Marquee />
        <About />
        <Services />
        <Menu />
        <Gallery />
        <Contact />
      </main>
      <Footer />
      <WhatsAppFab />
    </>
  );
}
