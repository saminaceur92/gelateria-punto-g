import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listaCollaborazioni, aggiornaCollaborazione, eliminaCollaborazione, MIGRAZIONE_MANCANTE,
} from '../lib/collabora';
import { etichettaTipo, linkEmail, linkTelefono, linkWhatsappTelefono } from '../lib/collaboraRegole';
import { logAction } from '../lib/log';

/**
 * Scheda "🤝 Collaborazioni": le proposte arrivate dal modulo della pagina
 * /collabora del sito. La vedono SOLO i titolari: la scheda compare solo a
 * loro e, soprattutto, il database non dà le righe a nessun altro (vedi
 * migrations/2026-10-09-collabora-con-noi.sql).
 *
 * Dalla scheda si cambiano solo lo stato e la nota interna: nome, email,
 * testo e data della spunta privacy restano quelli arrivati dal modulo.
 * "Elimina" cancella per sempre: serve anche quando qualcuno chiede di
 * cancellare i suoi dati.
 *
 * Il testo della proposta è mostrato come TESTO (mai come HTML, e i link non
 * sono cliccabili): lo scrive chiunque, anche chi vuole far cliccare qualcosa.
 */

const STATI = [
  { id: 'nuova', label: 'Nuova', color: '#8a5a00', bg: '#fff3d6' },
  { id: 'letta', label: 'Letta', color: '#2c7699', bg: 'rgba(44, 118, 153, 0.12)' },
  { id: 'in_corso', label: 'In corso', color: '#2f7d4f', bg: '#e3f5e9' },
  { id: 'chiusa', label: 'Chiusa', color: '#6b5d4f', bg: '#eee8de' },
  { id: 'spam', label: 'Spam', color: '#b03a3a', bg: '#fdeaea' },
];
const STATO = Object.fromEntries(STATI.map((s) => [s.id, s]));

const FILTRI = [
  { id: 'nuove', label: 'Da leggere', prova: (r) => r.stato === 'nuova', vuoto: 'Nessuna proposta da leggere.' },
  { id: 'seguire', label: 'Da seguire', prova: (r) => r.stato === 'letta' || r.stato === 'in_corso', vuoto: 'Nessuna proposta letta o in corso.' },
  { id: 'tutte', label: 'Tutte', prova: (r) => r.stato !== 'spam', vuoto: 'Ancora nessuna proposta.' },
  { id: 'spam', label: 'Spam', prova: (r) => r.stato === 'spam', vuoto: 'Niente spam. Quelle segnate come spam si cancellano da sole dopo 30 giorni.' },
];

const quando = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('it-IT', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '';
  }
};

const giorno = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
};

