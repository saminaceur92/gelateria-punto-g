import { motion } from 'framer-motion';
import { Bike, Cake, Snowflake, Sparkles, ArrowRight } from 'lucide-react';

/**
 * Ogni servizio ora PORTA da qualche parte: la card è un bottone/link, non più
 * un cartello da leggere e basta.
 *   Consegna a domicilio  → /consegna (pagina dedicata, con Glovo e Deliveroo)
 *   Torte su prenotazione → apre il configuratore
 *   Pasticceria a freddo  → /galleria (le foto vere valgono più del testo)
 *   Senza lattosio & Vegan→ #menu, i gusti con i loro bollini
 */
const services = [
  {
    icon: <Bike size={26} />,
    title: 'Consegna a domicilio',
    text: 'Scegli la comodità: ordini su WhatsApp o sulle piattaforme partner e il gelato arriva da te.',
    href: '/consegna',
    ev: 'servizio_consegna',
  },
  {
    icon: <Cake size={26} />,
    title: 'Torte su prenotazione',
    text: 'Compleanno, anniversario o pranzo dei parenti: prenota la torta perfetta, anche CROCK.',
    configuratore: true,
    ev: 'torta_apre_servizi',
  },
  {
    icon: <Snowflake size={26} />,
    title: 'Pasticceria a freddo',
    text: 'Granite siciliane, pasticcini, semifreddi, ghiaccioli, salame dolce e tante altre leccornie.',
    href: '/galleria',
    ev: 'servizio_galleria',
  },
  {
    icon: <Sparkles size={26} />,
    title: 'Senza lattosio & Vegan',
    text: 'Intolleranze o scelte di gusto? Tante varianti senza lattosio, senza glutine e 100% vegan.',
    href: '#menu',
    ev: 'servizio_gusti',
  },
];

export default function Services({ onOpenConfigurator }) {
  return (
    <section id="servizi" className="section services">
      <div className="container">
        <div className="services-header">
          <div>
            <span className="eyebrow">I nostri servizi</span>
            <h2 style={{ marginTop: '1.2rem' }}>Tutto ciò che<br />puoi <em style={{ fontStyle: 'italic', color: 'var(--orange)' }}>desiderare</em>.</h2>
          </div>
          <p className="lead">
            Dal cono della passeggiata alla torta del giorno speciale,
            siamo qui per rendere ogni momento più dolce.
          </p>
        </div>

        <div className="services-grid">
          {services.map((s, i) => {
            const contenuto = (
              <>
                <div className="service-icon">{s.icon}</div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
                <span className="service-vai" aria-hidden="true">
                  <ArrowRight size={16} />
                </span>
              </>
            );
            return (
              <motion.div
                key={i}
                className="service-cell"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.7, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              >
                {s.configuratore ? (
                  <button
                    type="button"
                    className="service-card service-link"
                    data-ev={s.ev}
                    onClick={() => onOpenConfigurator && onOpenConfigurator()}
                  >
                    {contenuto}
                  </button>
                ) : (
                  <a className="service-card service-link" href={s.href} data-ev={s.ev}>
                    {contenuto}
                  </a>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
