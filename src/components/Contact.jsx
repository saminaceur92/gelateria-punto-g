import { useState, useEffect } from 'react';
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
            Un cucchiaio<br />e ci <em style={{ fontStyle: 'italic', color: 'var(--orange)' }}>conosci</em>.
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
                >
                  Via Remesina Interna 46<br />41012 Carpi (MO)
                </a>
              </div>
            </div>

            <div className="info-row">
              <span className="icon"><Phone size={20} /></span>
              <div>
                <h4>Whatsappaci</h4>
                <a href="https://api.whatsapp.com/send?phone=393203306009" target="_blank" rel="noopener noreferrer">
                  320 330 6009
                </a>
              </div>
            </div>

            <div className="info-row">
              <span className="icon"><Instagram size={20} /></span>
              <div>
                <h4>Seguici</h4>
                <a href="https://www.instagram.com/gelateriapuntogicarpi/" target="_blank" rel="noopener noreferrer">
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
            >
              Scrivici su WhatsApp
            </a>
          </motion.div>

          <motion.div className="contact-map" {...reveal} transition={{ ...reveal.transition, delay: 0.15 }}>
            <iframe
              title="Mappa Gelateria Punto Gi Carpi"
              src="https://www.google.com/maps?q=Via+Remesina+Interna+46,+Carpi+MO&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
