import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Gestione accessi: chi può entrare nella dashboard (ruolo "owner").
export default function StaffPanel() {
  const [list, setList] = useState([]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  async function load() {
    setError('');
    const { data, error } = await supabase.rpc('staff_list');
    if (error) setError(error.message);
    else setList(data || []);
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
    const { error } = await supabase.rpc('staff_add', { p_email: em });
    if (error) setError(error.message);
    else {
      setEmail('');
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

  return (
    <section className="adm-card">
      <header className="adm-card-head">
        <div>
          <h3>Accessi staff</h3>
          <p>
            Chi può entrare nella gestione. Aggiungi l'email del dipendente: poi lui apre <code>/admin</code>,
            sceglie "Crea il tuo account" con <strong>quella stessa email</strong> e una password, e potrà accedere.
          </p>
        </div>
        <span className="adm-count">{list.length} abilitati</span>
      </header>

      {error && <div className="adm-error">⚠️ {error}</div>}

      <form className="staff-add" onSubmit={add}>
        <input
          type="email"
          placeholder="email.dipendente@esempio.it"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
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
    </section>
  );
}
