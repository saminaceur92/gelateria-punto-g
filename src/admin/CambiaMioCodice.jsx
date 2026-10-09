import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from './auth';
import { codiceCambia, codiceRicordato, ricordaCodice } from '../lib/codiciStaff';
import { MIN_CODICE, MIN_CODICE_ADMIN, problemaCodice, pulisci } from '../lib/codiciRegole';

/**
 * "Il mio codice": ognuno cambia il proprio codice, sapendo quello di adesso.
 * Prima per cambiarlo serviva uno script nel SQL Editor.
 *
 * Un codice da amministratore apre il gestionale con il ruolo 'owner': da lì
 * si sa se vale la regola delle 6 cifre. A decidere resta comunque il database.
 */
export default function CambiaMioCodice({ onChiudi }) {
  const { isOwner } = useAuth();
  const ruolo = isOwner ? 'admin' : 'staff';
  const minimo = isOwner ? MIN_CODICE_ADMIN : MIN_CODICE;
  const [attuale, setAttuale] = useState('');
  const [nuovo, setNuovo] = useState('');
  const [ripeti, setRipeti] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [fatto, setFatto] = useState(false);
  const primo = useRef(null);
  // Il cursore va sul primo campo solo all'apertura: la dashboard si ridisegna
  // spesso (ordini in arrivo) e riportarlo lì a ogni giro lo toglierebbe dal
  // campo in cui si sta scrivendo.
  const chiudi = useRef(onChiudi);
  chiudi.current = onChiudi;
  useEffect(() => {
    primo.current?.focus();
    const onKey = (e) => e.key === 'Escape' && chiudi.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function conferma(e) {
    e.preventDefault();
    setErr('');
    if (!pulisci(attuale)) { setErr('Scrivi il codice che usi adesso.'); return; }
    const problema = problemaCodice(nuovo, ruolo, ripeti);
    if (problema) { setErr(problema); return; }
    setBusy(true);
    const r = await codiceCambia(attuale, nuovo);
    setBusy(false);
    if (!r?.ok) { setErr(r?.motivo || 'Non riesco a cambiare il codice.'); return; }
    // La scheda Codici può ricordare il codice di prima: si aggiorna, così la
    // prossima azione non fallisce (e non conta come tentativo sbagliato).
    const vecchio = pulisci(attuale);
    const nuovoPulito = pulisci(nuovo);
    if (pulisci(codiceRicordato()) === vecchio) ricordaCodice(nuovoPulito);
    window.dispatchEvent(new CustomEvent('puntogi:codice-cambiato', { detail: { vecchio, nuovo: nuovoPulito } }));
    setFatto(true);
  }

  return (
    <div className="codice-overlay" onClick={onChiudi}>
      <form className="codice-box codice-box-lungo" onClick={(e) => e.stopPropagation()} onSubmit={conferma}>
        <button type="button" className="codice-chiudi" onClick={onChiudi} aria-label="Chiudi">
          <X size={18} />
        </button>
        <h3>Il mio codice</h3>
        {fatto ? (
          <>
            <p>Fatto: da ora entri e firmi con il codice nuovo.</p>
            <div className="codice-azioni">
              <button type="button" className="adm-btn adm-btn-primary" onClick={onChiudi}>Chiudi</button>
            </div>
          </>
        ) : (
          <>
            <p>
              Cambia il codice con cui entri e firmi le azioni. Il nuovo deve avere almeno {minimo} cifre.
            </p>
            <label className="codice-campo">
              <span>Codice di adesso</span>
              <input ref={primo} type="password" inputMode="numeric" autoComplete="off" value={attuale} onChange={(e) => setAttuale(e.target.value)} />
            </label>
            <label className="codice-campo">
              <span>Codice nuovo</span>
              <input type="password" inputMode="numeric" autoComplete="off" value={nuovo} onChange={(e) => setNuovo(e.target.value)} />
            </label>
            <label className="codice-campo">
              <span>Ripeti il codice nuovo</span>
              <input type="password" inputMode="numeric" autoComplete="off" value={ripeti} onChange={(e) => setRipeti(e.target.value)} />
            </label>
            {err && <p className="codice-err">⚠️ {err}</p>}
            <div className="codice-azioni">
              <button type="button" className="adm-btn" onClick={onChiudi}>Annulla</button>
              <button type="submit" className="adm-btn adm-btn-primary" disabled={busy || !attuale.trim() || !nuovo.trim() || !ripeti.trim()}>
                {busy ? 'Salvo…' : 'Cambia codice'}
              </button>
            </div>
            <p className="codice-nota">Gli amministratori possono vedere il tuo codice dalla scheda Codici.</p>
          </>
        )}
      </form>
    </div>
  );
}
