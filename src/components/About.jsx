import { motion } from 'framer-motion';
import { Heart, Snowflake, Wheat, Award } from 'lucide-react';

const reveal = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
};

const features = [
  { icon: <Heart size={18} />, title: 'Ricetta di famiglia', text: 'Sviluppata e affinata negli anni nel nostro laboratorio.' },
  { icon: <Snowflake size={18} />, title: 'Mantecato fresco', text: 'Produzione quotidiana, mai scorte di magazzino.' },
  { icon: <Wheat size={18} />, title: 'Per tutti', text: 'Versioni senza lattosio e senza glutine sempre disponibili.' },
  { icon: <Award size={18} />, title: 'Materie prime top', text: 'Pistacchio, nocciola e cioccolato selezionati con cura.' },
];

export default function About() {
  return (
    <section id="about" className="section about">
      <div className="container about-grid">
        <motion.div {...reveal} className="about-images">
          <div className="about-img-main">
            <img src="/gelato.jpg" alt="Gelato cremoso artigianale" />
          </div>
          <div className="about-img-sec">
            <img src="/torte.jpg" alt="Torte gelato decorate" />
          </div>
          <div className="about-badge">
            Fresco<br />ogni<br />giorno
          </div>
        </motion.div>

        <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.15 }}>
          <span className="eyebrow">La nostra storia</span>
          <h2 style={{ marginTop: '1.2rem' }}>
            Cremoso, denso,<br />
            <em>come quello di una volta.</em>
          </h2>
          <p className="lead" style={{ marginTop: '1.5rem' }}>
            A Carpi, in via Remesina Interna, c'è un piccolo laboratorio dove
            ogni mattina nasce qualcosa di speciale. Selezioniamo materie prime
            di qualità, lavoriamo con tempi lenti e ci mettiamo passione vera —
            quella che si sente al primo cucchiaio.
          </p>
          <p style={{ marginTop: '1rem' }}>
            <span className="script">Ti aspettiamo per farti emozionare!</span>
          </p>

          <div className="about-features">
            {features.map((f, i) => (
              <motion.div
                key={i}
                className="feature"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 * i }}
              >
                <div className="icon">{f.icon}</div>
                <div>
                  <h4>{f.title}</h4>
                  <p>{f.text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
