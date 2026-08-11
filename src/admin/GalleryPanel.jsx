import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './auth';
import {
  MAX_MB,
  caricaFoto,
  daConfigurare,
  eliminaFoto,
  fetchGalleryFoto,
  salvaOrdineFoto,
  validaFoto,
} from '../lib/galleryFoto';

/**
 * Scheda "Foto della gallery": carica, ordina ed elimina tutte le foto che si
 * vedono sul sito (fascia scorrevole in home e pagina /galleria).
 */
const peso = (b) => (!b ? '' : b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

export default function GalleryPanel() {
  const { user } = useAuth();
  const [foto, setFoto] = useState([]);
  const [errLoad, setErrLoad] = useState('');
  const [caricato, setCaricato] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [drag, setDrag] = useState(false);
  const [dragFoto, setDragFoto] = useState('');
  const inputRef = useRef(null);

  const ricarica = useCallback(async () => {
    const { data, error } = await fetchGalleryFoto();
    setErrLoad(error || '');
    setFoto(data || []);
    setCaricato(true);
  }, []);

  useEffect(() => { ricarica(); }, [ricarica]);

  // Si possono trascinare più foto insieme: si caricano una dopo l'altra e si
  // riporta quante ne sono andate a buon fine (una foto rotta non blocca le altre).
  async function aggiungi(files) {
    const lista = [...(files || [])];
    if (!lista.length) return;
    setBusy(true);
    setErr('');
    setMsg('');
    let ok = 0;
    const problemi = [];
    for (const f of lista) {
      const bad = validaFoto(f);
      if (bad) { problemi.push(`${f.name}: ${bad}`); continue; }
      const { error } = await caricaFoto({ file: f, email: user?.email });
      if (error) problemi.push(`${f.name}: ${error}`);
      else ok += 1;
    }
    if (ok) setMsg(`${ok} foto pubblicate ✔ — sono già online sul sito.`);
    if (problemi.length) setErr(problemi.join(' · '));
    if (inputRef.current) inputRef.current.value = '';
    await ricarica();
    setBusy(false);
  }

  async function elimina(f) {
    if (!window.confirm('Eliminare questa foto dal sito? Non si può recuperare.')) return;
    setBusy(true);
    const { error } = await eliminaFoto(f);
    if (error) setErr(error);
    else setMsg('Foto eliminata.');
    await ricarica();
    setBusy(false);
  }

  async function salvaPosizioni(prossime) {
    if (busy || !prossime.length) return;
    const precedenti = foto;
    setFoto(prossime);
    setBusy(true);
    setErr('');
    setMsg('');
    const { error } = await salvaOrdineFoto(prossime);
    if (error) {
      setFoto(precedenti);
      setErr(error);
    } else {
      setMsg('Ordine delle foto salvato.');
    }
    setBusy(false);
  }

  function sposta(id, delta) {
    const da = foto.findIndex((f) => f.id === id);
    const a = da + delta;
    if (da < 0 || a < 0 || a >= foto.length) return;
    const prossime = [...foto];
    [prossime[da], prossime[a]] = [prossime[a], prossime[da]];
    salvaPosizioni(prossime);
  }

  function rilasciaSu(idDestinazione) {
    if (!dragFoto || dragFoto === idDestinazione) {
      setDragFoto('');
      return;
    }
    const prossime = [...foto];
    const da = prossime.findIndex((f) => f.id === dragFoto);
    const a = prossime.findIndex((f) => f.id === idDestinazione);
    if (da < 0 || a < 0) {
      setDragFoto('');
      return;
    }
    const [mossa] = prossime.splice(da, 1);
    prossime.splice(a, 0, mossa);
    setDragFoto('');
    salvaPosizioni(prossime);
  }

  const nonConfigurato = daConfigurare(errLoad);

  return (
    <div className="doc-wrap">
      <section className="adm-card">
        <header className="adm-card-head">
          <div>
            <h3>🖼️ Foto della gallery</h3>
            <p>
              Le foto che si vedono sul sito, nella fascia scorrevole della home e nella pagina
              “Le nostre creazioni”. Quelle che carichi qui vanno online <strong>subito</strong>, senza
              aspettare nessuno. JPG, PNG o WebP, massimo {MAX_MB} MB l'una: le rimpiccioliamo noi
              prima di caricarle, così il sito resta veloce anche con foto scattate col telefono.
              Puoi cambiare l'ordine trascinando le foto oppure usando le frecce.
            </p>
          </div>
        </header>

        {nonConfigurato && (
          <div className="adm-error">
            ⚠️ Spazio foto non ancora attivo su Supabase. Esegui una volta la migrazione
            <code> migrations/2026-08-10-batch-agosto.sql </code> dal SQL Editor: fino ad allora sul sito
            restano le foto già incluse e il caricamento non funziona.
          </div>
        )}
        {!nonConfigurato && errLoad && <div className="adm-error">⚠️ {errLoad}</div>}
        {err && <div className="adm-error">⚠️ {err}</div>}
        {msg && <div className="adm-info">{msg}</div>}
        {!caricato && <div className="adm-muted">Caricamento…</div>}

        <div
          className={`doc-drop ${drag ? 'over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); aggiungi(e.dataTransfer?.files); }}
        >
          <p className="doc-drop-title">Trascina qui le foto</p>
          <p className="adm-muted">oppure</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={busy}
            onChange={(e) => aggiungi(e.target.files)}
          />
          <p className="adm-muted doc-hint">
            {busy ? 'Caricamento in corso…' : 'Puoi sceglierne anche più di una insieme.'}
          </p>
        </div>

        {foto.length > 0 && (
          <>
            <h4 className="adm-sub">Foto online ({foto.length})</h4>
            <div className="gal-grid">
              {foto.map((f, i) => (
                <figure
                  key={f.id}
                  className={`gal-item ${dragFoto === f.id ? 'gal-item-drag' : ''}`}
                  draggable={!busy}
                  onDragStart={(e) => {
                    setDragFoto(f.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    rilasciaSu(f.id);
                  }}
                  onDragEnd={() => setDragFoto('')}
                >
                  <img src={f.url} alt={f.titolo || ''} loading="lazy" />
                  <figcaption>
                    <span className="gal-pos" title="Posizione nella gallery">{i + 1}</span>
                    <span className="adm-muted">{peso(f.dimensione)}</span>
                    <span className="gal-actions">
                      <button type="button" className="adm-btn gal-move" disabled={busy || i === 0} onClick={() => sposta(f.id, -1)} title="Sposta prima">
                        ←
                      </button>
                      <button type="button" className="adm-btn gal-move" disabled={busy || i === foto.length - 1} onClick={() => sposta(f.id, 1)} title="Sposta dopo">
                        →
                      </button>
                      <button type="button" className="adm-btn adm-btn-del" disabled={busy} onClick={() => elimina(f)} title="Elimina la foto">
                        🗑
                      </button>
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
