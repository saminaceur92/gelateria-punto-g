import { useEffect } from 'react';
import { ArrowLeft, Handshake, Store, PartyPopper, Building2, Camera, Truck, MessageCircle, Send } from 'lucide-react';
import CollaboraForm from '../components/CollaboraForm';
import { WHATSAPP_URL } from '../lib/collaboraRegole';
// Gli stili del modulo arrivano solo con questa pagina: chi apre la home non
// li scarica. Il riquadro d'invito della home sta invece in global.css.
import '../styles/collabora.css';

/**
 * Pagina pubblica /collabora: l'invito a proporre una collaborazione e il
 * modulo che la manda ai titolari. È una pagina a sé apposta: è un link da
 * mandare a un ristorante o da mettere nella bio di Instagram, e il codice
 * del modulo si scarica solo qui. Ci si arriva dal riquadro in home
 * (#collabora), dal piè di pagina e dal menu del telefono.
 *
 * I testi dicono CHI può scriverci, non promettono servizi (forniture,
 * catering, regali aziendali…): quelli li decidono i titolari, caso per caso.
 * /collabora?tipo=eventi apre il modulo col tipo già scelto.
 */
const PER_CHI = [
  { Icona: Store, titolo: 'Ristoranti, bar e locali', testo: 'Hai un locale e un’idea da fare insieme?' },
  { Icona: PartyPopper, titolo: 'Eventi e feste', testo: 'Organizzi una festa, una serata o un evento in città?' },
  { Icona: Building2, titolo: 'Aziende', testo: 'Un’idea per i tuoi clienti o per chi lavora con te?' },
  { Icona: Camera, titolo: 'Creator e social', testo: 'Racconti il cibo e il territorio sui social?' },
  { Icona: Truck, titolo: 'Fornitori', testo: 'Materie prime, prodotti o servizi da proporci?' },
];

export default function Collabora() {
  useEffect(() => {
    document.title = 'Collabora con noi · Gelateria Punto Gi';
  }, []);

  return (
    <div className="collabora-page">
      {/* Stessa testata delle altre pagine (/consegna, /galleria). */}
      <header style={{ borderBottom: '1px solid rgba(50,40,31,0.1)', background: 'var(--cream)' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem var(--pad-x)' }}>
          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: 'var(--violet-deep)' }}>
            <ArrowLeft size={18} /> Torna al sito
          </a>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>Punto Gi</span>
        </div>
      </header>

      <main className="container collabora-main">
        <div className="collabora-griglia">
          <section className="collabora-intro" aria-labelledby="collabora-titolo">
            <span className="eyebrow"><Handshake size={16} aria-hidden="true" /> Collabora con noi</span>
            {/* Niente corsivo: Baloo 2 non ce l'ha (vedi global.css), l'enfasi la fa il colore. */}
            <h1 id="collabora-titolo">
              Facciamo qualcosa di buono, <span className="collabora-accento">insieme</span>.
            </h1>
            <p className="lead">
              Hai un locale, organizzi eventi, guidi un’azienda o racconti il cibo sui social? Se hai
              un’idea che profuma di gelato, raccontacela: ogni proposta la leggiamo noi, i titolari.
            </p>
            {/* Solo su telefono (vedi collabora.css): l'invito è lungo e il
                modulo sta sotto, a uno scorrimento e mezzo. Così ci si va subito. */}
            <a className="btn btn-primary collabora-vai" href="#collabora-modulo">
              <Send size={18} aria-hidden="true" /> Scrivi la tua proposta
            </a>

            <ul className="collabora-perchi">
              {PER_CHI.map(({ Icona, titolo, testo }) => (
                <li key={titolo}>
                  <span className="collabora-ico" aria-hidden="true"><Icona size={20} /></span>
                  <span>
                    <strong>{titolo}</strong>
                    <span className="collabora-perchi-testo">{testo}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="collabora-voce">
              <p>Preferisci WhatsApp? Scrivici pure lì: rispondiamo noi.</p>
              <a className="canale-chip canale-wa" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" data-ev="whatsapp_collabora">
                <MessageCircle size={16} aria-hidden="true" /> 320 330 6009
              </a>
            </div>
          </section>

          <section id="collabora-modulo" className="collabora-card" aria-label="Modulo per proporre una collaborazione">
            <CollaboraForm />
          </section>
        </div>

        {/* Le pagine non hanno il piè di pagina del sito: i dati obbligatori
            (art. 7 D.Lgs 70/2003) e l'informativa stanno qui. */}
        <footer className="collabora-legale">
          <span>
            Gelateria Punto Gi S.r.l. · Via Remesina Interna 46, 41012 Carpi (MO) · P.IVA 03578310363 · REA MO-399997
          </span>
          <span>
            <a href="https://www.iubenda.com/privacy-policy/38165264" className="iubenda-noiframe iubenda-embed" title="Privacy Policy">
              Privacy Policy
            </a>
            {' · '}
            <a href="https://www.iubenda.com/privacy-policy/38165264/cookie-policy" className="iubenda-noiframe iubenda-embed" title="Cookie Policy">
              Cookie Policy
            </a>
          </span>
        </footer>
      </main>
    </div>
  );
}
