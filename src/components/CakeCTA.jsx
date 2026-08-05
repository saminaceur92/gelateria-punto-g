import { motion } from 'framer-motion';
import { Cake, Sparkles, Clock } from 'lucide-react';
import CakePreview from './CakePreview';

const reveal = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
};

// Demo config animata in autoplay (vedi sotto).
// Le decorazioni sono una LISTA (se ne possono scegliere più d'una) e il colore
// si dice per ognuna che lo prevede: qui la granella sopra e i macarons rosa
// intorno, così si vede subito che si possono combinare.
const demoConfig = {
  type: 'crock',
  sizeId: '10',
  flavors: [
    { name: 'Pistacchio', color: '#7ea15a' },
    { name: 'Cioccolato fondente', color: '#2a160e' },
  ],
  decorations: ['granella-pistacchio', 'macarons'],
  decorationColors: { macarons: 'Rosa' },
  message: 'Buon Compleanno!',
  candle: true,
};

export default function CakeCTA({ onOpen }) {
  return (
    <section id="torte" className="cake-cta">
      <div className="container cake-cta-grid">
        <motion.div {...reveal}>
          <span className="eyebrow">Crea la tua torta</span>
          <h2 style={{ marginTop: '1.2rem' }}>
            La torta dei <em>tuoi</em> sogni,<br />
            in <em>4 minuti</em>.
          </h2>
          <p className="lead" style={{ marginTop: '1.4rem' }}>
            Configuratore guidato passo per passo: scegli tipo, gusti, base, decorazioni
            e scritta — noi la prepariamo a mano per te.
            Niente stress, solo dolcezza.
          </p>

          <div className="cake-cta-features">
            <span><Sparkles size={14} color="var(--violet-deep)" /> Tutto personalizzato</span>
            <span><Cake size={14} color="var(--violet-deep)" /> Passo per passo</span>
            <span><Clock size={14} color="var(--violet-deep)" /> Min. 5 ore</span>
          </div>

          <div className="cake-cta-diets">
            <span className="cake-cta-diets-label">Alternative:</span>
            <button type="button" className="diet-chip" onClick={() => onOpen({ allergies: ['glutine'] })}>
              ✻ Senza glutine
            </button>
            <button type="button" className="diet-chip" onClick={() => onOpen({ allergies: ['latte'] })}>
              ✻ Senza lattosio
            </button>
            <button type="button" className="diet-chip" onClick={() => onOpen({ allergies: ['latte', 'uova'] })}>
              ✻ Vegana
            </button>
          </div>

          <div className="cake-cta-actions">
            <button className="btn btn-primary" onClick={() => onOpen()}>
              <Cake size={18} /> Inizia ora
            </button>
            <a className="btn btn-ghost" href="#contatti">
              Preferisco scrivere
            </a>
          </div>
        </motion.div>

        <motion.div
          {...reveal}
          transition={{ ...reveal.transition, delay: 0.2 }}
          className="cake-cta-visual"
        >
          <CakePreview config={demoConfig} />
        </motion.div>
      </div>
    </section>
  );
}
