import { Instagram, Facebook, MessageCircle } from 'lucide-react';

// Riapre il pannello delle preferenze cookie di iubenda (se il banner è caricato).
function apriPreferenzeCookie(e) {
  e.preventDefault();
  window._iub?.cs?.api?.openPreferences?.();
}

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="brand">
              <span className="brand-mark">
                <img src="/logo.png" alt="" />
              </span>
              <span>
                Punto Gi
                <small>Gelateria · Carpi</small>
              </span>
            </div>
            <p>Il gelato che ti emoziona. Artigianale, cremoso, fresco ogni giorno — anche senza lattosio e Vegan.</p>
            <div className="footer-socials">
              <a href="https://www.instagram.com/gelateriapuntogicarpi/" aria-label="Instagram" target="_blank" rel="noopener noreferrer" data-ev="instagram_footer"><Instagram size={18} /></a>
              <a href="https://www.facebook.com/gelateriapuntogicarpi" aria-label="Facebook" target="_blank" rel="noopener noreferrer" data-ev="facebook_footer"><Facebook size={18} /></a>
              <a href="https://api.whatsapp.com/send?phone=393203306009" aria-label="WhatsApp" target="_blank" rel="noopener noreferrer" data-ev="whatsapp_footer"><MessageCircle size={18} /></a>
            </div>
          </div>

          <div>
            <h5>Esplora</h5>
            <ul className="footer-links">
              <li><a href="#about">Storia</a></li>
              <li><a href="#servizi">Servizi</a></li>
              <li><a href="#menu">Gusti</a></li>
              <li><a href="/galleria">Gallery</a></li>
              <li><a href="#contatti">Contatti</a></li>
              <li><a href="/consegna">Ordina a domicilio</a></li>
              <li><a href="/allergeni" data-ev="allergeni_footer">Allergeni</a></li>
            </ul>
          </div>

          <div>
            <h5>Contatti</h5>
            <ul className="footer-links">
              <li><a href="https://goo.gl/maps/s96Pk7NbEPJhneC66" target="_blank" rel="noopener noreferrer" data-ev="mappa_footer">Via Remesina Interna 46<br />41012 Carpi (MO)</a></li>
              {/* EV.TELEFONO non e' diviso per posizione (non esiste telefono_footer)
                  e questo e' l'unico tel: del sito nei file di mia competenza. */}
              <li><a href="tel:+393203306009" data-ev="telefono">320 330 6009</a></li>
            </ul>
          </div>

          <div>
            <h5>Servizi</h5>
            <ul className="footer-links">
              <li>Consegna a domicilio</li>
              <li>Torte su prenotazione</li>
              <li>Senza lattosio</li>
              <li>Vegan friendly</li>
            </ul>
          </div>

          <div>
            <h5>Note legali</h5>
            <ul className="footer-links">
              {/* Documenti iubenda: la classe iubenda-embed li apre nel riquadro
                  sovrapposto invece di mandare l'utente fuori dal sito. */}
              <li>
                <a href="https://www.iubenda.com/privacy-policy/38165264" className="iubenda-embed" title="Privacy Policy" target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="https://www.iubenda.com/privacy-policy/38165264/cookie-policy" className="iubenda-embed" title="Cookie Policy" target="_blank" rel="noopener noreferrer">
                  Cookie Policy
                </a>
              </li>
              <li>
                <a href="https://www.iubenda.com/termini-e-condizioni/38165264" className="iubenda-embed" title="Termini e Condizioni" target="_blank" rel="noopener noreferrer">
                  Termini e Condizioni
                </a>
              </li>
              <li>
                {/* Riapre il pannello dei consensi: obbligatorio poter cambiare idea */}
                <a href="#" onClick={apriPreferenzeCookie}>Preferenze cookie</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          {/* "Punto Gi" senza punto esclamativo: tolto apposta nel commit
              2303261, e quella decisione vale anche qui. */}
          <span>© {year} Gelateria Punto Gi · Tutti i diritti riservati</span>
          {/* Dati identificativi obbligatori per legge (art. 7 D.Lgs 70/2003) */}
          <span className="footer-legal">
            Gelateria Punto Gi S.r.l. · Via Remesina Interna 46, 41012 Carpi (MO) ·
            P.IVA 03578310363 · REA MO-399997
          </span>
          <span>Fatto con <span className="heart">♥</span> a Carpi</span>
        </div>
      </div>
    </footer>
  );
}
