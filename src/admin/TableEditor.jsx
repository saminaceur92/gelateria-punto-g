import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logAction } from '../lib/log';
import { caricaFotoFile, eliminaFotoFile } from '../lib/galleryFoto';

/**
 * Editor generico di una tabella di contenuti.
 * props:
 *  - table: nome tabella Supabase
 *  - title, subtitle
 *  - fields: [{ key, label, type: 'text'|'textarea'|'number'|'color'|'select'|'checkbox'|'checkboxes'|'foto', options?, placeholder? }]
 *    'checkboxes' = spunte multiple salvate come stringa separata da virgola (options: [{value, label?, emoji?}])
 *    'textarea' = testo lungo (descrizioni): occupa tutta la riga, si può allargare in altezza
 *    'foto' = foto di esempio: si carica/cambia/toglie e si salva DA SOLA subito
 *      (il file va nello storage al volo, non può aspettare il bottone Salva).
 *      `key` è la colonna con l'indirizzo, `pathKey` quella col percorso del file.
 *  - newRow: () => oggetto coi valori di default per una nuova riga
 */

/**
 * Foto di esempio di una riga (es. la copertura): miniatura + carica/cambia/
 * togli. Salva direttamente nel database: il file è già caricato nello storage
 * nel momento in cui lo si sceglie, tenerlo "in sospeso" fino al Salva della
 * riga lascerebbe file orfani a ogni ripensamento.
 */
function FotoField({ row, field, table, onSaved, onError }) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const url = row[field.key] || '';
  const pathKey = field.pathKey || `${field.key}_path`;

  async function scelto(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // così la stessa foto si può riscegliere dopo un errore
    if (!file) return;
    setBusy(true);
    onError('');
    const up = await caricaFotoFile({ file, cartella: `${table}` });
    if (up.error) { onError(up.error); setBusy(false); return; }
    const vecchio = row[pathKey];
    const patch = { [field.key]: up.url, [pathKey]: up.path };
    const { error } = await supabase.from(table).update(patch).eq('id', row.id);
    if (error) {
      onError(error.message);
      await eliminaFotoFile(up.path); // il file appena messo non serve più
    } else {
      if (vecchio) await eliminaFotoFile(vecchio);
      onSaved(row.id, patch);
      logAction('Foto di esempio caricata', `${table}: ${row.nome || row.id}`);
    }
    setBusy(false);
  }

  async function togli() {
    if (!window.confirm('Togliere la foto di esempio?')) return;
    setBusy(true);
    onError('');
    const patch = { [field.key]: null, [pathKey]: null };
    const { error } = await supabase.from(table).update(patch).eq('id', row.id);
    if (error) onError(error.message);
    else {
      if (row[pathKey]) await eliminaFotoFile(row[pathKey]);
      onSaved(row.id, patch);
      logAction('Foto di esempio tolta', `${table}: ${row.nome || row.id}`);
    }
    setBusy(false);
  }

  return (
    <div className="adm-foto">
      <span className="adm-flabel">{field.label}</span>
      <div className="adm-foto-riga">
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" title="Apri la foto">
            <img src={url} alt="" className="adm-foto-mini" />
          </a>
        ) : (
          <span className="adm-foto-vuota">nessuna</span>
        )}
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={scelto} />
        <button type="button" className="adm-btn" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? 'Carico…' : url ? 'Cambia' : 'Carica foto'}
        </button>
        {url && !busy && (
          <button type="button" className="adm-btn adm-btn-del" onClick={togli} title="Togli la foto">
            🗑
          </button>
        )}
      </div>
    </div>
  );
}

// Spunte multiple <-> stringa "A, B, C". Preserva eventuali valori non standard.
function MultiCheckField({ value, options, onChange }) {
  const current = (value || '').split(',').map((x) => x.trim()).filter(Boolean);
  const known = options.map((o) => o.value);
  const toggle = (val, on) => {
    const set = new Set(current);
    if (on) set.add(val); else set.delete(val);
    const ordered = options.filter((o) => set.has(o.value)).map((o) => o.value);
    const extras = [...set].filter((v) => !known.includes(v)); // non perdere valori scritti a mano
    onChange([...ordered, ...extras].join(', '));
  };
  return (
    <span className="adm-checks" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.7rem' }}>
      {options.map((o) => (
        <label key={o.value} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer' }}>
          <input type="checkbox" checked={current.includes(o.value)} onChange={(e) => toggle(o.value, e.target.checked)} />
          <span>{o.emoji ? `${o.emoji} ` : ''}{o.label || o.value}</span>
        </label>
      ))}
    </span>
  );
}

