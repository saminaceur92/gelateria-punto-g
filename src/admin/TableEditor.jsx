import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Editor generico di una tabella di contenuti.
 * props:
 *  - table: nome tabella Supabase
 *  - title, subtitle
 *  - fields: [{ key, label, type: 'text'|'number'|'color'|'select', options?, placeholder? }]
 *  - newRow: () => oggetto coi valori di default per una nuova riga
 */
export default function TableEditor({ table, title, subtitle, fields, newRow, locked = false }) {
  const [rows, setRows] = useState([]);
  const [dirty, setDirty] = useState({}); // id -> true
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  async function load() {
    setError('');
    const { data, error } = await supabase.from(table).select('*').order('ordine', { ascending: true });
    if (error) setError(error.message);
    else setRows(data || []);
    setLoaded(true);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  const edit = (id, key, value) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
    setDirty((d) => ({ ...d, [id]: true }));
  };

  async function saveRow(row) {
    setBusy(true);
    setError('');
    const patch = {};
    for (const f of fields) patch[f.key] = row[f.key];
    const { error } = await supabase.from(table).update(patch).eq('id', row.id);
    if (error) setError(error.message);
    else setDirty((d) => ({ ...d, [row.id]: false }));
    setBusy(false);
  }

  async function toggleActive(row) {
    setBusy(true);
    setError('');
    const next = !row.attivo;
    const { error } = await supabase.from(table).update({ attivo: next }).eq('id', row.id);
    if (error) setError(error.message);
    else setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, attivo: next } : r)));
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
    else setRows((rs) => [...rs, data]);
    setBusy(false);
  }

  async function deleteRow(row) {
    if (!window.confirm(`Eliminare "${row.nome || row.giorno || row.etichetta || 'questa voce'}"? L'operazione non è reversibile.`)) return;
    setBusy(true);
    setError('');
    const { error } = await supabase.from(table).delete().eq('id', row.id);
    if (error) setError(error.message);
    else setRows((rs) => rs.filter((r) => r.id !== row.id));
    setBusy(false);
  }

  return (
    <section className="adm-card">
      <header className="adm-card-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <span className="adm-count">{rows.filter((r) => r.attivo).length}/{rows.length} in vetrina</span>
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
              {fields.map((f) => (
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
                  ) : f.type === 'checkbox' ? (
                    <input
                      type="checkbox"
                      className="adm-check"
                      checked={!!row[f.key]}
                      onChange={(e) => edit(row.id, f.key, e.target.checked)}
                    />
                  ) : (
                    <input
                      type={f.type === 'number' ? 'number' : 'text'}
                      value={row[f.key] ?? ''}
                      placeholder={f.placeholder || ''}
                      onChange={(e) => edit(row.id, f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                    />
                  )}
                </label>
              ))}
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
