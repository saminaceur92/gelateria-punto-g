import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const fmt = (v) => {
  try {
    return new Date(v).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return v;
  }
};

// Gestione accessi (ruolo "owner"/titolare) + storico attività dei dipendenti.
export default function StaffPanel() {
  const [list, setList] = useState([]);
  const [activity, setActivity] = useState([]);
  const [who, setWho] = useState('tutti');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  async function load() {
    setError('');
    const [{ data: l, error: e1 }, { data: a, error: e2 }] = await Promise.all([
      supabase.rpc('staff_list'),
      supabase.rpc('staff_activity', { p_limit: 200 }),
    ]);
    if (e1) setError(e1.message);
    else setList(l || []);
    if (e2) setError((p) => p || e2.message);
    else setActivity(a || []);
    setLoaded(true);
  }
  useEffect(() => {
    load();
  }, []);

  async function add(e) {
    e.preventDefault();
    const em = email.trim();
    if (!em) return;
    setBusy(true);
    setError('');
    const { error } = await supabase.rpc('staff_add', { p_email: em, p_role: role });
    if (error) setError(error.message);
    else {
      setEmail('');
      setRole('staff');
      await load();
    }
    setBusy(false);
  }

  async function remove(em) {
    if (!window.confirm(`Revocare l'accesso a ${em}? Non potrà più entrare nella dashboard.`)) return;
    setBusy(true);
    setError('');
    const { error } = await supabase.rpc('staff_remove', { p_email: em });
    if (error) setError(error.message);
    else await load();
    setBusy(false);
  }

  const emails = [...new Set(activity.map((a) => a.user_email).filter(Boolean))];
  const shownActivity = activity.filter((a) => who === 'tutti' || a.user_email === who);

  return (
    <section className="adm-card">
      <header className="adm-card-head">
        <div>
          <h3>Accessi staff</h3>
          <p>
            Chi può entrare nella gestione. Aggiungi l'email e scegli il ruolo (dipendente o co-titolare):
            poi la persona apre <code>/admin</code>, sceglie "Crea il tuo account" con <strong>quella stessa email</strong>
            e una password, e potrà accedere. Solo i <strong>co-titolari</strong> vedono questa scheda.
          </p>
        </div>
        <span className="adm-count">{list.length} abilitati</span>
      </header>

      {error && <div className="adm-error">⚠️ {error}</div>}

      <form className="staff-add" onSubmit={add}>
        <input
          type="email"
          placeholder="email@esempio.it"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <select className="staff-role-select" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="staff">Dipendente</option>
          <option value="owner">Co-titolare</option>
        </select>
        <button type="submit" className="adm-btn adm-btn-primary" disabled={busy}>+ Abilita</button>
      </form>

      {!loaded && <div className="adm-muted">Caricamento…</div>}

      <div className="staff-list">
        {list.map((s) => (
          <div key={s.email} className="staff-row">
            <span className="staff-email">
              {s.email}
              {s.e_tu && <em className="staff-you"> (tu)</em>}
            </span>
            <span className={`staff-rolechip ${s.role === 'owner' ? 'owner' : ''}`}>
              {s.role === 'owner' ? '👑 Co-titolare' : 'Dipendente'}
            </span>
            <span className={`staff-badge ${s.registrato ? 'on' : ''}`}>
              {s.registrato ? '✓ Account attivo' : '⏳ In attesa di registrazione'}
            </span>
            {!s.e_tu && (
              <button type="button" className="adm-btn adm-btn-del" onClick={() => remove(s.email)} disabled={busy}>
                Revoca
              </button>
            )}
          </div>
        ))}
      </div>

      {/* ───── Storico attività ───── */}
      <header className="adm-card-head staff-storico-head">
        <div>
          <h3>Storico attività</h3>
          <p>Cosa fa ogni persona: accessi, torte create, ordini spostati o eliminati. (Ultime 200 azioni.)</p>
        </div>
        {emails.length > 0 && (
          <select className="staff-filter" value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="tutti">Tutti</option>
            {emails.map((em) => (
              <option key={em} value={em}>{em}</option>
            ))}
          </select>
        )}
      </header>

      {shownActivity.length === 0 ? (
        <div className="adm-muted">Nessuna attività registrata{who !== 'tutti' ? ' per questa persona' : ''}.</div>
      ) : (
        <ul className="log-list">
          {shownActivity.map((a, i) => (
            <li key={i} className="log-row">
              <span className="log-when">{fmt(a.created_at)}</span>
              <span className="log-who">{a.user_email}</span>
              <span className="log-act">
                <strong>{a.action}</strong>{a.dettagli ? ` — ${a.dettagli}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