export default function TableEditor({ table, title, subtitle, fields, newRow, locked = false, excludeIds = [] }) {
  const [rows, setRows] = useState([]);
  const [dirty, setDirty] = useState({}); // id -> true
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const excludeKey = excludeIds.join('|');
  const rowLabel = (r) => r.nome || r.gusto || r.titolo || r.codice || r.giorno || r.etichetta || 'voce';

  // La riga si legge male se i campi sono tutti in fila: li dividiamo in fasce
  // — dati, foto, gruppi di spunte (allergeni presenti / tracce), sì/no.
  const campiNormali = fields.filter((f) => !['checkbox', 'checkboxes', 'foto'].includes(f.type));
  const campiFoto = fields.filter((f) => f.type === 'foto');
  const gruppiSpunte = fields.filter((f) => f.type === 'checkboxes');
  const flag = fields.filter((f) => f.type === 'checkbox');
  // Le colonne foto si salvano da sole (vedi FotoField): il Salva della riga
  // non deve toccarle, altrimenti una riga "sporca" rimasta aperta
  // sovrascriverebbe la foto appena caricata col valore vecchio.
  const campiDaSalvare = fields.filter((f) => f.type !== 'foto');

  async function load() {
    setError('');
    const { data, error } = await supabase.from(table).select('*').order('ordine', { ascending: true });
    // Tabella non ancora creata: messaggio comprensibile invece dell'errore Postgres.
    if (error) {
      setError(/does not exist|schema cache/i.test(error.message)
        ? `Questa scheda non è ancora attiva: la tabella "${table}" va creata su Supabase eseguendo la migrazione SQL della cartella migrations/. (${error.message})`
        : error.message);
    } else {
      const nascosti = new Set(excludeKey.split('|').filter(Boolean));
      setRows((data || []).filter((r) => !nascosti.has(String(r.id))));
    }
    setLoaded(true);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, excludeKey]);

  const edit = (id, key, value) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
    setDirty((d) => ({ ...d, [id]: true }));
  };

  async function saveRow(row) {
    setBusy(true);
    setError('');
    const patch = {};
    for (const f of campiDaSalvare) patch[f.key] = row[f.key];
    const { error } = await supabase.from(table).update(patch).eq('id', row.id);
    if (error) setError(error.message);
    else {
      setDirty((d) => ({ ...d, [row.id]: false }));
      logAction('Contenuto modificato', `${title}: ${rowLabel(row)}`);
    }
    setBusy(false);
  }

  // Tutte le righe modificate in un colpo solo: prima c'era soltanto il Salva
  // per riga, e dopo dieci ritocchi toccava andarli a cercare uno per uno.
  const daSalvare = rows.filter((r) => dirty[r.id]);
  async function saveAll() {
    setBusy(true);
    setError('');
    let salvate = 0;
    for (const row of daSalvare) {
      const patch = {};
      for (const f of campiDaSalvare) patch[f.key] = row[f.key];
      const { error } = await supabase.from(table).update(patch).eq('id', row.id);
      // Al primo errore ci si ferma: le righe già salvate restano salvate,
      // quelle dopo restano segnate da salvare — niente si perde in silenzio.
      if (error) { setError(`${rowLabel(row)}: ${error.message}`); break; }
      setDirty((d) => ({ ...d, [row.id]: false }));
      salvate += 1;
    }
    if (salvate) logAction('Contenuti modificati', `${title}: ${salvate} voci`);
    setBusy(false);
  }

  async function toggleActive(row) {
    setBusy(true);
    setError('');
    const next = !row.attivo;
    const { error } = await supabase.from(table).update({ attivo: next }).eq('id', row.id);
    if (error) setError(error.message);
    else {
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, attivo: next } : r)));
      logAction(next ? 'Contenuto attivato' : 'Contenuto disattivato', `${title}: ${rowLabel(row)}`);
    }
    setBusy(false);
  }

  async function addRow() {
    setBusy(true);
    setError('');
    const maxOrd = rows.reduce((m, r) => Math.max(m, Number(r.ordine) || 0), 0);
    const { data, error } = await supabase
      .from(table)
      .insert({ ...newRow(), ordine: maxOrd + 10, attivo: true })
      .select()
      .single();
    if (error) setError(error.message);
    else {
      setRows((rs) => [...rs, data]);
      logAction('Contenuto aggiunto', title);
    }
    setBusy(false);
  }

  async function deleteRow(row) {
    if (!window.confirm(`Eliminare "${row.nome || row.giorno || row.etichetta || 'questa voce'}"? L'operazione non è reversibile.`)) return;
    setBusy(true);
    setError('');
    const { error } = await supabase.from(table).delete().eq('id', row.id);
    if (error) setError(error.message);
    else {
      setRows((rs) => rs.filter((r) => r.id !== row.id));
      logAction('Contenuto eliminato', `${title}: ${rowLabel(row)}`);
    }
    setBusy(false);
  }

  return (
    <section className="adm-card">
      <header className="adm-card-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="adm-head-destra">
          {daSalvare.length > 0 && (
            <button type="button" className="adm-btn adm-btn-save" onClick={saveAll} disabled={busy}>
              💾 Salva tutto ({daSalvare.length})
            </button>
          )}
          <span className="adm-count">{rows.filter((r) => r.attivo).length}/{rows.length} in vetrina</span>
        </div>
      </header>

      {error && <div className="adm-error">⚠️ {error}</div>}
      {!loaded && <div className="adm-muted">Caricamento…</div>}

      <div className="adm-rows">
        {rows.map((row) => (
          <div key={row.id} className={`adm-row ${row.attivo ? '' : 'off'}`}>
            <button
              type="button"
              className={`adm-toggle ${row.attivo ? 'on' : ''}`}
              onClick={() => toggleActive(row)}
              disabled={busy}
              title={row.attivo ? 'In vetrina — clicca per nascondere' : 'Nascosto — clicca per mostrare'}
            >
              <span className="knob" />
            </button>

            <div className="adm-fields">
              {/* 1ª riga: i campi normali */}
              {campiNormali.map((f) => (
                <label key={f.key} className={`adm-field f-${f.type}`}>
                  <span className="adm-flabel">{f.label}</span>
                  {f.type === 'select' ? (
                    <select value={row[f.key] ?? ''} onChange={(e) => edit(row.id, f.key, e.target.value)}>
                      <option value="">—</option>
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : f.type === 'color' ? (
                    <span className="adm-color">
                      <input type="color" value={row[f.key] || '#cccccc'} onChange={(e) => edit(row.id, f.key, e.target.value)} />
                      <code>{row[f.key] || '—'}</code>
                    </span>
                  ) : f.type === 'textarea' ? (
                    // Testi lunghi (es. la descrizione del gusto nella carta):
                    // in una casella normale non si leggerebbero mai per intero.
                    <textarea
                      rows={2}
                      value={row[f.key] ?? ''}
                      placeholder={f.placeholder || ''}
                      onChange={(e) => edit(row.id, f.key, e.target.value)}
                    />
                  ) : (
                    <input
                      type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                      value={row[f.key] ?? ''}
                      placeholder={f.placeholder || ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        // Numeri e date possono restare VUOTI e in quel caso vanno
                        // salvati come "niente", non come 0 o stringa vuota: una
                        // scadenza vuota vuol dire "non scade", non "1 gennaio".
                        if (f.type === 'number') return edit(row.id, f.key, v === '' ? null : Number(v));
                        if (f.type === 'date') return edit(row.id, f.key, v === '' ? null : v);
                        edit(row.id, f.key, v);
                      }}
                    />
                  )}
                </label>
              ))}

              {/* Foto di esempio: si carica e si salva da sola, subito. */}
              {campiFoto.map((f) => (
                <FotoField
                  key={f.key}
                  row={row}
                  field={f}
                  table={table}
                  onError={setError}
                  onSaved={(id, patch) =>
                    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
                  }
                />
              ))}

              {/* Un riquadro per gruppo di spunte (allergeni presenti / tracce):
                  ognuno a tutta larghezza, così non si confondono tra loro. */}
              {gruppiSpunte.map((f) => (
                <div key={f.key} className={`adm-group tone-${f.tone || 'neutro'}`}>
                  <span className="adm-flabel">{f.label}</span>
                  <MultiCheckField
                    value={row[f.key]}
                    options={f.options}
                    onChange={(v) => edit(row.id, f.key, v)}
                  />
                </div>
              ))}

              {/* Ultima riga: tutti i sì/no insieme (vegan, senza glutine, …) */}
              {flag.length > 0 && (
                <div className="adm-flags">
                  {flag.map((f) => (
                    <label key={f.key} className="adm-flag">
                      <input
                        type="checkbox"
                        className="adm-check"
                        checked={!!row[f.key]}
                        onChange={(e) => edit(row.id, f.key, e.target.checked)}
                      />
                      <span>{f.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="adm-row-actions">
              {dirty[row.id] && (
                <button type="button" className="adm-btn adm-btn-save" onClick={() => saveRow(row)} disabled={busy}>
                  Salva
                </button>
              )}
              {!locked && (
                <button type="button" className="adm-btn adm-btn-del" onClick={() => deleteRow(row)} disabled={busy} title="Elimina">
                  🗑
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {locked ? (
        <p className="adm-locked-note">🔒 Queste voci sono legate alla grafica 3D: puoi <strong>attivarle o disattivarle</strong> in base a cosa hai disponibile. Per aggiungerne di nuove serve il supporto 3D.</p>
      ) : (
        <button type="button" className="adm-btn adm-btn-add" onClick={addRow} disabled={busy}>
          + Aggiungi
        </button>
      )}
    </section>
  );
}
