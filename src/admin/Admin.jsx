import { useState } from 'react';
import { AuthProvider, useAuth } from './auth';
import Dashboard from './Dashboard';
import './admin.css';

function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('in'); // 'in' = accedi, 'up' = crea account
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    const fn = mode === 'up' ? signUp : signIn;
    const { data, error } = await fn(email.trim(), password);
    setBusy(false);
    if (error) {
      setError(error.message);
    } else if (mode === 'up' && !data.session) {
      // Email di conferma attiva: avvisa (consigliato disattivarla, vedi guida)
      setInfo('Account creato. Se richiesto, conferma la mail; poi accedi.');
      setMode('in');
    }
    // Se c'è la sessione, il Gate passa automaticamente alla dashboard.
  };

  return (
    <div className="adm-login">
      <div className="adm-login-card">
        <div className="adm-login-brand"><strong>Punto Gi</strong><span>Area gestione</span></div>
        <form onSubmit={submit}>
          <h2>{mode === 'up' ? 'Crea account' : 'Accedi'}</h2>
          <p className="adm-muted">
            {mode === 'up' ? 'Scegli una password per il tuo account proprietario.' : 'Entra con email e password.'}
          </p>
          <input
            type="email"
            required
            placeholder="latua@email.com"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <div className="adm-error">⚠️ {error}</div>}
          {info && <div className="adm-info">✅ {info}</div>}
          <button type="submit" className="adm-btn adm-btn-primary" disabled={busy}>
            {busy ? 'Attendi…' : mode === 'up' ? 'Crea account' : 'Entra'}
          </button>
          <button
            type="button"
            className="adm-link"
            onClick={() => { setMode(mode === 'up' ? 'in' : 'up'); setError(''); setInfo(''); }}
          >
            {mode === 'up' ? 'Hai già un account? Accedi' : 'Prima volta? Crea il tuo account'}
          </button>
        </form>
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
  const { configured, loading, session, isStaff } = useAuth();
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
  if (!isStaff) return <NotAuthorized />;
  return <Dashboard />;
}

export default function Admin() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
