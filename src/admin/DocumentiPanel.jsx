import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './auth';
import QrCode, { qrPngDataUrl, qrSvgString } from '../components/QrCode';
import QuadernoGenera from './QuadernoGenera';
import { stampaCartello } from './qrPrint';
import {
  DOC_ALLERGENI,
  MAX_MB,
  PDF_FALLBACK,
  caricaDocumento,
  eliminaVersione,
  getDocumento,
  listaVersioni,
  qrUrl as qrUrlOf,
  salvaQrUrl,
  validaPdf,
} from '../lib/documenti';

const dataOra = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('it-IT', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

const peso = (b) => (!b ? '' : b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

// La tabella/bucket non esistono ancora: va eseguita la migrazione SQL.
const daConfigurare = (msg) => !!msg && /(does not exist|schema cache|bucket not found)/i.test(msg);

function scarica(nomeFile, href, revoca = false) {
  const a = document.createElement('a');
  a.href = href;
  a.download = nomeFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revoca) setTimeout(() => URL.revokeObjectURL(href), 10000);
}

export default function DocumentiPanel() {
  const { user } = useAuth();
  const [doc, setDoc] = useState(null);
  const [errLoad, setErrLoad] = useState('');
  const [loaded, setLoaded] = useState(false);

  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const inputRef = useRef(null);

  const [versioni, setVersioni] = useState([]);
  const [mostraVersioni, setMostraVersioni] = useState(false);

  const [urlQr, setUrlQr] = useState('');
  const [urlSalvato, setUrlSalvato] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);

  const ricarica = useCallback(async () => {
    const { data, error } = await getDocumento(DOC_ALLERGENI);
    setErrLoad(error || '');
    setDoc(data);
    const u = qrUrlOf(data);
    setUrlQr(u);
    setUrlSalvato(u);
    setLoaded(true);
    const v = await listaVersioni(DOC_ALLERGENI);
    setVersioni(v.data);
  }, []);

  useEffect(() => {
    ricarica();
  }, [ricarica]);

  function scegli(f) {
    setErr('');
    setMsg('');
    const bad = validaPdf(f);
    if (bad) {
      setErr(bad);
      setFile(null);
      return;
    }
    setFile(f);
  }

  async function pubblica() {
    if (!file) return;
    setBusy(true);
    setErr('');
    setMsg('');
    const { error } = await caricaDocumento({
      chiave: DOC_ALLERGENI,
      file,
      titolo: 'Quaderno Ingredienti e Allergeni',
      email: user?.email,
    });
    if (error) setErr(error);
    else {
      setMsg('PDF pubblicato ✔ — è già online sulla pagina Allergeni, il QR resta lo stesso.');
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      await ricarica();
    }
    setBusy(false);
  }

  async function salvaUrl() {
    const u = urlQr.trim();
    if (!/^https?:\/\/.+/i.test(u)) {
      setErr('L\'indirizzo deve iniziare con https://');
      return;
    }
    setSavingUrl(true);
    setErr('');
    const { error } = await salvaQrUrl(DOC_ALLERGENI, u);
    if (error) setErr(error);
    else {
      setUrlSalvato(u);
      setMsg('Indirizzo del QR aggiornato ✔ — ricordati di ristampare i cartelli.');
      await ricarica();
    }
    setSavingUrl(false);
  }

  async function eliminaVecchia(v) {
    if (!window.confirm(`Eliminare definitivamente la versione "${v.nome}"?`)) return;
    setBusy(true);
    const { error } = await eliminaVersione(v.path);
    if (error) setErr(error);
    else await ricarica();
    setBusy(false);
  }

  const attuale = doc?.file_url || null;
  const qrTarget = urlSalvato || urlQr;
  const nonConfigurato = daConfigurare(errLoad);

  return (
    <div className="doc-wrap">
      {/* ─────────── Quaderno generato dai dati ─────────── */}
      {!nonConfigurato && <QuadernoGenera doc={doc} urlPagina={qrTarget} onPubblicato={ricarica} />}

      {/* ─────────── PDF caricato a mano ─────────── */}
      <section className="adm-card">
        <header className="adm-card-head">
          <div>
            <h3>📄 Carica un PDF tuo</h3>
            <p>
              Alternativa al pulsante qui sopra: se hai un quaderno impaginato a modo tuo, caricalo qui e va
              online <strong>subito</strong> sulla pagina pubblica e sul QR Code. Attenzione: un PDF caricato a
              mano non si aggiorna da solo quando cambi un allergene nel gestionale. Solo file PDF, massimo {MAX_MB} MB.
            </p>
          </div>
        </header>

        {nonConfigurato && (
          <div className="adm-error">
            ⚠️ Spazio documenti non ancora attivo su Supabase. Esegui una volta la migrazione
            <code> migrations/2026-07-26-documenti-e-qr.sql </code> dal SQL Editor: fino ad allora resta
            online il PDF incluso nel sito e il caricamento non funziona.
          </div>
        )}
        {!nonConfigurato && errLoad && <div className="adm-error">⚠️ {errLoad}</div>}
        {err && <div className="adm-error">⚠️ {err}</div>}
        {msg && <div className="adm-info">{msg}</div>}
        {!loaded && <div className="adm-muted">Caricamento…</div>}

        <div className="doc-current">
          <span className="doc-ico" aria-hidden="true">📕</span>
          <div className="doc-current-txt">
            <strong>{attuale ? doc.file_nome || 'Quaderno allergeni' : 'Quaderno allergeni (versione inclusa nel sito)'}</strong>
            <span className="adm-muted">
              {attuale
                ? `Pubblicato il ${dataOra(doc.aggiornato_il)}${doc.aggiornato_da ? ` da ${doc.aggiornato_da}` : ''}`
                : 'Nessun PDF caricato dalla dashboard: online c’è quello caricato dagli sviluppatori.'}
            </span>
          </div>
          <a className="adm-btn" href={attuale || PDF_FALLBACK} target="_blank" rel="noopener noreferrer">
            Apri PDF
          </a>
        </div>

        <div
          className={`doc-drop ${drag ? 'over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer?.files?.[0];
            if (f) scegli(f);
          }}
        >
          <p className="doc-drop-title">Trascina qui il PDF aggiornato</p>
          <p className="adm-muted">oppure</p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => scegli(e.target.files?.[0] || null)}
          />
          {file && (
            <p className="doc-chosen">
              Selezionato: <strong>{file.name}</strong> <span className="adm-muted">({peso(file.size)})</span>
            </p>
          )}
          <button type="button" className="adm-btn adm-btn-primary" onClick={pubblica} disabled={!file || busy}>
            {busy ? 'Caricamento…' : 'Pubblica questo PDF'}
          </button>
          <p className="adm-muted doc-hint">
            La versione precedente non viene cancellata: resta consultabile qui sotto.
          </p>
        </div>

        {versioni.length > 0 && (
          <div className="doc-versioni">
            <button type="button" className="adm-link" onClick={() => setMostraVersioni((v) => !v)}>
              {mostraVersioni ? 'Nascondi' : 'Mostra'} versioni caricate ({versioni.length})
            </button>
            {mostraVersioni && (
              <ul className="doc-vlist">
                {versioni.map((v) => {
                  const corrente = doc?.file_path === v.path;
                  return (
                    <li key={v.path}>
                      <a href={v.url} target="_blank" rel="noopener noreferrer">{v.nome}</a>
                      <span className="adm-muted">{peso(v.dimensione)}</span>
                      {corrente ? (
                        <span className="doc-badge">in uso</span>
                      ) : (
                        <button type="button" className="adm-btn adm-btn-del" onClick={() => eliminaVecchia(v)} disabled={busy} title="Elimina versione">🗑</button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* ─────────── QR ─────────── */}
      <section className="adm-card">
        <header className="adm-card-head">
          <div>
            <h3>📱 QR Code allergeni</h3>
            <p>
              Chi lo inquadra arriva sulla pagina pubblica degli allergeni, dove trova i gusti con i
              relativi allergeni e il PDF aggiornato qui sopra. Stampalo e mettilo in vetrina, sul
              bancone o sui tavolini.
            </p>
          </div>
        </header>

        <div className="doc-qr">
          <div className="doc-qr-box">
            <QrCode value={qrTarget} size={210} title="QR Code pagina allergeni" />
          </div>

          <div className="doc-qr-side">
            <label className="doc-field">
              <span className="adm-flabel">Indirizzo a cui porta il QR</span>
              <input
                type="url"
                value={urlQr}
                onChange={(e) => setUrlQr(e.target.value)}
                placeholder="https://…/allergeni"
                spellCheck="false"
              />
            </label>
            <div className="doc-actions">
              <button
                type="button"
                className="adm-btn adm-btn-save"
                onClick={salvaUrl}
                disabled={savingUrl || urlQr.trim() === urlSalvato}
              >
                {savingUrl ? 'Salvo…' : 'Salva indirizzo'}
              </button>
              <a className="adm-btn" href={qrTarget} target="_blank" rel="noopener noreferrer">Prova la pagina</a>
            </div>

            <p className="adm-muted doc-hint">
              ⚠️ Quando collegherai il dominio definitivo, cambia qui l’indirizzo e ristampa i QR già
              stampati: quelli vecchi punterebbero al vecchio indirizzo.
            </p>

            <div className="doc-actions">
              <button
                type="button"
                className="adm-btn"
                onClick={() => scarica('qr-allergeni-punto-gi.png', qrPngDataUrl(qrTarget, { size: 1600 }))}
              >
                ⬇ PNG (alta risoluzione)
              </button>
              <button
                type="button"
                className="adm-btn"
                onClick={() => {
                  const blob = new Blob([qrSvgString(qrTarget, { size: 1024 })], { type: 'image/svg+xml' });
                  scarica('qr-allergeni-punto-gi.svg', URL.createObjectURL(blob), true);
                }}
              >
                ⬇ SVG (per la tipografia)
              </button>
            </div>
            <div className="doc-actions">
              <button type="button" className="adm-btn adm-btn-primary" onClick={() => stampaCartello(qrTarget, 'cartello')}>
                🖨 Stampa cartello A4
              </button>
              <button type="button" className="adm-btn" onClick={() => stampaCartello(qrTarget, 'cartellini')}>
                🖨 4 cartellini da tavolo
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
