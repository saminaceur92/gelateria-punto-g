import { useState } from 'react';
import { AuthProvider, useAuth } from './auth';
import Dashboard from './Dashboard';
import './admin.css';

/**
 * Accesso al gestionale col CODICE personale.
 *
 * Il codice non si verifica qui: si manda alla funzione `staff-login`, che sta
 * sui server di Supabase, e quella risponde aprendo la sessione. Nel browser
 * non c'è niente da aggirare, e nemmeno l'elenco dei codici.
 *
 * È rimasto anche l'ingresso con email e password, ma nascosto: serve solo
 * come porta di servizio finché la funzione non è stata pubblicata (o se un
 * giorno dovesse smettere di rispondere). Toglierlo del tutto rischierebbe di
 * chiudere fuori tutti quanti.
 */
function Login() {
  const { signIn, entraColCodice } = useAuth();
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [conEmail, setConEmail] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submitCodice = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await entraColCodice(pin.trim());
    setBusy(false);
    if (error) setError(error);
    // Se la sessione si apre, il Gate passa da solo alla dashboard.
  };

  const submitEmail = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) setError(error.message);
  };

  return (
    <div className="adm-login">
      <div className="adm-login-card">
        <div className="adm-login-brand"><strong>Punto Gi</strong><span>Area gestione</span></div>

        {!conEmail ? (
          <form onSubmit={submitCodice}>
            <h2>Il tuo codice</h2>
            <p className="adm-muted">
              Ognuno ha il suo: è quello che firma anche gli ordini che prendi al banco.
            </p>
            <input
              type="password"
              inputMode="numeric"
              required
              minLength={4}
              placeholder="••••"
              autoComplete="off"
              className="adm-pin"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
            {error && <div className="adm-error">⚠️ {error}</div>}
            <button type="submit" className="adm-btn adm-btn-primary" disabled={busy || pin.trim().length < 4}>
              {busy ? 'Attendi…' : 'Entra'}
            </button>
            <button type="button" className="adm-link" onClick={() => { setConEmail(true); setError(''); }}>
              Entra con email e password
            </button>
          </form>
        ) : (
          <form onSubmit={submitEmail}>
            <h2>Accedi</h2>
            <p className="adm-muted">Ingresso di servizio, con email e password.</p>
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <div className="adm-error">⚠️ {error}</div>}
            <button type="submit" className="adm-btn adm-btn-primary" disabled={busy}>
              {busy ? 'Attendi…' : 'Entra'}
            </button>
            <button type="button" className="adm-link" onClick={() => { setConEmail(false); setError(''); }}>
              Torna al codice
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
