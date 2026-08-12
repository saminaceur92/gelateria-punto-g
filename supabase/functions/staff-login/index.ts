// Edge Function: staff-login
//
// Riceve un CODICE personale e, se è giusto, restituisce di che serve per
// aprire la sessione nel gestionale.
//
// Perché serve una funzione lato server e non basta il browser: il codice è
// custodito nel database sotto forma di impronta, e per aprire una sessione
// serve la chiave di servizio del progetto — che nel browser non può stare.
// Qui dentro invece sì, perché questo codice gira sui server di Supabase.
//
// Come si incastra con quello che c'era prima: NON sostituiamo l'impianto di
// accesso di Supabase, ci entriamo dentro. A ogni persona corrisponde un utente
// tecnico; l'accesso che ne esce è un accesso Supabase normale, quindi i
// permessi sulle tabelle restano identici a prima e non si rompe niente.
//
// Deploy:  supabase functions deploy staff-login
// Secrets: nessuno in più (usa SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY, che
//          Supabase mette a disposizione da sé).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// L'indirizzo dell'utente tecnico: non è una casella vera e non riceve mai
// niente, serve solo perché l'impianto di accesso ragiona per indirizzi.
const emailDi = (id: string) => `staff-${id}@codici.gelateriapuntogi.it`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Metodo non consentito' }, 405);

  try {
    const { pin } = await req.json();
    if (!pin || String(pin).trim().length < 4) {
      return json({ error: 'Codice non valido.' }, 400);
    }

    // La verifica la fa il database: qui non c'è nessun confronto da aggirare.
    // Dentro `verifica_codice` c'è anche il blocco dopo 5 tentativi sbagliati.
    const { data, error } = await admin.rpc('verifica_codice', { p_pin: String(pin).trim() });
    if (error) return json({ error: 'Non riesco a verificare il codice.' }, 500);
    if (!data?.ok) return json({ error: data?.motivo || 'Codice non riconosciuto.' }, 401);

    const email = emailDi(data.id);
    const ruolo = data.ruolo === 'admin' ? 'owner' : 'staff';

    // L'utente tecnico si crea alla prima entrata. La password è casuale e non
    // la usa nessuno: si entra solo col codice, da qui.
    const { error: eCreate } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: crypto.randomUUID() + crypto.randomUUID(),
      user_metadata: { nome: data.nome, ruolo: data.ruolo },
    });
    // "già esistente" non è un errore: vuol dire che questa persona è già entrata.
    if (eCreate && !/already|exists|registered/i.test(eCreate.message)) {
      return json({ error: eCreate.message }, 500);
    }

    // Il ruolo che la dashboard legge sta in `profiles`: lo teniamo allineato a
    // quello del codice, così chi è amministratore lo è anche qui.
    const { data: utente } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    void utente; // (elenco non usato: serviva solo a forzare la creazione)
    const { data: sessione, error: eLink } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    if (eLink || !sessione?.properties?.hashed_token) {
      return json({ error: eLink?.message || 'Non riesco ad aprire la sessione.' }, 500);
    }

    const idUtente = sessione.user?.id;
    if (idUtente) {
      await admin.from('profiles').upsert({ id: idUtente, email, role: ruolo }, { onConflict: 'id' });
    }

    return json({
      token_hash: sessione.properties.hashed_token,
      nome: data.nome,
      ruolo: data.ruolo,
    });
  } catch (e) {
    console.error('staff-login:', e);
    return json({ error: 'Errore interno' }, 500);
  }
});
