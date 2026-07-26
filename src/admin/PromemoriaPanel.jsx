import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth';
import {
  annullaPromemoria,
  inviaPromemoriaOra,
  listaPromemoria,
  promemoriaConfigurato,
  provaPromemoria,
  riattivaPromemoria,
} from '../lib/promemoria';

const STATI = {
  in_attesa: { label: 'in coda', color: '#8a5a00', bg: '#fff3d6' },
  inviato: { label: 'inviato', color: '#2f7d4f', bg: '#e3f5e9' },
  annullato: { label: 'annullato', color: '#777', bg: '#eee' },
  errore: { label: 'errore', color: '#b03a3a', bg: '#fdeaea' },
};

const TIPI = { primo: '30 giorni prima', secondo: '14 giorni prima' };

const data = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
};

const giorniA = (iso) => {
  try {
    const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
    return Math.round((new Date(`${iso}T00:00:00`) - oggi) / 86400000);
  } catch {
    return null;
  }
};

export default function PromemoriaPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [configurato, setConfigurato] = useState(true);

  const ricarica = useCallback(async () => {
    const { data: d, error } = await listaPromemoria();
    // Tabella non ancora creata: messaggio comprensibile.
    setErr(error && /does not exist|schema cache/i.test(error)
      ? 'Scheda non ancora attiva: esegui su Supabase la migrazione migrations/2026-07-26-promemoria-compleanno.sql.'
      : error || '');
    setRows(d);
    setLoaded(true);
    setConfigurato(await promemoriaConfigurato());
  }, []);

  useEffect(() => { ricarica(); }, [ricarica]);

  const { attesa, storico } = useMemo(() => ({
    attesa: rows.filter((r) => r.stato === 'in_attesa'),
    storico: rows.filter((r) => r.stato !== 'in_attesa')
      .sort((a, b) => (b.inviato_il || b.invio_previsto).localeCompare(a.inviato_il || a.invio_previsto)),
  }), [rows]);

  async function azione(fn, conferma) {
    if (conferma && !window.confirm(conferma)) return;
    setBusy(true); setErr(''); setMsg('');
    const { error, esito } = await fn();
    if (error) setErr(error);
    else {
      if (esito) setMsg(esito);
      await ricarica();
    }
    setBusy(false);
  }

  // Prova: manda una copia a un indirizzo a scelta, senza consumare il
  // promemoria vero (che resta in coda per l'anno prossimo).
  function prova(r) {
    const dest = window.prompt(
      'A quale indirizzo mando la copia di prova?\n(il promemoria del cliente resta in coda)',
      user?.email || '',
    );
    if (!dest) return;
    azione(() => provaPromemoria(r.id, dest.trim()));
  }

  const Riga = ({ r }) => {
    const s = STATI[r.stato] || STATI.annullato;
    const gg = r.stato === 'in_attesa' ? giorniA(r.invio_previsto) : null;
    return (
      <div className="prom-row">
        <div className="prom-when">
          <strong>{data(r.invio_previsto)}</strong>
          {gg !== null && (
            <span className="adm-muted">
              {gg < 0 ? 'in ritardo' : gg === 0 ? 'oggi' : gg === 1 ? 'domani' : `tra ${gg} giorni`}
            </span>
          )}
          {r.inviato_il && <span className="adm-muted">inviato il {new Date(r.inviato_il).toLocaleDateString('it-IT')}</span>}
        </div>

        <div className="prom-who">
          <strong>{r.nome || '—'}</strong>
          <span className="adm-muted">{r.email}</span>
        </div>

        <span className="prom-tipo">{TIPI[r.tipo] || r.tipo}</span>
        <span className="prom-badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
        {r.nota && <span className="prom-nota adm-muted">{r.nota}</span>}

        <div className="prom-actions">
          {r.stato === 'in_attesa' ? (
            <>
              <button
                type="button"
                className="adm-btn"
                disabled={busy || !configurato}
                title={configurato ? 'Manda una copia a te, per vedere com’è' : 'Mancano le chiavi EmailJS'}
                onClick={() => prova(r)}
              >
                Prova
              </button>
              <button
                type="button"
                className="adm-btn"
                disabled={busy || !configurato}
                title={configurato ? 'Manda adesso il promemoria al cliente' : 'Mancano le chiavi EmailJS'}
                onClick={() => azione(
                  () => inviaPromemoriaOra(r.id),
                  `Mandare adesso il promemoria a ${r.email}?\nNon verrà più inviato in automatico.`,
                )}
              >
                Invia ora
              </button>
              <button
                type="button"
                className="adm-btn adm-btn-del"
                disabled={busy}
                onClick={() => azione(() => annullaPromemoria(r.id), `Annullare il promemoria per ${r.email}?`)}
              >
                Annulla
              </button>
            </>
          ) : (
            <button
              type="button"
              className="adm-btn"
              disabled={busy}
              onClick={() => azione(() => riattivaPromemoria(r.id, r.invio_previsto))}
            >
              Rimetti in coda
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="adm-card">
      <header className="adm-card-head">
        <div>
          <h3>🎂 Promemoria compleanno</h3>
          <p>
            Chi ordina una torta per un <strong>compleanno</strong> lasciando l’email riceve l’anno
            dopo due promemoria (30 e 14 giorni prima) con la torta di allora e il link per rifarla.
            Partono da soli ogni mattina: qui li vedi, li puoi annullare o mandare in anticipo.
          </p>
        </div>
        <span className="adm-count">{attesa.length} in coda</span>
      </header>

      {err && <div className="adm-error">⚠️ {err}</div>}
      {msg && <div className="adm-info">{msg}</div>}
      {!err && !configurato && (
        <div className="adm-error">
          ⚠️ Invio non ancora attivo: mancano le chiavi EmailJS in <code>app_config</code>. I
          promemoria si accumulano in coda ma non parte nulla. Istruzioni in fondo alla migrazione
          <code> 2026-07-26-promemoria-compleanno.sql</code>.
        </div>
      )}
      {!loaded && <div className="adm-muted">Caricamento…</div>}

      {loaded && !err && (
        <>
          <h4 className="prom-title">In arrivo</h4>
          {attesa.length === 0 ? (
            <p className="adm-muted">
              Nessun promemoria in coda. Se ne crea uno ogni volta che arriva un ordine di
              compleanno con l’email del cliente.
            </p>
          ) : (
            <div className="prom-list">{attesa.map((r) => <Riga key={r.id} r={r} />)}</div>
          )}

          {storico.length > 0 && (
            <>
              <h4 className="prom-title">Storico</h4>
              <div className="prom-list">{storico.map((r) => <Riga key={r.id} r={r} />)}</div>
            </>
          )}
        </>
      )}
    </section>
  );
}
