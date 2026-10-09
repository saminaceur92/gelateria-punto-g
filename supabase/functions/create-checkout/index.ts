// Edge Function: create-checkout
// Riceve la configurazione della torta scelta sul sito, la CONTROLLA contro il
// listino vero, ricalcola il prezzo, scrive la riga ordine (riepilogo per il
// laboratorio, mail di conferma, dettagli) e apre una Stripe Checkout Session
// con la riga nei metadata. L'ordine lo salva il webhook SOLO a pagamento
// avvenuto (stato 'da_fare' → lavorazione + trigger Telegram e mail).
//
// Dal browser si prende solo la configurazione: prezzo, riepilogo e mail li
// scrive il server da ciò che viene davvero pagato. Della vecchia riga
// `insert` che il sito manda ancora si usano solo gli URL delle foto già
// caricate su Storage (controllati) e "ho mostrato l'avviso dei promemoria".
//
// Risposte per il sito (catch del pagamento in CakeConfigurator.jsx):
//   200 { url }                                  → si va su Stripe
//   409/422/400 { error, codice, campo, voce }    → scelta da rifare: il sito
//        rilegge il listino e riporta al passo `campo` (OrdineRifiutato)
//   503 { error, codice: 'listino_non_disponibile' } → riprovare fra poco
//   500 { error }                                → guasto (dettaglio nei log)
//
// Deploy:  supabase functions deploy create-checkout
// Secrets: STRIPE_SECRET_KEY, SITE_URL
//          PUBLIC_SUPABASE_URL (facoltativo): l'indirizzo del progetto come lo
//          vede il SITO, se un giorno non coincidesse più con SUPABASE_URL
//          (dominio personalizzato, prove in locale). Serve a riconoscere gli
//          URL delle foto caricate dal sito.
import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { computeOrder } from '../_shared/price.ts';
import { ListinoNonDisponibile } from '../_shared/listino.ts';
import { OrdineRifiutato } from '../_shared/valida.ts';
import { avvisoPromemoriaDalBrowser, fotoDalBrowser, rigaOrdine } from '../_shared/ordine.ts';
import { metadatiOrdine, TroppoTestoPerStripe } from '../_shared/metadati.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  httpClient: Stripe.createFetchHttpClient(),
});
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);
const BASI_FOTO = [Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('PUBLIC_SUPABASE_URL') ?? ''];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Metodo non consentito' }, 405);

  let body: { config?: unknown; insert?: unknown } | null = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const config = body?.config;
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return json({ error: 'Dati ordine incompleti', codice: 'dati_incompleti', campo: 'details' }, 400);
  }

  try {
    // Controllo + prezzo + sconto: tutto PRIMA di parlare con Stripe, così
    // una torta "impossibile" non apre nemmeno una sessione di pagamento.
    const ordine = await computeOrder(supabase, config);
    if (ordine.amountCents < 50) return json({ error: 'Importo non valido' }, 400);

    const riga = rigaOrdine(ordine.validato, ordine.prezzo, ordine.sconto, ordine.totale, {
      foto: fotoDalBrowser(body?.insert, BASI_FOTO),
      promemoriaAvviso: avvisoPromemoriaDalBrowser(body?.insert, config),
    });
    const metadata = metadatiOrdine(riga, ordine.amountCents, ordine.sconto);

    const siteUrl = Deno.env.get('SITE_URL') ?? '';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'it',
      customer_email: String(ordine.validato.canon.email || '') || undefined,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: ordine.amountCents,
          product_data: {
            name: 'Torta personalizzata — Gelateria Punto Gi',
            description: ordine.summary || undefined,
          },
        },
      }],
      metadata,
      success_url: `${siteUrl}/?pagamento=ok`,
      cancel_url: `${siteUrl}/?pagamento=annullato`,
    });

    return json({ url: session.url });
  } catch (e) {
    // Una scelta che non va (listino cambiato mentre il cliente sceglieva, o
    // una richiesta manomessa): risposta riconoscibile, non è un guasto. Nei
    // log solo cosa e dove, mai i dati del cliente.
    if (e instanceof OrdineRifiutato) {
      console.warn('ordine rifiutato:', e.codice, e.campo, e.voce ?? '');
      return json({ error: e.message, codice: e.codice, campo: e.campo, voce: e.voce }, e.status);
    }
    if (e instanceof TroppoTestoPerStripe) {
      console.warn('ordine rifiutato: troppo testo per i metadata Stripe');
      return json({ error: e.message, codice: 'scelta_non_valida', campo: 'details', voce: null }, 422);
    }
    if (e instanceof ListinoNonDisponibile) {
      console.error('listino non disponibile:', e.message);
      return json({
        error: 'Non riusciamo a leggere il listino adesso: riprova tra un minuto.',
        codice: 'listino_non_disponibile',
      }, 503);
    }
    // Errori di Stripe o imprevisti: il dettaglio tecnico solo nei log.
    console.error('create-checkout error:', e);
    return json({ error: 'Non siamo riusciti ad aprire il pagamento. Riprova tra poco; se succede ancora, chiamaci.' }, 500);
  }
});
