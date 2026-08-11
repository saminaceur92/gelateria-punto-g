import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logAction } from '../lib/log';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sessione corrente + ascolto dei cambi (login/logout)
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // Registra l'accesso effettivo (non i refresh del token). Il debounce
      // lato DB evita doppioni ravvicinati.
      if (event === 'SIGNED_IN') {
        logAction('Accesso effettuato');
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Dipendiamo dall'ID utente (stabile), non dall'oggetto session: così il
  // refresh periodico del token (es. tornando sul tab) NON rimonta la dashboard.
  const userId = session?.user?.id || null;

  // Carica il profilo (per sapere se è "owner")
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!supabase || !userId) {
        if (alive) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('role, email')
        .eq('id', userId)
        .maybeSingle();
      if (alive) {
        setProfile(data);
        setLoading(false);
      }
    }
    setLoading(true);
    load();
    return () => {
      alive = false;
    };
  }, [userId]);

  const value = {
    configured: !!supabase,
    loading,
    session,
    user: session?.user || null,
    profile,
    isOwner: profile?.role === 'owner',
    isStaff: profile?.role === 'owner' || profile?.role === 'staff',
    // Ingresso col CODICE personale: il codice va alla funzione `staff-login`
    // (sui server di Supabase), che lo verifica e risponde con un lasciapassare
    // usa e getta. Da lì in poi la sessione è una sessione Supabase normale,
    // quindi i permessi sulle tabelle restano quelli di prima.
    entraColCodice: async (pin) => {
      if (!supabase) return { error: 'Configurazione mancante.' };
      const { data, error } = await supabase.functions.invoke('staff-login', { body: { pin } });
      if (error) {
        // Il messaggio del server (es. "Codice non riconosciuto") arriva nel
        // corpo della risposta: senza questo si vedrebbe solo "Edge Function
        // returned a non-2xx status code", che non dice niente a nessuno.
        let msg = 'Non riesco a verificare il codice.';
        try { msg = (await error.context?.json())?.error || msg; } catch { /* no-op */ }
        return { error: msg };
      }
      if (!data?.token_hash) return { error: data?.error || 'Codice non riconosciuto.' };
      const { error: e2 } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: 'magiclink',
      });
      if (e2) return { error: e2.message };
      logAction('Accesso col codice', data.nome || null);
      return { error: null };
    },
    // Ingresso di servizio con email + password (vedi Admin.jsx).
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
