// Edge Function: stripe-webhook
// Su 'checkout.session.completed' ricompone la riga ordine dai metadata e la
// SALVA in `ordini` (stato 'da_fare'). L'inserimento fa scattare il trigger DB
// che notifica la gelateria su Telegram. L'email di conferma la manda il client
// al ritorno sul sito (EmailJS lato browser).
//
// Deploy (IMPORTANTE --no-verify-jwt: Stripe non invia un JWT Supabase):
//   supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();
  if (!signature) return new Response('Firma mancante', { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
      undefined,
      cryptoProvider,
    );
  } catch (e) {
    console.error('Verifica firma webhook fallita:', (e as Error).message);
    return new Response(`Webhook error: ${(e as Error).message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    // Ricompone la riga ordine dai metadata (pezzi d0, d1, …)
    const md = session.metadata || {};
    const n = parseInt(md.chunks || '0', 10);
    let payload = '';
    for (let i = 0; i < n; i++) payload += md['d' + i] || '';
    let insert: Record<string, unknown> = {};
    try { insert = JSON.parse(payload); } catch { insert = {}; }

    // Sconto: vale quello DECISO DAL SERVER quando ha preparato il pagamento,
    // non quello che il browser aveva messo nella riga ordine.
    const scontoCodice = md.sconto_codice || null;
    const scontoEuro = md.sconto_euro ? Number(md.sconto_euro) : 0;

    // Salva l'ordine PAGATO come 'da_fare' → trigger DB notifica Telegram
    const row = {
      ...insert,
      stato: 'da_fare',
      totale: (session.amount_total ?? 0) / 100,
      sconto_codice: scontoCodice,
      sconto_euro: scontoEuro || null,
      stripe_session_id: session.id,
      stripe_payment_intent: (session.payment_intent as string) ?? null,
      pagato_il: new Date().toISOString(),
    };

    // Stripe può rimandare lo stesso evento più di una volta: senza questo
    // controllo nascerebbe un ordine doppio (e il codice sconto verrebbe
    // scalato due volte).
    const { data: gia } = await supabase
      .from('ordini').select('id').eq('stripe_session_id', session.id).maybeSingle();
    if (gia) {
      console.log('Evento già registrato, salto:', session.id);
      return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { error } = await supabase.from('ordini').insert(row);
    if (error) console.error('Insert ordine fallito:', error.message);

    // Il codice sconto si consuma SOLO ora: qui sappiamo che il cliente ha
    // pagato davvero. Se lo scalassimo all'apertura del pagamento, chi ci
    // ripensa brucerebbe un utilizzo per niente.
    if (!error && scontoCodice) {
      const { error: e2 } = await supabase.rpc('consuma_sconto', { p_codice: scontoCodice });
      if (e2) console.error('Conteggio del codice sconto fallito:', e2.message);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
