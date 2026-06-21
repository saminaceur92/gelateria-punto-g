import { createClient } from '@supabase/supabase-js';

// Chiavi pubbliche (sicure nel browser, protette dalla RLS).
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY;

// Se le variabili non sono impostate, supabase resta null e la dashboard
// mostra un messaggio di configurazione invece di rompersi.
export const supabase = url && key ? createClient(url, key) : null;
