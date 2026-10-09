-- ============================================================
-- «Collabora con noi»: le proposte dal sito arrivano ai titolari — 2026-10-09
-- Da eseguire su Supabase (SQL Editor) UNA VOLTA, tutto insieme.
-- È idempotente: rilanciarla non fa danni.
--
-- Cosa cambia:
--   · nuova tabella `collaborazioni`: le proposte scritte nel modulo della
--     pagina /collabora del sito. Il pubblico non la legge e non ci scrive:
--     si entra SOLO dalla funzione `invia_collaborazione`, che rifà i
--     controlli del sito (il browser non è fidato) e applica i freni
--     anti-spam;
--   · le leggono, le cambiano di stato e le cancellano SOLO i titolari, cioè
--     chi entra con un codice da amministratore: scheda "🤝 Collaborazioni"
--     della dashboard, con il numero di quelle nuove che si aggiorna da solo;
--   · a ogni proposta parte un avviso su Telegram, con le stesse chiavi
--     degli ordini. Nella chat degli ordini (che legge anche il laboratorio)
--     arriva solo un avviso breve, senza nomi né contatti; il messaggio
--     completo arriva solo in una chat dei titolari, se la indicate (vedi in
--     fondo, "Facoltativo");
--   · le proposte si cancellano da sole dopo 24 mesi, quelle segnate come
--     spam dopo 30 giorni (lo dice anche il modulo, sotto la spunta privacy);
--   · statistiche: la pagina "collabora" e 5 click nuovi.
--
-- Ordine consigliato: PRIMA questa migrazione, POI il sito nuovo. Il sito
-- funziona anche nell'ordine inverso (il modulo dice che non riesce a
-- inviare e propone WhatsApp col testo già scritto; la scheda in dashboard
-- dice quale file lanciare), ma le proposte arrivano solo da qui in poi.
--
-- In fondo c'è il controllo finale: ogni riga deve dire ok / no / sì come
-- indicato fra parentesi. Il file 2026-10-09-collabora-con-noi-prova.sql
-- prova tutto sul database vero e poi annulla quello che ha scritto.
-- ============================================================

begin;

-- ── 1. Le proposte ───────────────────────────────────────────
-- I limiti di lunghezza sono gli stessi del modulo: qui fanno da rete, se
-- qualcuno chiamasse la funzione a mano con testi enormi.
-- `privacy_il` e `privacy_testo` sono la prova della spunta sull'informativa:
-- quando è stata messa e su quale versione del modulo. Se un giorno cambia il
-- testo della spunta (src/components/CollaboraForm.jsx), va cambiato anche
-- il testo salvato qui sotto, nella funzione `invia_collaborazione`.
create table if not exists public.collaborazioni (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  -- 'lavoro' è ammesso ma oggi il modulo non lo propone: è pronto se un
  -- giorno i titolari vorranno ricevere anche le candidature.
  tipo          text not null default 'altro'
                check (tipo in ('locale','eventi','aziende','creator','fornitore','lavoro','altro')),
  nome          text not null check (char_length(nome) between 2 and 120),
  azienda       text check (azienda is null or char_length(azienda) <= 160),
  email         text not null check (char_length(email) between 5 and 254),
  telefono      text check (telefono is null or char_length(telefono) <= 40),
  messaggio     text not null check (char_length(messaggio) between 20 and 2000),
  privacy_il    timestamptz not null,
  privacy_testo text not null,
  stato         text not null default 'nuova'
                check (stato in ('nuova','letta','in_corso','chiusa','spam')),
  nota_staff    text check (nota_staff is null or char_length(nota_staff) <= 2000),
  -- true = salvata ma SENZA avviso Telegram (filtro anti-spam, vedi sotto)
  silenziata    boolean not null default false,
  telegram_req  bigint,          -- id della richiesta pg_net, per capire se l'avviso è partito
  aggiornata_il timestamptz      -- ultima modifica di stato o nota (la mette il database)
);
create index if not exists collaborazioni_created_idx on public.collaborazioni (created_at desc);
create index if not exists collaborazioni_email_idx   on public.collaborazioni (email, created_at desc);


