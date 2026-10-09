import { motion } from 'framer-motion';
import { Handshake, Store, PartyPopper, Building2, Camera } from 'lucide-react';

const reveal = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-50px' },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
};

const PER_CHI = [
  { Icona: Store, testo: 'Locali' },
  { Icona: PartyPopper, testo: 'Eventi' },
  { Icona: Building2, testo: 'Aziende' },
  { Icona: Camera, testo: 'Creator' },
];

/**
 * Riquadro «Collabora con noi» nella home, fra la gallery e i contatti.
 * È solo l'invito: il modulo sta nella pagina /collabora, così il suo codice
 * lo scarica solo chi ci va (e il link si può mandare a un ristorante o
 * mettere nella bio di Instagram). Un solo pulsante, con il suo data-ev:
 * le etichette "per chi" sono testo, non link.
 */
export default function CollaboraInvito() {
  return (
    <section id="collabora" className="collabora-invito" aria-labelledby="collabora-invito-titolo">
      <div className="container">
        <motion.div className="collabora-invito-box" {...reveal}>
          <div className="collabora-invito-testo">
            <span className="eyebrow">Collabora con noi</span>
            {/* Niente corsivo: Baloo 2 non ce l'ha, l'enfasi la fa il colore. */}
            <h2 id="collabora-invito-titolo">
              Un’idea golosa? <span className="collabora-accento">Facciamola insieme.</span>
            </h2>
            <p>
              Hai un locale, organizzi eventi, guidi un’azienda o racconti il cibo sui social?
              Raccontaci cosa hai in mente: ogni proposta la leggiamo noi.
            </p>
            <ul className="collabora-invito-chi" aria-label="Per chi è">
              {PER_CHI.map(({ Icona, testo }) => (
                <li key={testo}>
                  <Icona size={15} aria-hidden="true" /> {testo}
                </li>
              ))}
            </ul>
          </div>
          <a className="btn btn-primary collabora-invito-btn" href="/collabora" data-ev="collabora_home">
            <Handshake size={18} aria-hidden="true" /> Proponi una collaborazione
          </a>
        </motion.div>
      </div>
    </section>
  );
}
