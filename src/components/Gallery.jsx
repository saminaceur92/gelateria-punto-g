import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import galleryImages from '../data/galleryImages';
import { fetchGalleryCompleta } from '../lib/galleryFoto';
import Lightbox from './Lightbox';

// Se il batch non ha ancora generato le foto, usa i placeholder esistenti.
const FALLBACK = ['/hero-cup.jpg', '/torte.jpg', '/semifreddi.jpg', '/pasticcini.jpg', '/gelato.jpg'];
const statiche = (galleryImages && galleryImages.length ? galleryImages : FALLBACK).map((url) => ({ url }));

// Quante foto scorrono nella fascia della home. Non tutte: il nastro è una
// striscia unica che il browser deve tenere disegnata e muovere, e con 50 foto
// (duplicate = 100) diventava larga 36.000 px — abbastanza da far scattare lo
// scorrimento della pagina. Se ne vedono 4 alla volta: 18 bastano e avanzano,
// e comunque c'è il pulsante che porta a /galleria con tutte quante.
const NEL_NASTRO = 18;

export default function Gallery() {
  const [imgs, setImgs] = useState(statiche);
  const [aperta, setAperta] = useState(null);
  const [inVista, setInVista] = useState(true);
  const nastro = useRef(null);

  // La tabella gestita dalla dashboard è l'elenco definitivo, anche se viene
  // svuotata. Se non esiste ancora, fetchGalleryCompleta usa le statiche.
  useEffect(() => {
    let vivo = true;
    fetchGalleryCompleta().then((lista) => {
      if (vivo) setImgs(lista || []);
    });
    return () => { vivo = false; };
  }, []);

  // Il nastro si ferma quando non è a schermo: altrimenti il browser continua a
  // spostare quella striscia anche mentre stai leggendo un'altra sezione.
  useEffect(() => {
    const el = nastro.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setInVista(e.isIntersecting), { rootMargin: '150px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Duplico la lista per uno scorrimento a nastro senza stacchi.
  const nelNastro = imgs.slice(0, NEL_NASTRO);
  const loop = [...nelNastro, ...nelNastro];

  return (
    <section id="gallery" className="section gallery">
      <div className="container">
        <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
          <span className="eyebrow">Gallery</span>
          <h2 style={{ marginTop: '1.2rem' }}>
            Cose che <em style={{ fontStyle: 'italic', color: 'var(--violet-deep)' }}>amerai</em>
          </h2>
          <p className="lead" style={{ marginTop: '1rem', marginInline: 'auto' }}>
            Ogni vassoio è una piccola opera. Lasciati ispirare e scegli la tua coccola.
          </p>
        </div>
      </div>

      <div className={`gallery-scroll ${inVista ? 'in-vista' : ''}`} ref={nastro} aria-label="Le nostre creazioni">
        <div className="gallery-track">
          {loop.map((f, i) => (
            <figure className="gallery-shot" key={i} aria-hidden={i >= nelNastro.length ? 'true' : undefined}>
              {/* Toccare la foto la apre ingrandita: prima il tocco non faceva
                  nulla (anzi, su telefono bloccava il nastro). */}
              {/* foto_aperta si conta qui e non dentro Lightbox: quel componente
                  lo usa anche il configuratore torte per la foto della copertura,
                  e quelle aperture non sono foto della gallery. */}
              <button
                type="button"
                className="gallery-shot-btn"
                data-ev="foto_aperta"
                onClick={() => setAperta(i % nelNastro.length)}
                aria-label="Ingrandisci la foto"
                tabIndex={i >= nelNastro.length ? -1 : 0}
              >
                <img src={f.url} alt={f.titolo || 'Creazione della Gelateria Punto Gi'} loading="lazy" />
              </button>
            </figure>
          ))}
        </div>
      </div>

      <div className="container" style={{ textAlign: 'center', marginTop: '2rem' }}>
        <a className="btn btn-ghost" href="/galleria" data-ev="galleria_vedi_tutte">
          Vedi tutte le foto <ArrowRight size={16} />
        </a>
      </div>

      {aperta !== null && (
        <Lightbox foto={imgs} indice={aperta} onCambia={setAperta} onChiudi={() => setAperta(null)} />
      )}
    </section>
  );
}