-- ── 2. Chi le vede: solo i titolari ─────────────────────────
-- Una proposta contiene nome, email, telefono e un testo libero: non è un
-- dato da lasciare a tutto il personale. "Titolare" = profilo con ruolo
-- 'owner', cioè chi entra con un codice da amministratore (staff-login).
-- Per aprirle a tutto lo staff basta cambiare la riga indicata.
create or replace function public.puo_vedere_collaborazioni()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and p.role = 'owner'          -- tutto lo staff: p.role in ('owner','staff')
  );
$$;
-- In Postgres una funzione nasce eseguibile da chiunque (e Supabase la dà
-- anche ad anon): qui serve solo alle regole qui sotto.
revoke execute on function public.puo_vedere_collaborazioni() from public, anon;
grant  execute on function public.puo_vedere_collaborazioni() to authenticated;

alter table public.collaborazioni enable row level security;

-- Supabase concede tutto sulle tabelle nuove anche ad `anon`, cioè a
-- chiunque abbia la chiave pubblica che sta nel bundle del sito: si toglie
-- tutto a mano e si ridà solo quello che serve alla dashboard.
-- (Il revoke sulla tabella toglie anche i permessi sulle singole colonne.)
revoke all on public.collaborazioni from anon, authenticated;
grant select, delete on public.collaborazioni to authenticated;
-- Dalla dashboard si cambiano SOLO lo stato e la nota. Nome, email, testo e
-- data della spunta privacy restano quelli arrivati dal modulo: un update su
-- qualunque altra colonna risponde "permission denied".
grant update (stato, nota_staff) on public.collaborazioni to authenticated;

drop policy if exists "collaborazioni_select_titolari" on public.collaborazioni;
create policy "collaborazioni_select_titolari" on public.collaborazioni
  for select to authenticated
  using ((select public.puo_vedere_collaborazioni()));

drop policy if exists "collaborazioni_update_titolari" on public.collaborazioni;
create policy "collaborazioni_update_titolari" on public.collaborazioni
  for update to authenticated
  using ((select public.puo_vedere_collaborazioni()))
  with check ((select public.puo_vedere_collaborazioni()));

drop policy if exists "collaborazioni_delete_titolari" on public.collaborazioni;
create policy "collaborazioni_delete_titolari" on public.collaborazioni
  for delete to authenticated
  using ((select public.puo_vedere_collaborazioni()));

-- Nessuna policy di insert, per nessuno: si entra solo da invia_collaborazione.
-- Perché una funzione e non una policy "insert per anon": con l'insert
-- diretto chi apre la console del browser sceglie TUTTE le colonne (stato,
-- data della spunta, "silenziata"…), legge gli errori dei vincoli e nessun
-- freno anti-spam si può applicare. È la stessa scelta delle statistiche e
-- dei codici sconto.

-- `aggiornata_il` la scrive il database, non il browser (orologio non fidato).
create or replace function public.collaborazioni_aggiornata()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.stato is distinct from old.stato or new.nota_staff is distinct from old.nota_staff then
    new.aggiornata_il := now();
  end if;
  return new;
end $$;
revoke execute on function public.collaborazioni_aggiornata() from public, anon, authenticated;

drop trigger if exists collaborazioni_aggiornata_trg on public.collaborazioni;
create trigger collaborazioni_aggiornata_trg
  before update on public.collaborazioni
  for each row execute function public.collaborazioni_aggiornata();


