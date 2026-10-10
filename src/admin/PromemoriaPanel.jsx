import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth';
import {
  annullaPromemoria,
  disiscriviEmail,
  inviaPromemoriaOra,
  listaDisiscritti,
  listaPromemoria,
  promemoriaConfigurato,
  provaPromemoria,
  riattivaEmail,
  rimettiInCoda,
  statoPromemoria,
  STORICO_MAX,
  togliRicorrenza,
} from '../lib/promemoria';
import { puoRimettere, raggruppaPromemoria, testiPromemoria } from '../lib/promemoriaRegole';

/**
 * Scheda «Promemoria» del gestionale: una scheda per FESTA (un ordine di
 * compleanno o anniversario), con le sue due mail (30 e 14 giorni prima).
 * Lo staff può togliere una sola mail, tutta la festa, oppure disiscrivere o
 * riattivare un indirizzo. Le regole vere (niente doppioni, una mail al giorno,
 * niente mail già partite rimandate) le applica il database: qui si propone
 * solo quello che ha senso, e si mostra il motivo quando il database dice no.
 */

const STATI = {
  in_attesa: { label: 'in coda', color: '#8a5a00', bg: '#fff3d6' },
  inviato: { label: 'inviato', color: '#2f7d4f', bg: '#e3f5e9' },
  annullato: { label: 'non parte', color: '#6b6b6b', bg: '#eeeeee' },
  errore: { label: 'errore', color: '#b03a3a', bg: '#fdeaea' },
};

const TIPI = { primo: '30 giorni prima', secondo: '14 giorni prima' };

// Lo storico cresce di anno in anno: se ne mostrano i più recenti, il resto a richiesta.
const STORICO_VISIBILE = 12;

const data = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
};

const giorniA = (iso) => {
  try {
    const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
    return Math.round((new Date(`${String(iso).slice(0, 10)}T00:00:00`) - oggi) / 86400000);
  } catch {
    return null;
  }
};

const quandoTesto = (gg) => (gg < 0 ? 'in ritardo' : gg === 0 ? 'oggi' : gg === 1 ? 'domani' : `tra ${gg} giorni`);

// La risposta di EmailJS la legge il database ogni 10 minuti, a qualunque ora
// (prima di allora `esito` è vuoto): dopo un «Invia ora» lo si dice, così
// nessuno dà per arrivata una mail che EmailJS potrebbe ancora rifiutare.
const ESITO_IN_ARRIVO_MS = 5 * 60 * 60 * 1000; // oltre, il database scrive «non verificato»

// Cosa ha risposto EmailJS, in parole (colonna `esito`, dopo la migrazione).
function testoEsito(r) {
  const { esito } = r;
  // `null` (non `undefined`): la colonna c'è, cioè la migrazione è fatta.
  if (esito === null && r.inviato_il && Date.now() - Date.parse(r.inviato_il) < ESITO_IN_ARRIVO_MS) {
    return 'Risposta di EmailJS in arrivo: entro 10 minuti la vedi qui (ricarica la scheda).';
  }
  if (!esito) return null;
  if (esito.startsWith('ok')) return 'EmailJS l’ha presa in carico ✓';
  if (esito.startsWith('incerto')) {
    return `Esito incerto (${esito.replace(/^incerto:\s*/, '')}): non la rimando da solo, per non mandarla due volte.`;
  }
  if (esito === 'non verificato') return 'Esito non verificato: EmailJS non ha risposto in tempo.';
  return null; // gli errori veri sono già nella nota
}

