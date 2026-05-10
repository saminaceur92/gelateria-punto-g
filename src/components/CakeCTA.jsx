import { motion } from 'framer-motion';
import { Cake, Sparkles, Clock } from 'lucide-react';
import CakePreview from './CakePreview';

const reveal = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
};

// Demo config animata in autoplay (vedi sotto)
const demoConfig = {
  type: 'crock',
  sizeId: '10',
  flavors: [
    { name: 'Pistacchio', color: '#7ea15a' },
    { name: 'Cioccolato fondente', color: '#2a160e' },
  ],
  decoration: 'frutta',
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
            e scritta — e <strong>vedi la tua torta prendere forma in tempo reale</strong>.
            Niente stress, solo dolcezza.
          </p>

          <div className="cake-cta-features">
            <span><Sparkles size={14} color="var(--violet-deep)" /> Anteprima live</span>
            <span><Cake size={14} color="var(--violet-deep)" /> 8 passaggi</span>
            <span><Clock size={14} color="var(--violet-deep)" /> Min. 24h preavviso</span>
            <span>✻ Senza glutine disponibile</span>
          </div>

          <div className="cake-cta-actions">
            <button className="btn btn-primary" onClick={onOpen}>
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
          {/* Preview demo cliccabile */}
          <button
            onClick={onOpen}
            aria-label="Apri il configuratore torte"
            style={{
              width: '100%',
              height: '100%',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <CakePreview config={demoConfig} />
          </button>
        </motion.div>
      </div>
    </section>
  );
}