-- ── 3. L'invio dal sito: l'unica porta d'ingresso ───────────
-- Risponde sempre un JSON, mai un errore:
--   { ok: true }                       salvata (o scartata in silenzio: bot)
--   { ok: true, gia_ricevuta: true }   stessa proposta già arrivata (doppio tocco)
--   { ok: false, campo, motivo }       da correggere: il sito mostra `motivo`
--                                      sotto `campo` (o in un riquadro se è null)
--
-- Freni anti-spam, senza IP e senza servizi esterni (il sito non manda e
-- non salva l'indirizzo di nessuno):
--   · campo trappola nascosto (p_sito) e tempo minimo di compilazione (p_ms):
--     un umano non vede il campo e non compila tutto in meno di 3 secondi.
--     Al bot si risponde "fatto" ma non si salva niente: non impara nulla;
--   · al massimo 3 proposte in 24 ore dallo stesso indirizzo email;
--   · oltre 5 proposte nell'ultima ora, o 20 avvisi nelle ultime 24 ore, o
--     più di 2 link nel testo, o un indirizzo web al posto dell'azienda, o
--     lo stesso testo già arrivato da un'altra email: si SALVA ma senza
--     avviso Telegram (in dashboard la proposta lo dice). Così uno spammer
--     non può riempire la chat degli ordini;
--   · oltre 30 nell'ultima ora o 100 nelle ultime 24 ore non si salva più
--     niente: è un attacco. Si dice la verità (anche un cliente vero deve
--     sapere che la sua proposta non è arrivata) e si indica WhatsApp.
--
-- ⚠️ Se un domani serve un parametro in più: prima `drop function` della
-- firma vecchia. Due versioni con lo stesso nome confondono PostgREST.
create or replace function public.invia_collaborazione(
  p_tipo      text,
  p_nome      text,
  p_azienda   text,
  p_email     text,
  p_telefono  text,
  p_messaggio text,
  p_privacy   boolean,
  p_sito      text    default null,   -- trappola: un umano la lascia vuota
  p_ms        integer default null    -- millisecondi fra apertura del modulo e invio
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  -- Campi di una riga sola: caratteri di controllo, a capo e spazi multipli
  -- diventano UNO spazio, poi via gli spazi in testa e in coda.
  v_tipo     text := lower(btrim(coalesce(p_tipo, '')));
  v_nome     text := btrim(left(btrim(regexp_replace(coalesce(p_nome, ''), '[[:cntrl:][:space:]]+', ' ', 'g')), 120));
  v_azienda  text := nullif(btrim(left(btrim(regexp_replace(coalesce(p_azienda, ''), '[[:cntrl:][:space:]]+', ' ', 'g')), 160)), '');
  v_email    text := lower(btrim(regexp_replace(coalesce(p_email, ''), '[[:cntrl:][:space:]]+', ' ', 'g')));
  v_tel      text := nullif(btrim(left(btrim(regexp_replace(coalesce(p_telefono, ''), '[[:cntrl:][:space:]]+', ' ', 'g')), 40)), '');
  v_msg      text := coalesce(p_messaggio, '');
  v_cifre    text;
  v_ora      int;
  v_giorno   int;
  v_avvisi   int;
  v_silenzia boolean;
begin
  -- 1) Trappole per i bot: si risponde "fatto" senza salvare niente.
  if btrim(coalesce(p_sito, '')) <> '' then
    return json_build_object('ok', true);
  end if;
  if p_ms is not null and p_ms < 3000 then
    return json_build_object('ok', true);
  end if;

  -- 2) Il messaggio tiene gli a capo (sono il modo in cui la gente scrive),
  --    ma perde gli altri caratteri di controllo; gli a capo di Windows
  --    diventano a capo normali.
  v_msg := replace(replace(v_msg, chr(13) || chr(10), chr(10)), chr(13), chr(10));
  v_msg := regexp_replace(v_msg, '[' || chr(1) || '-' || chr(8) || chr(11) || chr(12) || chr(14) || '-' || chr(31) || chr(127) || ']', '', 'g');
  v_msg := regexp_replace(v_msg, '^[[:space:]]+|[[:space:]]+$', '', 'g');

  -- 3) Gli stessi controlli del modulo (src/lib/collaboraRegole.js).
  --    Un tipo sconosciuto non è un errore del cliente: diventa "altro".
  if v_tipo not in ('locale','eventi','aziende','creator','fornitore','lavoro','altro') then
    v_tipo := 'altro';
  end if;
  if char_length(v_nome) < 2 then
    return json_build_object('ok', false, 'campo', 'nome', 'motivo', 'Scrivi nome e cognome.');
  end if;
  if char_length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    return json_build_object('ok', false, 'campo', 'email', 'motivo', 'Controlla l''email: sembra incompleta.');
  end if;
  -- Telefono facoltativo e più largo di quello del configuratore (lì servono
  -- 10 cifre): qui scrivono anche locali col fisso (059…) e fornitori esteri.
  if v_tel is not null then
    v_cifre := regexp_replace(v_tel, '[^0-9]', '', 'g');
    if char_length(v_cifre) not between 6 and 15 then
      return json_build_object('ok', false, 'campo', 'telefono',
        'motivo', 'Controlla il numero di telefono (oppure lascialo vuoto).');
    end if;
  end if;
  if char_length(v_msg) < 20 then
    return json_build_object('ok', false, 'campo', 'messaggio',
      'motivo', 'Raccontaci qualcosa in più (almeno 20 caratteri).');
  end if;
  v_msg := left(v_msg, 2000);
  if p_privacy is not true then
    return json_build_object('ok', false, 'campo', 'privacy',
      'motivo', 'Serve la spunta sull''informativa privacy.');
  end if;

  -- 4) Un invio alla volta: i conteggi qui sotto restano esatti anche con
  --    due invii nello stesso istante. Ogni invio dura pochi millisecondi.
  perform pg_advisory_xact_lock(hashtext('public.invia_collaborazione'));

  -- 5) Doppio tocco o rete lenta: stessa email e stesso testo nelle ultime
  --    24 ore. Non è un errore: la proposta c'è già.
  if exists (select 1 from public.collaborazioni
              where email = v_email and messaggio = v_msg
                and created_at > now() - interval '24 hours') then
    return json_build_object('ok', true, 'gia_ricevuta', true);
  end if;

  -- 6) Tetto per indirizzo: 3 proposte in 24 ore.
  if (select count(*) from public.collaborazioni
       where email = v_email and created_at > now() - interval '24 hours') >= 3 then
    return json_build_object('ok', false, 'campo', null,
      'motivo', 'Abbiamo già ricevuto le tue proposte di oggi: ti rispondiamo appena possibile.');
  end if;

  -- 7) Tetti di tutto il sito (nessun IP: si conta e basta).
  select count(*) filter (where created_at > now() - interval '1 hour'),
         count(*),
         count(*) filter (where not silenziata)
    into v_ora, v_giorno, v_avvisi
    from public.collaborazioni
   where created_at > now() - interval '24 hours';

  if v_ora >= 30 or v_giorno >= 100 then
    return json_build_object('ok', false, 'campo', null,
      'motivo', 'In questo momento non riusciamo a ricevere altre proposte: scrivici su WhatsApp al 320 330 6009.');
  end if;

  v_silenzia := v_ora >= 5
             or v_avvisi >= 20
             or (select count(*) from regexp_matches(v_msg, '(https?://|www[.])', 'gi')) > 2
             or coalesce(v_azienda, '') ~* '(https?://|www[.])'
             or exists (select 1 from public.collaborazioni
                         where messaggio = v_msg and created_at > now() - interval '24 hours');

  insert into public.collaborazioni
    (tipo, nome, azienda, email, telefono, messaggio, privacy_il, privacy_testo, silenziata)
  values
    (v_tipo, v_nome, v_azienda, v_email, v_tel, v_msg, now(),
     'Informativa privacy iubenda 38165264: presa visione con la spunta del modulo «Collabora con noi» (versione 1, ottobre 2026)',
     v_silenzia);

  return json_build_object('ok', true);