/** Una delle due mail di una festa. */
function Mail({ r, busy, configurato, migrata, onProva, onAzione }) {
  const s = STATI[r.stato] || STATI.annullato;
  const gg = r.stato === 'in_attesa' ? giorniA(r.invio_previsto) : null;
  const esito = r.stato === 'inviato' ? testoEsito(r) : null;
  const inCoda = r.stato === 'in_attesa';
  return (
    <li className="prom-mail">
      <div className="prom-when">
        <strong>{TIPI[r.tipo] || r.tipo}</strong>
        <span className="adm-muted">
          {r.inviato_il
            ? `inviata il ${new Date(r.inviato_il).toLocaleDateString('it-IT')}`
            : `${data(r.invio_previsto)}${gg !== null ? ` · ${quandoTesto(gg)}` : ''}`}
        </span>
      </div>
      <span className="prom-badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
      {(r.nota || esito) && (
        <span className="prom-nota adm-muted">{[r.nota, esito].filter(Boolean).join(' · ')}</span>
      )}
      <div className="prom-actions">
        <button
          type="button"
          className="adm-btn"
          disabled={busy || !configurato}
          title={configurato ? 'Manda una copia a te, per vedere com’è (i link per togliere sono finti)' : 'Mancano le chiavi EmailJS'}
          onClick={() => onProva(r)}
        >
          Prova
        </button>
        {inCoda && (
          <>
            <button
              type="button"
              className="adm-btn"
              disabled={busy || !configurato}
              title={configurato ? 'Manda adesso questa mail al cliente' : 'Mancano le chiavi EmailJS'}
              onClick={() => onAzione(
                () => inviaPromemoriaOra(r.id),
                `Mandare adesso a ${r.email} la mail di ${TIPI[r.tipo] || r.tipo}?\nPoi non partirà più in automatico.`,
              )}
            >
              Invia ora
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-del"
              disabled={busy}
              title="Solo questa mail: l’altra mail della festa resta in coda"
              onClick={() => onAzione(
                () => annullaPromemoria(r.id),
                `Non mandare a ${r.email} la mail di ${TIPI[r.tipo] || r.tipo}?\nL’altra mail di questa festa, se c’è, resta in coda.`,
              )}
            >
              Non mandare questa
            </button>
          </>
        )}
        {puoRimettere(r) && (
          <button
            type="button"
            className="adm-btn"
            disabled={busy}
            title={migrata ? 'Torna in coda (il database controlla che non sia un doppione)' : 'Torna in coda'}
            onClick={() => onAzione(() => rimettiInCoda(r.id))}
          >
            Rimetti in coda
          </button>
        )}
      </div>
    </li>
  );
}

/** Una festa (un ordine) con le sue due mail. */
function Scheda({ s, busy, configurato, migrata, onProva, onAzione }) {
  const t = testiPromemoria(s.occasione);
  const togli = () => onAzione(
    () => togliRicorrenza(s.righe[0].id),
    `Togliere ${t.ricorrenza} del ${data(s.anniversario)} per ${s.email}?\n\n`
      + 'Non partirà più nessuna mail di questa festa'
      + (s.doppione ? ', nemmeno quelle dell’altro ordine per la stessa festa' : '')
      + '.\nGli altri promemoria di questo indirizzo restano attivi: non è una disiscrizione.',
  );
  return (
    <article className={`prom-scheda${s.attiva ? '' : ' prom-scheda-chiusa'}`}>
      <header className="prom-scheda-testa">
        <div className="prom-festa">
          <span className="prom-festa-titolo">
            <span aria-hidden="true">{t.emoji}</span> {s.occasione} · {data(s.anniversario)}
          </span>
          <span className="prom-chi">
            <strong>{s.nome || '—'}</strong>
            <span className="adm-muted">{s.email}</span>
          </span>
        </div>
        {s.doppione && (
          <span
            className="prom-doppione"
            title="C’è un altro ordine per la stessa festa (stessa email, date a 3 giorni o meno): il cliente riceve le mail una volta sola."
          >
            stessa festa di un altro ordine
          </span>
        )}
      </header>

      <ul className="prom-mails">
        {s.righe.map((r) => (
          <Mail key={r.id} r={r} busy={busy} configurato={configurato} migrata={migrata} onProva={onProva} onAzione={onAzione} />
        ))}
      </ul>

      {migrata && s.attiva && (
        <footer className="prom-scheda-piede">
          <button type="button" className="adm-btn adm-btn-del" disabled={busy} onClick={togli}>
            Togli questa ricorrenza
          </button>
        </footer>
      )}
    </article>
  );
}

