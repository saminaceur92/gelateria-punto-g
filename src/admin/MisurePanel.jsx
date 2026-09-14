import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logAction } from '../lib/log';
import { misuraForma, personeOf, RECT_MIN_PERSONE } from '../lib/misureTorta';

/**
 * Misure della torta per forma (tab Dimensioni).
 *
 * Griglia taglie × forme, una casella per incrocio. Sta in un riquadro a
 * parte, sotto l'editor delle taglie: lì ogni riga è una taglia, e quattro
 * forme (una con due lati) sarebbero diventate cinque campi in fila senza
 * intestazione. Qui si legge come la tabella che si tiene in laboratorio.
 *
 * La tonda si salva nella colonna storica `diametro`, le altre forme in
 * `misure` (vedi src/lib/misureTorta.js).
 */

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

export default function MisurePanel({ versione = 0 }) {
  const [taglie, setTaglie] = useState([]);
  const [forme, setForme] = useState([]);
  const [valori, setValori] = useState({}); // idTaglia -> idForma -> ['24'] o ['24', '34']
  const [dirty, setDirty] = useState({}); // idTaglia -> true
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [salvate, setSalvate] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  async function load() {
    setError('');
    const [dim, frm] = await Promise.all([
      supabase.from('dimensioni').select('*').order('ordine', { ascending: true }),
      supabase.from('forme').select('*').order('ordine', { ascending: true }),
    ]);
    const err = dim.error || frm.error;
    if (err) {
      setError(err.message);
      setLoaded(true);
      return;
    }
    const righe = dim.data || [];
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
  }, [versione]);

  // Migrazione non ancora eseguita: Supabase non restituisce la colonna.
  // La tonda si salva lo stesso, le altre forme restano bloccate.
  const senzaColonna = taglie.length > 0 && !('misure' in taglie[0]);

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
    if (n) logAction('Misure torta modificate', `${n} ${n === 1 ? 'taglia' : 'taglie'}`);
    setSalvate(n);
    setBusy(false);
  }

  return (
    <section className="adm-card">
      <header className="adm-card-head">
        <div>
          <h3>Misure per forma</h3>
          <p>
            Quanto misura ogni taglia, forma per forma, in centimetri. È la misura che il cliente
            vede quando sceglie e che arriva scritta nell'ordine.
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

      {senzaColonna && (
        <div className="mis-avviso">
          Per ora si può salvare solo la <strong>tonda</strong>. Per sbloccare cuore, quadrata e
          rettangolare va eseguita una volta su Supabase la migrazione
          <code> migrations/2026-09-14-misure-per-forma.sql</code>.
        </div>
      )}
      {error && <div className="adm-error">⚠️ {error}</div>}
      {nErrori > 0 && <div className="adm-error">⚠️ Sistema le caselle in rosso prima di salvare.</div>}
      {!loaded && <div className="adm-muted">Caricamento…</div>}

      {loaded && taglie.length > 0 && (
        <div className="mis-scroll">
          <table className="mis-tabella">
            <thead>
              <tr>
                <th scope="col">Taglia</th>
                {forme.map((f) => (
                  <th key={f.id} scope="col" className={f.attivo ? '' : 'off'}>
                    <span className="mis-forma">{f.emoji} {f.nome}</span>
                    <span className="mis-come">{COME[misuraForma(f.id).tipo]}{f.attivo ? '' : ' · nascosta'}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {taglie.map((r) => {
                const persone = parseInt(r.etichetta, 10) || personeOf({ id: r.id });
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
                      return (
                        <td key={f.id} data-forma={`${f.emoji} ${f.nome} · ${COME[tipo]}`}>
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
                                    aria-label={`${r.etichetta}, ${f.nome}${lati === 2 ? (i === 0 ? ', lato corto' : ', lato lungo') : `, ${COME[tipo]}`}, in centimetri`}
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
      </p>
    </section>
  );
}
