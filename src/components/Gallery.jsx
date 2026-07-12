import galleryImages from '../data/galleryImages';

// Se il batch non ha ancora generato le foto, usa i placeholder esistenti.
const FALLBACK = ['/hero-cup.jpg', '/torte.jpg', '/semifreddi.jpg', '/pasticcini.jpg', '/gelato.jpg'];
const imgs = galleryImages && galleryImages.length ? galleryImages : FALLBACK;
// Duplico la lista per uno scorrimento a nastro senza stacchi.
const loop = [...imgs, ...imgs];

export default function Gallery() {
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

      <div className="gallery-scroll" aria-label="Le nostre creazioni">
        <div className="gallery-track">
          {loop.map((src, i) => (
            <figure className="gallery-shot" key={i} aria-hidden={i >= imgs.length ? 'true' : undefined}>
              <img src={src} alt="Creazione della Gelateria Punto Gi!" loading="lazy" />
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
