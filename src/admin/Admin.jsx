import { useState } from 'react';
import { AuthProvider, useAuth } from './auth';
import Dashboard from './Dashboard';
import './admin.css';

function Login() {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await signInWithEmail(email.trim());
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <div className="adm-login">
      <div className="adm-login-card">
        <div className="adm-login-brand"><strong>Punto G!</strong><span>Area gestione</span></div>
        {sent ? (
          <div className="adm-login-sent">
            <h2>Controlla la tua email 📧</h2>
            <p>Ti abbiamo inviato un link di accesso a <strong>{email}</strong>. Aprilo da questo dispositivo per entrare.</p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h2>Accedi</h2>
            <p className="adm-muted">Inserisci la tua email: ti mandiamo un link per entrare, senza password.</p>
            <input
              type="email"
              required
              placeholder="latua@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && <div className="adm-error">⚠️ {error}</div>}
            <button type="submit" className="adm-btn adm-btn-primary" disabled={busy}>
              {busy ? 'Invio…' : 'Invia link di accesso'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function NotAuthorized() {
  const { user, signOut } = useAuth();
  return (
    <div className="adm-login">
      <div className="adm-login-card">
        <h2>Accesso non autorizzato</h2>
        <p>L'account <strong>{user?.email}</strong> non è abilitato alla gestione. Contatta l'amministratore del sito.</p>
        <button className="adm-btn" onClick={signOut}>Esci</button>
      </div>
    </div>
  );
}

function Gate() {
  const { configured, loading, session, isOwner } = useAuth();
  if (!configured) {
    return (
      <div className="adm-login">
        <div className="adm-login-card">
          <h2>Configurazione mancante</h2>
          <p>Le variabili <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_KEY</code> non sono impostate.</p>
        </div>
      </div>
    );
  }
  if (loading) return <div className="adm-splash">Caricamento…</div>;
  if (!session) return <Login />;
  if (!isOwner) return <NotAuthorized />;
  return <Dashboard />;
}

export default function Admin() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
