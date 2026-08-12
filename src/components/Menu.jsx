import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { flavorCategories as fallbackCategories } from '../data/flavors';
import { fetchMenu } from '../data/live';

// Pillola "Tutti i Gusti": raccoglie i gusti da coppetta di tutte le categorie.
// Restano fuori le basi (Base Bianca, Vegan, Frutta: non si ordinano da sole) e
// le "Altre Leccornie" (pasticcini, salame dolce, torte…), che gusti non sono.
const TUTTI = 'tutti';
const NON_GUSTI = ['base', 'leccornie'];

function conTutti(categorie) {
  const gusti = categorie.filter((c) => !NON_GUSTI.includes(c.id)).flatMap((c) => c.flavors);
  if (!gusti.length) return categorie;
  return [{ id: TUTTI, name: 'Tutti i Gusti', description: '', flavors: gusti }, ...categorie];
}

export default function Menu() {
  const [categories, setCategories] = useState(() => conTutti(fallbackCategories));
  const [active, setActive] = useState(TUTTI);

  // Aggiornamento live da Supabase (con fallback ai dati statici)
  useEffect(() => {
    let alive = true;
    fetchMenu().then((data) => {
      if (!alive || !data?.length) return;
      const conTutte = conTutti(data);
      setCategories(conTutte);
      // Gli id delle categorie live ('crema', 'golosone'…) non coincidono con
      // quelli del fallback: se la categoria selezionata non c'è più, torniamo
      // a "Tutti i Gusti", altrimenti nessuna pillola resterebbe evidenziata.
      setActive((cur) => (conTutte.some((c) => c.id === cur) ? cur : TUTTI));
    });
    return () => {
      alive = false;
    };
  }, []);

  const current = categories.find((c) => c.id === active) || categories[0];

  return (
    <section id="menu" className="section menu">
      <div className="container">
        <div className="menu-header">
          <span className="eyebrow">I nostri gusti</span>
          <h2 style={{ marginTop: '1.2rem' }}>
            Gusti nuovi <em style={{ color: 'var(--violet-deep)' }}>ogni mese!</em>
          </h2>
          <p className="lead" style={{ marginTop: '1rem' }}>
            Una selezione che cambia con le stagioni:
            <strong style={{ color: 'var(--violet-deep)' }}> Limited Edition</strong> e gusti stagionali sempre
            nuovi — chiedili al nostro staff!
          </p>
        </div>

        <div className="menu-tabs" role="tablist">
          {categories.map((c) => (
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

        {/* La descrizione di categoria può non esserci (i dati live non la usano):
            in quel caso non lasciamo il paragrafo vuoto a occupare spazio. */}
        {current.description?.trim() && (
          <p style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--grey)', fontSize: '0.95rem' }}>
            {current.description}
          </p>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            className="flavor-grid"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
          >
            {current.flavors.map((f, i) => {
              // La descrizione la scrivono i titolari dalla dashboard e per molti
              // gusti manca: se è vuota non stampiamo nulla, così la scheda resta
              // compatta come prima (niente righe o spazi a vuoto).
              const desc = (f.desc || '').trim();
              return (
                <motion.div
                  key={`${f.name}-${i}`}
                  className={`flavor${desc ? ' has-desc' : ''}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.025 }}
                >
                  <span className="flavor-dot" style={{ background: f.color }} />
                  <span className="flavor-text">
                    <span className="flavor-name">
                      {f.name}
                      {f.tag && <span className="flavor-tag">{f.tag}</span>}
                      {f.diet?.map((d) => (
                        <span key={d.short} className="flavor-diet" title={d.label}>{d.short}</span>
                      ))}
                    </span>
                    {desc && <span className="flavor-desc">{desc}</span>}
                  </span>
                </motion.div>
              );
            })}
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
