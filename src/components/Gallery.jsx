import { motion } from 'framer-motion';

const items = [
  { src: '/hero-cup.jpg', caption: 'Pistacchio & cremino', cls: 'g1' },
  { src: '/torte.jpg', caption: 'Torte gelato', cls: 'g2' },
  { src: '/semifreddi.jpg', caption: 'Semifreddi', cls: 'g3' },
  { src: '/pasticcini.jpg', caption: 'Pasticcini', cls: 'g4' },
  { src: '/gelato.jpg', caption: 'Gusti del giorno', cls: 'g5' },
  { src: '/hero-cup.jpg', caption: 'In coppetta o cono', cls: 'g6' },
];

export default function Gallery() {
  return (
    <section id="gallery" className="section gallery">
      <div className="container">
        <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
          <span className="eyebrow">Gallery</span>
          <h2 style={{ marginTop: '1.2rem' }}>
            Cose che <em style={{ fontStyle: 'italic', color: 'var(--violet-deep)' }}>amerai</em>
          </h2>
          <p className="lead" style={{ marginTop: '1rem', marginInline: 'auto' }}>
            Ogni vassoio è una piccola opera. Lasciati ispirare e scegli la tua coccola.
          </p>
        </div>

        <div className="gallery-grid">
          {items.map((it, i) => (
            <motion.div
              key={i}
              className={`gallery-item ${it.cls}`}
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.7, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
            >
              <img src={it.src} alt={it.caption} loading="lazy" />
              <span className="caption">{it.caption}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