exception when others then
  -- Mai un errore di Postgres al visitatore: non gli serve e direbbe a chi
  -- sonda com'è fatta la tabella.
  return json_build_object('ok', false, 'campo', null,
    'motivo', 'Non siamo riusciti a inviare la proposta. Riprova tra poco o scrivici su WhatsApp.');
end $$;

revoke execute on function public.invia_collaborazione(text,text,text,text,text,text,boolean,text,integer) from public;
grant  execute on function public.invia_collaborazione(text,text,text,text,text,text,boolean,text,integer) to anon, authenticated;


-- ── 4. L'avviso su Telegram ─────────────────────────────────
-- Stesso bot e stesse chiavi di app_config degli ordini, nessuna
-- configurazione nuova. Testo semplice (niente parse_mode): nomi e messaggi
-- li scrive chiunque, e con la formattazione di Telegram un asterisco o un
-- trattino basso sbagliati farebbero scartare l'avviso.
create or replace function public.notifica_collaborazione()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  v_token    text;
  v_chat     text;
  v_dedicata text;
  v_tipo     text;
  v_msg      text;
  v_testo    text;
  v_req      bigint;
begin
  if new.silenziata then
    return new;
  end if;

  select value into v_token    from public.app_config where key = 'telegram_bot_token';
  select value into v_chat     from public.app_config where key = 'telegram_chat_id';
  select value into v_dedicata from public.app_config where key = 'telegram_chat_id_collabora';
  if coalesce(v_token, '') = '' then
    return new;
  end if;

  v_tipo := case new.tipo
    when 'locale'    then 'Ristorante, bar o locale'
    when 'eventi'    then 'Eventi e feste'
    when 'aziende'   then 'Aziende'
    when 'creator'   then 'Creator e social'
    when 'fornitore' then 'Fornitore'
    when 'lavoro'    then 'Lavorare con noi'
    else 'Altro' end;

  if coalesce(v_dedicata, '') <> '' then
    -- Chat dei soli titolari: il messaggio completo. Il testo è tagliato a
    -- 1200 caratteri: Telegram rifiuta i messaggi oltre i 4096 (contati a
    -- modo suo, le emoji valgono doppio) e quello intero sta in dashboard.
    v_chat := v_dedicata;
    v_msg  := case when char_length(new.messaggio) > 1200
                   then left(new.messaggio, 1200) || '… (continua nel gestionale)'
                   else new.messaggio end;
    v_testo := '🤝 NUOVA PROPOSTA DI COLLABORAZIONE'
            || chr(10) || chr(10) || 'Tipo: ' || v_tipo
            || chr(10) || '👤 ' || new.nome
            || coalesce(chr(10) || '🏢 ' || new.azienda, '')
            || chr(10) || '📧 ' || new.email
            || coalesce(chr(10) || '📞 ' || new.telefono, '')
            || chr(10) || chr(10) || '📝 ' || v_msg
            || chr(10) || chr(10) || 'La trovi anche nel gestionale, scheda 🤝 Collaborazioni.';
  else
    -- Chat degli ordini: la legge anche il laboratorio. Niente nome, niente
    -- contatti e niente azienda (è un campo libero: ci può finire di tutto).
    v_testo := '🤝 Nuova proposta di collaborazione dal sito — ' || v_tipo
            || chr(10) || 'La leggono i titolari nel gestionale, scheda 🤝 Collaborazioni.';
  end if;
  if coalesce(v_chat, '') = '' then
    return new;
  end if;

  select net.http_post(
    url  := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
    body := jsonb_build_object(
      'chat_id', v_chat,
      'text', v_testo,
      'link_preview_options', jsonb_build_object('is_disabled', true)
    ),
    timeout_milliseconds := 20000
  ) into v_req;

  update public.collaborazioni set telegram_req = v_req where id = new.id;
  return new;
