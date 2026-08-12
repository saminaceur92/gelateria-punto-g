import { useCallback, useEffect, useState } from 'react';
import {
  codiceCrea,
  codiceElimina,
  codiciElenco,
  codiceRicordato,
  dimenticaCodice,
  ricordaCodice,
  ultimeAttivita,
} from '../lib/codiciStaff';

/**
 * Scheda "Codici e attività": chi lavora in gelateria, con che codice, e cosa
 * ha fatto. La aprono solo gli AMMINISTRATORI, e il controllo non è qui: ogni
 * operazione passa da una funzione del database che richiede un codice da
 * amministratore. Nascondere il pulsante non basterebbe.
 */
const quando = (iso) => {
  if (!iso) return 'mai';
  try {
    return new Date(iso).toLocaleString('it-IT', {
      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch { return '—'; }
};

export default function CodiciPanel() {
  const [pin, setPin] = useState(codiceRicordato());
  const [sbloccato, setSbloccato] = useState(false);
  const [elenco, setElenco] = useState([]);
  const [attivita, setAttivita] = useState([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // nuovo codice
  const [nome, setNome] = useState('');
  const [ruolo, setRuolo] = useState('staff');
  const [nuovoPin, setNuovoPin] = useState('');

  const carica = useCallback(async (p) => {
    setBusy(true);
    const r = await codiciElenco(p);
    setBusy(false);
    if (!r?.ok) {
      setErr(r?.motivo || 'Codice non riconosciuto.');
      setSbloccato(false);
      return false;
    }
    setErr('');
    setElenco(r.elenco || []);
    setSbloccato(true);
    ricordaCodice(p);
    const a = await ultimeAttivita(100);
    setAttivita(a.data);
    return true;
  }, []);

  // Se il codice è già stato messo in questa scheda del browser, si entra dritti.
  useEffect(() => {
    const p = codiceRicordato();
    if (p) carica(p);
  }, [carica]);

  async function aggiungi(e) {
    e.preventDefault();
    setErr(''); setMsg('');
    const r = await codiceCrea(pin, nome, ruolo, nuovoPin);
    if (!r?.ok) { setErr(r?.motivo || 'Non riesco ad aggiungere.'); return; }
    setMsg(`${nome} può entrare col codice che hai scelto. Diglielo a voce: da qui in poi non è più leggibile da nessuna parte.`);
    setNome(''); setNuovoPin(''); setRuolo('staff');
    carica(pin);
  }

  async function elimina(p) {
    if (!window.confirm(`Togliere il codice di ${p.nome}? Non potrà più entrare.`)) return;
    setErr(''); setMsg('');
    const r = await codiceElimina(pin, p.id);
    if (!r?.ok) { setErr(r?.motivo || 'Non riesco a togliere.'); return; }
    setMsg(`${p.nome} non ha più accesso.`);
    carica(pin);
  }

  if (!sbloccato) {
    return (
      <section className="adm-card">
        <header className="adm-card-head">
          <div>
            <h3>🔑 Codici e attività</h3>
            <p>Questa scheda la aprono solo gli amministratori. Metti il tuo codice.</p>
          </div>
        </header>
        {err && <div className="adm-error">⚠️ {err}</div>}
        <form
          className="codice-riga"
          onSubmit={(e) => { e.preventDefault(); carica(pin); }}
        >
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Il tuo codice"
            autoComplete="off"
          />
          <button className="adm-btn adm-btn-primary" disabled={busy || !pin.trim()}>
            {busy ? 'Verifico…' : 'Entra'}
          </button>
        </form>
      </section>
    );
  }

  return (
    <div className="doc-wrap">
      <section className="adm-card">
        <header className="adm-card-head">
          <div>
            <h3>🔑 Chi lavora in gelateria</h3>
            <p>
              Ogni persona ha il suo codice: lo usa per entrare e per firmare le azioni importanti
              (prendere un ordine al banco, eliminarlo, segnarlo pronto). Gli <strong>amministratori</strong>
              {' '}possono anche aggiungere e togliere i codici degli altri.
            </p>
          </div>
          <button className="adm-btn" onClick={() => { dimenticaCodice(); setSbloccato(false); setPin(''); }}>
            Blocca la scheda
          </button>
        </header>

        {err && <div className="adm-error">⚠️ {err}</div>}
        {msg && <div className="adm-info">{msg}</div>}

        <ul className="codici-lista">
          {elenco.map((p) => (
            <li key={p.id}>
              <span className="codici-nome">
                {p.nome}
                {p.ruolo === 'admin' && <span className="codici-badge">amministratore</span>}
                {p.bloccato && <span className="codici-badge codici-badge-ko">bloccato</span>}
              </span>
              <span className="adm-muted">ultimo accesso: {quando(p.ultimo_uso)}</span>
              <button className="adm-btn adm-btn-del" onClick={() => elimina(p)} title="Togli il codice">🗑</button>
            </li>
          ))}
        </ul>

        <form className="codici-nuovo" onSubmit={aggiungi}>
          <h4 className="adm-sub">Aggiungi una persona</h4>
          <div className="codici-nuovo-riga">
            <label className="adm-field">
              <span className="adm-flabel">Nome</span>
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Es. Anna" />
            </label>
            <label className="adm-field">
              <span className="adm-flabel">Ruolo</span>
              <select value={ruolo} onChange={(e) => setRuolo(e.target.value)}>
                <option value="staff">Staff</option>
                <option value="admin">Amministratore</option>
              </select>
            </label>
            <label className="adm-field">
              <span className="adm-flabel">Codice (almeno 4 cifre)</span>
              <input
                type="text"
                inputMode="numeric"
                value={nuovoPin}
                onChange={(e) => setNuovoPin(e.target.value)}
                placeholder="Es. 4071"
                autoComplete="off"
              />
            </label>
            <button className="adm-btn adm-btn-primary" disabled={!nome.trim() || nuovoPin.trim().length < 4}>
              Aggiungi
            </button>
          </div>
          <p className="adm-muted doc-hint">
            Scegli un codice diverso per ogni persona e diglielo a voce: dopo non sarà più leggibile
            da nessuna parte, nemmeno da qui. Se qualcuno lo dimentica, gliene fai uno nuovo.
          </p>
        </form>
      </section>

      <section className="adm-card">
        <header className="adm-card-head">
          <div>
            <h3>🕘 Chi ha fatto cosa</h3>
            <p>Le ultime 100 azioni firmate col codice personale.</p>
          </div>
        </header>
        {attivita.length === 0 ? (
          <p className="adm-muted">Ancora niente: le azioni compariranno qui man mano.</p>
        ) : (
          <ul className="attivita-lista">
            {attivita.map((a) => (
              <li key={a.id}>
                <span className="attivita-quando">{quando(a.quando)}</span>
                <strong>{a.chi_nome || '—'}</strong>
                <span>{a.azione}</span>
                {a.dettaglio && <span className="adm-muted">· {a.dettaglio}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
