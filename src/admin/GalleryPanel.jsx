import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './auth';
import {
  MAX_MB,
  caricaFoto,
  daConfigurare,
  eliminaFoto,
  fetchGalleryFoto,
  fotoStatiche,
  validaFoto,
} from '../lib/galleryFoto';

/**
 * Scheda "Foto della gallery": carica ed elimina le foto che si vedono sul sito
 * (fascia scorrevole in home e pagina /galleria).
 *
 * Le 50 foto storiche incluse nel sito restano sempre lì e non si possono
 * cancellare da qui: si vedono in fondo, come promemoria di cosa c'è già online.
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
  const [mostraStoriche, setMostraStoriche] = useState(false);
  const inputRef = useRef(null);
  const statiche = fotoStatiche();

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
            <h4 className="adm-sub">Foto caricate da voi ({foto.length})</h4>
            <div className="gal-grid">
              {foto.map((f) => (
                <figure key={f.id} className="gal-item">
                  <img src={f.url} alt={f.titolo || ''} loading="lazy" />
                  <figcaption>
                    <span className="adm-muted">{peso(f.dimensione)}</span>
                    <button type="button" className="adm-btn adm-btn-del" disabled={busy} onClick={() => elimina(f)} title="Elimina la foto">
                      🗑
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
          </>
        )}

        <div className="doc-versioni">
          <button type="button" className="adm-link" onClick={() => setMostraStoriche((v) => !v)}>
            {mostraStoriche ? 'Nascondi' : 'Mostra'} le foto già incluse nel sito ({statiche.length})
          </button>
          {mostraStoriche && (
            <>
              <p className="adm-muted doc-hint">
                Queste sono le foto messe dagli sviluppatori: restano sempre online e non si eliminano da qui.
              </p>
              <div className="gal-grid">
                {statiche.map((f) => (
                  <figure key={f.url} className="gal-item gal-item-fissa">
                    <img src={f.url} alt="" loading="lazy" />
                  </figure>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