exception when others then
  return new;  -- l'avviso è un di più: la proposta resta salvata comunque
end $$;
revoke execute on function public.notifica_collaborazione() from public, anon, authenticated;

drop trigger if exists notifica_collaborazione_trg on public.collaborazioni;
create trigger notifica_collaborazione_trg
  after insert on public.collaborazioni
  for each row execute function public.notifica_collaborazione();


-- ── 5. Il numero in dashboard si aggiorna da solo ───────────
-- Come per gli ordini: la scheda ascolta le proposte nuove in tempo reale.
-- La RLS vale anche qui, quindi l'avviso arriva solo ai titolari. Se la
-- tabella è già nell'elenco (migrazione rilanciata) Postgres protesta: va
-- bene così. Senza tempo reale il numero si aggiorna cambiando scheda.
do $$
begin
  alter publication supabase_realtime add table public.collaborazioni;
exception when others then
  null;
end $$;


-- ── 6. Pulizia automatica: 24 mesi, lo spam 30 giorni ───────
-- Ogni notte alle 03:20 UTC. I dati personali non si tengono per sempre: è
-- la regola della conservazione minima, ed è scritta anche nel modulo.
do $$
begin
  perform cron.unschedule('pulizia-collaborazioni');
exception when others then
  null;  -- primo giro: il lavoro non c'era ancora
