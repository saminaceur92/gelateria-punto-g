-- ============================================================
-- Foto caricata dal cliente per la cialda su Telegram (+ download) e riga
-- "Dove si mangia" nella notifica — 2026-08-29
-- Da eseguire su Supabase (SQL Editor). È idempotente.
--
-- Cosa cambia sul sito, nella stessa versione:
--   · la foto caricata dal cliente per la cialda viene salvata su Storage in
--     `dettagli.fotoCialdaUrl`; `immagine` resta solo l'anteprima 3D;
--   · in dashboard gli ordini con foto hanno "⬇ Scarica foto cialda".
--   · nel passo "I tuoi dati" si chiede se la torta verrà mangiata a casa o
--     in un locale: la riga "Dove si mangia:" arriva nel riepilogo, nella
--     mail e su Telegram.
--
-- Qui:
--   1. la notifica Telegram riceve DUE immagini: la foto per la cialda, con
--      il link per scaricarla, e subito dopo l'anteprima della torta finita;
--   2. il messaggio di testo mette l'emoji davanti a "Dove si mangia:".
--
-- Il trigger che oggi manda il TESTO su Telegram (`notify_new_order_trg`,
-- del 2026-07-06) non è in questo repo (vive nel database) e NON viene
-- toccato: la foto parte da un secondo trigger, che legge bot token e chat
-- id dalle STESSE chiavi di `app_config` già usate da quello
-- (`telegram_bot_token` e `telegram_chat_id`), quindi non c'è niente da
-- configurare. Il passo 1a è solo una rete di sicurezza: se un giorno quelle
-- chiavi non ci fossero, prova a ricavarle dalla funzione esistente; se non
-- ci riesce lo dice nel controllo finale, e basta inserirle a mano:
--   insert into public.app_config (key, value) values
--     ('telegram_bot_token', '123456789:AAxxxxxxxx'),
--     ('telegram_chat_id',   '-1001234567890');
-- ============================================================

-- ── 1a. Credenziali Telegram in app_config (se non ci sono già) ──
do $$
declare
  v_token text; v_chat text; v_src text; v_key text; v_val text;
begin
  select value into v_token from public.app_config where key = 'telegram_bot_token';
  select value into v_chat  from public.app_config where key = 'telegram_chat_id';
  if coalesce(v_token, '') <> '' and coalesce(v_chat, '') <> '' then return; end if;

  -- La funzione che oggi manda il testo su Telegram: token e chat id sono
  -- scritti lì dentro, oppure lì c'è il nome della chiave di app_config.
  select string_agg(p.prosrc, E'\n')
    into v_src
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname <> 'telegram_foto_ordine'
     and p.prosrc ilike '%telegram%';

  if v_src is not null then
    if coalesce(v_token, '') = '' then
      v_token := coalesce(
        (regexp_match(v_src, 'bot([0-9]{6,}:[A-Za-z0-9_-]{20,})'))[1],
        (regexp_match(v_src, '''([0-9]{6,}:[A-Za-z0-9_-]{25,})'''))[1]);
    end if;
    if coalesce(v_chat, '') = '' then
      v_chat := (regexp_match(v_src, 'chat_id[^0-9-]{1,24}(-?[0-9]{5,})'))[1];
    end if;
    -- …oppure la funzione legge app_config con chiavi dai nomi diversi
    if coalesce(v_token, '') = '' or coalesce(v_chat, '') = '' then
      for v_key in select m[1] from regexp_matches(v_src, 'key\s*=\s*''([^'']+)''', 'g') as m loop
        select value into v_val from public.app_config where key = v_key;
        if v_val is null then continue; end if;
        if coalesce(v_token, '') = '' and v_val ~ '^[0-9]{6,}:[A-Za-z0-9_-]{20,}$' then v_token := v_val; end if;
        if coalesce(v_chat, '') = ''  and v_val ~ '^-?[0-9]{5,}$' then v_chat := v_val; end if;
      end loop;
    end if;
  end if;

  -- …oppure stanno nel Vault di Supabase
  begin
    if coalesce(v_token, '') = '' then
      select decrypted_secret into v_token from vault.decrypted_secrets
       where name ilike '%telegram%' and decrypted_secret ~ '^[0-9]{6,}:[A-Za-z0-9_-]{20,}$' limit 1;
    end if;
    if coalesce(v_chat, '') = '' then
      select decrypted_secret into v_chat from vault.decrypted_secrets
       where name ilike '%telegram%' and decrypted_secret ~ '^-?[0-9]{5,}$' limit 1;
    end if;
  exception when others then
    null;  -- niente Vault: pazienza
  end;

  if coalesce(v_token, '') <> '' then
    insert into public.app_config (key, value) values ('telegram_bot_token', v_token)
    on conflict (key) do update set value = excluded.value;
  end if;
  if coalesce(v_chat, '') <> '' then
    insert into public.app_config (key, value) values ('telegram_chat_id', v_chat)
    on conflict (key) do update set value = excluded.value;
  end if;
