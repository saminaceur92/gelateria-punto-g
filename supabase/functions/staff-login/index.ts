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

    const { data: sessione, error: eLink } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    if (eLink || !sessione?.properties?.hashed_token) {
      return json({ error: eLink?.message || 'Non riesco ad aprire la sessione.' }, 500);
    }

    // Il ruolo che la dashboard legge sta in `profiles`: lo teniamo allineato a
    // quello del codice, così chi è amministratore lo è anche qui.
    //
    // ⚠️ Da qui in poi si controlla tutto, e c'è un motivo preciso: quando
    // questo pezzo falliva in silenzio, il profilo restava quello creato dal
    // trigger (`customer`), la sessione si apriva lo stesso e la persona
    // arrivava in dashboard per trovarsi scritto "non sei abilitato alla
    // gestione" con un codice giusto. Un errore che si presenta come un
    // permesso mancante è la cosa più lunga da capire che ci sia: meglio
    // fallire qui, dicendo cosa è successo.
    const idUtente = sessione.user?.id;
    if (!idUtente) {
      return json({ error: 'Sessione aperta ma utente non identificato. Riprova.' }, 500);
    }

    const { error: eProfilo } = await admin
      .from('profiles')
      .upsert({ id: idUtente, email, role: ruolo }, { onConflict: 'id' });
    if (eProfilo) {
      return json(
        {
          error:
            'Codice giusto, ma non riesco a registrare i tuoi permessi. ' +
            'Fallo sapere a chi gestisce il sito: ' + eProfilo.message,
        },
        500,
      );
    }

    // Ultima rete: rileggiamo il ruolo appena scritto. Se il database avesse
    // accettato la scrittura ma conservato un valore diverso (è successo: il
    // vincolo su `profiles.role` non ammetteva tutti i ruoli previsti qui),
    // è meglio accorgersene adesso che lasciar entrare qualcuno in un limbo.
    const { data: verifica } = await admin
      .from('profiles')
      .select('role')
      .eq('id', idUtente)
      .maybeSingle();
    if (verifica && verifica.role !== ruolo) {
      return json(
        {
          error:
            `Permessi non registrati: risulti "${verifica.role}" invece di "${ruolo}". ` +
            'Fallo sapere a chi gestisce il sito.',
        },
        500,
      );
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
