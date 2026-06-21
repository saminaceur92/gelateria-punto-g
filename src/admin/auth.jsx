import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

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
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Carica il profilo (per sapere se è "owner")
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!supabase || !session?.user) {
        if (alive) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('role, email')
        .eq('id', session.user.id)
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
  }, [session]);

  const value = {
    configured: !!supabase,
    loading,
    session,
    user: session?.user || null,
    profile,
    isOwner: profile?.role === 'owner',
    // Login classico con email + password
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signUp: (email, password) => supabase.auth.signUp({ email, password }),
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
