import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { flavorCategories } from '../data/flavors';

export default function Menu() {
  const [active, setActive] = useState(flavorCategories[0].id);
  const current = flavorCategories.find((c) => c.id === active);

  return (
    <section id="menu" className="section menu">
      <div className="container">
        <div className="menu-header">
          <span className="eyebrow">I nostri gusti</span>
          <h2 style={{ marginTop: '1.2rem' }}>
            La carta del <em style={{ color: 'var(--violet-deep)', fontStyle: 'italic' }}>gelato</em>
          </h2>
          <p className="lead" style={{ marginTop: '1rem' }}>
            Una selezione che cambia con le stagioni. Ogni mese aggiungiamo
            <strong style={{ color: 'var(--violet-deep)' }}> Limited Edition</strong> e gusti stagionali —
            chiedili al nostro staff!
          </p>
        </div>

        <div className="menu-tabs" role="tablist">
          {flavorCategories.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={active === c.id}
              className={`menu-tab ${active === c.id ? 'active' : ''}`}
              onClick={() => setActive(c.id)}
            >
              {c.name}
              <span className="count">{c.flavors.length}</span>
            </button>
          ))}
        </div>

        <p style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--grey)', fontSize: '0.95rem' }}>
          {current.description}
        </p>

        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            className="flavor-grid"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
          >
            {current.flavors.map((f, i) => (
              <motion.div
                key={f.name}
                className="flavor"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.025 }}
              >
                <span className="flavor-dot" style={{ background: f.color }} />
                <span className="flavor-name">
                  {f.name}
                  {f.tag && <span className="flavor-tag">{f.tag}</span>}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        <div className="menu-note">
          <span className="script">a prestissssimo!</span>
          Altri gusti stagionali o "Limited Edition" disponibili in vetrina.
        </div>
      </div>
    </section>
  );
}
