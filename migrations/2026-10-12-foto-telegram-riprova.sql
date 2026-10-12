-- ============================================================
-- Foto degli ordini su Telegram: se non arrivano, si riprova — 2026-10-12
-- Da eseguire su Supabase (SQL Editor) UNA VOLTA, tutto insieme.
-- È rieseguibile: lanciarla due volte non fa danni.
--
-- Cosa è successo il 12/10 alle 13:19: un ordine pagato dal sito è arrivato
-- su Telegram col testo ma senza la foto della torta. Nell'ordine era tutto
-- giusto (link dell'anteprima presente, trigger attivo), ma la richiesta
-- della foto non è riuscita nemmeno ad aprire la connessione con Telegram in
-- 20 secondi ("TCP/SSL handshake 19999 ms", la foto non è mai partita),
-- mentre quella del testo, partita nello stesso istante, è arrivata. Un
-- intoppo di rete fra Supabase e Telegram: può capitare, e il trigger delle
-- foto spediva UNA volta sola senza mai guardare la risposta.
--
-- Cosa cambia:
--   1. ogni ordine ricorda com'è andata la sua foto (colonne telegram_foto_*);
--   2. un giro ogni 2 minuti legge la risposta di Telegram e, se la foto non
--      è arrivata (connessione fallita, errore, nessuna risposta), la
--      rispedisce: 6 tentativi in tutto, con attese crescenti (circa 2, 2,
--      4, 8 e 16 minuti), così si copre anche mezz'ora di Telegram giù;
--   3. se il trigger stesso non riesce a spedire, l'ordine resta segnato e ci
--      pensa il giro.
-- Le foto e le didascalie restano quelle di prima (2026-08-30). Il messaggio
-- di TESTO non cambia: il suo trigger vive solo nel database. Spegnere il
-- trigger delle foto le ferma, come prima.
--
-- Doppioni: se Telegram ha ricevuto la foto ma non ha risposto entro 20
-- secondi, forse l'ha già pubblicata. Dopo una risposta così si riprova UNA
-- volta sola; se succede di nuovo la foto resta "forse_arrivate". Al massimo
-- due copie, e solo quando Telegram è molto lento.
--
-- Per rimandare su Telegram le foto di un ordine (es. quello delle 13:19 del
-- 12/10, la cui foto non è mai arrivata), anche giorni dopo:
--   select public.invia_foto_ordine(id) from public.ordini
--    where created_at >= '2026-10-12 13:19:00 Europe/Rome'
--      and created_at <  '2026-10-12 13:21:00 Europe/Rome';
-- Una rispedizione a mano riparte da capo: la controlla il giro, con 6
-- tentativi come un ordine nuovo.
-- ============================================================

begin;
-- Aggiungere le colonne blocca la tabella degli ordini per un istante: se è
-- occupata, meglio fermarsi e rilanciare che far aspettare il sito.
set local lock_timeout = '5s';

-- ── 1. Com'è andata la foto, ordine per ordine ───────────────
-- telegram_foto_stato: null = niente da mandare (o ordine di prima di oggi),
-- 'in_corso' = spedita, la risposta si legge al prossimo giro,
-- 'arrivate' = Telegram ha detto ok, 'non_arrivate' = tentativi finiti e
-- nessuna è arrivata, 'forse_arrivate' = Telegram ne ha ricevuta almeno una
-- senza rispondere in tempo (rispedirla a mano farebbe un doppione).
-- telegram_foto_forse: quante volte si è già rispedito dopo una risposta
-- arrivata troppo tardi (la foto forse c'era già): al massimo una.
alter table public.ordini add column if not exists telegram_foto_req       bigint;
alter table public.ordini add column if not exists telegram_foto_stato     text;
alter table public.ordini add column if not exists telegram_foto_tentativi integer not null default 0;
alter table public.ordini add column if not exists telegram_foto_forse     integer not null default 0;
alter table public.ordini add column if not exists telegram_foto_il        timestamptz;
alter table public.ordini add column if not exists telegram_foto_errore    text;
-- Rifatto a ogni lancio: così vale sempre l'elenco di stati di questo file.
alter table public.ordini drop constraint if exists ordini_telegram_foto_stato_check;
alter table public.ordini add constraint ordini_telegram_foto_stato_check
  check (telegram_foto_stato in ('in_corso', 'arrivate', 'non_arrivate', 'forse_arrivate'));

-- ── 2. Le foto di un ordine e il messaggio per Telegram ──────
-- I link pubblici delle due foto (null quella che manca o non è un link):
-- stesse regole del trigger del 2026-08-30.
create or replace function public.foto_telegram_link(o public.ordini, out cialda text, out torta text)
language sql
immutable
set search_path = public
as $$
  select case when x.c ~* '^https?://' then x.c end,
         case when x.t ~* '^https?://' then x.t end
    from (select nullif(o.dettagli ->> 'fotoCialdaUrl', '') as c,
                 coalesce(nullif(o.dettagli ->> 'tortaConfigurataUrl', ''),
                          case when o.immagine ~* '^https?://' then o.immagine end) as t) as x;
$$;

-- Metodo e corpo della richiesta a Telegram (senza token): album se ci sono
-- tutte e due le foto, altrimenti la sola foto che c'è. metodo null = niente
-- da mandare. Didascalie identiche a quelle del 2026-08-30: nome del cliente
-- a 120 caratteri e nome del file a 60, perché Telegram scarta in silenzio
-- le didascalie oltre i 1024.
create or replace function public.foto_telegram_messaggio(o public.ordini, p_chat text, out metodo text, out corpo jsonb)
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_cialda  text;
  v_torta   text;
  v_nome    text;
  v_slug    text;
  v_caption text;
begin
  select l.cialda, l.torta into v_cialda, v_torta from public.foto_telegram_link(o) as l;
  if v_cialda is null and v_torta is null then
    return;
  end if;

  v_nome := left(coalesce(nullif(btrim(o.cliente_nome), ''), 'cliente'), 120);
  if v_cialda is not null then
    begin
      v_slug := btrim(regexp_replace(lower(unaccent(v_nome)), '[^a-z0-9]+', '-', 'g'), '-');
    exception when others then
      v_slug := btrim(regexp_replace(lower(v_nome), '[^a-z0-9]+', '-', 'g'), '-');
    end;
    v_slug := left(coalesce(nullif(v_slug, ''), 'cliente'), 60);
    v_caption := '📸 Foto per la cialda — ' || v_nome
              || E'\n⬇️ Scarica la foto per la cialda: '
              || v_cialda
              || case when position('?' in v_cialda) > 0 then '&' else '?' end
              || 'download=foto-cialda-' || v_slug || '.jpg';
  end if;

  if v_cialda is not null and v_torta is not null then
    -- Un unico album: due richieste separate potrebbero perderne una.
    metodo := 'sendMediaGroup';
    corpo := jsonb_build_object(
      'chat_id', p_chat,
      'media', jsonb_build_array(
        jsonb_build_object('type', 'photo', 'media', v_cialda, 'caption', v_caption),
        jsonb_build_object('type', 'photo', 'media', v_torta, 'caption', '🎂 Torta configurata — ' || v_nome)
      )
    );
  elsif v_cialda is not null then
    metodo := 'sendPhoto';
    corpo := jsonb_build_object('chat_id', p_chat, 'photo', v_cialda, 'caption', v_caption);
  else
    metodo := 'sendPhoto';
    corpo := jsonb_build_object('chat_id', p_chat, 'photo', v_torta, 'caption', '🎂 Torta configurata — ' || v_nome);
  end if;
end $$;

-- Gli errori finiscono nell'ordine, che la dashboard dello staff legge: mai
-- col token del bot dentro. pg_net (dalla 0.20.1) scrive l'URL intero
-- nell'errore di un indirizzo malformato, e l'URL contiene il token.
create or replace function public.telegram_senza_token(p text)
returns text
language sql
immutable
as $$
  select case when p is null then null
              else left(regexp_replace(regexp_replace(p, 'bot.*/(send[A-Za-z]*)', 'bot<token>/\1', 'g'),
                                       '[0-9]{6,}:[A-Za-z0-9_-]{20,}', '<token>', 'g'), 300) end;
$$;

-- ── 3. Spedire (e ricordarsi di averlo fatto) ────────────────
-- Restituisce l'id della richiesta pg_net, o null se non c'era niente da
-- mandare. Chiamata dal trigger o a mano parte una serie nuova (6
-- tentativi); dal giro (p_riprova) continua quella in corso.
-- p_errore_prima: perché si sta riprovando (resta scritto nell'ordine finché
-- Telegram non dice ok).
drop function if exists public.invia_foto_ordine(uuid, text);
create or replace function public.invia_foto_ordine(p_id uuid, p_errore_prima text default null,
                                                    p_riprova boolean default false)
returns bigint
language plpgsql
security definer
set search_path = public, net
as $$
declare
  o        public.ordini;
  v_token  text;
  v_chat   text;
  v_metodo text;
  v_corpo  jsonb;
  v_req    bigint;
begin
  select * into o from public.ordini where id = p_id;
  if not found then
    return null;
  end if;
  if (public.foto_telegram_link(o)).cialda is null and (public.foto_telegram_link(o)).torta is null then
    -- Foto tolte dall'ordine mentre si riprovava: non c'è più niente da mandare.
    update public.ordini set telegram_foto_stato = null
     where id = p_id and telegram_foto_stato = 'in_corso';
    return null;
  end if;

  -- Spazi o a capo incollati per sbaglio con il token renderebbero l'URL
  -- malformato: via.
  select btrim(value, E' \t\r\n') into v_token from public.app_config where key = 'telegram_bot_token';
  select btrim(value, E' \t\r\n') into v_chat  from public.app_config where key = 'telegram_chat_id';
  if coalesce(v_token, '') = '' or coalesce(v_chat, '') = '' then
    update public.ordini
       set telegram_foto_stato  = 'non_arrivate',
           telegram_foto_errore = 'mancano telegram_bot_token o telegram_chat_id in app_config'
     where id = p_id;
    return null;
  end if;

  select m.metodo, m.corpo into v_metodo, v_corpo from public.foto_telegram_messaggio(o, v_chat) as m;
  select net.http_post(
    url  := 'https://api.telegram.org/bot' || v_token || '/' || v_metodo,
    body := v_corpo,
    timeout_milliseconds := 20000
  ) into v_req;

  update public.ordini
     set telegram_foto_req       = v_req,
         telegram_foto_stato     = 'in_corso',
         telegram_foto_tentativi = case when p_riprova then telegram_foto_tentativi + 1 else 1 end,
         telegram_foto_forse     = case when p_riprova then telegram_foto_forse else 0 end,
         telegram_foto_il        = now(),
         telegram_foto_errore    = public.telegram_senza_token(p_errore_prima)
   where id = p_id;
  return v_req;
end $$;

-- Il trigger di sempre (zz_telegram_foto_ordine_trg, dopo il testo): ora
-- passa da invia_foto_ordine, che si segna la richiesta.
create or replace function public.telegram_foto_ordine()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.invia_foto_ordine(new.id);
  return new;
exception when others then
  -- Le foto sono un di più: l'ordine si salva comunque. Si segna il
  -- tentativo andato male, così la foto la rimanda il giro (punto 4).
  begin
    update public.ordini
       set telegram_foto_stato     = 'in_corso',
           telegram_foto_req       = null,
           telegram_foto_tentativi = 1,
           telegram_foto_forse     = 0,
           telegram_foto_il        = now(),
           telegram_foto_errore    = public.telegram_senza_token('invio non riuscito: ' || sqlerrm)
     where id = new.id;
  exception when others then
    null;
  end;
  return new;
end $$;

drop trigger if exists zz_telegram_foto_ordine_trg on public.ordini;
create trigger zz_telegram_foto_ordine_trg
  after insert on public.ordini
  for each row execute function public.telegram_foto_ordine();

-- ── 4. Il giro ogni 2 minuti ─────────────────────────────────
-- Legge le risposte di Telegram e rispedisce le foto non arrivate. pg_net le
-- risposte le tiene 6 ore dall'invio: il giro guarda le foto spedite (o
-- rispedite) nelle ultime 6 ore.
create or replace function public.riprova_foto_telegram()
returns integer
language plpgsql
security definer
set search_path = public, net
as $$
declare
  r        record;
  v_coda   boolean := to_regclass('net.http_request_queue') is not null;
  st       integer;
  v_tipo   text;
  v_corpo  text;
  v_err    text;
  v_errore text;
  v_forse  boolean;
  n        integer := 0;
begin
  for r in
    select o.id, o.telegram_foto_req as req, o.telegram_foto_tentativi as tentativi,
           o.telegram_foto_forse as forse, o.telegram_foto_il as il, o.telegram_foto_errore as errore
      from public.ordini as o
     where o.telegram_foto_stato = 'in_corso'
       and coalesce(o.telegram_foto_il, o.created_at) > now() - interval '6 hours'
     order by o.created_at
     for update of o skip locked
  loop
    -- Senza richiesta (l'invio stesso è fallito) il motivo è quello già scritto.
    v_errore := case when r.req is null then r.errore end;
    v_forse := false;
    if r.req is not null then
      st := null; v_tipo := null; v_corpo := null; v_err := null;
      select h.status_code, h.content_type, h.content, h.error_msg
        into st, v_tipo, v_corpo, v_err
        from net._http_response as h
       where h.id = r.req;
      if found then
        if st between 200 and 299 then
          update public.ordini
             set telegram_foto_stato = 'arrivate', telegram_foto_errore = null
           where id = r.id and telegram_foto_req = r.req;
          continue;
        end if;
        -- Tempo scaduto DOPO l'invio (pg_net misura un tempo di richiesta e
        -- risposta diverso da zero), o connessione caduta a richiesta già
        -- partita: Telegram la foto l'ha ricevuta e forse l'ha già pubblicata.
        v_forse := coalesce((v_err like '%HTTP Request/Response time: %'
                             and v_err !~ 'HTTP Request/Response time: 0(\.0*)? ms')
                            or v_err ~* '^(server returned nothing|failure when receiving|transferred a partial file)',
                            false);
        -- La spiegazione di Telegram ("description") o quella di pg_net.
        begin
          v_errore := case when v_tipo like 'application/json%' then v_corpo::jsonb ->> 'description' end;
        exception when others then
          v_errore := null;
        end;
        v_errore := public.telegram_senza_token(coalesce(nullif(v_errore, ''), nullif(v_err, ''),
                                                         'risposta ' || coalesce(st::text, 'vuota')));
      elsif (v_coda and exists (select 1 from net.http_request_queue as q where q.id = r.req))
            or r.il > now() - interval '3 minutes' then
        continue; -- ancora in coda o in viaggio: si riguarda al prossimo giro
      else
        v_errore := 'nessuna risposta da Telegram';
      end if;
    end if;

    -- Forse è già arrivata: si riprova una volta sola (al massimo due copie).
    if v_forse and r.forse >= 1 then
      update public.ordini
         set telegram_foto_stato = 'forse_arrivate', telegram_foto_errore = v_errore
       where id = r.id;
      continue;
    end if;

    -- Tentativi finiti. Se uno di quelli andati male può essere arrivato
    -- lo stesso, la foto è "forse_arrivate": rispedirla a mano farebbe un doppione.
    if r.tentativi >= 6 then
      update public.ordini
         set telegram_foto_stato = case when v_forse or r.forse >= 1 then 'forse_arrivate' else 'non_arrivate' end,
             telegram_foto_errore = coalesce(v_errore, telegram_foto_errore)
       where id = r.id;
      continue;
    end if;

    -- Attesa dopo il tentativo precedente: 1, 2, 4, 8, 16 minuti.
    if r.il is not null and r.il > now() - interval '1 minute' * power(2, greatest(r.tentativi - 1, 0)) then
      if v_errore is not null and r.errore is distinct from v_errore then
        update public.ordini set telegram_foto_errore = v_errore where id = r.id;
      end if;
      continue;
    end if;

    -- La riprova dopo una risposta arrivata troppo tardi: si conta, è l'unica.
    if v_forse then
      update public.ordini set telegram_foto_forse = telegram_foto_forse + 1 where id = r.id;
    end if;
    begin
      if public.invia_foto_ordine(r.id, v_errore, true) is not null then
        n := n + 1;
      end if;
    exception when others then
      -- Un ordine che non si riesce a spedire non deve fermare gli altri: il
      -- tentativo conta lo stesso, così dopo 6 si smette.
      begin
        update public.ordini
           set telegram_foto_stato     = 'in_corso',
               telegram_foto_req       = null,
               telegram_foto_tentativi = telegram_foto_tentativi + 1,
               telegram_foto_il        = now(),
               telegram_foto_errore    = public.telegram_senza_token('invio non riuscito: ' || sqlerrm)
         where id = r.id;
      exception when others then
        null;
      end;
    end;
  end loop;

  -- Oltre le 6 ore dall'ultimo invio pg_net non ha più la risposta: chi è
  -- ancora "in corso" un esito non lo avrà mai.
  update public.ordini
     set telegram_foto_stato  = case when telegram_foto_forse >= 1 then 'forse_arrivate' else 'non_arrivate' end,
         telegram_foto_errore = coalesce(telegram_foto_errore, 'nessun esito entro 6 ore')
   where telegram_foto_stato = 'in_corso'
     and coalesce(telegram_foto_il, created_at) <= now() - interval '6 hours';

  return n;
end $$;

-- Funzioni interne: le usano solo il trigger, il giro e chi lavora nel SQL
-- Editor. Non sono RPC pubbliche.
revoke execute on function public.foto_telegram_link(public.ordini) from public, anon, authenticated;
revoke execute on function public.foto_telegram_messaggio(public.ordini, text) from public, anon, authenticated;
revoke execute on function public.telegram_senza_token(text) from public, anon, authenticated;
revoke execute on function public.invia_foto_ordine(uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.telegram_foto_ordine() from public, anon, authenticated;
revoke execute on function public.riprova_foto_telegram() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('riprova-foto-telegram');
exception when others then
  null;
end $$;
select cron.schedule('riprova-foto-telegram', '*/2 * * * *', $$ select public.riprova_foto_telegram(); $$);

commit;

-- ── Controllo finale: ogni riga deve dire quello che c'è fra parentesi ──
select 'Trigger delle foto attivo? (sì)' as cosa,
       case when exists (select 1 from pg_trigger
                          where tgrelid = 'public.ordini'::regclass
                            and tgname = 'zz_telegram_foto_ordine_trg' and tgenabled <> 'D')
             and pg_get_functiondef('public.telegram_foto_ordine()'::regprocedure) like '%invia_foto_ordine%'
            then 'sì' else 'NO — ERRORE' end as valore
union all
select 'Giro ogni 2 minuti programmato? (sì)',
       case when exists (select 1 from cron.job where jobname = 'riprova-foto-telegram' and active)
            then 'sì' else 'NO — ERRORE' end
union all
select 'Token e chat di Telegram in app_config, scritti bene? (sì)',
       case when coalesce((select btrim(value, E' \t\r\n') from public.app_config where key = 'telegram_bot_token'), '')
                   ~ '^[0-9]+:[A-Za-z0-9_-]+$'
             and coalesce((select btrim(value, E' \t\r\n') from public.app_config where key = 'telegram_chat_id'), '') <> ''
            then 'sì' else 'NO — le foto non possono partire' end
union all
select 'Messaggio con la sola anteprima (sendPhoto)',
       coalesce((select m.metodo from public.foto_telegram_messaggio(
                   jsonb_populate_record(null::public.ordini,
                     '{"cliente_nome": "Prova", "dettagli": {"tortaConfigurataUrl": "https://prova.invalid/a.jpg"}}'),
                   '0') as m), 'NIENTE — ERRORE')
union all
select 'Messaggio con foto cialda e anteprima (sendMediaGroup, foto-cialda-sofia.jpg)',
       coalesce((select m.metodo || ', '
                        || substring(m.corpo -> 'media' -> 0 ->> 'caption' from 'foto-cialda-[a-z0-9-]+\.jpg')
                   from public.foto_telegram_messaggio(
                   jsonb_populate_record(null::public.ordini,
                     '{"cliente_nome": "Sofìa", "dettagli": {"fotoCialdaUrl": "https://prova.invalid/c.jpg", "tortaConfigurataUrl": "https://prova.invalid/a.jpg"}}'),
                   '0') as m), 'NIENTE — ERRORE')
union all
select 'Errore col token dentro: il token sparisce (sparito)',
       case when public.telegram_senza_token(
                   'invalid URL "https://api.telegram.org/bot123456789:AAprovaprovaprovaprovaprova12 /sendPhoto": Malformed input')
                 = 'invalid URL "https://api.telegram.org/bot<token>/sendPhoto": Malformed input'
            then 'sparito' else 'NO — ERRORE' end
union all
select 'Ultimi ordini — mail e foto (le foto si contano da oggi in poi)',
       coalesce((select string_agg(
                          to_char(o.created_at at time zone 'Europe/Rome', 'DD/MM HH24:MI')
                          || ' mail ' || case when o.email_ok then 'confermata'
                                              when o.email_req is null then '—'
                                              else 'non confermata' end
                          || ' (' || o.email_tentativi || case when o.email_tentativi = 1 then ' invio)' else ' invii)' end
                          || ', foto ' || coalesce(o.telegram_foto_stato, '—'),
                          ' · ' order by o.created_at desc)
                   from (select * from public.ordini order by created_at desc limit 3) as o), 'nessun ordine');
