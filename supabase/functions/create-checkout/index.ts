// Edge Function: create-checkout
// Riceve la configurazione + la riga ordine (già costruita dal client, senza
// immagine). Ricalcola il prezzo LATO SERVER, apre una Stripe Checkout Session
// e mette la riga ordine nei metadata. L'ordine viene salvato dal webhook SOLO
// a pagamento avvenuto (stato 'da_fare' → workflow esistente + trigger Telegram).
//
// Deploy:  supabase functions deploy create-checkout
// Secrets: STRIPE_SECRET_KEY, SITE_URL
import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { computeOrder, type CakeConfig } from '../_shared/price.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  httpClient: Stripe.createFetchHttpClient(),
});
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Metodo non consentito' }, 405);

  try {
    // La config arriva tale e quale dal configuratore e finisce intera in
    // computeOrder: `decorations` (array di id) e `decorationColors` (mappa
    // id → colore) restano array e oggetto dopo il JSON.parse, quindi non serve
    // ricostruirli. Chi valida cosa: qui si controlla solo che l'ordine abbia il
    // minimo indispensabile, mentre le decorazioni (doppioni, id sconosciuti,
    // liste troppo lunghe, campi vecchi decoration/decorationColor) le ripulisce
    // computeOrder, che è l'unico a decidere il prezzo.
    const { config, insert } = (await req.json()) as {
      config: CakeConfig & Record<string, unknown>;
      insert: Record<string, unknown>;
    };

    if (
      !config?.type ||
      !Array.isArray(config.flavors) || config.flavors.length < 1 ||
      !insert || !insert.cliente_nome || !insert.cliente_telefono
    ) {
      return json({ error: 'Dati ordine incompleti' }, 400);
    }

    const { amountCents, summary, sconto, scontoCodice } = await computeOrder(supabase, config);
    if (amountCents <= 0) return json({ error: 'Importo non valido' }, 400);

    // La riga ordine (senza immagine) va nei metadata, a pezzi da <500 char.
    const payload = JSON.stringify(insert);
    const metadata: Record<string, string> = { chunks: String(Math.ceil(payload.length / 450)) };
    // Lo sconto DAVVERO applicato viaggia a parte: il webhook lo scrive
    // sull'ordine e scala il contatore del codice solo a pagamento avvenuto.
    if (scontoCodice && sconto > 0) {
      metadata.sconto_codice = scontoCodice;
      metadata.sconto_euro = sconto.toFixed(2);
    }
    for (let i = 0, k = 0; i < payload.length; i += 450, k++) {
      metadata['d' + k] = payload.slice(i, i + 450);
    }

    const siteUrl = Deno.env.get('SITE_URL') ?? '';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'it',
      customer_email: (config.email as string) || undefined,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: amountCents,
          product_data: {
            name: 'Torta personalizzata — Gelateria Punto Gi',
            description: summary || undefined,
          },
        },
      }],
      metadata,
      success_url: `${siteUrl}/?pagamento=ok`,
      cancel_url: `${siteUrl}/?pagamento=annullato`,
    });

    return json({ url: session.url });
  } catch (e) {
    console.error('create-checkout error:', e);
    return json({ error: (e as Error)?.message ?? 'Errore interno' }, 500);
  }
});
