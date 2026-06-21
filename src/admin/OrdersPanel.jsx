import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const STATI = [
  { value: 'nuovo', label: 'Nuovo', color: '#b651e4' },
  { value: 'confermato', label: 'Confermato', color: '#2a7ad6' },
  { value: 'pronto', label: 'Pronto', color: '#eb911e' },
  { value: 'consegnato', label: 'Consegnato', color: '#46a85a' },
  { value: 'annullato', label: 'Annullato', color: '#b03a3a' },
];
const ATTIVI = ['nuovo', 'confermato', 'pronto'];

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

export default function OrdersPanel() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('da_fare');
  const [sortBy, setSortBy] = useState('ritiro');
  const [openId, setOpenId] = useState(null);

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
    if (error) setError(error.message);
    else setOrders((os) => os.map((o) => (o.id === id ? { ...o, stato } : o)));
  }

  async function remove(id) {
    if (!window.confirm("Eliminare questo ordine? L'operazione non è reversibile.")) return;
    const { error } = await supabase.from('ordini').delete().eq('id', id);
    if (error) setError(error.message);
    else setOrders((os) => os.filter((o) => o.id !== id));
  }

  // Filtro
  let shown = orders;
  if (filter === 'da_fare') shown = orders.filter((o) => ATTIVI.includes(o.stato));
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

  const daFare = orders.filter((o) => ATTIVI.includes(o.stato)).length;

  return (
    <section className="adm-card">
      <header className="adm-card-head">
        <div>
          <h3>Ordini torte</h3>
          <p>Richieste dal sito, ordinate per priorità (ritiro più vicino in cima). Aggiorna lo stato man mano che le prepari.</p>
        </div>
        <span className="adm-count">{daFare} da fare · {orders.length} totali</span>
      </header>

      <div className="ord-filters">
        <button className={filter === 'da_fare' ? 'active' : ''} onClick={() => setFilter('da_fare')}>Da fare</button>
        <button className={filter === 'tutti' ? 'active' : ''} onClick={() => setFilter('tutti')}>Tutti</button>
        {STATI.map((s) => (
          <button key={s.value} className={filter === s.value ? 'active' : ''} onClick={() => setFilter(s.value)}>
            {s.label}
          </button>
        ))}
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
          const attivo = ATTIVI.includes(o.stato);
          const urg = attivo ? urgency(o.ritiro_data) : null;
          const gusti = Array.isArray(o.dettagli?.flavors) ? o.dettagli.flavors.map((f) => f.name).filter(Boolean).join(', ') : '';
          const accent = urg && urg.level >= 2 ? 'urgente' : urg && urg.level === 1 ? 'presto' : '';

          return (
            <div key={o.id} className={`ord-card ${accent}`}>
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

              {open && (
                <>
                  {o.riepilogo && <pre className="ord-riepilogo">{o.riepilogo}</pre>}
                  {o.note && <p className="ord-note"><strong>Note:</strong> {o.note}</p>}
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
