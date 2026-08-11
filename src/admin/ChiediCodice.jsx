import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { registraAttivita } from '../lib/codiciStaff';

/**
 * Finestrella che chiede il codice personale prima di un'azione importante
 * (creare un ordine al banco, eliminarlo, segnarlo Pronto).
 *
 * Perché lo chiediamo anche a chi è già entrato: al banco il tablet resta
 * aperto tutto il giorno. Senza questo passaggio, tutto quello che succede
 * risulterebbe fatto dalla persona che l'ha acceso la mattina.
 *
 * Props:
 *  - azione:    testo che finisce nello storico ("Ordine eliminato")
 *  - dettaglio: contorno per lo storico (il nome del cliente)
 *  - descrizione: cosa sta per succedere, in parole semplici
 *  - onFatto(persona): chiamata SOLO se il codice è giusto
 *  - onAnnulla()
 */
export default function ChiediCodice({ azione, dettaglio, descrizione, onFatto, onAnnulla }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef(null);

  useEffect(() => {
    input.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onAnnulla();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onAnnulla]);

  async function conferma(e) {
    e?.preventDefault();
    const p = pin.trim();
    if (!p) return;
    setBusy(true);
    setErr('');
    // La verifica e la registrazione avvengono insieme, lato database.
    const r = await registraAttivita(p, azione, dettaglio);
    setBusy(false);
    if (!r?.ok) {
      setErr(r?.motivo || 'Codice non riconosciuto.');
      setPin('');
      input.current?.focus();
      return;
    }
    onFatto(r);
  }

  return (
    <div className="codice-overlay" onClick={onAnnulla}>
      <form className="codice-box" onClick={(e) => e.stopPropagation()} onSubmit={conferma}>
        <button type="button" className="codice-chiudi" onClick={onAnnulla} aria-label="Annulla">
          <X size={18} />
        </button>
        <h3>Il tuo codice</h3>
        <p>{descrizione}</p>
        <input
          ref={input}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="••••"
          aria-label="Codice personale"
        />
        {err && <p className="codice-err">⚠️ {err}</p>}
        <div className="codice-azioni">
          <button type="button" className="adm-btn" onClick={onAnnulla}>Annulla</button>
          <button type="submit" className="adm-btn adm-btn-primary" disabled={busy || !pin.trim()}>
            {busy ? 'Verifico…' : 'Conferma'}
          </button>
        </div>
      </form>
    </div>
  );
}