end $$;

-- unaccent serve per il nome del file scaricato (Sofìa → sofia). Su Supabase
-- le estensioni stanno nello schema `extensions` (lezione del promemoria
-- compleanno: con search_path = public non si trovano); se lo schema non
-- c'è o l'estensione non si può installare, pazienza: la funzione qui sotto
-- ha il ripiego senza accenti tolti.
do $$
begin
  begin
    create extension if not exists unaccent with schema extensions;
  exception when others then
    begin
      create extension if not exists unaccent;
    exception when others then
      null;
    end;
  end;
end $$;

-- ── 1b. Le due foto su Telegram, appena l'ordine è salvato ──────────
-- Prima manda la foto caricata per la cialda, col link per scaricarla; poi
-- manda l'anteprima della torta finita (`immagine`, la stessa della dashboard).
-- Se una delle due manca o non è un URL pubblico, manda comunque l'altra.
-- Nessun errore Telegram deve mai bloccare il salvataggio dell'ordine.
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
  v_url_torta := nullif(new.immagine, '');
  if (v_url_cialda is null or v_url_cialda !~* '^https?://')
     and (v_url_torta is null or v_url_torta !~* '^https?://') then
    return new;
  end if;

  select value into v_token from public.app_config where key = 'telegram_bot_token';
  select value into v_chat  from public.app_config where key = 'telegram_chat_id';
  if coalesce(v_token, '') = '' or coalesce(v_chat, '') = '' then return new; end if;

  v_nome := coalesce(nullif(btrim(new.cliente_nome), ''), 'cliente');

  -- 1) Foto cliente per la cialda + download.
  if v_url_cialda ~* '^https?://' then
    begin
      v_slug := btrim(regexp_replace(lower(unaccent(v_nome)), '[^a-z0-9]+', '-', 'g'), '-');
    exception when others then
      v_slug := btrim(regexp_replace(lower(v_nome), '[^a-z0-9]+', '-', 'g'), '-');
    end;
    v_slug := coalesce(nullif(v_slug, ''), 'cliente');
    v_caption := '📸 Foto per la cialda — ' || v_nome
              || E'\n⬇️ Scarica la foto per la cialda: '
              || v_url_cialda
              || case when position('?' in v_url_cialda) > 0 then '&' else '?' end
              || 'download=foto-cialda-' || v_slug || '.jpg';

    begin
      perform net.http_post(
        url  := 'https://api.telegram.org/bot' || v_token || '/sendPhoto',
        body := jsonb_build_object(
          'chat_id', v_chat,
          'photo',   v_url_cialda,
          'caption', v_caption
        ),
        timeout_milliseconds := 20000
      );
    exception when others then
      null; -- prova comunque a inviare la torta finita
    end;
  end if;

  -- 2) Render della torta finita, uguale alla miniatura in dashboard.
  if v_url_torta ~* '^https?://' then
    begin
      perform net.http_post(
        url  := 'https://api.telegram.org/bot' || v_token || '/sendPhoto',
        body := jsonb_build_object(
          'chat_id', v_chat,
          'photo',   v_url_torta,
          'caption', '🎂 Torta configurata — ' || v_nome
        ),
        timeout_milliseconds := 20000
      );
    exception when others then
      null;
    end;
  end if;

  return new;
exception when others then
  return new;  -- le foto sono un di più: l'ordine si salva comunque
end $$;

