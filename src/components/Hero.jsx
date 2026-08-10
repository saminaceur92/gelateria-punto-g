import { motion } from 'framer-motion';
import { Sparkles, Cake } from 'lucide-react';

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] },
});

export default function Hero({ onOpenConfigurator }) {
  return (
    <section id="top" className="hero">
      <div className="container hero-grid">
        <div>
          <motion.span className="eyebrow" {...fade(0.1)}>
            Gelateria Artigianale · Carpi (MO)
          </motion.span>

          <motion.h1 {...fade(0.2)} style={{ marginTop: '1.5rem' }}>
            Il gelato<br />
            che <span className="accent">ti</span><br />
            <span className="accent">emoziona<span className="dot">.</span></span>
          </motion.h1>

          <motion.p className="lead" {...fade(0.4)} style={{ marginTop: '1.8rem' }}>
            Una ricetta unica, creata e perfezionata da noi negli anni.
            Cremoso, corposo, denso come quello <em>"di una volta"</em>.
            Delicatamente fresco al palato e leggero da digerire — anche{' '}
            <strong style={{ color: 'var(--violet-deep)' }}>senza lattosio</strong> e{' '}
            <strong style={{ color: 'var(--violet-deep)' }}>Vegan</strong>.
          </motion.p>

          <motion.div className="hero-meta" {...fade(0.55)}>
            <a className="btn btn-primary" href="#menu">
              Scopri i gusti <Sparkles size={18} />
            </a>
            <button className="btn btn-ghost" onClick={onOpenConfigurator}>
              <Cake size={18} /> Crea la tua torta
            </button>
          </motion.div>

          <motion.div className="hero-stats" {...fade(0.75)}>
            <div className="stat">
              <strong>30+</strong>
              <span>Gusti artigianali</span>
            </div>
            <div className="stat">
              <strong>100%</strong>
              <span>Fresco ogni giorno</span>
            </div>
            <div className="stat">
              <strong>0</strong>
              <span>Lattosio nei Vegan</span>
            </div>
          </motion.div>
        </div>

        <motion.div
          className="hero-visual"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        >
          <div className="hero-blob" />
          <div className="hero-img">
            <img src="/hero-cup.jpg" alt="Coppetta di gelato Punto Gi" />
          </div>

          <motion.div
            className="hero-badge b1"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            ✻ Vegan friendly
          </motion.div>
          <motion.div
            className="hero-badge b2"
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          >
            ✻ Senza lattosio
          </motion.div>
          <motion.div
            className="hero-badge b3"
            animate={{ x: [0, -8, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          >
            ★ Artigianale
          </motion.div>
        </motion.div>
      </div>

      <motion.div
        className="scroll-cue"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
      >
        Scrolla
        <span className="line" />
      </motion.div>
    </section>
  );
}
