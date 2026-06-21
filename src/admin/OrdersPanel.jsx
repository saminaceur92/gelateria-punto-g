import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const STATI = [
  { value: 'nuovo', label: 'Nuovo', color: '#b651e4' },
  { value: 'confermato', label: 'Confermato', color: '#2a7ad6' },
  { value: 'pronto', label: 'Pronto', color: '#eb911e' },
  { value: 'consegnato', label: 'Consegnato', color: '#46a85a' },
  { value: 'annullato', label: 'Annullato', color: '#b03a3a' },
];

const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

export default function OrdersPanel() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('tutti');
  const [openId, setOpenId] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    const { data, error } = await supabase.from('ordini').select('*').order('created_at', { ascending: false });
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
    if (!window.confirm('Eliminare questo ordine? L\'operazione non è reversibile.')) return;
    const { error } = await supabase.from('ordini').delete().eq('id', id);
    if (error) setError(error.message);
    else setOrders((os) => os.filter((o) => o.id !== id));
  }

  const shown = filter === 'tutti' ? orders : orders.filter((o) => o.stato === filter);
  const nuovi = orders.filter((o) => o.stato === 'nuovo').length;

  return (
    <section className="adm-card">
      <header className="adm-card-head">
        <div>
          <h3>Ordini torte</h3>
          <p>Le richieste arrivate dal configuratore del sito. Cambia lo stato man mano che li gestisci.</p>
        </div>
        <span className="adm-count">{orders.length} totali{nuovi ? ` · ${nuovi} nuovi` : ''}</span>
      </header>

      <div className="ord-filters">
        <button className={filter === 'tutti' ? 'active' : ''} onClick={() => setFilter('tutti')}>Tutti</button>
        {STATI.map((s) => (
          <button key={s.value} className={filter === s.value ? 'active' : ''} onClick={() => setFilter(s.value)}>
            {s.label}
          </button>
        ))}
        <button className="ord-reload" onClick={load} title="Aggiorna">↻</button>
      </div>

      {error && <div className="adm-error">⚠️ {error}</div>}
      {loading && <div className="adm-muted">Caricamento…</div>}
      {!loading && shown.length === 0 && <div className="adm-muted">Nessun ordine{filter !== 'tutti' ? ' con questo stato' : ' ancora'}.</div>}

      <div className="ord-list">
        {shown.map((o) => {
          const stato = STATI.find((s) => s.value === o.stato) || STATI[0];
          const open = openId === o.id;
          const tel = (o.cliente_telefono || '').replace(/\D/g, '');
          return (
            <div key={o.id} className="ord-card">
              <div className="ord-top">
                <div className="ord-who">
                  <strong>{o.cliente_nome || 'Senza nome'}</strong>
                  <span className="ord-meta">{o.tipo || 'Torta'} · €{Number(o.totale || 0).toFixed(2)}</span>
                </div>
                <span className="ord-badge" style={{ background: stato.color }}>{stato.label}</span>
              </div>

              <div className="ord-info">
                <span>📅 {fmtDate(o.created_at)}</span>
                {o.cliente_telefono && <span>📞 {o.cliente_telefono}</span>}
                {o.ritiro_data && <span>🛍️ ritiro {o.ritiro_data}</span>}
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
