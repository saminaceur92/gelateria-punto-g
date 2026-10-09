// Edge Function: stripe-webhook
// A pagamento INCASSATO ricompone la riga ordine dai metadata della sessione
// e la SALVA in `ordini` (stato 'da_fare'). L'inserimento fa scattare i
// trigger del database: notifica Telegram, mail di conferma, promemoria.
//
// Cosa fa, e perché:
// - Ascolta 'checkout.session.completed' e anche
//   'checkout.session.async_payment_succeeded': con i metodi differiti
//   (bonifico, SEPA…) la prima arriva quando i soldi non sono ancora
//   incassati, e l'ordine nasce solo con la seconda. Con le carte cambia niente.
// - Dai metadata prende SOLO le colonne della torta e del cliente (whitelist
//   in _shared/webhook.ts): stato, totale, sconto e campi Stripe li scrive lui.
// - Un pagamento = un ordine: vincolo unico su stripe_session_id (migrazione
//   2026-10-09-pagamenti-blindati.sql). Stripe può mandare lo stesso evento
//   due volte, anche insieme: il secondo inserimento riceve l'errore 23505,
//   cioè "già registrato", e il codice sconto non viene scalato due volte.
// - Se l'inserimento fallisce per un altro motivo, riprova con una riga
//   ridotta (contatti, importo, avviso "controlla su Stripe"); se fallisce
//   anche quella risponde 500, così Stripe ritenta più tardi e nel suo
//   pannello l'endpoint risulta in errore. Prima rispondeva 200 comunque e
//   l'ordine pagato restava solo nei log.
//
// Deploy (IMPORTANTE --no-verify-jwt: Stripe non invia un JWT Supabase):
//   supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { EVENTI_ORDINE, pagamentoIncassato, rigaDaSessione, rigaRidotta, type Sessione } from '../_shared/webhook.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const ok = () => new Response(JSON.stringify({ received: true }), {
  headers: { 'Content-Type': 'application/json' },
});

// 'salvato' | 'doppione' (23505: questo pagamento c'è già) | 'errore'
async function inserisci(riga: Record<string, unknown>): Promise<'salvato' | 'doppione' | 'errore'> {
  const { error } = await supabase.from('ordini').insert(riga);
  if (!error) return 'salvato';
  if (error.code === '23505') return 'doppione';
  console.error('Insert ordine fallito:', error.code ?? '', error.message);
  return 'errore';
}

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

  if (!EVENTI_ORDINE.includes(event.type)) return ok();
  const session = event.data.object as unknown as Sessione;

  if (!pagamentoIncassato(session)) {
    // Pagamento differito non ancora arrivato: l'ordine nasce con
    // 'checkout.session.async_payment_succeeded'.
    console.log('Pagamento non ancora incassato, si aspetta:', session.id, session.payment_status);
    return ok();
  }

  // Scorciatoia: evento già registrato. Il vincolo unico copre il caso di due
  // consegne contemporanee, che questo controllo da solo non vede.
  const { data: gia } = await supabase
    .from('ordini').select('id').eq('stripe_session_id', session.id).limit(1);
  if (Array.isArray(gia) && gia.length) {
    console.log('Evento già registrato, salto:', session.id);
    return ok();
  }

  const adesso = new Date();
  const { riga, scontoCodice, versione, avvisi } = rigaDaSessione(session, adesso);
  for (const a of avvisi) console.warn(`${a} (sessione ${session.id}, formato v${versione})`);

  let esito = await inserisci(riga);
  if (esito === 'errore') {
    esito = await inserisci(rigaRidotta(session, riga, adesso));
    if (esito === 'salvato') console.warn('Ordine salvato in forma ridotta:', session.id);
  }
  if (esito === 'doppione') {
    console.log('Evento già registrato (vincolo unico), salto:', session.id);
    return ok();
  }
  if (esito === 'errore') {
    // Stripe ritenta (in live fino a 3 giorni): col vincolo unico i tentativi
    // ripetuti non creano doppioni.
    return new Response(JSON.stringify({ error: 'Ordine non salvato: riprovare' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Il codice sconto si consuma SOLO ora: qui sappiamo che il cliente ha
  // pagato davvero. Se lo scalassimo all'apertura del pagamento, chi ci
  // ripensa brucerebbe un utilizzo per niente.
  if (scontoCodice) {
    const { error: e2 } = await supabase.rpc('consuma_sconto', { p_codice: scontoCodice });
    if (e2) console.error('Conteggio del codice sconto fallito:', e2.message);
  }
  return ok();
});
