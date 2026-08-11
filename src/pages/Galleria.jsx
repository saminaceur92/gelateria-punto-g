import { useEffect, useState } from 'react';
import { ArrowLeft, Instagram, Camera } from 'lucide-react';
import galleryImages from '../data/galleryImages';
import { fetchGalleryCompleta } from '../lib/galleryFoto';
import Lightbox from '../components/Lightbox';

/**
 * Pagina pubblica /galleria: tutte le foto delle creazioni, ognuna apribile
 * ingrandita con lo zoom, più il riquadro che porta al profilo Instagram.
 *
 * Perché /galleria e non /gallery: la cartella delle immagini è public/gallery/,
 * quindi una rotta con lo stesso nome litigherebbe con i file (e le 50 foto
 * smetterebbero di caricarsi, anche in home).
 */
const IG_URL = 'https://www.instagram.com/gelateriapuntogicarpi/';

const statiche = (galleryImages || []).map((url) => ({ url }));

export default function Galleria() {
  const [foto, setFoto] = useState(statiche);
  const [aperta, setAperta] = useState(null);

  useEffect(() => {
    document.title = 'Le nostre creazioni · Gelateria Punto Gi';
    let vivo = true;
    fetchGalleryCompleta().then((lista) => {
      if (vivo && lista?.length) setFoto(lista);
    });
    return () => { vivo = false; };
  }, []);

  return (
    <div className="galleria-page">
      <header style={{ borderBottom: '1px solid rgba(50,40,31,0.1)', background: 'var(--cream)' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem var(--pad-x)' }}>
          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: 'var(--violet-deep)' }}>
            <ArrowLeft size={18} /> Torna al sito
          </a>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>Punto Gi</span>
        </div>
      </header>

      <main className="container" style={{ padding: '2.5rem var(--pad-x) 4rem' }}>
        <span className="eyebrow"><Camera size={16} style={{ marginRight: 6 }} /> Gallery</span>
        <h1 style={{ fontSize: 'clamp(2rem,5vw,3.2rem)', margin: '0.8rem 0 0.6rem' }}>Le nostre creazioni</h1>
        <p className="lead">
          Torte, semifreddi, vassoi di pasticcini e coppette: tutto quello che esce dal nostro laboratorio.
          Tocca una foto per vederla in grande e ingrandirla.
        </p>

        {/* Scheda profilo Instagram, in cima: e' li' che si va a cercare il
            profilo, non dopo cinquanta foto. La foto tonda e' il logo: quella
            vera del profilo Instagram non si puo' prendere da fuori (l'indirizzo
            cambia e Instagram lo blocca), va caricata come file. */}
        <section className="galleria-ig">
          <a className="galleria-ig-profilo" href={IG_URL} target="_blank" rel="noopener noreferrer">
            <span className="galleria-ig-foto">
              {/* Foto del profilo: basta salvare l'immagine come
                  public/instagram-profilo.jpg e compare qui, senza toccare il
                  codice. Finché non c'è, si vede il logo. */}
              <img
                src="/instagram-profilo.jpg"
                alt=""
                className="ig-avatar"
                onError={(e) => {
                  e.currentTarget.src = '/logo.png';
                  e.currentTarget.classList.add('e-logo');
                }}
              />
            </span>
            <span className="galleria-ig-testi">
              <strong>Gelateria Punto Gi</strong>
              <span className="galleria-ig-handle">@gelateriapuntogicarpi</span>
              <span className="galleria-ig-bio">Gelateria artigianale · Carpi (MO)</span>
            </span>
          </a>
          <p>
            Le novità, i gusti del mese e le torte appena uscite dal laboratorio le pubblichiamo lì,
            praticamente ogni giorno.
          </p>
          <a className="btn btn-primary" href={IG_URL} target="_blank" rel="noopener noreferrer">
            <Instagram size={18} /> Seguici su Instagram
          </a>
        </section>

        <div className="galleria-griglia">
          {foto.map((f, i) => (
            <button
              key={f.id || f.url || i}
              type="button"
              className="galleria-cella"
              onClick={() => setAperta(i)}
              aria-label={f.titolo ? `Ingrandisci: ${f.titolo}` : 'Ingrandisci la foto'}
            >
              <img
                src={f.url}
                alt={f.titolo || 'Creazione della Gelateria Punto Gi'}
                loading="lazy"
                decoding="async"
              />
            </button>
          ))}
        </div>

      </main>

      {aperta !== null && (
        <Lightbox foto={foto} indice={aperta} onCambia={setAperta} onChiudi={() => setAperta(null)} />
      )}
    </div>
  );
}
