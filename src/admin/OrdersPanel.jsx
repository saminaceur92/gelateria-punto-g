import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logAction } from '../lib/log';

const STATI = [
  { value: 'da_fare', label: 'Da fare', color: '#b651e4' },
  { value: 'in_lavorazione', label: 'In lavorazione', color: '#2a7ad6' },
  { value: 'pronto', label: 'Pronto', color: '#eb911e' },
  { value: 'consegnato', label: 'Consegnato', color: '#46a85a' },
  { value: 'annullato', label: 'Annullato', color: '#b03a3a' },
];
// Stati finali: ordine chiuso, niente countdown alla scadenza.
const FINALI = ['consegnato', 'annullato'];

// Formato date uniforme (gg/mm/aaaa) in tutta la dashboard.
const fmtDate = (val) => {
  if (!val) return '';
  try {
    return new Date(val).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return val;
  }
};
const fmtDateTime = (val) => {
  if (!val) return '';
  try {
    return new Date(val).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return val;
  }
};

// Urgenza in base alla data di ritiro (priorità produzione).
function urgency(ritiro) {
  if (!ritiro) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${ritiro}T00:00:00`);
  const days = Math.round((d - today) / 86400000);
  if (days < 0) return { label: 'Scaduto', color: '#b03a3a', level: 3 };
  if (days === 0) return { label: 'Oggi', color: '#b03a3a', level: 3 };
  if (days === 1) return { label: 'Domani', color: '#eb911e', level: 2 };
  if (days <= 3) return { label: `tra ${days} giorni`, color: '#eb911e', level: 1 };
  return { label: `tra ${days} giorni`, color: '#8a8a8a', level: 0 };
}

// Ordine "scaduto": ritiro già passato e ancora da gestire (non chiuso).
const isScaduto = (o) => !FINALI.includes(o.stato) && urgency(o.ritiro_data)?.label === 'Scaduto';

export default function OrdersPanel() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('da_fare');
  const [sortBy, setSortBy] = useState('ritiro');
  const [openId, setOpenId] = useState(null);
  const [labDraft, setLabDraft] = useState({}); // id -> testo nota in modifica
  const [labSaved, setLabSaved] = useState(null); // id appena salvato (feedback)

  async function load() {
    setLoading(true);
    setError('');
    const { data, error } = await supabase.from('ordini').select('*');
    if (error) setError(error.message);
    else setOrders(data || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function setStato(id, stato) {
    const { error } = await supabase.from('ordini').update({ stato }).eq('id', id);
    if (error) { setError(error.message); return; }
    setOrders((os) => os.map((o) => (o.id === id ? { ...o, stato } : o)));
    const o = orders.find((x) => x.id === id);
    const label = (STATI.find((s) => s.value === stato) || {}).label || stato;
    logAction('Ordine spostato', `${o?.cliente_nome || 'ordine'} → ${label}`);
  }

  async function remove(id) {
    const o = orders.find((x) => x.id === id);
    if (!window.confirm("Eliminare questo ordine? L'operazione non è reversibile.")) return;
    const { error } = await supabase.from('ordini').delete().eq('id', id);
    if (error) { setError(error.message); return; }
    setOrders((os) => os.filter((x) => x.id !== id));
    logAction('Ordine eliminato', o?.cliente_nome || 'ordine');
  }

  async function saveLab(id) {
    const note_lab = labDraft[id] ?? '';
    const { error } = await supabase.from('ordini').update({ note_lab }).eq('id', id);
    if (error) { setError(error.message); return; }
    const o = orders.find((x) => x.id === id);
    setOrders((os) => os.map((x) => (x.id === id ? { ...x, note_lab } : x)));
    setLabDraft((d) => { const n = { ...d }; delete n[id]; return n; });
    logAction('Nota ordine aggiornata', o?.cliente_nome || 'ordine');
    setLabSaved(id);
    setTimeout(() => setLabSaved((s) => (s === id ? null : s)), 2000);
  }

  // Filtro per stato (+ vista trasversale "Scaduto")
  let shown = orders;
  if (filter === 'scaduto') shown = orders.filter(isScaduto);
  else if (filter !== 'tutti') shown = orders.filter((o) => o.stato === filter);

  // Ordinamento
  shown = [...shown].sort((a, b) => {
    if (sortBy === 'ritiro') {
      if (!a.ritiro_data && !b.ritiro_data) return 0;
      if (!a.ritiro_data) return 1;
      if (!b.ritiro_data) return -1;
      return a.ritiro_data.localeCompare(b.ritiro_data);
    }
    return (b.created_at || '').localeCompare(a.created_at || '');
  });

  const nDaFare = orders.filter((o) => o.stato === 'da_fare').length;
  const nInLav = orders.filter((o) => o.stato === 'in_lavorazione').length;
  const nScaduti = orders.filter(isScaduto).length;

  return (
    <section className="adm-card">
      <header className="adm-card-head">
        <div>
          <h3>Ordini torte</h3>
          <p>Richieste dal sito, ordinate per priorità (ritiro più vicino in cima). Aggiorna lo stato man mano che le prepari.</p>
        </div>
        <span className="adm-count">
          {nDaFare + nInLav} da gestire <span className="adm-count-detail">({nDaFare} da fare · {nInLav} in lavorazione)</span> · {orders.length} totali
          {nScaduti > 0 && <span className="ord-count-scaduti"> · ⚠ {nScaduti} scaduti</span>}
        </span>
      </header>

      <div className="ord-filters">
        {STATI.map((s) => (
          <button key={s.value} className={filter === s.value ? 'active' : ''} onClick={() => setFilter(s.value)}>
            {s.label}
          </button>
        ))}
        <button className={`ord-f-scaduto ${filter === 'scaduto' ? 'active' : ''}`} onClick={() => setFilter('scaduto')}>
          Scaduto{nScaduti > 0 ? ` (${nScaduti})` : ''}
        </button>
        <button className={filter === 'tutti' ? 'active' : ''} onClick={() => setFilter('tutti')}>Tutti</button>
        <span className="ord-sort">
          Ordina:
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="ritiro">Priorità (ritiro)</option>
            <option value="recenti">Più recenti</option>
          </select>
          <button className="ord-reload" onClick={load} title="Aggiorna">↻</button>
        </span>
      </div>

      {error && <div className="adm-error">⚠️ {error}</div>}
      {loading && <div className="adm-muted">Caricamento…</div>}
      {!loading && shown.length === 0 && <div className="adm-muted">Nessun ordine{filter !== 'tutti' ? ' in questa vista' : ' ancora'}.</div>}

      <div className="ord-list">
        {shown.map((o) => {
          const stato = STATI.find((s) => s.value === o.stato) || STATI[0];
          const open = openId === o.id;
          const tel = (o.cliente_telefono || '').replace(/\D/g, '');
          // Il countdown alla scadenza c'è sempre, finché l'ordine non è chiuso.
          const urg = FINALI.includes(o.stato) ? null : urgency(o.ritiro_data);
          const gusti = Array.isArray(o.dettagli?.flavors) ? o.dettagli.flavors.map((f) => f.name).filter(Boolean).join(', ') : '';
          // Bordo sinistro: rosso se scaduto, grigio se annullato, altrimenti il colore dello stato.
          const overdue = isScaduto(o);
          const borderCol = overdue ? '#b03a3a' : o.stato === 'annullato' ? '#c9c9c9' : stato.color;

          return (
            <div key={o.id} className={`ord-card ${overdue ? 'scaduto' : ''}`} style={{ borderLeftColor: borderCol }}>
              <div className="ord-row">
                {o.immagine && <img className="ord-img" src={o.immagine} alt="Torta configurata" loading="lazy" />}
                <div className="ord-body">
                  <div className="ord-top">
                    <div className="ord-who">
                      <strong>{o.cliente_nome || 'Senza nome'}</strong>
                      <span className="ord-meta">{o.tipo || 'Torta'} · €{Number(o.totale || 0).toFixed(2)}</span>
                    </div>
                    <div className="ord-badges">
                      {urg && <span className="ord-badge" style={{ background: urg.color }}>{urg.label}</span>}
                      <span className="ord-badge ord-badge-stato" style={{ background: stato.color }}>{stato.label}</span>
                    </div>
                  </div>

                  {gusti && <div className="ord-gusti">🍰 {gusti}</div>}
                  {o.note_lab && <div className="ord-lab-preview">📝 {o.note_lab}</div>}

                  <div className="ord-info">
                    <span>🗓️ Prenotato {fmtDateTime(o.created_at)}</span>
                    {o.ritiro_data && <span>🛍️ Ritiro {fmtDate(o.ritiro_data)}</span>}
                    {o.cliente_telefono && <span>📞 {o.cliente_telefono}</span>}
                  </div>

                  <div className="ord-actions">
                    <select value={o.stato} onChange={(e) => setStato(o.id, e.target.value)}>
                      {STATI.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                    <button className="adm-btn" onClick={() => setOpenId(open ? null : o.id)}>
                      {open ? 'Nascondi' : 'Dettagli'}
                    </button>
                    {tel && (
                      <a className="adm-btn" href={`https://api.whatsapp.com/send?phone=${tel}`} target="_blank" rel="noopener noreferrer">
                        WhatsApp
                      </a>
                    )}
                    <button className="adm-btn adm-btn-del" onClick={() => remove(o.id)} title="Elimina">🗑</button>
                  </div>
                </div>
              </div>

              {open && (
                <>
                  {o.riepilogo && <pre className="ord-riepilogo">{o.riepilogo}</pre>}
                  {o.note && <p className="ord-note"><strong>Note cliente:</strong> {o.note}</p>}
                  <div className="ord-lab">
                    <label>📝 Note di laboratorio <span>(interne, non visibili al cliente)</span></label>
                    <textarea
                      value={labDraft[o.id] ?? o.note_lab ?? ''}
                      placeholder="Es. allergie, scaffale, da richiamare…"
                      onChange={(e) => setLabDraft((d) => ({ ...d, [o.id]: e.target.value }))}
                    />
                    <button
                      className="adm-btn adm-btn-save"
                      onClick={() => saveLab(o.id)}
                      disabled={(labDraft[o.id] ?? o.note_lab ?? '') === (o.note_lab ?? '')}
                    >
                      {labSaved === o.id ? '✓ Salvata' : 'Salva nota'}
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
