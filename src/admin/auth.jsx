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
    // Login classico con email + password
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signUp: (email, password) => supabase.auth.signUp({ email, password }),
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
