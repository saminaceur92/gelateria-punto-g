import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import {
  codiceCrea,
  codiceElimina,
  codiciElenco,
  codiciRivela,
  codiceRicordato,
  dimenticaCodice,
  ricordaCodice,
  ultimeAttivita,
} from '../lib/codiciStaff';
import {
  MASCHERA,
  MIN_CODICE,
  MIN_CODICE_ADMIN,
  VISIBILE_TUTTI_MS,
  VISIBILE_UNO_MS,
  problemaCodice,
  pulisci,
} from '../lib/codiciRegole';
import ChiediCodice from './ChiediCodice';
import ImpostaCodice from './ImpostaCodice';

/**
 * Scheda "Codici e attività": chi lavora in gelateria, con che codice, e cosa
 * ha fatto. La aprono solo gli AMMINISTRATORI, e il controllo non è qui: ogni
 * operazione passa da una funzione del database che richiede un codice da
 * amministratore. Nascondere il pulsante non basterebbe.
 *
 * Gli amministratori possono anche VEDERE i codici (migrazione
 * 2026-10-09-codici-visibili). Perché si possa fare senza rischi al banco,
 * dove il tablet resta acceso tutto il giorno:
 *  - "Mostra" chiede ogni volta il codice da amministratore, appena digitato;
 *  - i codici stanno solo nello stato della pagina, mai nel browser;
 *  - si richiudono da soli (30 s, 60 s per "tutti"), quando la scheda del
 *    browser va in secondo piano e quando si esce da questa scheda;
 *  - il database scrive nello storico chi ha guardato e quali.
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

  // Codici mostrati in questo momento: { [id]: '123456' | null }.
  const [mostrati, setMostrati] = useState({});
  // Richiesta del codice da amministratore per mostrare: { persona } o { tutti: true }.
  const [chiedi, setChiedi] = useState(null);
  const [imposta, setImposta] = useState(null);
  const timer = useRef(null);

  // nuovo codice
  const [nome, setNome] = useState('');
  const [ruolo, setRuolo] = useState('staff');
  const [nuovoPin, setNuovoPin] = useState('');

  const nascondi = useCallback(() => {
    clearTimeout(timer.current);
    setMostrati({});
  }, []);

  useEffect(() => {
    const onVisibilita = () => { if (document.hidden) nascondi(); };
    document.addEventListener('visibilitychange', onVisibilita);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilita);
      clearTimeout(timer.current);
    };
  }, [nascondi]);

  // "Il mio codice" (in alto) può cambiare proprio il codice ricordato qui.
  useEffect(() => {
    const onCambio = (e) => setPin((p) => (pulisci(p) === e.detail?.vecchio ? e.detail.nuovo : p));
    window.addEventListener('puntogi:codice-cambiato', onCambio);
    return () => window.removeEventListener('puntogi:codice-cambiato', onCambio);
  }, []);

  const caricaAttivita = useCallback(async () => {
    const a = await ultimeAttivita(100);
    setAttivita(a.data);
  }, []);

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
    await caricaAttivita();
    return true;
  }, [caricaAttivita]);

  // Se il codice è già stato messo in questa scheda del browser (da meno di
  // 10 minuti), si entra dritti.
  useEffect(() => {
    const p = codiceRicordato();
    if (p) carica(p);
  }, [carica]);

  function blocca() {
    dimenticaCodice();
    nascondi();
    setSbloccato(false);
    setPin('');
  }

  async function aggiungi(e) {
    e.preventDefault();
    setErr(''); setMsg('');
    const problema = problemaCodice(nuovoPin, ruolo);
    if (problema) { setErr(problema); return; }
    const r = await codiceCrea(pin, nome, ruolo, nuovoPin);
    if (!r?.ok) { setErr(r?.motivo || 'Non riesco ad aggiungere.'); return; }
    setMsg(`${nome} può entrare col codice che hai scelto. Diglielo a voce: gli amministratori lo possono rivedere da qui.`);
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

  function mostra(r, tutti) {
    const m = {};
    for (const c of r.codici || []) m[c.id] = c.codice ?? null;
    setMostrati(m);
    setChiedi(null);
    clearTimeout(timer.current);
    timer.current = setTimeout(nascondi, tutti ? VISIBILE_TUTTI_MS : VISIBILE_UNO_MS);
    // Lo storico ora dice chi ha guardato: si ricarica. Se una copia era
    // illeggibile il database l'ha tolta: si ricarica anche l'elenco.
    caricaAttivita();
    if ((r.codici || []).some((c) => c.codice == null)) carica(pin);
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

  // Prima della migrazione 2026-10-09 l'elenco non dice se un codice si può
  // mostrare: i comandi nuovi restano nascosti e la scheda funziona come prima.
  const conVisibili = elenco.some((p) => 'visibile' in p);
  const qualcunoVisibile = elenco.some((p) => p.visibile);
  const qualcunoInAttesa = conVisibili && elenco.some((p) => !p.visibile);
  const apertiOra = Object.values(mostrati).some(Boolean);
  const problemaNuovo = nuovoPin.trim() ? problemaCodice(nuovoPin, ruolo) : '';

  return (
    <div className="doc-wrap">
      <section className="adm-card">
        <header className="adm-card-head">
          <div>
            <h3>🔑 Chi lavora in gelateria</h3>
            <p>
              Ogni persona ha il suo codice: lo usa per entrare e per firmare le azioni importanti
              (prendere un ordine al banco, eliminarlo, segnarlo pronto). Gli <strong>amministratori</strong>
              {' '}possono aggiungere e togliere i codici degli altri, e vederli: ogni volta che qualcuno
              guarda un codice resta scritto qui sotto, in «Chi ha fatto cosa».
            </p>
          </div>
          <div className="codici-testata">
            {conVisibili && qualcunoVisibile && (
              apertiOra ? (
                <button type="button" className="adm-btn" onClick={nascondi}>
                  <EyeOff size={15} /> Nascondi i codici
                </button>
              ) : (
                <button type="button" className="adm-btn" onClick={() => setChiedi({ tutti: true })}>
                  <Eye size={15} /> Mostra tutti
                </button>
              )
            )}
            <button className="adm-btn" onClick={blocca}>Blocca la scheda</button>
          </div>
        </header>

        {err && <div className="adm-error">⚠️ {err}</div>}
        {msg && <div className="adm-info">{msg}</div>}

        <ul className="codici-lista">
          {elenco.map((p) => (
            <li key={p.id}>
              <span className="codici-nome">
                {p.nome}
                {p.ruolo === 'admin' && <span className="codici-badge">amministratore</span>}
                {p.sei_tu && <span className="codici-badge codici-badge-tu">tu</span>}
              </span>
              {conVisibili && (
                <span className="codici-codice-blocco">
                  {p.visibile ? (
                    <>
                      <code className={`codici-codice ${mostrati[p.id] ? 'aperto' : ''}`} aria-live="polite">
                        {mostrati[p.id] || MASCHERA}
                      </code>
                      <button
                        type="button"
                        className="adm-btn codici-occhio"
                        onClick={() => (mostrati[p.id] ? nascondi() : setChiedi({ persona: p }))}
                        aria-label={mostrati[p.id] ? `Nascondi il codice di ${p.nome}` : `Mostra il codice di ${p.nome}`}
                        title={mostrati[p.id] ? 'Nascondi' : 'Mostra il codice'}
                      >
                        {mostrati[p.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </>
                  ) : (
                    <span className="codici-badge-attesa">non ancora visibile</span>
                  )}
                </span>
              )}
              <span className="adm-muted">ultimo accesso: {quando(p.ultimo_uso)}</span>
              <span className="codici-azioni">
                {conVisibili && !p.sei_tu && (
                  <button type="button" className="adm-btn" onClick={() => setImposta(p)}>Imposta codice</button>
                )}
                {!p.sei_tu && (
                  <button className="adm-btn adm-btn-del" onClick={() => elimina(p)} title="Togli il codice" aria-label={`Togli il codice di ${p.nome}`}>🗑</button>
                )}
              </span>
            </li>
          ))}
        </ul>

        {qualcunoInAttesa && (
          <p className="codici-nota">
            <strong>Non ancora visibile</strong>: il codice c'è, ma è nato prima che si potessero
            mostrare. Compare da solo la prima volta che quella persona lo usa (entrando o firmando
            un ordine). Se ti serve subito, usa «Imposta codice» e scrivi il codice che usa già:
            per quella persona non cambia niente.
          </p>
        )}

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
              <span className="adm-flabel">
                Codice (almeno {ruolo === 'admin' ? MIN_CODICE_ADMIN : MIN_CODICE} cifre)
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={nuovoPin}
                onChange={(e) => setNuovoPin(e.target.value)}
                placeholder={ruolo === 'admin' ? 'Almeno 6 cifre' : 'Almeno 4 cifre'}
                autoComplete="off"
                aria-invalid={problemaNuovo ? 'true' : undefined}
              />
            </label>
            <button className="adm-btn adm-btn-primary" disabled={!nome.trim() || !nuovoPin.trim() || !!problemaNuovo}>
              Aggiungi
            </button>
          </div>
          {problemaNuovo && <p className="codice-err">{problemaNuovo}</p>}
          <p className="adm-muted doc-hint">
            Scegli un codice diverso per ogni persona e diglielo a voce. Gli amministratori lo
            possono rivedere da qui con «Mostra», e ogni volta resta scritto nello storico. Se
            qualcuno lo dimentica, usa «Imposta codice».
          </p>
        </form>
      </section>

      <section className="adm-card">
        <header className="adm-card-head">
          <div>
            <h3>🕘 Chi ha fatto cosa</h3>
            <p>Le ultime 100 azioni firmate col codice personale, compreso chi ha guardato i codici.</p>
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

      {chiedi && (
        <ChiediCodice
          titolo="Codice da amministratore"
          descrizione={
            chiedi.tutti
              ? 'Per vedere i codici di tutti metti il TUO codice da amministratore. Resterà scritto nello storico.'
              : `Per vedere il codice di ${chiedi.persona.nome} metti il TUO codice da amministratore. Resterà scritto nello storico.`
          }
          verifica={(p) => codiciRivela(p, chiedi.tutti ? null : chiedi.persona.id)}
          onFatto={(r) => mostra(r, !!chiedi.tutti)}
          onAnnulla={() => setChiedi(null)}
        />
      )}

      {imposta && (
        <ImpostaCodice
          persona={imposta}
          pin={pin}
          onAnnulla={() => setImposta(null)}
          onFatto={(esito, persona) => {
            setImposta(null);
            setErr('');
            setMsg(esito === 'uguale'
              ? `Era già il codice di ${persona.nome}: non cambia niente, e da ora lo puoi mostrare.`
              : `Da ora ${persona.nome} entra con il codice nuovo: diglielo a voce.`);
            carica(pin);
          }}
        />
      )}
    </div>
  );
}
