import { Instagram, Facebook, MessageCircle } from 'lucide-react';

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
        </div>

        <div className="footer-bottom">
          <span>© {year} Gelateria Punto Gi · Tutti i diritti riservati</span>
          <span>Fatto con <span className="heart">♥</span> a Carpi</span>
        </div>
      </div>
    </footer>
  );
}
