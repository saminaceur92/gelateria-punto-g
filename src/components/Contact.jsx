import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Phone, Clock, Instagram } from 'lucide-react';
import { openingHours as fallbackHours } from '../data/hours';
import { fetchHours } from '../data/live';

const reveal = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-50px' },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
};

/**
 * Mappa con blocco preventivo dei cookie.
 * L'iframe parte con `suppressedsrc` invece di `src`: finché l'utente non
 * acconsente, il browser non contatta Google. iubenda riempie `src` quando il
 * consenso arriva; noi ce ne accorgiamo con un MutationObserver e togliamo il
 * segnaposto — così al posto del riquadro vuoto c'è una spiegazione e un tasto.
 */
function MappaConConsenso() {
  const iframeRef = useRef(null);
  const [attiva, setAttiva] = useState(false);

  useEffect(() => {
    // Osserviamo il CONTENITORE, non l'iframe: quando arriva il consenso
    // iubenda rimpiazza il nodo, quindi un observer sull'iframe originale
    // resterebbe attaccato a un elemento ormai staccato dal documento.
    const box = iframeRef.current?.parentElement;
    if (!box) return undefined;
    const controlla = () => {
      if (box.querySelector('iframe[src]')) {
        setAttiva(true);
        return true;
      }
      return false;
    };
    if (controlla()) return undefined;
    const obs = new MutationObserver(controlla);
    obs.observe(box, { attributes: true, childList: true, subtree: true, attributeFilter: ['src'] });
    return () => obs.disconnect();
  }, []);

  const chiediConsenso = () => {
    const api = window._iub?.cs?.api;
    if (api?.askConsent) api.askConsent();
    else api?.openPreferences?.();
  };

  return (
    <>
      <iframe
        ref={iframeRef}
        title="Mappa Gelateria Punto Gi! Carpi"
        suppressedsrc="https://www.google.com/maps?q=Via+Remesina+Interna+46,+Carpi+MO&output=embed"
        className="_iub_cs_activate"
        data-iub-purposes="3"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
      {!attiva && (
        <div className="map-consent">
          <MapPin size={26} />
          <p>
            La mappa è fornita da Google: per mostrartela ci serve il tuo
            consenso ai cookie.
          </p>
          <button type="button" className="btn btn-accent" onClick={chiediConsenso}>
            Attiva la mappa
          </button>
          <a href="https://goo.gl/maps/s96Pk7NbEPJhneC66" target="_blank" rel="noopener noreferrer">
            oppure aprila su Google Maps →
          </a>
        </div>
      )}
    </>
  );
}

export default function Contact() {
  const [hours, setHours] = useState(fallbackHours);

  // Aggiornamento live degli orari da Supabase (con fallback)
  useEffect(() => {
    let alive = true;
    fetchHours().then((data) => {
      if (alive && data?.length) setHours(data);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section id="contatti" className="section contact">
      <div className="container">
        <motion.div {...reveal} style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
          <span className="eyebrow">Vieni a trovarci</span>
          <h2 style={{ marginTop: '1.2rem' }}>
            Un cucchiaio<br />e ci <em style={{ color: 'var(--orange)' }}>conosci</em>.
          </h2>
        </motion.div>

        <div className="contact-grid">
          <motion.div className="contact-info" {...reveal}>
            <div className="info-row">
              <span className="icon"><MapPin size={20} /></span>
              <div>
                <h4>Indirizzo</h4>
                <a
                  href="https://goo.gl/maps/s96Pk7NbEPJhneC66"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-ev="mappa_contatti"
                >
                  Via Remesina Interna 46<br />41012 Carpi (MO)
                </a>
              </div>
            </div>

            <div className="info-row">
              <span className="icon"><Phone size={20} /></span>
              <div>
                <h4>Whatsappaci</h4>
                <a href="https://api.whatsapp.com/send?phone=393203306009" target="_blank" rel="noopener noreferrer" data-ev="whatsapp_contatti">
                  320 330 6009
                </a>
              </div>
            </div>

            <div className="info-row">
              <span className="icon"><Instagram size={20} /></span>
              <div>
                <h4>Seguici</h4>
                <a href="https://www.instagram.com/gelateriapuntogicarpi/" target="_blank" rel="noopener noreferrer" data-ev="instagram_contatti">
                  @gelateriapuntogicarpi
                </a>
              </div>
            </div>

            <div className="info-row">
              <span className="icon"><Clock size={20} /></span>
              <div style={{ width: '100%' }}>
                <h4>Orari di apertura</h4>
                <div className="hours-grid">
                  {hours.map((o) => (
                    <div key={o.day}><span>{o.day}</span><span>{o.hours}</span></div>
                  ))}
                </div>
              </div>
            </div>

            <a
              href="https://api.whatsapp.com/send?phone=393203306009"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-accent"
              style={{ alignSelf: 'flex-start' }}
              data-ev="whatsapp_contatti"
            >
              Scrivici su WhatsApp
            </a>
          </motion.div>

          <motion.div className="contact-map" {...reveal} transition={{ ...reveal.transition, delay: 0.15 }}>
            <MappaConConsenso />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
