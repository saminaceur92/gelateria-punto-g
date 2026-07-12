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
                Punto Gi<span style={{ color: 'var(--orange)' }}>!</span>
                <small>Gelateria · Carpi</small>
              </span>
            </div>
            <p>Il gelato che ti emoziona. Artigianale, cremoso, fresco ogni giorno — anche senza lattosio e Vegan.</p>
            <div className="footer-socials">
              <a href="https://www.instagram.com/gelateriapuntogicarpi/" aria-label="Instagram" target="_blank" rel="noopener noreferrer"><Instagram size={18} /></a>
              <a href="https://www.facebook.com/gelateriapuntogicarpi" aria-label="Facebook" target="_blank" rel="noopener noreferrer"><Facebook size={18} /></a>
              <a href="https://api.whatsapp.com/send?phone=393203306009" aria-label="WhatsApp" target="_blank" rel="noopener noreferrer"><MessageCircle size={18} /></a>
            </div>
          </div>

          <div>
            <h5>Esplora</h5>
            <ul className="footer-links">
              <li><a href="#about">Storia</a></li>
              <li><a href="#servizi">Servizi</a></li>
              <li><a href="#menu">Gusti</a></li>
              <li><a href="#gallery">Gallery</a></li>
              <li><a href="#contatti">Contatti</a></li>
              <li><a href="/allergeni">Allergeni</a></li>
            </ul>
          </div>

          <div>
            <h5>Contatti</h5>
            <ul className="footer-links">
              <li><a href="https://goo.gl/maps/s96Pk7NbEPJhneC66" target="_blank" rel="noopener noreferrer">Via Remesina Interna 46<br />41012 Carpi (MO)</a></li>
              <li><a href="tel:+393203306009">320 330 6009</a></li>
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
          <span>© {year} Gelateria Punto Gi! · Tutti i diritti riservati</span>
          <span>Fatto con <span className="heart">♥</span> a Carpi</span>
        </div>
      </div>
    </footer>
  );
}
