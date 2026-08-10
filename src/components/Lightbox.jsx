import { useCallback, useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

/**
 * Visore foto a tutto schermo: si apre toccando una foto della gallery.
 *
 * Cosa fa: frecce avanti/indietro (anche da tastiera), scorrimento col dito
 * (swipe) su telefono, Esc o tocco fuori per chiudere, e ZOOM — un tocco sulla
 * foto la ingrandisce nel punto toccato, poi la si trascina per spostarla.
 *
 * Perché lo zoom è fatto a mano e non lasciato al pinch del browser: il visore
 * è a schermo intero e `position: fixed`, quindi il pinch ingrandirebbe tutta
 * la pagina sotto, non la foto.
 */
const ZOOM = 2.5;

export default function Lightbox({ foto, indice, onChiudi, onCambia }) {
  const [zoom, setZoom] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const trascino = useRef(null);
  const tocco = useRef(null);
  const corrente = foto[indice];

  const vai = useCallback(
    (d) => {
      setZoom(false);
      setPos({ x: 0, y: 0 });
      onCambia((indice + d + foto.length) % foto.length);
    },
    [indice, foto.length, onCambia]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onChiudi();
      if (e.key === 'ArrowRight') vai(1);
      if (e.key === 'ArrowLeft') vai(-1);
    };
    window.addEventListener('keydown', onKey);
    // Blocca lo scorrimento della pagina sotto mentre il visore è aperto.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onChiudi, vai]);

  if (!corrente) return null;

  // Un tocco sulla foto ingrandisce PROPRIO LÌ: si porta il punto toccato al
  // centro, altrimenti lo zoom sembra andare sempre sul centro della foto.
  const alternaZoom = (e) => {
    e.stopPropagation();
    if (zoom) {
      setZoom(false);
      setPos({ x: 0, y: 0 });
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    const dx = (r.left + r.width / 2 - e.clientX) * (ZOOM - 1);
    const dy = (r.top + r.height / 2 - e.clientY) * (ZOOM - 1);
    setZoom(true);
    setPos({ x: dx, y: dy });
  };

  const giu = (e) => {
    if (!zoom) return;
    trascino.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };
  const muovi = (e) => {
    if (!zoom || !trascino.current) return;
    setPos({ x: e.clientX - trascino.current.x, y: e.clientY - trascino.current.y });
  };
  const su = () => { trascino.current = null; };

  // Swipe: solo quando NON è zoomata, altrimenti il dito serve a spostare.
  const toccoInizio = (e) => { tocco.current = e.touches[0]?.clientX ?? null; };
  const toccoFine = (e) => {
    if (zoom || tocco.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - tocco.current;
    if (Math.abs(dx) > 50) vai(dx < 0 ? 1 : -1);
    tocco.current = null;
  };

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Foto ingrandita" onClick={onChiudi}>
      <button className="lightbox-chiudi" onClick={onChiudi} aria-label="Chiudi">
        <X size={22} />
      </button>

      {foto.length > 1 && (
        <button
          className="lightbox-freccia sx"
          onClick={(e) => { e.stopPropagation(); vai(-1); }}
          aria-label="Foto precedente"
        >
          <ChevronLeft size={26} />
        </button>
      )}

      <figure
        className="lightbox-figura"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={toccoInizio}
        onTouchEnd={toccoFine}
      >
        <img
          src={corrente.url}
          alt={corrente.titolo || 'Creazione della Gelateria Punto Gi'}
          className={zoom ? 'zoom' : ''}
          style={zoom ? { transform: `translate(${pos.x}px, ${pos.y}px) scale(${ZOOM})` } : undefined}
          onClick={alternaZoom}
          onPointerDown={giu}
          onPointerMove={muovi}
          onPointerUp={su}
          onPointerLeave={su}
          draggable={false}
        />
        <figcaption>
          <span className="lightbox-zoom-hint">
            {zoom ? <ZoomOut size={14} /> : <ZoomIn size={14} />}
            {zoom ? ' Tocca per rimpicciolire · trascina per spostare' : ' Tocca la foto per ingrandire'}
          </span>
          <span className="lightbox-conta">{indice + 1} / {foto.length}</span>
        </figcaption>
      </figure>

      {foto.length > 1 && (
        <button
          className="lightbox-freccia dx"
          onClick={(e) => { e.stopPropagation(); vai(1); }}
          aria-label="Foto successiva"
        >
          <ChevronRight size={26} />
        </button>
      )}
    </div>
  );
}
