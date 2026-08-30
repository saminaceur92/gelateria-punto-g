-- ============================================================
-- Rifiniture dopo il batch di fine agosto — 2026-08-30
-- Da eseguire su Supabase (SQL Editor), DOPO le migrazioni del 29-08.
-- È idempotente: rieseguirla non fa danni.
--
-- Vengono dalla revisione del codice del 29-08:
--   1. le gemelle vegetali della panna (id "-veg") prendono ESATTAMENTE il
--      posto della voce con latte: stesso `ordine` (prima era +1, che poteva
--      finire alla pari con la voce dopo e cambiare posto da un caricamento
--      all'altro) e stessa foto di esempio per le coperture (prima non era
--      copiata: chi sceglieva la panna vegetale non aveva il link "clicca qui
--      per vedere un'immagine");
--   2. nella notifica Telegram con le foto, nome del cliente e nome del file
--      vengono accorciati: la didascalia di Telegram ha un massimo di 1024
--      caratteri e con un nome lunghissimo la foto veniva scartata in
--      silenzio. E il commento sull'ordine "prima il testo, poi le foto" dice
--      la verità: è probabile, non garantito.
-- ============================================================

-- ── 1. Gemelle vegetali: stesso posto e stessa foto dell'originale ──
-- Si copia solo `foto` (il link pubblico), NON `foto_path`: quel campo serve
-- alla dashboard per cancellare il file quando la foto viene cambiata, e se
-- fosse lo stesso sulle due righe, cambiare la foto di una cancellerebbe il
-- file anche all'altra.
update public.coperture as v
   set ordine = c.ordine,
       foto   = coalesce(v.foto, c.foto)
  from public.coperture as c
 where v.id = c.id || '-veg';

update public.decorazioni as v
   set ordine = d.ordine
  from public.decorazioni as d
 where v.id = d.id || '-veg';

-- ── 2. Telegram: didascalie entro il limite ─────────────────
-- Stessa funzione della migrazione 2026-08-29-foto-telegram-e-locale.sql, con
-- il nome del cliente a massimo 120 caratteri e il nome del file a 60.
create or replace function public.telegram_foto_ordine()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  v_token text; v_chat text; v_url_cialda text; v_url_torta text;
  v_nome text; v_slug text; v_caption text;
begin
  v_url_cialda := nullif(new.dettagli->>'fotoCialdaUrl', '');
  v_url_torta := coalesce(
    nullif(new.dettagli->>'tortaConfigurataUrl', ''),
    case when new.immagine ~* '^https?://' then new.immagine else null end
  );
  if (v_url_cialda is null or v_url_cialda !~* '^https?://')
     and (v_url_torta is null or v_url_torta !~* '^https?://') then
    return new;
  end if;

  select value into v_token from public.app_config where key = 'telegram_bot_token';
  select value into v_chat  from public.app_config where key = 'telegram_chat_id';
  if coalesce(v_token, '') = '' or coalesce(v_chat, '') = '' then return new; end if;

  -- Accorciato: la didascalia di Telegram ha un massimo di 1024 caratteri e
  -- oltre quel limite la foto viene scartata senza errori.
  v_nome := left(coalesce(nullif(btrim(new.cliente_nome), ''), 'cliente'), 120);

  -- Prepara la didascalia della foto cialda.
  if v_url_cialda ~* '^https?://' then
    begin
      v_slug := btrim(regexp_replace(lower(unaccent(v_nome)), '[^a-z0-9]+', '-', 'g'), '-');
    exception when others then
      v_slug := btrim(regexp_replace(lower(v_nome), '[^a-z0-9]+', '-', 'g'), '-');
    end;
    v_slug := left(coalesce(nullif(v_slug, ''), 'cliente'), 60);
    v_caption := '📸 Foto per la cialda — ' || v_nome
              || E'\n⬇️ Scarica la foto per la cialda: '
              || v_url_cialda
              || case when position('?' in v_url_cialda) > 0 then '&' else '?' end
              || 'download=foto-cialda-' || v_slug || '.jpg';
  end if;

  -- Se ci sono entrambe, un unico album Telegram garantisce che non se ne
  -- perda una tra due richieste asincrone separate.
  if v_url_cialda ~* '^https?://' and v_url_torta ~* '^https?://' then
    begin
      perform net.http_post(
        url  := 'https://api.telegram.org/bot' || v_token || '/sendMediaGroup',
        body := jsonb_build_object(
          'chat_id', v_chat,
          'media', jsonb_build_array(
            jsonb_build_object('type', 'photo', 'media', v_url_cialda, 'caption', v_caption),
            jsonb_build_object('type', 'photo', 'media', v_url_torta, 'caption', '🎂 Torta configurata — ' || v_nome)
          )
        ),
        timeout_milliseconds := 20000
      );
    exception when others then
      null;
    end;
    return new;
  end if;

  -- Ripiego: se esiste una sola immagine, invia comunque quella.
  if v_url_cialda ~* '^https?://' then
    begin
      perform net.http_post(
        url  := 'https://api.telegram.org/bot' || v_token || '/sendPhoto',
        body := jsonb_build_object('chat_id', v_chat, 'photo', v_url_cialda, 'caption', v_caption),
        timeout_milliseconds := 20000
      );
    exception when others then null;
    end;
  elsif v_url_torta ~* '^https?://' then
    begin
      perform net.http_post(
        url  := 'https://api.telegram.org/bot' || v_token || '/sendPhoto',
        body := jsonb_build_object(
          'chat_id', v_chat,
          'photo', v_url_torta,
          'caption', '🎂 Torta configurata — ' || v_nome
        ),
        timeout_milliseconds := 20000
      );
    exception when others then null;
    end;
  end if;

  return new;
exception when others then
  return new;  -- le foto sono un di più: l'ordine si salva comunque
end $$;

-- Il trigger resta quello del 29-08 (`zz_telegram_foto_ordine_trg`). Il
-- prefisso "zz_" lo fa scattare dopo quello del testo, ma le richieste a
-- Telegram sono asincrone (pg_net): di norma prima arriva il riepilogo e poi
-- le foto, non è una garanzia. Va bene così: le foto hanno la loro didascalia
-- col nome del cliente e si capiscono anche da sole.

-- ── Controllo finale ─────────────────────────────────────────
-- Prime 6 righe: le gemelle, con lo stesso `ordine` dell'originale (e per le
-- coperture la stessa foto). Ultima riga: la funzione accorcia davvero.
select 'copertura' as tipo, v.id, v.ordine, c.ordine as ordine_originale,
       case when v.foto is not distinct from c.foto then 'stessa foto' else 'foto diversa' end as foto
  from public.coperture v join public.coperture c on v.id = c.id || '-veg'
union all
select 'decorazione', v.id, v.ordine, d.ordine, '—'
  from public.decorazioni v join public.decorazioni d on v.id = d.id || '-veg'
union all
select 'funzione telegram', 'nome accorciato',
       null, null,
       case when pg_get_functiondef('public.telegram_foto_ordine()'::regprocedure) like '%left(coalesce(nullif(btrim(new.cliente_nome)%' then 'ok' else 'MANCA' end
 order by 1, 2;