/** Una proposta. Esportata anche da sola: le prove la disegnano con dati finti. */
export function Proposta({ r, occupata, onStato, onNota, onElimina }) {
  const [nota, setNota] = useState(r.nota_staff || '');
  // Se la nota cambia da fuori (salvataggio, ricarica), la casella la segue.
  useEffect(() => {
    setNota(r.nota_staff || '');
  }, [r.nota_staff]);

  const s = STATO[r.stato] || STATO.nuova;
  const tel = linkTelefono(r.telefono);
  const wa = linkWhatsappTelefono(r.telefono);
  const notaCambiata = (nota.trim() || '') !== (r.nota_staff || '');

  return (
    <article className={`collab-card${r.stato === 'nuova' ? ' collab-nuova' : ''}`}>
      <header className="collab-top">
        <div className="collab-chi">
          <strong>{r.nome}</strong>
          {r.azienda && <span className="collab-azienda">{r.azienda}</span>}
          <span className="adm-muted">{etichettaTipo(r.tipo)} · {quando(r.created_at)}</span>
        </div>
        <div className="collab-badges">
          <span className="prom-badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
          {r.silenziata && (
            <span
              className="collab-silenziata"
              title="Il filtro anti-spam l’ha salvata senza mandare l’avviso su Telegram (tante proposte di fila, troppi link o un testo già arrivato). Leggila lo stesso: può essere vera."
            >
              senza avviso Telegram
            </span>
          )}
        </div>
      </header>

      <div className="collab-contatti">
        <a className="adm-btn" href={linkEmail(r.email, r.nome)}>✉️ Rispondi via email</a>
        {tel && <a className="adm-btn" href={tel}>📞 {r.telefono}</a>}
        {wa && <a className="adm-btn" href={wa} target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>}
        <span className="collab-email">{r.email}</span>
      </div>

      <p className="collab-msg">{r.messaggio}</p>

      <div className="collab-azioni">
        {r.stato === 'nuova' && (
          <button type="button" className="adm-btn adm-btn-primary" disabled={occupata} onClick={() => onStato(r, 'letta')}>
            ✓ Segna come letta
          </button>
        )}
        <label className="collab-stato">
          Stato
          <select value={r.stato} disabled={occupata} onChange={(e) => onStato(r, e.target.value)}>
            {STATI.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </label>
        <button type="button" className="adm-btn adm-btn-del collab-elimina" disabled={occupata} onClick={() => onElimina(r)}>
          Elimina
        </button>
      </div>

      <div className="collab-nota">
        <label htmlFor={`collab-nota-${r.id}`}>
          Nota interna <span>(la vedono solo i titolari)</span>
        </label>
        <textarea
          id={`collab-nota-${r.id}`}
          value={nota}
          maxLength={2000}
          placeholder="Es. richiamare lunedì, mandato il listino…"
          onChange={(e) => setNota(e.target.value)}
        />
        {notaCambiata && (
          <button type="button" className="adm-btn adm-btn-save" disabled={occupata} onClick={() => onNota(r, nota)}>
            Salva nota
          </button>
        )}
      </div>

      <p className="collab-privacy">
        Informativa privacy accettata il {giorno(r.privacy_il)}
        {r.aggiornata_il ? ` · ultima modifica ${quando(r.aggiornata_il)}` : ''}
      </p>
    </article>
  );
}

export default function CollaborazioniPanel({ onCambio }) {
  const [righe, setRighe] = useState([]);
  const [errLista, setErrLista] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [loaded, setLoaded] = useState(false);
  // Si parte da "Tutte" (le più recenti in cima, quelle da leggere evidenziate):
  // con "Da leggere" una proposta appena segnata come letta sparirebbe sotto
  // il dito, proprio mentre si vuole scriverci una nota.
  const [filtro, setFiltro] = useState('tutte');
  const [occupata, setOccupata] = useState(null); // id della proposta che sta salvando

  const ricarica = useCallback(async () => {
    setErr('');
    setMsg('');
    const { data, error } = await listaCollaborazioni();
    setErrLista(error);
    setRighe(data);
    setLoaded(true);
    if (onCambio) onCambio();
  }, [onCambio]);

  useEffect(() => {
    ricarica();
  }, [ricarica]);

  const conteggi = useMemo(
    () => Object.fromEntries(FILTRI.map((f) => [f.id, righe.filter(f.prova).length])),
    [righe],
  );
  const F = FILTRI.find((f) => f.id === filtro) || FILTRI[2];
  const visibili = useMemo(() => righe.filter(F.prova), [righe, F]);

  async function salva(r, modifiche, conferma) {
    setOccupata(r.id);
    setErr('');
    setMsg('');
    const { data, error } = await aggiornaCollaborazione(r.id, modifiche);
    setOccupata(null);
    if (error) {
      setErr(error);
      return;
    }
    setRighe((rs) => rs.map((x) => (x.id === r.id ? { ...x, ...data } : x)));
    if (conferma) setMsg(conferma);
    if (modifiche.stato !== undefined && onCambio) onCambio();
  }

  async function elimina(r) {
    const ok = window.confirm(
      `Eliminare per sempre la proposta di ${r.nome}?\n\n`
      + 'Serve anche quando qualcuno chiede di cancellare i suoi dati. Non si può annullare.',
    );
    if (!ok) return;
    setOccupata(r.id);
    setErr('');
    setMsg('');
    const { error } = await eliminaCollaborazione(r.id);
    setOccupata(null);
    if (error) {
      setErr(error);
      return;
    }
    setRighe((rs) => rs.filter((x) => x.id !== r.id));
    // Nello storico attività solo il fatto, mai il nome: lo storico lo legge
    // anche lo staff, che le proposte non le vede.
    logAction('Proposta di collaborazione eliminata');
    setMsg('Proposta eliminata.');
    if (onCambio) onCambio();
  }

  return (
    <section className="adm-card">
      <header className="adm-card-head">
        <div>
          <h3>🤝 Proposte di collaborazione</h3>
          <p>
            Arrivano dal modulo della pagina «Collabora con noi» del sito (
            <a href="/collabora" target="_blank" rel="noopener noreferrer">apri la pagina</a>
            ). Le vedono solo i titolari. Si cancellano da sole dopo 24 mesi, quelle segnate
            come spam dopo 30 giorni.
          </p>
        </div>
        <div className="adm-head-destra">
          {loaded && !errLista && <span className="adm-count">{conteggi.nuove} da leggere</span>}
          <button type="button" className="adm-btn" onClick={ricarica} disabled={!loaded}>↻ Aggiorna</button>
        </div>
      </header>

      {errLista && <div className="adm-error">⚠️ {errLista}</div>}
      {err && <div className="adm-error">⚠️ {err}</div>}
      {msg && <div className="adm-info">{msg}</div>}
      {!loaded && <div className="adm-muted">Caricamento…</div>}

      {loaded && !errLista && (
        <>
          <div className="ord-filters" role="group" aria-label="Quali proposte vedere">
            {FILTRI.map((f) => (
              <button
                key={f.id}
                type="button"
                className={filtro === f.id ? 'active' : ''}
                aria-pressed={filtro === f.id}
                onClick={() => setFiltro(f.id)}
              >
                {f.label} ({conteggi[f.id]})
              </button>
            ))}
          </div>

          {visibili.length === 0 ? (
            <p className="adm-muted collab-vuoto">{F.vuoto}</p>
          ) : (
            <div className="collab-lista">
              {visibili.map((r) => (
                <Proposta
                  key={r.id}
                  r={r}
                  occupata={occupata === r.id}
                  onStato={(x, stato) => salva(
                    x,
                    { stato },
                    // Lo spam esce da "Tutte": si dice dove è finito.
                    stato === 'spam' && filtro !== 'spam' ? 'Spostata nello spam: la trovi nel filtro «Spam».' : '',
                  )}
                  onNota={(x, nota) => salva(x, { nota_staff: nota }, 'Nota salvata.')}
                  onElimina={elimina}
                />
              ))}
            </div>
          )}

          <p className="adm-muted collab-legenda">
            «Senza avviso Telegram»: il filtro anti-spam l’ha salvata senza mandare l’avviso (tante
            proposte di fila, troppi link o un testo già arrivato da un altro indirizzo). Leggila lo
            stesso: può essere vera.
          </p>
        </>
      )}
      {errLista === MIGRAZIONE_MANCANTE && (
        <p className="adm-muted">
          Finché la migrazione non è lanciata, il modulo del sito risponde che non riesce a inviare e
          propone WhatsApp: nessuna proposta va persa in silenzio.
        </p>
      )}
    </section>
  );
}
