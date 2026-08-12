import { useState } from 'react';
import { AuthProvider, useAuth } from './auth';
import Dashboard from './Dashboard';
import './admin.css';

/**
 * Accesso al gestionale col CODICE personale — l'unico modo di entrare.
 *
 * Il codice non si verifica qui: si manda alla funzione `staff-login`, che sta
 * sui server di Supabase, e quella risponde aprendo la sessione. Nel browser
 * non c'è niente da aggirare, e nemmeno l'elenco dei codici.
 *
 * C'era anche un ingresso di servizio con email e password: serviva finché la
 * funzione non era pubblicata. Ora che lo è — e che la catena codice → sessione
 * è stata provata da capo a fondo — è stato tolto: due porte per la stessa
 * stanza sono una porta di troppo da sorvegliare.
 *
 * Se un giorno `staff-login` smettesse di rispondere e nessuno riuscisse più a
 * entrare, la via di rientro è ripristinare questo file dalla cronologia di git
 * (commit precedente a questo) e ripubblicare: due minuti.
 */
function Login() {
  const { entraColCodice } = useAuth();
  const [pin, setPin] = useState('');
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

  return (
    <div className="adm-login">
      <div className="adm-login-card">
        <div className="adm-login-brand"><strong>Punto Gi</strong><span>Area gestione</span></div>

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
