import { useEffect } from 'react';
import { ArrowLeft, Bike, MessageCircle, MapPin, Clock, Gift } from 'lucide-react';

/**
 * Pagina pubblica /consegna: come farsi portare il gelato a casa.
 * Ci si arriva da "Ordina a domicilio" nell'header e dalla card dei servizi.
 *
 * Testo e ordine li hanno decisi i titolari: PRIMA WhatsApp — l'ordine diretto
 * con loro, con l'elenco di cosa si può ordinare e la consegna "a sorpresa" —
 * e POI, in alternativa, Deliveroo e Glovo. Link e numeri sono gli stessi
 * usati nel resto del sito.
 */
const GLOVO_URL = 'https://glovoapp.com/it/it/carpi/stores/gelateria-punto-gi-crp';
const DELIVEROO_URL = 'https://deliveroo.it/it/menu/Carpi/carpi/gelateria-punto-gi';
const WA_URL = 'https://api.whatsapp.com/send?phone=393203306009';

// L'elenco dei titolari, parola per parola.
const PRODOTTI = [
  { emoji: '🍨', nome: 'Gelato' },
  { emoji: '🍦', nome: 'Maritozzi, coni, cialde, coppette' },
  { emoji: '🧁', nome: 'Pasticcini' },
  { emoji: '🎂', nome: 'Torte gelato' },
  { emoji: '🍰', nome: 'Torte semifreddo' },
  { emoji: '🍫', nome: 'Salame Dolce' },
  { emoji: '🥤', nome: 'Bibite' },
];

export default function Consegna() {
  useEffect(() => {
    document.title = 'Consegna a domicilio · Gelateria Punto Gi';
  }, []);

  return (
    <div className="consegna-page">
      <header style={{ borderBottom: '1px solid rgba(50,40,31,0.1)', background: 'var(--cream)' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem var(--pad-x)' }}>
          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: 'var(--violet-deep)' }}>
            <ArrowLeft size={18} /> Torna al sito
          </a>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>Punto Gi</span>
        </div>
      </header>

      <main className="container" style={{ padding: '2.5rem var(--pad-x) 4rem' }}>
        <span className="eyebrow"><Bike size={16} style={{ marginRight: 6 }} /> Il gelato arriva da te</span>
        <h1 style={{ fontSize: 'clamp(2rem,5vw,3.2rem)', margin: '0.8rem 0 0.6rem' }}>
          Consegna a domicilio
        </h1>

        {/* ── WhatsApp: l'ordine diretto con la gelateria ── */}
        <section className="consegna-wa">
          <h2>Ordina su WhatsApp direttamente con noi:</h2>
          <ul className="consegna-prodotti">
            {PRODOTTI.map((p) => (
              <li key={p.nome}>
                <span aria-hidden="true">{p.emoji}</span> {p.nome}
              </li>
            ))}
          </ul>
          <p className="consegna-sorpresa">
            <Gift size={18} />
            <span>
              Qualsiasi prodotto può essere consegnato <strong>&ldquo;a sorpresa&rdquo;</strong> dove
              vuoi tu, se ordini su WhatsApp con noi!
            </span>
          </p>
          <a className="btn btn-primary" href={WA_URL} target="_blank" rel="noopener noreferrer" data-ev="whatsapp_consegna">
            <MessageCircle size={18} /> Ordina su WhatsApp
          </a>
        </section>

        {/* ── Le piattaforme, in alternativa ── */}
        <section className="consegna-alt">
          <h2>In alternativa, ordina a domicilio con Deliveroo e Glovo!</h2>
          <div className="consegna-alt-bottoni">
            <a className="btn btn-ghost" href={DELIVEROO_URL} target="_blank" rel="noopener noreferrer" data-ev="deliveroo_consegna">
              🛵 Ordina su Deliveroo
            </a>
            <a className="btn btn-ghost" href={GLOVO_URL} target="_blank" rel="noopener noreferrer" data-ev="glovo_consegna">
              🛵 Ordina su Glovo
            </a>
          </div>
        </section>

        <section className="consegna-note">
          <div className="consegna-nota">
            <MapPin size={18} />
            <p>
              Preferisci passare tu? Siamo in <strong>Via Remesina Interna 46, Carpi (MO)</strong> —
              il ritiro in gelateria è sempre gratuito.
            </p>
          </div>
          <div className="consegna-nota">
            <Clock size={18} />
            <p>
              <strong>Aperti 7 giorni su 7</strong>, orario continuato. Zone e orari di consegna
              delle piattaforme li vedi al momento dell&rsquo;ordine.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