-- "zz_" davanti al nome: i trigger scattano in ordine alfabetico, e questo
-- deve partire DOPO quello del testo, così su Telegram prima arriva il
-- riepilogo e poi le due foto.
drop trigger if exists zz_telegram_foto_ordine_trg on public.ordini;
create trigger zz_telegram_foto_ordine_trg
  after insert on public.ordini
  for each row execute function public.telegram_foto_ordine();

-- ── 2. Emoji per "Dove si mangia:" nel messaggio di testo ───
-- Stessa funzione della migrazione 2026-08-10 (batch agosto), con una riga in
-- più. Va aggiornata insieme al sito: cerca le stringhe ESATTE.
CREATE OR REPLACE FUNCTION public.order_telegram_msg(p_riepilogo text, p_cliente text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare msg text;
begin
  msg := coalesce(nullif(btrim(regexp_replace(coalesce(p_riepilogo,''), '[*_]', '', 'g')), ''), '');
  if msg = '' then
    msg := '⚠ NUOVO ORDINE — Punto Gi' || E'\n👤 Cliente: ' || coalesce(p_cliente, 'Cliente');
  else
    msg := replace(msg, '🎂 Nuova richiesta torta — Punto Gi', '⚠ NUOVO ORDINE — Punto Gi');
    msg := replace(msg, '🎂 Nuovo ordine in gelateria — Punto Gi', '⚠ NUOVO ORDINE (in gelateria) — Punto Gi');
    msg := replace(msg, 'Tipo:', '– Tipo:');
    msg := replace(msg, 'Forma:', '– Forma:');
    msg := replace(msg, 'Dimensione:', '– Dimensione:');
    msg := replace(msg, 'Base:', '– Base:');
    msg := replace(msg, 'Tipo di crumble:', '– Tipo di crumble:');
    msg := replace(msg, 'Strati / Gusti:', '– Strati / Gusti:');
    msg := replace(msg, 'Farcitura:', '– Farcitura:');
    msg := replace(msg, 'Copertura:', '– Copertura:');
    msg := replace(msg, 'Decorazione:', '– Decorazione:');
    msg := replace(msg, 'Scritta:', '– Scritta:');
    msg := replace(msg, 'Foto su cialda:', '– Foto su cialda:');
    msg := replace(msg, 'Candelina:', '– Candelina:');
    msg := replace(msg, 'Occasione:', '– Occasione:');
    msg := replace(msg, 'Attenzione:', '🎀 Attenzione:');
    msg := replace(msg, 'Da ritirare:', '📅 Da ritirare:');
    msg := replace(msg, 'Consegna a domicilio:', '🛵 Consegna a domicilio:');
    msg := replace(msg, 'Indirizzo:', '📍 Indirizzo:');
    msg := replace(msg, 'Sovrapprezzo consegna:', '💶 Sovrapprezzo consegna:');
    msg := replace(msg, 'Dove si mangia:', '🍽️ Dove si mangia:');   -- NUOVO (29-08)
    msg := replace(msg, 'Cliente:', '👤 Cliente:');
    msg := replace(msg, 'Telefono:', '📞 Telefono:');
    msg := replace(msg, 'Email:', '📧 Email:');
    msg := replace(msg, 'Note:', '📝 Note:');
    msg := replace(msg, 'Stima:', 'Importo pagato:');
  end if;
  return msg;
end $function$;

-- ── Controllo finale ─────────────────────────────────────────
-- Le prime due righe devono dire "ok": se una dice "MANCA", inserisci la
-- chiave a mano (vedi in cima) — finché manca, arriva solo il testo.
select 'telegram_bot_token' as cosa,
       case when coalesce((select value from public.app_config where key = 'telegram_bot_token'), '') <> '' then 'ok' else 'MANCA' end as stato
union all
select 'telegram_chat_id',
       case when coalesce((select value from public.app_config where key = 'telegram_chat_id'), '') <> '' then 'ok' else 'MANCA' end
union all
select 'trigger foto',
       case when exists (select 1 from pg_trigger where tgname = 'zz_telegram_foto_ordine_trg') then 'ok' else 'MANCA' end
union all
select 'riga "Dove si mangia"',
       case when public.order_telegram_msg('*Dove si mangia:* a casa', 'x') like '%🍽️ Dove si mangia:%' then 'ok' else 'MANCA' end;
