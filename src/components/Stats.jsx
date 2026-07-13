import { useEffect, useRef, useState } from 'react';
import { motion, useInView, animate } from 'framer-motion';
import { IceCream2, Cake, CalendarDays, Sparkles } from 'lucide-react';

const reveal = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
};

// Contatore che si avvia quando entra a schermo. Rispetta "riduci animazioni".
function Counter({ to, duration = 2 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setN(to);
      return;
    }
    const controls = animate(0, to, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setN(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, to, duration]);

  // Separatore delle migliaia all'italiana, coerente (12.000, 2.000).
  const formatted = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return <span ref={ref}>{formatted}</span>;
}

const stats = [
  { icon: <IceCream2 size={22} />, prefix: '+', to: 12000, suffix: 'kg', label: 'di gelato prodotto ogni anno' },
  { icon: <Cake size={22} />, prefix: '+', to: 2000, label: 'torte create ogni anno' },
  { icon: <CalendarDays size={22} />, to: 365, label: 'giorni all’anno di gelato fresco' },
  { icon: <Sparkles size={22} />, text: 'Ogni giorno', label: 'torte sfornate fresche' },
];

export default function Stats() {
  return (
    <section id="numeri" className="section stats-band">
      <div className="container">
        <motion.div {...reveal} className="stats-head">
          <span className="eyebrow">I nostri numeri</span>
          <h2 style={{ marginTop: '1.2rem' }}>
            Piccolo laboratorio,<br />
            <em>grandi numeri.</em>
          </h2>
          <p className="lead" style={{ margin: '1.2rem auto 0' }}>
            Artigianale non vuol dire poco: ecco quanto lavoriamo — fresco, ogni giorno.
          </p>
        </motion.div>

        <div className="stats-grid">
          {stats.map((s, i) => (
            <motion.div
              key={i}
              className="stat-card"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: 0.1 * i, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="stat-icon">{s.icon}</span>
              <div className="stat-value">
                {s.text ? (
                  <span className="stat-word">{s.text}</span>
                ) : (
                  <>
                    {s.prefix && <span className="affix">{s.prefix}</span>}
                    <Counter to={s.to} />
                    {s.suffix && <span className="affix">{s.suffix}</span>}
                  </>
                )}
              </div>
              <p className="stat-label">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
