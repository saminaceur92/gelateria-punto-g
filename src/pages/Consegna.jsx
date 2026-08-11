import { useEffect } from 'react';
import { ArrowLeft, Bike, MessageCircle, MapPin, Clock } from 'lucide-react';

/**
 * Pagina pubblica /consegna: come farsi portare il gelato a casa.
 * Ci si arriva dalla card "Consegna a domicilio" dei servizi in home.
 *
 * Tre strade, in ordine di praticità per la gelateria: le piattaforme
 * (Glovo e Deliveroo, con i loro fattorini) e WhatsApp per accordarsi
 * direttamente — stessi link e numeri usati nel resto del sito.
 */
const GLOVO_URL = 'https://glovoapp.com/it/it/carpi/stores/gelateria-punto-gi-crp';
const DELIVEROO_URL = 'https://deliveroo.it/it/menu/Carpi/carpi/gelateria-punto-gi';
const WA_URL = 'https://api.whatsapp.com/send?phone=393203306009';

const canali = [
  {
    nome: 'Glovo',
    emoji: '🛵',
    href: GLOVO_URL,
    testo: 'Ordina dall’app o dal sito Glovo: vaschette, torte in vetrina e specialità, consegnate in giornata.',
    bottone: 'Ordina su Glovo',
  },
  {
    nome: 'Deliveroo',
    emoji: '🛵',
    href: DELIVEROO_URL,
    testo: 'Il nostro menù è anche su Deliveroo, con le consegne coperte dai loro rider.',
    bottone: 'Ordina su Deliveroo',
  },
  {
    nome: 'WhatsApp',
    emoji: '💬',
    href: WA_URL,
    testo: 'Per richieste particolari — una torta, un vassoio di pasticcini, un orario preciso — scrivici: ci accordiamo direttamente.',
    bottone: 'Scrivici su WhatsApp',
  },
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
        <span className="eyebrow"><Bike size={16} style={{ marginRight: 6 }} /> Consegna a domicilio</span>
        <h1 style={{ fontSize: 'clamp(2rem,5vw,3.2rem)', margin: '0.8rem 0 0.6rem' }}>
          Il gelato arriva da te
        </h1>
        <p className="lead" style={{ maxWidth: '56ch' }}>
          Divano, festa in famiglia o cena con gli amici: il nostro gelato viaggia.
          Ordina dalle piattaforme partner, oppure scrivici su WhatsApp e ci accordiamo direttamente.
        </p>

        <div className="consegna-canali">
          {canali.map((c) => (
            <article key={c.nome} className="consegna-canale">
              <div className="consegna-canale-testa">
                <span className="consegna-canale-emoji" aria-hidden="true">{c.emoji}</span>
                <h2>{c.nome}</h2>
              </div>
              <p>{c.testo}</p>
              <a className="btn btn-primary" href={c.href} target="_blank" rel="noopener noreferrer">
                {c.nome === 'WhatsApp' && <MessageCircle size={18} />} {c.bottone}
              </a>
            </article>
          ))}
        </div>

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
              dipendono dalla piattaforma scelta: li vedi al momento dell&rsquo;ordine.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