export default function PromemoriaPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [disiscritti, setDisiscritti] = useState([]);
  const [errLista, setErrLista] = useState(''); // la coda non si legge
  const [err, setErr] = useState('');           // il database ha detto no a un'azione
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [configurato, setConfigurato] = useState(true);
  const [stato, setStato] = useState({ migrata: true, templatePronto: true });
  const [tuttoStorico, setTuttoStorico] = useState(false);
  const [storicoTagliato, setStoricoTagliato] = useState(false);
  const [nuovoStop, setNuovoStop] = useState('');

  const ricarica = useCallback(async () => {
    const [{ data: d, error, storicoTagliato: tagliato }, conf, st] = await Promise.all([
      listaPromemoria(), promemoriaConfigurato(), statoPromemoria(),
    ]);
    // Tabella non ancora creata: messaggio comprensibile.
    setErrLista(error && /does not exist|schema cache/i.test(error)
      ? 'Scheda non ancora attiva: esegui su Supabase la migrazione migrations/2026-07-26-promemoria-compleanno.sql.'
      : error || '');
    setRows(d);
    setStoricoTagliato(Boolean(tagliato));
    setConfigurato(conf);
    setStato(st);
    setDisiscritti(st.migrata ? (await listaDisiscritti()).data : []);
    setLoaded(true);
  }, []);

  useEffect(() => { ricarica(); }, [ricarica]);

  const schede = useMemo(() => raggruppaPromemoria(rows), [rows]);
  const attive = schede.filter((s) => s.attiva);
  const storico = schede.filter((s) => !s.attiva);
  const storicoVisto = tuttoStorico ? storico : storico.slice(0, STORICO_VISIBILE);

  // Ogni azione: conferma (se serve), poi chiamata, poi la scheda si ricarica
  // SEMPRE, anche se il database ha detto no (la riga può essere cambiata).
  async function azione(fn, conferma) {
    if (conferma && !window.confirm(conferma)) return false;
    setBusy(true); setErr(''); setMsg('');
    const { error, esito } = await fn();
    if (error) setErr(error);
    else if (esito) setMsg(esito);
    await ricarica();
    setBusy(false);
    return !error;
  }

  // Prova: una copia a un indirizzo a scelta, con i link per togliere finti:
  // il promemoria del cliente non cambia.
  function prova(r, occasione) {
    const dest = window.prompt(
      occasione === 'Anniversario'
        ? 'Versione ANNIVERSARIO: a quale indirizzo mando la copia di prova?\n(nessun promemoria del cliente cambia)'
        : 'A quale indirizzo mando la copia di prova?\n(il promemoria del cliente non cambia)',
      user?.email || '',
    );
    if (!dest) return;
    azione(() => provaPromemoria(r.id, dest.trim(), occasione));
  }

  async function disiscrivi(e) {
    e.preventDefault();
    const email = nuovoStop.trim();
    if (!email) return;
    const fatto = await azione(
      () => disiscriviEmail(email),
      `Disiscrivere ${email} da TUTTI i promemoria?\nNon riceverà più nessuna mail di compleanno o anniversario.`,
    );
    if (fatto) setNuovoStop('');
  }

  return (
    <section className="adm-card">
      <header className="adm-card-head">
        <div>
          <h3>🎂 Promemoria compleanni e anniversari</h3>
          <p>
            Chi ordina una torta per un <strong>compleanno</strong> o un <strong>anniversario</strong> lasciando
            l’email riceve l’anno dopo due promemoria (30 e 14 giorni prima) con la torta di allora e il link
            per rifarla. Partono da soli fra le 9 e le 12: al massimo una mail al giorno per indirizzo, e una
            volta sola anche se la stessa festa ha due ordini.
          </p>
        </div>
        <div className="prom-testa-destra">
          <span className="adm-count">{attive.length} {attive.length === 1 ? 'festa in arrivo' : 'feste in arrivo'}</span>
          {stato.migrata && rows.length > 0 && (
            <button
              type="button"
              className="adm-btn"
              disabled={busy || !configurato}
              title="Manda a te una copia con le parole dell’anniversario, partendo da un promemoria qualsiasi"
              onClick={() => prova(rows[0], 'Anniversario')}
            >
              🥂 Prova la mail di anniversario
            </button>
          )}
        </div>
      </header>

      {errLista && <div className="adm-error" role="alert">⚠️ {errLista}</div>}
      {err && <div className="adm-error" role="alert">⚠️ {err}</div>}
      {msg && <div className="adm-info" role="status">{msg}</div>}
      {!errLista && !configurato && (
        <div className="adm-error">
          ⚠️ Invio non ancora attivo: mancano le chiavi EmailJS in <code>app_config</code>. I
          promemoria si accumulano in coda ma non parte nulla. Istruzioni in fondo alla migrazione
          <code> 2026-07-26-promemoria-compleanno.sql</code>.
        </div>
      )}
      {loaded && !stato.migrata && (
        <div className="prom-avviso">
          Per i promemoria di <strong>anniversario</strong>, per <strong>togliere una sola festa</strong> e per i
          controlli contro i doppioni va eseguita su Supabase la migrazione
          <code> migrations/2026-10-09-promemoria-ricorrenze.sql</code>. Intanto tutto il resto funziona come prima.
        </div>
      )}
      {loaded && stato.migrata && !stato.templatePronto && (
        <div className="prom-avviso">
          🥂 I promemoria di <strong>anniversario</strong> restano in coda finché non si aggiorna il template su
          EmailJS (istruzioni in <code>docs/PROMEMORIA-COMPLEANNO.md</code>). Dopo, prova la mail con il bottone
          qui sopra e accendili con la riga SQL in fondo alla migrazione del 09/10/2026.
        </div>
      )}
      {!loaded && <div className="adm-muted">Caricamento…</div>}

      {loaded && !errLista && (
        <>
          <h4 className="prom-title">In arrivo</h4>
          {attive.length === 0 ? (
            <p className="adm-muted">
              Nessun promemoria in coda. Se ne crea uno ogni volta che arriva un ordine di compleanno o di
              anniversario con l’email del cliente.
            </p>
          ) : (
            <div className="prom-schede">
              {attive.map((s) => (
                <Scheda key={s.ordineId} s={s} busy={busy} configurato={configurato} migrata={stato.migrata} onProva={prova} onAzione={azione} />
              ))}
            </div>
          )}

          {storico.length > 0 && (
            <>
              <h4 className="prom-title">Storico</h4>
              <div className="prom-schede">
                {storicoVisto.map((s) => (
                  <Scheda key={s.ordineId} s={s} busy={busy} configurato={configurato} migrata={stato.migrata} onProva={prova} onAzione={azione} />
                ))}
              </div>
              {storico.length > STORICO_VISIBILE && (
                <button type="button" className="adm-btn prom-altri" onClick={() => setTuttoStorico((v) => !v)}>
                  {tuttoStorico ? 'Mostra solo i più recenti' : `Mostra tutto lo storico (${storico.length})`}
                </button>
              )}
              {storicoTagliato && (
                <p className="adm-muted prom-spiega prom-altri">
                  Qui ci sono le ultime {STORICO_MAX} mail dello storico: le più vecchie restano salvate nel database.
                </p>
              )}
            </>
          )}

          {stato.migrata && (
            <>
              <h4 className="prom-title">Disiscritti</h4>
              <p className="adm-muted prom-spiega">
                Non ricevono più nessun promemoria, né di compleanno né di anniversario. Si disiscrivono da soli
                dal link in fondo alle mail; qui puoi farlo tu (per esempio se te lo chiedono al banco) o
                riattivarli, solo se è il cliente a chiederlo.
              </p>
              <form className="prom-dis-form" onSubmit={disiscrivi}>
                <label className="prom-dis-campo">
                  <span>Disiscrivi un indirizzo</span>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    placeholder="email del cliente"
                    value={nuovoStop}
                    onChange={(e) => setNuovoStop(e.target.value)}
                  />
                </label>
                <button type="submit" className="adm-btn adm-btn-del" disabled={busy || !nuovoStop.trim()}>
                  Disiscrivi
                </button>
              </form>
              {disiscritti.length === 0 ? (
                <p className="adm-muted">Nessuno si è disiscritto.</p>
              ) : (
                <ul className="prom-dis-lista">
                  {disiscritti.map((d) => (
                    <li key={d.email}>
                      <span className="prom-dis-email">{d.email}</span>
                      <span className="adm-muted">dal {new Date(d.creato_il).toLocaleDateString('it-IT')}</span>
                      <button
                        type="button"
                        className="adm-btn"
                        disabled={busy}
                        onClick={() => azione(
                          () => riattivaEmail(d.email),
                          `Riattivare i promemoria per ${d.email}?\nFallo solo se te l’ha chiesto il cliente.`,
                        )}
                      >
                        Riattiva
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
