import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logAction } from '../lib/log';
import { misuraForma, personeOf, RECT_MIN_PERSONE, formeAmmesseRighe, ultimaFormaDelGruppo } from '../lib/misureTorta';

/**
 * Misure della torta per forma (tab Dimensioni).
 *
 * Griglia taglie × forme, una casella per incrocio. Sta in un riquadro a
 * parte, sotto l'editor delle taglie: lì ogni riga è una taglia, e quattro
 * forme (una con due lati) sarebbero diventate cinque campi in fila senza
 * intestazione. Qui si legge come la tabella che si tiene in laboratorio.
 *
 * Il tab ne mostra due: una per le taglie delle torte normali e una per
 * quelle delle ALTE (prop `alta`), che hanno taglie e misure proprie.
 *
 * La tonda si salva nella colonna storica `diametro`, le altre forme in
 * `misure` (vedi src/lib/misureTorta.js).
 *
 * In cima a ogni colonna c'è l'interruttore della forma PER QUESTO GRUPPO
 * (colonne `per_normali` / `per_alte` di `forme`): una forma si può spegnere
 * solo per le alte o solo per le normali. Si salva subito, senza «Salva
 * misure». L'interruttore della scheda Forme (`attivo`) resta quello
 * generale. Da telefono l'intestazione della tabella non si vede, quindi gli
 * stessi interruttori stanno in una striscia sopra la tabella.
 */

/**
 * L'interruttore di una forma per un gruppo. Un pulsante intero, non solo la
 * levetta: l'area da toccare deve essere comoda anche da telefono.
 */
function InterruttoreForma({ f, acceso, disabled, title, etichetta, stato, idStato, onClick, conNome = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={acceso}
      aria-label={etichetta}
      aria-describedby={idStato}
      className={`mis-sw ${acceso ? 'on' : ''}`}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      <span className="mis-sw-pista" aria-hidden="true"><span className="mis-sw-pallino" /></span>
      {conNome && <span className="mis-sw-nome">{f.emoji} {f.nome}</span>}
      <span className="mis-sw-stato" id={idStato}>{stato}</span>
    </button>
  );
}

// Nell'input si lavora con il testo finché non si salva: "24," a metà
// battitura non deve diventare 24 né sparire.
const aTesto = (n) => (Number(n) > 0 ? String(n) : '');
const aNumero = (s) => {
  const n = Number(String(s ?? '').replace(',', '.').trim());
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : null;
};

const COME = { diametro: 'diametro', lato: 'lato', lati: 'lato corto × lungo' };

function valoriDaRiga(row, forme) {
  const v = {};
  for (const f of forme) {
    const { lati } = misuraForma(f.id);
    const numeri = f.id === 'tonda'
      ? [row.diametro]
      : (Array.isArray(row.misure?.[f.id]) ? row.misure[f.id] : []);
    v[f.id] = Array.from({ length: lati }, (_, i) => aTesto(numeri[i]));
  }
  return v;
}

function patchDaValori(row, valori, forme) {
  // Le chiavi di forme che qui non compaiono restano com'erano.
  const misure = { ...(row.misure && typeof row.misure === 'object' ? row.misure : {}) };
  // Tonda vuota = 0, che il sito tratta come "misura non indicata": la
  // colonna storica potrebbe non accettare un valore nullo.
  let diametro = Number(row.diametro) || 0;
  for (const f of forme) {
    const numeri = (valori?.[f.id] || []).map(aNumero);
    if (f.id === 'tonda') { diametro = numeri[0] ?? 0; continue; }
    if (numeri.length && numeri.every((n) => n != null)) misure[f.id] = numeri;
    else delete misure[f.id];
  }
  return { diametro, misure };
}

function erroreCella(testi, lati) {
  const pieni = testi.filter((t) => String(t).trim() !== '');
  if (!pieni.length) return '';
  if (pieni.some((t) => aNumero(t) == null)) return 'Scrivi i centimetri in cifre';
  if (lati === 2 && pieni.length < 2) return 'Servono tutti e due i lati';
  if (pieni.some((t) => aNumero(t) > 200)) return 'Più di 2 metri: controlla';
  return '';
}