end $$;
select cron.schedule('pulizia-collaborazioni', '20 3 * * *', $$
  delete from public.collaborazioni
   where created_at < now() - interval '24 months'
      or (stato = 'spam' and created_at < now() - interval '30 days');
$$);


-- ── 7. Statistiche: la pagina /collabora e i suoi click ─────
-- Regola del progetto (migrations/2026-08-12-statistiche-sito.sql): un
-- evento nuovo = riga a catalogo + costante in src/lib/analytics.js + punto
-- in cui si chiama. Qui le righe a catalogo e la pagina "collabora".
--
-- `registra_evento` NON si riscrive da capo: si aggiunge 'collabora' alla
-- sua lista di pagine, lasciando tutto il resto com'è. Così, se qualcuno l'ha
-- ritoccata (a mano o con un'altra migrazione), quella modifica non si
-- perde. Se la lista non si trova, non si tocca niente e il controllo
-- finale lo dice.
do $$
declare
  v_def    text;
  v_nuova  text;
  v_pagine text[];
  v_lista  text;
  r        record;
begin
  if to_regclass('public.statistiche_eventi') is null or to_regclass('public.statistiche_sito') is null then
    return;  -- statistiche non installate: niente da fare
  end if;

  insert into public.statistiche_eventi (chiave, etichetta, tipo, gruppo, ordine) values
    ('whatsapp_collabora', 'WhatsApp — pagina Collabora con noi',     'click', 'contatti',  10),
    ('collabora_inviata',  'Proposta di collaborazione inviata',       'click', 'contatti',  11),
    ('nav_collabora',      'Menù del telefono — Collabora con noi',    'click', 'contenuti', 16),
    ('collabora_home',     'Collabora con noi — riquadro nella home',  'click', 'contenuti', 17),
    ('collabora_footer',   'Collabora con noi — piè di pagina',        'click', 'contenuti', 18)
  on conflict (chiave) do update
    set etichetta = excluded.etichetta,
        tipo      = excluded.tipo,
        gruppo    = excluded.gruppo,
        ordine    = excluded.ordine;
  -- `attivo` non si tocca: se il titolare ha spento un evento, resta spento.

  -- Il vincolo sulla colonna `pagina`: si tengono le pagine che ci sono già
  -- (anche quelle aggiunte da altri) e si aggiunge 'collabora'. La lista si
  -- riscrive come pagina in ('a', 'b', …): Postgres la conserva valore per
  -- valore, e al giro dopo si rilegge uguale.
  select array_agg(distinct m[1]) into v_pagine
    from pg_constraint c,
         regexp_matches(pg_get_constraintdef(c.oid), '''([^'']*)''', 'g') as m
   where c.conrelid = 'public.statistiche_sito'::regclass
     and c.contype = 'c'
     and pg_get_constraintdef(c.oid) ~ '[(]+pagina ';
  if v_pagine is null or not ('collabora' = any (v_pagine)) then
    select string_agg(quote_literal(s.x), ', ' order by s.x) into v_lista
      from (select distinct x
              from unnest(coalesce(v_pagine, array[]::text[])
                          || array['home','allergeni','galleria','consegna','collabora','altro']) as u(x)) as s;
    for r in
      select conname from pg_constraint
       where conrelid = 'public.statistiche_sito'::regclass
         and contype = 'c'
         and pg_get_constraintdef(oid) ~ '[(]+pagina '
    loop
      execute format('alter table public.statistiche_sito drop constraint %I', r.conname);
    end loop;
    execute 'alter table public.statistiche_sito add constraint statistiche_sito_pagina_check check (pagina in (' || v_lista || '))';
  end if;

  -- registra_evento: 'collabora' nella lista delle pagine.
  if to_regprocedure('public.registra_evento(text,text,text,text)') is not null then
    v_def := pg_get_functiondef('public.registra_evento(text,text,text,text)'::regprocedure);
    if v_def !~ '''collabora''' then
      v_nuova := regexp_replace(v_def, '(p_pagina[[:space:]]+in[[:space:]]*[(][^)]*)[)]', '\1, ''collabora'')');
      if v_nuova <> v_def then
        execute v_nuova;  -- create or replace: proprietario e permessi restano quelli di prima
      end if;
    end if;
  end if;
end $$;

-- PostgREST rilegge lo schema: le funzioni nuove sono chiamabili subito.
notify pgrst, 'reload schema';

commit;


-- ── Facoltativo: il messaggio completo in una chat dei soli titolari ──
-- Create un gruppo Telegram con i titolari e il bot degli ordini, prendete il
-- suo chat_id (inizia con -100…) e lanciate questa riga col numero giusto:
--
--   insert into public.app_config (key, value) values ('telegram_chat_id_collabora', '-100XXXXXXXXXX')
--   on conflict (key) do update set value = excluded.value;
--
-- Per tornare all'avviso breve nella chat degli ordini:
--   delete from public.app_config where key = 'telegram_chat_id_collabora';


-- ── Controllo finale: ogni riga deve dire quello che è fra parentesi ──
select 'Il pubblico può LEGGERE le proposte? (deve dire no)' as cosa,
       case when has_table_privilege('anon', 'public.collaborazioni', 'select') then 'SÌ — ERRORE' else 'no' end as valore
union all
select 'Il pubblico può SCRIVERE direttamente nella tabella? (deve dire no)',
       case when has_table_privilege('anon', 'public.collaborazioni', 'insert') then 'SÌ — ERRORE' else 'no' end
union all
select 'Il pubblico può INVIARE dal modulo? (deve dire sì)',
       case when has_function_privilege('anon', 'public.invia_collaborazione(text,text,text,text,text,text,boolean,text,integer)', 'execute') then 'sì' else 'NO — ERRORE' end
union all
select 'Dalla dashboard si possono cambiare email e testo? (deve dire no)',
       case when has_column_privilege('authenticated', 'public.collaborazioni', 'email', 'update')
              or has_column_privilege('authenticated', 'public.collaborazioni', 'messaggio', 'update') then 'SÌ — ERRORE' else 'no' end
union all
select 'Avviso Telegram (deve dire ok)',
       case when exists (select 1 from pg_trigger where tgname = 'notifica_collaborazione_trg') then 'ok' else 'MANCA' end
union all
select 'Chiavi Telegram degli ordini (deve dire ok)',
       case when coalesce((select value from public.app_config where key = 'telegram_bot_token'), '') <> ''
             and coalesce((select value from public.app_config where key = 'telegram_chat_id'), '') <> '' then 'ok' else 'MANCANO' end
union all
select 'Chat Telegram dei soli titolari (facoltativa)',
       case when coalesce((select value from public.app_config where key = 'telegram_chat_id_collabora'), '') <> ''
            then 'sì: messaggio completo' else 'no: avviso breve nella chat degli ordini' end
union all
select 'Numero in dashboard in tempo reale (deve dire ok)',
       case when exists (select 1 from pg_publication_tables
                          where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'collaborazioni')
            then 'ok' else 'no: si aggiorna cambiando scheda' end
union all
select 'Pulizia automatica dopo 24 mesi (deve dire ok)',
       case when exists (select 1 from cron.job where jobname = 'pulizia-collaborazioni') then 'ok' else 'MANCA' end
union all
select 'Pagina "collabora" nelle statistiche (deve dire ok)',
       case when exists (select 1 from pg_constraint
                          where conrelid = to_regclass('public.statistiche_sito')
                            and conname = 'statistiche_sito_pagina_check'
                            and pg_get_constraintdef(oid) like '%collabora%')
             and coalesce(pg_get_functiondef(to_regprocedure('public.registra_evento(text,text,text,text)')), '') like '%''collabora''%'
            then 'ok' else 'NO — le visite finiscono in "Altre pagine"' end
union all
select 'Click nuovi a catalogo (deve dire 5)',
       (select count(*)::text from public.statistiche_eventi
         where chiave in ('whatsapp_collabora','collabora_inviata','nav_collabora','collabora_home','collabora_footer'));
