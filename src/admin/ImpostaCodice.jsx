import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { codiceReimposta } from '../lib/codiciStaff';
import { MIN_CODICE, pulisci } from '../lib/codiciRegole';

/**
 * L'amministratore dà un codice a una persona, senza cancellarla e ricrearla
 * (stessa persona, stesso storico, stesso accesso).
 *
 * Se scrive il codice che la persona usa GIÀ, per lei (la persona) non cambia niente: da
 * quel momento il suo codice si può anche mostrare. È il modo per rendere
 * visibili subito i codici creati prima che si potessero vedere.
 *
 * Props: persona { id, nome }, pin (codice dell'amministratore), onFatto(esito, persona), onAnnulla()
 */
export default function ImpostaCodice({ persona, pin, onFatto, onAnnulla }) {
  const [codice, setCodice] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  // Cursore sul campo solo all'apertura (vedi CambiaMioCodice).
  const annulla = useRef(onAnnulla);
  annulla.current = onAnnulla;
  useEffect(() => {
    input.current?.focus();
    const onKey = (e) => e.key === 'Escape' && annulla.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function conferma(e) {
    e.preventDefault();
    // Qui si controlla solo la lunghezza minima: la regola delle 6 cifre per
    // gli amministratori NON vale se si riscrive il codice che usano già, e a
    // saperlo è solo il database.
    if (pulisci(codice).length < MIN_CODICE) {
      setErr(`Il codice deve avere almeno ${MIN_CODICE} cifre.`);
      return;
    }
    setBusy(true);
    setErr('');
    const r = await codiceReimposta(pin, persona.id, codice);
    setBusy(false);
    if (!r?.ok) {
      setErr(r?.motivo || 'Non riesco a impostare il codice.');
      return;
    }
    onFatto(r.esito, persona);
  }

  return (
    <div className="codice-overlay" onClick={onAnnulla}>
      <form className="codice-box" onClick={(e) => e.stopPropagation()} onSubmit={conferma}>
        <button type="button" className="codice-chiudi" onClick={onAnnulla} aria-label="Annulla">
          <X size={18} />
        </button>
        <h3>Codice di {persona.nome}</h3>
        <p>
          Se scrivi il codice che usa già, per {persona.nome} non cambia niente e da ora lo puoi
          mostrare. Se ne scrivi uno nuovo, da ora entra con questo: diglielo a voce.
        </p>
        <input
          ref={input}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={codice}
          onChange={(e) => setCodice(e.target.value)}
          placeholder="Codice"
          aria-label={`Codice di ${persona.nome}`}
        />
        {err && <p className="codice-err">⚠️ {err}</p>}
        <div className="codice-azioni">
          <button type="button" className="adm-btn" onClick={onAnnulla}>Annulla</button>
          <button type="submit" className="adm-btn adm-btn-primary" disabled={busy || !codice.trim()}>
            {busy ? 'Salvo…' : 'Salva'}
          </button>
        </div>
      </form>
    </div>
  );
}