export default function MisurePanel({ versione = 0, alta = false }) {
  const [taglie, setTaglie] = useState([]);
  const [forme, setForme] = useState([]);
  const [valori, setValori] = useState({}); // idTaglia -> idForma -> ['24'] o ['24', '34']
  const [dirty, setDirty] = useState({}); // idTaglia -> true
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [salvate, setSalvate] = useState(0);
  const [loaded, setLoaded] = useState(false);
  // Colonne che arrivano solo dopo le migrazioni: se Supabase non le
  // restituisce, lo script non è ancora stato eseguito.
  const [colonne, setColonne] = useState({ misure: true, alta: true });
  const [formaInCorso, setFormaInCorso] = useState(''); // forma che si sta accendendo o spegnendo
  const [avvisoForma, setAvvisoForma] = useState('');
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // La colonna di `forme` di questo gruppo e come lo si chiama a parole.
  const col = alta ? 'per_alte' : 'per_normali';
  const gruppo = alta ? 'torte alte' : 'torte normali';
  // Interruttori per gruppo: le colonne nascono con la migrazione
  // 2026-10-09-dashboard-ottobre. Prima, select('*') non le restituisce.
  const conGruppi = forme.length > 0 && col in forme[0];

  async function load() {
    setError('');
    const [dim, frm] = await Promise.all([
      supabase.from('dimensioni').select('*').order('ordine', { ascending: true }).order('id', { ascending: true }),
      // stesso ordine del configuratore (ordine, poi id)
      supabase.from('forme').select('*').order('ordine', { ascending: true }).order('id', { ascending: true }),
    ]);
    const err = dim.error || frm.error;
    if (err) {
      setError(err.message);
      setLoaded(true);
      return;
    }
    const tutte = dim.data || [];
    const prima = tutte[0];
    setColonne({ misure: !prima || 'misure' in prima, alta: !prima || 'alta' in prima });
    const righe = tutte.filter((r) => Boolean(r.alta) === alta);
    const fs = frm.data || [];
    setTaglie(righe);
    setForme(fs);
    // Si ricarica anche quando nel riquadro sopra si aggiunge o rinomina una
    // taglia: le caselle toccate e non ancora salvate restano come sono.
    setValori((prev) => {
      const next = {};
      for (const r of righe) next[r.id] = dirtyRef.current[r.id] && prev[r.id] ? prev[r.id] : valoriDaRiga(r, fs);
      return next;
    });
    setLoaded(true);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versione, alta]);

  // Migrazione delle misure non ancora eseguita: la tonda si salva lo
  // stesso, le altre forme restano bloccate.
  const senzaColonna = !colonne.misure;
  // Migrazione delle alte non ancora eseguita: la sezione delle alte è vuota
  // per forza, e va detto perché.
  const altePrimaDellaMigrazione = alta && !colonne.alta;

  const cambia = (idTaglia, idForma, i, testo) => {
    setSalvate(0);
    setValori((v) => {
      const riga = { ...(v[idTaglia] || {}) };
      const celle = [...(riga[idForma] || [])];
      celle[i] = testo;
      riga[idForma] = celle;
      return { ...v, [idTaglia]: riga };
    });
    setDirty((d) => ({ ...d, [idTaglia]: true }));
  };

  const nDaSalvare = taglie.filter((t) => dirty[t.id]).length;
  const nErrori = useMemo(() => taglie.reduce((tot, r) => tot + forme.filter((f) =>
    erroreCella(valori[r.id]?.[f.id] || [], misuraForma(f.id).lati)).length, 0), [taglie, forme, valori]);

  async function salva() {
    setBusy(true);
    setError('');
    let n = 0;
    for (const r of taglie.filter((t) => dirty[t.id])) {
      const patch = patchDaValori(r, valori[r.id], forme);
      if (senzaColonna) delete patch.misure;
      const { error: e } = await supabase.from('dimensioni').update(patch).eq('id', r.id);
      // Al primo errore ci si ferma: quelle già salvate restano salvate,
      // le altre restano segnate da salvare.
      if (e) { setError(`${r.etichetta || 'Taglia'}: ${e.message}`); break; }
      setTaglie((ts) => ts.map((t) => (t.id === r.id ? { ...t, ...patch } : t)));
      setDirty((d) => ({ ...d, [r.id]: false }));
      n += 1;
    }
    if (n) logAction('Misure torta modificate', `${alta ? 'torte alte, ' : ''}${n} ${n === 1 ? 'taglia' : 'taglie'}`);
    setSalvate(n);
    setBusy(false);
  }

  // Le forme che il cliente vede per questo gruppo (stessa regola del
  // configuratore) e se sta scattando la rete di sicurezza.
  const { ammesse, rete } = useMemo(() => formeAmmesseRighe(forme, alta), [forme, alta]);

  // Stato di una forma per questo gruppo, a parole: sotto l'interruttore e
  // nell'etichetta delle caselle da telefono.
  const statoForma = (f) => {
    const acceso = f[col] !== false;
    if (!f.attivo) return { acceso, vista: false, testo: 'nascosta in Forme' };
    if (!acceso) return { acceso, vista: ammesse.includes(f.id), testo: `spenta per le ${alta ? 'alte' : 'normali'}` };
    return { acceso, vista: true, testo: 'in vendita' };
  };

  // Accende o spegne la forma per questo gruppo. Vale SUBITO sul sito: non
  // aspetta «Salva misure», che riguarda solo le caselle dei centimetri.
  async function cambiaForma(f) {
    const acceso = f[col] !== false;
    if (acceso && ultimaFormaDelGruppo(forme, f.id, alta)) {
      setAvvisoForma(`${f.nome} è l'ultima forma accesa per le ${gruppo}: accendine prima un'altra, poi spegni questa.`);
      return;
    }
    setAvvisoForma('');
    setError('');
    setFormaInCorso(f.id);
    const { data, error: e } = await supabase.from('forme').update({ [col]: !acceso }).eq('id', f.id).select('id');
    setFormaInCorso('');
    if (e) { setError(`${f.nome}: ${e.message}`); return; }
    // Un aggiornamento fermato dai permessi non dà errore: non tocca righe.
    if (!data?.length) { setError(`${f.nome}: il database non ha accettato la modifica. Esci e rientra col tuo codice, poi riprova.`); return; }
    setForme((fs) => fs.map((x) => (x.id === f.id ? { ...x, [col]: !acceso } : x)));
    logAction(acceso ? 'Forma spenta' : 'Forma accesa', `${f.nome} · ${gruppo}`);
  }

  // Lo stesso interruttore sta in due posti (intestazione da computer,
  // striscia da telefono): gli id restano diversi.
  const interruttore = (f, dove) => {
    const st = statoForma(f);
    return (
      <InterruttoreForma
        f={f}
        acceso={st.acceso}
        disabled={!f.attivo || busy || formaInCorso !== ''}
        title={f.attivo ? undefined : 'Accendila prima nella scheda Forme'}
        etichetta={`${f.nome} per le ${gruppo}`}
        stato={formaInCorso === f.id ? 'salvo…' : st.testo}
        idStato={`mis-sw-${alta ? 'alte' : 'normali'}-${f.id}-${dove}`}
        onClick={() => cambiaForma(f)}
        conNome={dove === 'striscia'}
      />
    );
  };

  return (
    <section className="adm-card">
      <header className="adm-card-head">
        <div>
          <h3>Misure per forma{alta ? ' · torte alte' : ''}</h3>
          <p>
            Quanto misura ogni taglia, forma per forma, in centimetri. È la misura che il cliente
            vede quando sceglie e che arriva scritta nell'ordine.
            {conGruppi && (
              <>
                {' '}L'interruttore sotto ogni forma decide se si può scegliere per le {gruppo}: vale
                subito, senza «Salva misure».
              </>
            )}
          </p>
        </div>
        <div className="adm-head-destra">
          {nDaSalvare > 0 ? (
            <button type="button" className="adm-btn adm-btn-save" onClick={salva} disabled={busy || nErrori > 0}>
              {busy ? 'Salvo…' : `💾 Salva misure (${nDaSalvare})`}
            </button>
          ) : salvate > 0 ? (
            <span className="adm-count">✓ Salvate</span>
          ) : null}
        </div>
      </header>

      {altePrimaDellaMigrazione && (
        <div className="mis-avviso">
          Le taglie delle <strong>torte alte</strong> si attivano eseguendo una volta su Supabase la
          migrazione <code>migrations/2026-09-14-taglie-alte.sql</code>.
        </div>
      )}
      {senzaColonna && !altePrimaDellaMigrazione && (
        <div className="mis-avviso">
          Per ora si può salvare solo la <strong>tonda</strong>. Per sbloccare cuore, quadrata e
          rettangolare va eseguita una volta su Supabase la migrazione
          <code> migrations/2026-09-14-misure-per-forma.sql</code>.
        </div>
      )}
      {loaded && forme.length > 0 && !conGruppi && !altePrimaDellaMigrazione && (
        <div className="mis-avviso">
          Gli interruttori per accendere e spegnere ogni forma solo per le {gruppo} si attivano
          eseguendo una volta su Supabase la migrazione <code>migrations/2026-10-09-dashboard-ottobre.sql</code>.
        </div>
      )}
      {conGruppi && rete && (
        <div className="mis-avviso" role="status">
          Per le <strong>{gruppo}</strong> non c'è nessuna forma accesa (contano anche gli interruttori
          della scheda Forme). Per non lasciare i clienti senza scelta, finché non ne accendi una il sito
          mostra alle {gruppo} <strong>tutte</strong> le forme in vendita.
        </div>
      )}
      {conGruppi && ammesse.length === 1 && ammesse[0] === 'rettangolare' && (
        <div className="mis-avviso" role="status">
          Per le <strong>{gruppo}</strong> c'è solo la rettangolare, che si può scegliere da{' '}
          {RECT_MIN_PERSONE} persone in su: chi ne ordina una più piccola resta senza forma. Accendine
          anche un'altra.
        </div>
      )}
      {avvisoForma && <div className="mis-avviso" role="status">{avvisoForma}</div>}
      {error && <div className="adm-error">⚠️ {error}</div>}
      {nErrori > 0 && <div className="adm-error">⚠️ Sistema le caselle in rosso prima di salvare.</div>}
      {!loaded && <div className="adm-muted">Caricamento…</div>}
      {loaded && !error && taglie.length === 0 && !altePrimaDellaMigrazione && (
        <div className="adm-muted">
          Nessuna taglia{alta ? ' per le torte alte' : ''}: aggiungila dal riquadro sopra con «+ Aggiungi».
        </div>
      )}

      {/* Da telefono l'intestazione della tabella è nascosta: gli interruttori
          stanno qui. Da computer questa striscia compare solo se la tabella
          non c'è (nessuna taglia), altrimenti stanno sotto il nome della forma. */}
      {loaded && conGruppi && (
        <div
          className={`mis-forme-switch ${taglie.length === 0 ? 'sempre' : ''}`}
          role="group"
          aria-label={`Forme per le ${gruppo}`}
        >
          <p className="mis-fs-tit">Forme per le {gruppo}</p>
          {forme.map((f) => <Fragment key={f.id}>{interruttore(f, 'striscia')}</Fragment>)}
        </div>
      )}

      {loaded && taglie.length > 0 && (
        <div className="mis-scroll">
          <table className="mis-tabella">
            <thead>
              <tr>
                <th scope="col">Taglia</th>
                {forme.map((f) => (
                  <th key={f.id} scope="col" className={statoForma(f).vista ? '' : 'off'}>
                    <span className="mis-forma">{f.emoji} {f.nome}</span>
                    <span className="mis-come">{COME[misuraForma(f.id).tipo]}{f.attivo || conGruppi ? '' : ' · nascosta'}</span>
                    {conGruppi && interruttore(f, 'testa')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {taglie.map((r) => {
                const persone = personeOf({ id: r.id, label: r.etichetta });
                return (
                  <tr key={r.id} className={`${r.attivo ? '' : 'off'} ${dirty[r.id] ? 'mod' : ''}`}>
                    <th scope="row">
                      {r.etichetta || 'Senza nome'}
                      {!r.attivo && <small>nascosta</small>}
                    </th>
                    {forme.map((f) => {
                      const { tipo, lati } = misuraForma(f.id);
                      const testi = valori[r.id]?.[f.id] || [];
                      const err = erroreCella(testi, lati);
                      const bloccata = f.id === 'rettangolare' && persone > 0 && persone < RECT_MIN_PERSONE;
                      const ferma = senzaColonna && f.id !== 'tonda';
                      // Cuore vuoto = diametro della tonda: lo si suggerisce in grigio.
                      const suggerito = tipo === 'diametro' && f.id !== 'tonda' ? (valori[r.id]?.tonda?.[0] || '') : '';
                      // Forma che il cliente non vede: caselle attenuate ma
                      // ancora scrivibili, così le misure si preparano prima di
                      // accenderla (come per le taglie alte).
                      const st = statoForma(f);
                      return (
                        <td
                          key={f.id}
                          className={st.vista ? '' : 'off'}
                          data-forma={`${f.emoji} ${f.nome} · ${COME[tipo]}${st.vista ? '' : ` · ${st.testo}`}`}
                        >
                          {bloccata ? (
                            <span className="mis-no">solo da {RECT_MIN_PERSONE} persone</span>
                          ) : (
                            <div className="mis-cella">
                              {Array.from({ length: lati }, (_, i) => (
                                <Fragment key={i}>
                                  {i > 0 && <span className="mis-x">×</span>}
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={testi[i] ?? ''}
                                    placeholder={suggerito}
                                    disabled={ferma || busy}
                                    className={err ? 'err' : ''}
                                    aria-invalid={err ? 'true' : undefined}
                                    aria-label={`${alta ? 'Torta alta, ' : ''}${r.etichetta}, ${f.nome}${lati === 2 ? (i === 0 ? ', lato corto' : ', lato lungo') : `, ${COME[tipo]}`}, in centimetri`}
                                    onChange={(e) => cambia(r.id, f.id, i, e.target.value)}
                                  />
                                </Fragment>
                              ))}
                              <span className="mis-cm">cm</span>
                            </div>
                          )}
                          {err && <span className="mis-err">{err}</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="adm-locked-note">
        Casella vuota: per il <strong>cuore</strong> vale il diametro della tonda (il numero in grigio);
        per <strong>quadrata e rettangolare</strong> al cliente non si mostra nessuna misura.
        {conGruppi && (
          <>
            {' '}Una forma spenta qui resta in vendita per le altre torte; spenta nella scheda{' '}
            <strong>Forme</strong> non la vede nessuno.
          </>
        )}
      </p>
    </section>
  );
}
