-- ============================================================
-- PROMEMORIA: NIENTE DOPPIONI, «TOGLI SOLO QUESTO», ANNIVERSARIO — 2026-10-09
-- Da eseguire su Supabase (SQL Editor) UNA VOLTA, tutto insieme, dopo le
-- migrazioni dei promemoria già fatte (2026-07-26-promemoria-compleanno,
-- -fix-token-promemoria, -fix-invio-promemoria e 2026-08-10-dominio-definitivo).
-- È rieseguibile: ogni passo controlla se è già stato fatto.
-- Serve public.is_staff() (c'è già: la usano statistiche e codici).
--
-- Il sito funziona sia prima sia dopo questa migrazione: si può lanciare
-- prima o dopo il deploy, l'ordine non conta.
--
-- Cosa cambia, in breve:
--  1. NIENTE DOPPIONI NÉ MAIL DI TROPPO
--     · al massimo UNA mail al giorno per indirizzo;
--     · due ordini per la stessa festa (stessa email, stessa occasione, date a
--       3 giorni o meno) → il cliente riceve le mail UNA volta sola;
--     · ordine annullato → i suoi promemoria si fermano (e ripartono se
--       l'ordine torna fra quelli da fare). Email, data o occasione corrette
--       sull'ordine → i promemoria non ancora partiti si aggiornano;
--     · «Invia ora» e «Rimetti in coda» non rimandano MAI una mail già partita;
--     · due giri non possono sovrapporsi; una mail per giro (EmailJS accetta
--       una richiesta al secondo), e solo fra le 9 e le 12 ora italiana;
--     · se EmailJS risponde «troppe richieste» (429) si riprova: in quel caso
--       nessuna mail è partita, quindi non nasce un doppione. Se la risposta è
--       incerta (errore del server di EmailJS, rete lenta) NON si riprova:
--       meglio una mail persa che due;
--     · la risposta di EmailJS si legge tutto il giorno, ogni 10 minuti: anche
--       un «Invia ora» del pomeriggio rifiutato da EmailJS risulta «errore» e
--       si può rimettere in coda (prima restava «inviato» per sempre, e lo
--       staff credeva che fosse arrivata).
--  2. «TOGLI SOLO QUESTO»: nella mail c'è un link nuovo (?togli=) che ferma solo
--     quella ricorrenza, senza disiscrivere l'indirizzo da tutto, e vale PER
--     SEMPRE: anche gli ordini futuri per la stessa festa non la ricordano più.
--     Lo staff dal gestionale toglie le mail in arrivo di una festa, e può
--     disiscrivere o riattivare un indirizzo.
--  3. ANNIVERSARIO: anche l'occasione «Anniversario» crea i due promemoria, per
--     gli ordini NUOVI fatti col sito che mostra l'avviso. Le mail partono
--     solo dopo aver aggiornato il template EmailJS (docs/PROMEMORIA-COMPLEANNO.md;
--     l'ultimo passo è la riga in fondo a questo file).
--  4. Le funzioni che spediscono non si possono più chiamare dal sito pubblico
--     (oggi sì: su Supabase ogni funzione nuova nasce aperta a tutti).
-- ============================================================

begin;

-- ── 0. Serve is_staff() ──────────────────────────────────────
-- Le azioni dello staff controllano DENTRO la funzione che chi chiama sia del
-- personale: "autenticato" non basta (vedi 2026-08-12-statistiche-sito.sql).
do $$
begin
  if to_regprocedure('public.is_staff()') is null then
    raise exception 'Manca public.is_staff(): non è stato cambiato niente. Avvisa chi gestisce il sito.';
  end if;
end $$;

-- ── 1. Coda: le colonne nuove ────────────────────────────────
--  occasione    'Compleanno' | 'Anniversario' (cambia le parole della mail)
--  anniversario la data della festa da ricordare (ritiro + 1 anno): serve a
--               riconoscere la STESSA festa su ordini diversi
--  tentativi    quante volte è stata passata a EmailJS (tetto ai nuovi tentativi)
--  esito        cosa ha risposto EmailJS ('ok 200', 'EmailJS 400', 'incerto: …')
alter table public.promemoria_compleanno add column if not exists occasione    text    not null default 'Compleanno';
alter table public.promemoria_compleanno add column if not exists anniversario date;
alter table public.promemoria_compleanno add column if not exists tentativi    integer not null default 0;
alter table public.promemoria_compleanno add column if not exists esito        text;

-- Le righe già in coda erano tutte di compleanno: basta la data.
update public.promemoria_compleanno p
   set anniversario = (o.ritiro_data + interval '1 year')::date
  from public.ordini o
 where o.id = p.ordine_id and p.anniversario is null and o.ritiro_data is not null;
-- Rete di sicurezza (ordine senza data, non dovrebbe esistere): si ricava
-- dalla data d'invio, che è 30 o 14 giorni prima.
update public.promemoria_compleanno
   set anniversario = invio_previsto + case tipo when 'primo' then 30 else 14 end
 where anniversario is null;

create index if not exists promemoria_email_idx on public.promemoria_compleanno (email, stato);

-- Un ordine = al massimo un "primo" e un "secondo". Se per qualche motivo ci
-- fossero già doppioni, l'indice non si crea e lo dice il controllo in fondo:
-- niente cancellazioni automatiche, si guardano a mano.
do $$
begin
  if exists (select 1 from public.promemoria_compleanno
              group by ordine_id, tipo having count(*) > 1) then
    raise notice 'ATTENZIONE: promemoria doppi per lo stesso ordine, indice unico NON creato.';
  else
    create unique index if not exists promemoria_ordine_tipo_uidx
      on public.promemoria_compleanno (ordine_id, tipo);
  end if;
end $$;

-- Le feste tolte dal cliente col link «Non ricordarmi più questa ricorrenza».
-- La pagina gli dice «non ti ricorderemo più il compleanno del 3 novembre»:
-- deve valere anche gli anni dopo, quando ordina di nuovo per la stessa festa
-- (al banco l'interruttore dei promemoria è acceso di partenza e lui l'avviso
-- non lo vede). Sta in una tabella a sé, come i disiscritti, perché le righe
-- della coda spariscono se l'ordine viene eliminato: la scelta del cliente no.
--  festa = la data della festa della mail da cui l'ha tolta; vale lo stesso
--          giorno (±3, come la regola della stessa festa) di ogni anno.
create table if not exists public.promemoria_tolti (
  email     text not null,
  occasione text not null,
  festa     date not null,
  creato_il timestamptz not null default now(),
  primary key (email, occasione, festa)
);
alter table public.promemoria_tolti enable row level security;
-- La scrive solo togli_promemoria (qui sotto); lo staff può leggerla.
revoke all on public.promemoria_tolti from anon, authenticated;
grant select on public.promemoria_tolti to authenticated;
drop policy if exists "promemoria_tolti_read_staff" on public.promemoria_tolti;
create policy "promemoria_tolti_read_staff" on public.promemoria_tolti
  for select to authenticated using (public.is_staff());

-- Se una versione precedente di questa migrazione è già girata, le feste già
-- tolte dal cliente entrano nella tabella.
insert into public.promemoria_tolti (email, occasione, festa)
select distinct p.email, p.occasione, p.anniversario
  from public.promemoria_compleanno p
 where p.nota = 'tolto dal cliente' and p.anniversario is not null
on conflict do nothing;

-- ── 2. Regole di base ────────────────────────────────────────

-- Quali occasioni hanno il promemoria. Confronto "largo": se in dashboard
-- l'occasione diventa "Compleanno 🎂" o "Anniversario di matrimonio" il
-- promemoria continua a funzionare (prima bastava rinominarla per spegnerlo
-- senza accorgersene). La stessa regola è in src/lib/promemoriaRegole.js.
create or replace function public.promemoria_occasione(p_occasion text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_occasion ~* 'compleann'   then 'Compleanno'
    when p_occasion ~* 'anniversari' then 'Anniversario'
  end;
$$;

-- Due righe parlano della STESSA festa se sono dello stesso ordine, oppure se
-- hanno stessa email, stessa occasione e date a 3 giorni o meno (doppio
-- pagamento, due torte per la stessa festa, ordine rifatto). Vale sia per
-- non mandare doppioni sia per «togli solo questo».
create or replace function public.promemoria_stessa_ricorrenza(
  a_ordine uuid, a_email text, a_occasione text, a_anniversario date,
  b_ordine uuid, b_email text, b_occasione text, b_anniversario date)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(
           a_ordine = b_ordine
           or (a_email = b_email and a_occasione = b_occasione
               and abs(a_anniversario - b_anniversario) <= 3),
           false);
$$;

-- La stessa festa in anni diversi: stesso giorno dell'anno, 3 giorni o meno di
-- differenza. La data b si porta nell'anno di a (e in quello prima e dopo, per
-- le feste a cavallo di Capodanno: 30 dicembre e 2 gennaio sono vicine). Il
-- 29 febbraio, negli anni che non ce l'hanno, diventa il 28.
create or replace function public.promemoria_stesso_giorno_anno(a date, b date)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(bool_or(
           abs(a - (b + make_interval(years => (extract(year from a) - extract(year from b))::int + k))::date) <= 3),
         false)
    from generate_series(-1, 1) as k;
$$;

-- Questa festa (indirizzo, occasione, data) il cliente l'ha tolta per sempre?
create or replace function public.promemoria_festa_tolta(p_email text, p_occasione text, p_festa date)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (select 1 from public.promemoria_tolti t
                  where t.email = p_email and t.occasione = p_occasione
                    and public.promemoria_stesso_giorno_anno(p_festa, t.festa));
$$;

-- Le parole che cambiano nella mail: diventano variabili del template EmailJS.
create or replace function public.promemoria_testi(p_occasione text)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case p_occasione
    when 'Anniversario' then jsonb_build_object(
      'occasione',            'anniversario',
      'ricorrenza',           'l''anniversario',
      'ricorrenza_maiuscola', 'L''anniversario',
      'emoji',                '🥂',
      'motivo',               'una torta per un anniversario')
    else jsonb_build_object(
      'occasione',            'compleanno',
      'ricorrenza',           'il compleanno',
      'ricorrenza_maiuscola', 'Il compleanno',
      'emoji',                '🎂',
      'motivo',               'una torta di compleanno')
  end;
$$;

-- Le mail partono solo di mattina, ora italiana (cambio d'ora compreso).
create or replace function public.promemoria_ora_di_invio()
returns boolean
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'Europe/Rome')::time between time '09:00' and time '12:00';
$$;

-- Il template EmailJS è già stato aggiornato con le parole variabili? Finché
-- no, i promemoria di ANNIVERSARIO restano in coda: partirebbero con scritto
-- "il compleanno". Si accende con la riga in fondo a questo file.
create or replace function public.promemoria_template_ricorrenze()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select value from public.app_config
                    where key = 'promemoria_template_ricorrenze'), '') = 'si';
$$;

-- ── 3. Mettere in coda i due promemoria di un ordine ─────────
-- dettagli.promemoria lo scrive il sito nuovo (configuratore):
--   true  = il cliente ha visto l'avviso "tra un anno ti scriveremo"
--           (anche per l'anniversario), oppure lo staff al banco ha lasciato
--           acceso l'interruttore "Promemoria tra un anno";
--   false = lo staff l'ha spento (ordine di prova, cliente che non lo vuole).
-- Gli ordini fatti col sito VECCHIO non ce l'hanno: per il compleanno vale
-- come prima, l'anniversario invece no (quel cliente l'avviso non l'ha visto).
create or replace function public.accoda_promemoria(p_ordine_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  o       public.ordini%rowtype;
  v_email text;
  v_occ   text;
  v_anniv date;
  v_token text;
  n       integer := 0;
begin
  select * into o from public.ordini where id = p_ordine_id;
  if not found then return 0; end if;

  v_email := lower(coalesce(nullif(trim(o.cliente_email), ''), nullif(trim(o.email), ''), ''));
  v_occ   := public.promemoria_occasione(o.dettagli ->> 'occasion');

  if o.promemoria_ok is not true                                        then return 0; end if;
  if coalesce(o.dettagli ->> 'promemoria', '') = 'false'                then return 0; end if;
  if coalesce(o.stato, '') = 'annullato'                                then return 0; end if;
  if v_occ is null or o.ritiro_data is null                             then return 0; end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'       then return 0; end if;
  -- Come deciso a luglio: lo storico precedente al 26/07/2026 resta fuori.
  if o.created_at < timestamptz '2026-07-26 15:00:00+00'                then return 0; end if;
  if v_occ <> 'Compleanno' and coalesce(o.dettagli ->> 'promemoria', '') <> 'true' then return 0; end if;
  if exists (select 1 from public.promemoria_stop s where s.email = v_email) then return 0; end if;

  v_anniv := (o.ritiro_data + interval '1 year')::date;
  -- Festa tolta dal cliente col link della mail, anche anni fa: non si
  -- ricorda più (gli altri promemoria dello stesso indirizzo sì).
  if public.promemoria_festa_tolta(v_email, v_occ, v_anniv) then return 0; end if;
  -- Stesso token per le due mail dello stesso ordine.
  select min(token) into v_token from public.promemoria_compleanno where ordine_id = o.id;
  v_token := coalesce(v_token, replace(gen_random_uuid()::text, '-', ''));

  insert into public.promemoria_compleanno
         (ordine_id, email, nome, tipo, invio_previsto, token, occasione, anniversario)
  select o.id, v_email, o.cliente_nome, t.tipo, v_anniv - t.giorni, v_token, v_occ, v_anniv
    from (values ('primo', 30), ('secondo', 14)) as t(tipo, giorni)
   where not exists (select 1 from public.promemoria_compleanno p
                      where p.ordine_id = o.id and p.tipo = t.tipo);
  get diagnostics n = row_count;
  return n;
end $$;

-- Il trigger di sempre (crea_promemoria_compleanno_trg, dopo l'inserimento di
-- un ordine): cambia solo la funzione, che ora passa da accoda_promemoria.
create or replace function public.crea_promemoria_compleanno()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.accoda_promemoria(new.id);
  return new;
exception when others then
  -- Non deve MAI bloccare il salvataggio dell'ordine, ma ora l'errore resta
  -- nei log di Postgres (prima spariva: è così che il baco del token di luglio
  -- era rimasto nascosto).
  raise warning 'promemoria non creato per l''ordine %: % (%)', new.id, sqlerrm, sqlstate;
  return new;
end $$;

drop trigger if exists crea_promemoria_compleanno_trg on public.ordini;
create trigger crea_promemoria_compleanno_trg
  after insert on public.ordini
  for each row execute function public.crea_promemoria_compleanno();

-- Anniversari ordinati col sito NUOVO prima di questa migrazione (se il sito
-- è andato online prima): il cliente l'avviso l'ha visto, ma il trigger
-- vecchio non li conosceva. Solo quelli con dettagli.promemoria = true, cioè
-- dal sito nuovo; valgono tutte le altre regole (annullati, disiscritti…).
do $$
declare n integer;
begin
  select coalesce(sum(public.accoda_promemoria(o.id)), 0) into n
    from public.ordini o
   where public.promemoria_occasione(o.dettagli ->> 'occasion') = 'Anniversario'
     and o.dettagli ->> 'promemoria' = 'true'
     and not exists (select 1 from public.promemoria_compleanno p where p.ordine_id = o.id);
  if n > 0 then
    raise notice 'Promemoria di anniversario recuperati: %', n;
  end if;
end $$;

-- ── 4. Se l'ordine cambia, i promemoria non ancora partiti lo seguono ──
-- Annullato → si fermano. Rimesso fra quelli da fare → ripartono. Email, data,
-- occasione o nome corretti → si aggiornano. Quelli già inviati non si toccano,
-- e nemmeno quelli tolti dal cliente o dallo staff.
create or replace function public.sincronizza_promemoria_ordine()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email  text := lower(coalesce(nullif(trim(new.cliente_email), ''), nullif(trim(new.email), ''), ''));
  v_occ    text := public.promemoria_occasione(new.dettagli ->> 'occasion');
  v_anniv  date := (new.ritiro_data + interval '1 year')::date;
  v_data   boolean := old.ritiro_data is distinct from new.ritiro_data;
  v_motivo text;
begin
  v_motivo := case
    when coalesce(new.stato, '') = 'annullato' then 'ordine annullato'
    when new.promemoria_ok is not true
      or coalesce(new.dettagli ->> 'promemoria', '') = 'false' then 'promemoria spento sull''ordine'
    when v_occ is null then 'occasione cambiata'
    when v_occ <> 'Compleanno'
     and coalesce(new.dettagli ->> 'promemoria', '') <> 'true' then 'occasione cambiata'
    when new.ritiro_data is null then 'data di ritiro tolta'
    when v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then 'email tolta dall''ordine'
    -- Corretta la data (o l'email): ora è una festa che il cliente ha tolto.
    when public.promemoria_festa_tolta(v_email, v_occ, v_anniv) then 'tolto dal cliente (stessa ricorrenza)'
  end;

  if v_motivo is not null then
    update public.promemoria_compleanno
       set stato = 'annullato', nota = v_motivo
     where ordine_id = new.id and stato in ('in_attesa', 'errore');
    return new;
  end if;

  -- Dati nuovi sulle righe non ancora partite. Le date si ricalcolano solo se
  -- è cambiata la data di ritiro (una riga rimessa in coda a mano per oggi non
  -- deve tornare a una data già passata).
  update public.promemoria_compleanno p
     set email          = v_email,
         nome           = new.cliente_nome,
         occasione      = v_occ,
         anniversario   = case when v_data or p.anniversario is null then v_anniv else p.anniversario end,
         invio_previsto = case when v_data
                               then v_anniv - case p.tipo when 'primo' then 30 else 14 end
                               else p.invio_previsto end
   where p.ordine_id = new.id and p.stato <> 'inviato' and p.inviato_il is null;

  -- Ripartono solo quelli che aveva fermato questo stesso trigger (o il giro,
  -- per una festa tolta dal cliente che, con la correzione, non è più quella).
  update public.promemoria_compleanno p
     set stato = 'in_attesa', nota = null
   where p.ordine_id = new.id and p.stato = 'annullato' and p.inviato_il is null
     and p.nota in ('ordine annullato', 'promemoria spento sull''ordine', 'occasione cambiata',
                    'data di ritiro tolta', 'email tolta dall''ordine',
                    'tolto dal cliente (stessa ricorrenza)');

  -- Se non ce n'erano (es. occasione diventata Compleanno) li crea adesso.
  perform public.accoda_promemoria(new.id);
  return new;
exception when others then
  raise warning 'promemoria non aggiornati per l''ordine %: % (%)', new.id, sqlerrm, sqlstate;
  return new;
end $$;

-- Scatta solo per i cambi che contano: gli aggiornamenti di servizio (esito
-- della mail di conferma, stato in lavorazione → pronto, note…) non lo toccano.
drop trigger if exists sincronizza_promemoria_trg on public.ordini;
create trigger sincronizza_promemoria_trg
  after update of stato, ritiro_data, cliente_email, email, dettagli, promemoria_ok, cliente_nome
  on public.ordini
  for each row
  when (
       (coalesce(old.stato, '') = 'annullato') is distinct from (coalesce(new.stato, '') = 'annullato')
    or old.ritiro_data   is distinct from new.ritiro_data
    or old.cliente_email is distinct from new.cliente_email
    or old.email         is distinct from new.email
    or old.promemoria_ok is distinct from new.promemoria_ok
    or old.cliente_nome  is distinct from new.cliente_nome
    or (old.dettagli ->> 'occasion')   is distinct from (new.dettagli ->> 'occasion')
    or (old.dettagli ->> 'promemoria') is distinct from (new.dettagli ->> 'promemoria')
  )
  execute function public.sincronizza_promemoria_ordine();

-- ── 5. La spedizione di UNA mail ─────────────────────────────
-- Cambia la firma (terzo parametro per provare la versione "anniversario"):
-- va tolta la vecchia, altrimenti Postgres ne terrebbe due.
drop function if exists public.invia_un_promemoria(uuid, text);

create or replace function public.invia_un_promemoria(
  p_id uuid, p_email_override text default null, p_occasione text default null)
returns bigint
language plpgsql
security definer
set search_path = public, net
as $$
declare
  r record;
  v_service text; v_template text; v_user text; v_access text; v_site text;
  v_gusti text; v_torta text; v_anniv date; v_dest text; v_req bigint; v_occ text; v_link text;
begin
  select p.email, p.nome, p.token, p.occasione, p.anniversario, o.tipo, o.dettagli, o.ritiro_data
    into r
    from public.promemoria_compleanno p
    join public.ordini o on o.id = p.ordine_id
   where p.id = p_id;
  if not found then return null; end if;

  select value into v_service  from public.app_config where key = 'emailjs_service_id';
  select value into v_template from public.app_config where key = 'emailjs_template_compleanno';
  select value into v_user     from public.app_config where key = 'emailjs_public_key';
  select value into v_access   from public.app_config where key = 'emailjs_private_key';
  select value into v_site     from public.app_config where key = 'site_url';
  if coalesce(v_service, '') = '' or coalesce(v_template, '') = ''
     or coalesce(v_user, '') = '' or coalesce(v_access, '') = '' then
    return null;
  end if;
  v_site := coalesce(nullif(v_site, ''), 'https://www.gelateriapuntogi.it');

  v_dest  := coalesce(nullif(trim(p_email_override), ''), r.email);
  v_occ   := coalesce(public.promemoria_occasione(p_occasione), r.occasione, 'Compleanno');
  v_anniv := coalesce(r.anniversario, (r.ritiro_data + interval '1 year')::date);
  select string_agg(f ->> 'name', ', ')
    into v_gusti
    from jsonb_array_elements(coalesce(r.dettagli -> 'flavors', '[]'::jsonb)) f;
  v_torta := coalesce(r.tipo, 'la tua torta')
             || case when coalesce(v_gusti, '') <> '' then ' — ' || v_gusti else '' end;
  -- Nella copia di PROVA i due link "smetti" sono finti: chi prova la mail e
  -- ci clicca sopra non deve togliere i promemoria al cliente vero (prima
  -- succedeva: la prova conteneva il link di disiscrizione del cliente).
  v_link := case when p_email_override is null then r.token else 'prova' end;

  -- Solo per le prove SQL (migrations/2026-10-09-promemoria-ricorrenze-prova.sql):
  -- segna la mail come spedita senza chiamare EmailJS.
  if current_setting('app.promemoria_finto', true) = 'on' then return -1; end if;

  select net.http_post(
    url  := 'https://api.emailjs.com/api/v1.0/email/send',
    body := jsonb_build_object(
      'service_id',  v_service,
      'template_id', v_template,
      'user_id',     v_user,
      'accessToken', v_access,
      'template_params', jsonb_build_object(
        'email',       v_dest,
        'cliente',     coalesce(nullif(split_part(coalesce(r.nome, ''), ' ', 1), ''), 'ciao'),
        'torta',       v_torta,
        'quando',      to_char(v_anniv, 'DD/MM/YYYY'),
        'anno_scorso', to_char(r.ritiro_data, 'DD/MM/YYYY'),
        'link_torta',  v_site || '/?torta=' || r.token,
        'link_togli',  v_site || '/?togli=' || v_link,
        'link_stop',   v_site || '/?stop='  || v_link
      ) || public.promemoria_testi(v_occ)
    ),
    timeout_milliseconds := 20000
  ) into v_req;

  return v_req;
exception when others then
  return null;
end $$;

-- ── 6. Si può spedire? Le regole in un posto solo ────────────
-- Restituisce NULL se la mail può partire, altrimenti il motivo (finisce
-- nella nota della riga). La usano il giro automatico e «Invia ora».
-- p_manuale = true («Invia ora»): decide lo staff, quindi non contano il
-- ritardo e "ha già ordinato"; tutto il resto sì.
create or replace function public.promemoria_ostacolo(p_id uuid, p_manuale boolean default false)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r     record;
  v_tel text;
begin
  select p.id, p.ordine_id, p.email, p.tipo, p.occasione, p.anniversario, p.invio_previsto,
         o.stato as stato_ordine, o.cliente_telefono
    into r
    from public.promemoria_compleanno p
    join public.ordini o on o.id = p.ordine_id
   where p.id = p_id;
  if not found then return 'promemoria non trovato'; end if;

  if coalesce(r.stato_ordine, '') = 'annullato' then return 'ordine annullato'; end if;
  if exists (select 1 from public.promemoria_stop s where s.email = r.email) then return 'disiscritto'; end if;
  if r.anniversario <= current_date then return 'ricorrenza già passata'; end if;
  -- Giro fermo a lungo: non spedire promemoria ormai fuori tempo.
  if not p_manuale and r.invio_previsto < current_date - 7 then return 'fuori tempo'; end if;

  -- Il cliente ha tolto questa festa dal link della mail: quest'anno o in un
  -- anno qualsiasi, anche da un altro ordine per la stessa festa (per esempio
  -- una data di ritiro corretta dopo, che porta l'ordine su quella festa).
  if public.promemoria_festa_tolta(r.email, r.occasione, r.anniversario)
     or exists (select 1 from public.promemoria_compleanno q
                 where q.id <> r.id and q.stato = 'annullato' and q.nota like 'tolto dal cliente%'
                   and public.promemoria_stessa_ricorrenza(q.ordine_id, q.email, q.occasione, q.anniversario,
                                                           r.ordine_id, r.email, r.occasione, r.anniversario)) then
    return 'tolto dal cliente (stessa ricorrenza)';
  end if;

  -- Questa festa è già stata ricordata con un altro ordine (stessa mail, 30 o 14 giorni).
  if exists (select 1 from public.promemoria_compleanno q
              where q.id <> r.id and q.ordine_id <> r.ordine_id
                and q.stato = 'inviato' and q.tipo = r.tipo
                and public.promemoria_stessa_ricorrenza(q.ordine_id, q.email, q.occasione, q.anniversario,
                                                        r.ordine_id, r.email, r.occasione, r.anniversario)) then
    return 'doppione: stessa ricorrenza di un altro ordine';
  end if;

  -- Una mail per questa festa è partita da meno di una settimana (succede solo
  -- dopo un ritardo o un intervento a mano: di norma fra le due passano 16 giorni).
  if exists (select 1 from public.promemoria_compleanno q
              where q.id <> r.id and q.stato = 'inviato' and q.inviato_il > now() - interval '7 days'
                and public.promemoria_stessa_ricorrenza(q.ordine_id, q.email, q.occasione, q.anniversario,
                                                        r.ordine_id, r.email, r.occasione, r.anniversario)) then
    return 'già ricordato pochi giorni fa';
  end if;

  -- Ha già ordinato (stessa email o stesso telefono, ordini non annullati):
  -- negli ultimi 60 giorni, oppure ha già una torta prenotata per questa festa.
  if not p_manuale then
    v_tel := right(regexp_replace(coalesce(r.cliente_telefono, ''), '\D', '', 'g'), 10);
    if exists (
      select 1 from public.ordini o2
       where o2.id <> r.ordine_id
         and coalesce(o2.stato, '') <> 'annullato'
         and (lower(coalesce(nullif(trim(o2.cliente_email), ''), nullif(trim(o2.email), ''), '')) = r.email
              or (length(v_tel) = 10
                  and right(regexp_replace(coalesce(o2.cliente_telefono, ''), '\D', '', 'g'), 10) = v_tel))
         and (o2.created_at > now() - interval '60 days'
              or o2.ritiro_data between r.anniversario - 21 and r.anniversario + 7)
    ) then
      return 'ha già ordinato';
    end if;
  end if;

  return null;
end $$;

-- ── 7. Il giro automatico ────────────────────────────────────

-- (a) Cosa ha risposto EmailJS. pg_net tiene le risposte solo 6 ore: chi non
--     le legge in tempo non saprà mai se una mail è partita. Per questo la
--     lettura sta in una funzione a sé, che gira TUTTO IL GIORNO (lavoro
--     'promemoria-esiti', qui sotto) e non solo con il giro del mattino: un
--     «Invia ora» del pomeriggio rifiutato da EmailJS (per esempio con il
--     template appena cambiato) risultava «inviato» per sempre, e lo staff non
--     poteva nemmeno rimetterlo in coda.
create or replace function public.leggi_esiti_promemoria()
returns integer
language plpgsql
security definer
set search_path = public, net
as $$
declare
  r       record;
  st      integer;
  err     text;
  v_corpo text;
  n       integer := 0;
begin
  -- Mai insieme al giro o a «Invia ora» (stesso lucchetto): un 429 letto
  -- mentre il giro sta rispedendo la stessa mail la rimetterebbe in coda una
  -- volta di troppo. Se è occupato non aspetta: ci pensa il giro, che legge
  -- gli esiti da sé, o il prossimo passaggio. Dentro il giro, che il
  -- lucchetto ce l'ha già, la richiesta passa subito (in Postgres chi tiene
  -- un lucchetto di questo tipo lo può chiedere di nuovo).
  if not pg_try_advisory_xact_lock(hashtext('punto_gi_promemoria')) then
    return 0;
  end if;

  -- Ogni aggiornamento qui sotto ricontrolla che la riga sia ancora la mail
  -- spedita con QUELLA richiesta: se nel frattempo qualcuno l'ha cambiata
  -- (es. dal pannello vecchio), si lascia stare.
  for r in
    select id, net_req, tentativi
      from public.promemoria_compleanno
     where stato = 'inviato' and esito is null and net_req > 0
       and inviato_il > now() - interval '5 hours'
  loop
    st := null; err := null; v_corpo := null;
    select h.status_code, h.error_msg, h.content
      into st, err, v_corpo
      from net._http_response h
     where h.id = r.net_req;

    if st between 200 and 299 then
      update public.promemoria_compleanno set esito = 'ok ' || st
       where id = r.id and stato = 'inviato' and net_req = r.net_req;
    elsif st = 429 then
      -- EmailJS era occupato e l'ha RIFIUTATA: nessuna mail è partita, quindi
      -- riprovare non crea doppioni. Al massimo 3 volte, e sempre dal giro
      -- (fra le 9 e le 12), anche se era un «Invia ora» del pomeriggio.
      if r.tentativi < 3 then
        update public.promemoria_compleanno
           set stato = 'in_attesa', invio_previsto = least(invio_previsto, current_date),
               inviato_il = null, net_req = null,
               nota = 'EmailJS era occupato (429): non è partita, riprovo da solo al prossimo giro (fra le 9 e le 12)'
         where id = r.id and stato = 'inviato' and net_req = r.net_req;
      else
        update public.promemoria_compleanno
           set stato = 'errore', esito = 'EmailJS 429', inviato_il = null, net_req = null,
               nota = 'EmailJS occupato per 3 volte: non è partita. Rimetti in coda più tardi.'
         where id = r.id and stato = 'inviato' and net_req = r.net_req;
      end if;
    elsif st between 400 and 499 then
      -- Rifiuto netto (template sbagliato, chiavi, API non abilitata…): la mail
      -- non è partita. Niente nuovo tentativo automatico: si sistema, poi
      -- «Rimetti in coda» dal gestionale.
      update public.promemoria_compleanno
         set stato = 'errore', esito = 'EmailJS ' || st, inviato_il = null, net_req = null,
             nota = 'EmailJS l''ha rifiutata (' || st
                    || coalesce(': ' || left(nullif(coalesce(nullif(v_corpo, ''), err), ''), 150), '')
                    || '): non è partita'
       where id = r.id and stato = 'inviato' and net_req = r.net_req;
    elsif st is not null then
      -- Errore del server di EmailJS: forse è partita, forse no. Non si
      -- riprova da soli (sarebbe un possibile doppione).
      update public.promemoria_compleanno set esito = 'incerto: EmailJS ' || st
       where id = r.id and stato = 'inviato' and net_req = r.net_req;
    elsif err is not null then
      -- Rete lenta o caduta: stesso discorso, esito sconosciuto.
      update public.promemoria_compleanno set esito = 'incerto: ' || left(err, 150)
       where id = r.id and stato = 'inviato' and net_req = r.net_req;
    else
      continue; -- nessuna risposta ancora: si riguarda al prossimo passaggio
    end if;
    n := n + 1;
  end loop;

  update public.promemoria_compleanno
     set esito = 'non verificato'
   where stato = 'inviato' and esito is null and inviato_il <= now() - interval '5 hours';

  return n;
end $$;

-- Cambia la firma (parametro per le prove): via la vecchia senza parametri.
drop function if exists public.invia_promemoria_compleanno();

create or replace function public.invia_promemoria_compleanno(p_ignora_orario boolean default false)
returns integer
language plpgsql
security definer
set search_path = public, net
as $$
declare
  r        record;
  v_req    bigint;
  v_motivo text;
begin
  -- Un giro alla volta: due giri sovrapposti (cron + una chiamata a mano)
  -- leggerebbero le stesse righe e manderebbero la stessa mail due volte.
  if not pg_try_advisory_xact_lock(hashtext('punto_gi_promemoria')) then
    return 0;
  end if;

  -- (a) Prima gli esiti degli invii precedenti: così un 429 si riprova già in
  --     questo giro. Il lucchetto è lo stesso, e il giro ce l'ha già.
  perform public.leggi_esiti_promemoria();

  if not p_ignora_orario and not public.promemoria_ora_di_invio() then return 0; end if;
  -- EmailJS non configurato: non spedisce nulla (la coda resta lì, non si perde niente).
  if not public.promemoria_configurato() then return 0; end if;

  -- (b) UNA mail per giro (EmailJS accetta 1 richiesta al secondo; il giro
  --     passa ogni 2 minuti). Saltati gli indirizzi che hanno già ricevuto un
  --     promemoria nelle ultime 20 ore: al massimo una mail al giorno a testa.
  for r in
    select p.id, p.inviato_il, p.occasione
      from public.promemoria_compleanno p
     where p.stato = 'in_attesa'
       and p.invio_previsto <= current_date
       and not exists (select 1 from public.promemoria_compleanno q
                        where q.email = p.email and q.stato = 'inviato'
                          and q.inviato_il > now() - interval '20 hours')
     order by p.invio_previsto, p.created_at, p.tipo
     for update of p skip locked
  loop
    -- Riga già partita e rimessa "in coda" a mano (pannello vecchio o SQL):
    -- non si rispedisce.
    if r.inviato_il is not null then
      update public.promemoria_compleanno
         set stato = 'inviato', nota = 'era già stato inviato: non lo rimando'
       where id = r.id;
      continue;
    end if;

    v_motivo := public.promemoria_ostacolo(r.id, false);
    if v_motivo is not null then
      update public.promemoria_compleanno set stato = 'annullato', nota = v_motivo where id = r.id;
      continue;
    end if;

    -- Anniversario: resta in coda finché il template EmailJS non è aggiornato.
    if r.occasione <> 'Compleanno' and not public.promemoria_template_ricorrenze() then
      continue;
    end if;

    v_req := public.invia_un_promemoria(r.id);
    if v_req is null then
      update public.promemoria_compleanno
         set stato = 'errore', nota = 'invio non riuscito (pg_net): non è partita', tentativi = tentativi + 1
       where id = r.id;
      return 0;
    end if;

    update public.promemoria_compleanno
       set stato = 'inviato', inviato_il = now(), net_req = v_req, esito = null,
           tentativi = tentativi + 1, nota = null
     where id = r.id;
    return 1;
  end loop;

  return 0;
end $$;

-- Il giro: ogni 2 minuti fra le 7 e le 11:58 UTC (9-14 d'estate, 8-13
-- d'inverno, ora italiana). Le mail partono solo fra le 9 e le 12 italiane.
do $$
begin
  perform cron.unschedule('promemoria-compleanno');
exception when others then
  null;
end $$;
select cron.schedule('promemoria-compleanno', '*/2 7-11 * * *', $$ select public.invia_promemoria_compleanno(); $$);

-- Gli esiti: ogni 10 minuti, tutto il giorno (anche quello di un «Invia ora»
-- fatto nel pomeriggio). Non spedisce niente: legge e basta. Passa ai minuti
-- 5, 15, 25…, mentre il giro passa ai minuti pari: così non partono mai nello
-- stesso istante e nessuno dei due salta un turno per il lucchetto dell'altro.
-- (Le copie di «Prova» non vanno nella coda: il loro esito non si segue.)
do $$
begin
  perform cron.unschedule('promemoria-esiti');
exception when others then
  null;
end $$;
select cron.schedule('promemoria-esiti', '5,15,25,35,45,55 * * * *', $$ select public.leggi_esiti_promemoria(); $$);

-- ── 8. Azioni dello staff (gestionale) ───────────────────────
-- Tutte controllano is_staff() da sé. Quando dicono di no, lo dicono con un
-- errore: il gestionale lo mostra in rosso, così non sembra un'azione riuscita.

-- «Invia ora»: manda adesso al cliente. Mai una mail già partita, mai a un
-- disiscritto, mai a un ordine annullato, mai due promemoria in 20 ore.
create or replace function public.invia_promemoria_ora(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r        record;
  v_req    bigint;
  v_motivo text;
begin
  if public.is_staff() is not true then
    raise exception 'Riservato al personale.';
  end if;

  -- Se proprio adesso sta girando il giro automatico, si aspetta che finisca
  -- (meno di un secondo): potrebbe star spedendo allo stesso indirizzo.
  perform pg_advisory_xact_lock(hashtext('punto_gi_promemoria'));

  select * into r from public.promemoria_compleanno where id = p_id for update;
  if not found then
    raise exception 'Promemoria non trovato: ricarica la scheda.';
  end if;
  if r.stato = 'inviato' or r.inviato_il is not null then
    raise exception 'Già inviato il %: non lo rimando, al cliente arriverebbe due volte.',
      to_char(coalesce(r.inviato_il, now()) at time zone 'Europe/Rome', 'DD/MM/YYYY "alle" HH24:MI');
  end if;
  if r.stato <> 'in_attesa' then
    raise exception 'Questo promemoria non è in coda (%): prima «Rimetti in coda».', r.stato;
  end if;

  v_motivo := public.promemoria_ostacolo(p_id, true);
  if v_motivo is not null then
    raise exception 'Non lo mando: %.', v_motivo;
  end if;
  if exists (select 1 from public.promemoria_compleanno q
              where q.email = r.email and q.stato = 'inviato'
                and q.inviato_il > now() - interval '20 hours') then
    raise exception 'A % è già partito un promemoria nelle ultime 20 ore: per non esagerare, riprova domani.', r.email;
  end if;
  if r.occasione <> 'Compleanno' and not public.promemoria_template_ricorrenze() then
    raise exception 'Prima va aggiornato il template EmailJS per l''anniversario (istruzioni in docs/PROMEMORIA-COMPLEANNO.md).';
  end if;
  if not public.promemoria_configurato() then
    raise exception 'Invio non attivo: mancano le chiavi EmailJS in app_config.';
  end if;

  v_req := public.invia_un_promemoria(p_id);
  if v_req is null then
    raise exception 'Invio non riuscito: controlla le chiavi EmailJS in app_config.';
  end if;

  update public.promemoria_compleanno
     set stato = 'inviato', inviato_il = now(), net_req = v_req, esito = null,
         tentativi = tentativi + 1, nota = 'inviato a mano dal gestionale'
   where id = p_id;
  return 'Mail inviata a ' || r.email || '.';
end $$;

-- «Prova»: una copia a un indirizzo a scelta, con i link "smetti" finti; la
-- riga del cliente non cambia. p_occasione = 'Anniversario' prova le parole
-- dell'anniversario anche partendo da un promemoria di compleanno.
-- Il gestionale vecchio la chiama con due argomenti: funziona ancora.
drop function if exists public.prova_promemoria(uuid, text);

create or replace function public.prova_promemoria(p_id uuid, p_email text, p_occasione text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dest text := lower(trim(coalesce(p_email, '')));
  v_occ  text := public.promemoria_occasione(p_occasione);
  v_req  bigint;
begin
  if public.is_staff() is not true then
    raise exception 'Riservato al personale.';
  end if;
  if v_dest !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Indirizzo non valido.';
  end if;
  if not exists (select 1 from public.promemoria_compleanno where id = p_id) then
    raise exception 'Promemoria non trovato: ricarica la scheda.';
  end if;
  -- La copia di prova ha i link per togliere FINTI: al cliente vero non va
  -- mai (non potrebbe togliere il promemoria da quella mail).
  if exists (select 1 from public.promemoria_compleanno where id = p_id and email = v_dest) then
    raise exception 'Questo è l''indirizzo del cliente: la prova è per te. Per mandargliela davvero usa «Invia ora».';
  end if;
  if not public.promemoria_configurato() then
    raise exception 'Invio non attivo: mancano le chiavi EmailJS in app_config.';
  end if;

  v_req := public.invia_un_promemoria(p_id, v_dest, v_occ);
  if v_req is null then
    raise exception 'Invio non riuscito: controlla le chiavi EmailJS in app_config.';
  end if;
  return 'Prova inviata a ' || v_dest
         || coalesce(' (versione ' || lower(v_occ) || ')', '')
         || ': il promemoria del cliente non cambia.';
end $$;

-- «Rimetti in coda»: per una mail annullata o in errore, MAI per una già
-- partita né per una che il cliente ha chiesto di togliere. Una data già
-- passata diventa oggi.
create or replace function public.rimetti_in_coda_promemoria(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r        record;
  v_data   date;
  v_motivo text;
begin
  if public.is_staff() is not true then
    raise exception 'Riservato al personale.';
  end if;

  select p.*, o.stato as stato_ordine
    into r
    from public.promemoria_compleanno p
    join public.ordini o on o.id = p.ordine_id
   where p.id = p_id
   for update of p;
  if not found then
    raise exception 'Promemoria non trovato: ricarica la scheda.';
  end if;

  if r.stato = 'in_attesa' then
    raise exception 'È già in coda.';
  end if;
  if r.stato = 'inviato' or (r.stato = 'annullato' and r.inviato_il is not null) then
    raise exception 'È già stato inviato: non lo rimetto in coda (al cliente arriverebbe due volte).';
  end if;
  if coalesce(r.nota, '') like 'tolto dal cliente%' then
    raise exception 'Il cliente ha chiesto di non ricevere più questo promemoria: non lo rimetto in coda.';
  end if;
  if exists (select 1 from public.promemoria_stop s where s.email = r.email) then
    raise exception '% si è disiscritto da tutti i promemoria: prima riattiva l''indirizzo (in fondo alla scheda).', r.email;
  end if;
  if coalesce(r.stato_ordine, '') = 'annullato' then
    raise exception 'L''ordine è annullato: prima rimettilo fra gli ordini da fare.';
  end if;
  if coalesce(r.anniversario, current_date) <= current_date + 2 then
    raise exception 'La ricorrenza è già passata (o manca meno di 3 giorni): non ha più senso mandarlo.';
  end if;

  v_data := greatest(r.invio_previsto, current_date);
  update public.promemoria_compleanno
     set stato = 'in_attesa', nota = null, esito = null, inviato_il = null, net_req = null,
         tentativi = 0, invio_previsto = v_data
   where id = p_id;

  -- Gli stessi controlli del giro (stessa festa già ricordata, ha già
  -- ordinato…): meglio dirlo subito che vederlo annullare di nuovo domattina.
  -- L'errore annulla anche l'update qui sopra.
  v_motivo := public.promemoria_ostacolo(p_id, false);
  if v_motivo is not null then
    raise exception 'Non lo rimetto in coda: %.', v_motivo;
  end if;

  return 'Rimesso in coda: parte '
         || case when v_data <= current_date then 'appena possibile (fra le 9 e le 12)'
                 else 'il ' || to_char(v_data, 'DD/MM/YYYY') end
         || '.';
end $$;

-- «Togli questa ricorrenza»: ferma le mail non ancora partite di quella festa
-- (anche quelle di un altro ordine per la stessa festa). Gli altri promemoria
-- dello stesso indirizzo restano attivi: NON è una disiscrizione.
create or replace function public.togli_ricorrenza_staff(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer;
begin
  if public.is_staff() is not true then
    raise exception 'Riservato al personale.';
  end if;

  select * into r from public.promemoria_compleanno where id = p_id;
  if not found then
    raise exception 'Promemoria non trovato: ricarica la scheda.';
  end if;

  update public.promemoria_compleanno q
     set stato = 'annullato', nota = 'tolto dal gestionale'
   where q.stato in ('in_attesa', 'errore')
     and public.promemoria_stessa_ricorrenza(q.ordine_id, q.email, q.occasione, q.anniversario,
                                             r.ordine_id, r.email, r.occasione, r.anniversario);
  get diagnostics n = row_count;

  if n = 0 then
    return 'Niente da togliere: per questa ricorrenza non c''erano mail in arrivo.';
  end if;
  return 'Ricorrenza tolta: ' || n
         || case when n = 1 then ' mail non partirà' else ' mail non partiranno' end
         || '. Gli altri promemoria di ' || r.email || ' restano attivi.';
end $$;

-- Disiscrivere / riattivare un indirizzo dal gestionale (es. richiesta al
-- telefono o al banco). La disiscrizione vale per sempre, come quella dal link.
create or replace function public.disiscrivi_email_promemoria(p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v text := lower(trim(coalesce(p_email, '')));
  n integer;
begin
  if public.is_staff() is not true then
    raise exception 'Riservato al personale.';
  end if;
  if v !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Indirizzo non valido.';
  end if;

  insert into public.promemoria_stop (email) values (v) on conflict (email) do nothing;
  update public.promemoria_compleanno
     set stato = 'annullato', nota = 'disiscritto'
   where email = v and stato in ('in_attesa', 'errore');
  get diagnostics n = row_count;

  return v || ' non riceverà più nessun promemoria'
         || case when n = 0 then ''
                 else ' (' || n || case when n = 1 then ' mail tolta' else ' mail tolte' end || ' dalla coda)' end
         || '.';
end $$;

create or replace function public.riattiva_email_promemoria(p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v text := lower(trim(coalesce(p_email, '')));
  n integer;
begin
  if public.is_staff() is not true then
    raise exception 'Riservato al personale.';
  end if;

  delete from public.promemoria_stop where email = v;
  if not found then
    raise exception '% non risulta disiscritto.', v;
  end if;

  -- Ripartono le mail fermate dalla disiscrizione, se la festa è ancora davanti.
  -- I controlli del giro valgono comunque (doppioni, una mail al giorno…).
  update public.promemoria_compleanno
     set stato = 'in_attesa', nota = null, invio_previsto = greatest(invio_previsto, current_date)
   where email = v and stato = 'annullato' and nota = 'disiscritto' and inviato_il is null
     and anniversario > current_date + 2;
  get diagnostics n = row_count;

  return v || ' riceverà di nuovo i promemoria'
         || case when n = 0 then ''
                 else ' (' || n || case when n = 1 then ' mail rimessa' else ' mail rimesse' end || ' in coda)' end
         || '.';
end $$;

-- ── 9. Dal link nella mail (cliente, senza login) ────────────

-- Cosa mostra la pagina PRIMA di chiedere conferma. Mai l'email in chiaro:
-- il token basta a chi ha la mail, e la mail queste cose le dice già.
--  in_coda = mail di questa festa ancora da partire (quest'anno o, se il
--            cliente ha già riordinato, l'anno dopo): «togli» le ferma tutte;
--  tolto   = il cliente l'ha già tolta per sempre (quelle tolte dallo staff
--            valgono solo per quell'anno: il cliente può ancora toglierla lui).
create or replace function public.info_promemoria(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r record;
begin
  if coalesce(length(p_token), 0) < 20 then return null; end if;
  select p.ordine_id, p.email, p.nome, p.occasione, p.anniversario
    into r
    from public.promemoria_compleanno p
   where p.token = p_token
   order by p.created_at
   limit 1;
  if not found then return null; end if;

  return jsonb_build_object(
    'occasione',    r.occasione,
    'anniversario', r.anniversario,
    'nome',         nullif(split_part(trim(coalesce(r.nome, '')), ' ', 1), ''),
    'in_coda',      (select count(*) from public.promemoria_compleanno q
                      where q.stato in ('in_attesa', 'errore')
                        and (q.ordine_id = r.ordine_id
                             or (q.email = r.email and q.occasione = r.occasione
                                 and public.promemoria_stesso_giorno_anno(q.anniversario, r.anniversario)))),
    'tolto',        public.promemoria_festa_tolta(r.email, r.occasione, r.anniversario)
                    or exists (select 1 from public.promemoria_compleanno q
                                where q.stato = 'annullato' and q.nota = 'tolto dal cliente'
                                  and public.promemoria_stessa_ricorrenza(q.ordine_id, q.email, q.occasione, q.anniversario,
                                                                          r.ordine_id, r.email, r.occasione, r.anniversario)),
    'disiscritto',  exists (select 1 from public.promemoria_stop s where s.email = r.email)
  );
end $$;

-- «Non ricordarmi più questa ricorrenza»: solo quella festa, ma PER SEMPRE
-- (stesso indirizzo, stessa occasione, stesso giorno ±3 di ogni anno): si
-- fermano le mail in arrivo, anche di un ordine già fatto per l'anno dopo, e
-- gli ordini futuri per quella festa non ne creano più. L'indirizzo NON entra
-- fra i disiscritti: gli altri promemoria restano.
create or replace function public.togli_promemoria(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer;
begin
  if coalesce(length(p_token), 0) < 20 then return jsonb_build_object('ok', false); end if;
  select p.ordine_id, p.email, p.occasione, p.anniversario
    into r
    from public.promemoria_compleanno p
   where p.token = p_token
   order by p.created_at
   limit 1;
  if not found then return jsonb_build_object('ok', false); end if;

  insert into public.promemoria_tolti (email, occasione, festa)
  values (r.email, r.occasione, r.anniversario)
  on conflict do nothing;

  update public.promemoria_compleanno q
     set stato = 'annullato', nota = 'tolto dal cliente'
   where q.stato in ('in_attesa', 'errore')
     and (q.ordine_id = r.ordine_id
          or (q.email = r.email and q.occasione = r.occasione
              and public.promemoria_stesso_giorno_anno(q.anniversario, r.anniversario)));
  get diagnostics n = row_count;

  return jsonb_build_object('ok', true, 'occasione', r.occasione,
                            'anniversario', r.anniversario, 'tolti', n);
end $$;

-- Disiscrizione da tutto (link ?stop=): come prima, ma ferma anche le righe in
-- errore. Ora la pagina chiede conferma prima di chiamarla: i filtri antivirus
-- che aprono da soli i link delle mail non disiscrivono più nessuno.
create or replace function public.stop_promemoria(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if coalesce(length(p_token), 0) < 20 then return false; end if;
  select email into v_email from public.promemoria_compleanno where token = p_token limit 1;
  if v_email is null then return false; end if;

  insert into public.promemoria_stop (email) values (v_email) on conflict (email) do nothing;
  update public.promemoria_compleanno
     set stato = 'annullato', nota = 'disiscritto'
   where email = v_email and stato in ('in_attesa', 'errore');
  return true;
end $$;

-- ── 10. Lo staff vede i disiscritti (e li cambia solo con le funzioni sopra) ──
drop policy if exists "promemoria_stop_read_auth" on public.promemoria_stop;
create policy "promemoria_stop_read_auth" on public.promemoria_stop
  for select to authenticated using (public.is_staff());

-- ── 11. Chi può chiamare cosa ────────────────────────────────
-- In Postgres (e su Supabase) una funzione nasce eseguibile da CHIUNQUE, anche
-- con la chiave pubblica che sta nel sito: verificato, il sito pubblico
-- poteva lanciare il giro e spedire mail. Ogni funzione va chiusa a mano.

-- Interne: le chiamano solo il giro, i trigger e le funzioni qui sopra (che
-- girano come proprietario, quindi non serve concederle a nessuno).
revoke execute on function public.invia_promemoria_compleanno(boolean)      from public, anon, authenticated;
revoke execute on function public.leggi_esiti_promemoria()                  from public, anon, authenticated;
revoke execute on function public.invia_un_promemoria(uuid, text, text)     from public, anon, authenticated;
revoke execute on function public.accoda_promemoria(uuid)                   from public, anon, authenticated;
revoke execute on function public.crea_promemoria_compleanno()              from public, anon, authenticated;
revoke execute on function public.sincronizza_promemoria_ordine()           from public, anon, authenticated;
revoke execute on function public.promemoria_ostacolo(uuid, boolean)        from public, anon, authenticated;
revoke execute on function public.promemoria_occasione(text)                from public, anon, authenticated;
revoke execute on function public.promemoria_testi(text)                    from public, anon, authenticated;
revoke execute on function public.promemoria_ora_di_invio()                 from public, anon, authenticated;
revoke execute on function public.promemoria_stessa_ricorrenza(uuid, text, text, date, uuid, text, text, date)
                                                                            from public, anon, authenticated;
revoke execute on function public.promemoria_stesso_giorno_anno(date, date) from public, anon, authenticated;
revoke execute on function public.promemoria_festa_tolta(text, text, date)  from public, anon, authenticated;

-- Gestionale: solo con una sessione del personale.
revoke execute on function public.invia_promemoria_ora(uuid)               from public, anon;
revoke execute on function public.prova_promemoria(uuid, text, text)       from public, anon;
revoke execute on function public.rimetti_in_coda_promemoria(uuid)         from public, anon;
revoke execute on function public.togli_ricorrenza_staff(uuid)             from public, anon;
revoke execute on function public.disiscrivi_email_promemoria(text)        from public, anon;
revoke execute on function public.riattiva_email_promemoria(text)          from public, anon;
revoke execute on function public.promemoria_configurato()                 from public, anon;
revoke execute on function public.promemoria_template_ricorrenze()         from public, anon;
grant  execute on function public.invia_promemoria_ora(uuid)               to authenticated;
grant  execute on function public.prova_promemoria(uuid, text, text)       to authenticated;
grant  execute on function public.rimetti_in_coda_promemoria(uuid)         to authenticated;
grant  execute on function public.togli_ricorrenza_staff(uuid)             to authenticated;
grant  execute on function public.disiscrivi_email_promemoria(text)        to authenticated;
grant  execute on function public.riattiva_email_promemoria(text)          to authenticated;
grant  execute on function public.promemoria_configurato()                 to authenticated;
grant  execute on function public.promemoria_template_ricorrenze()         to authenticated;

-- Dal link nella mail: il cliente non ha login.
grant execute on function public.torta_da_token(text)   to anon, authenticated;
grant execute on function public.stop_promemoria(text)  to anon, authenticated;
grant execute on function public.info_promemoria(text)  to anon, authenticated;
grant execute on function public.togli_promemoria(text) to anon, authenticated;

-- ── 12. Pulizia: promemoria in coda di ordini GIÀ annullati ──
update public.promemoria_compleanno p
   set stato = 'annullato', nota = 'ordine annullato'
  from public.ordini o
 where o.id = p.ordine_id and p.stato in ('in_attesa', 'errore') and o.stato = 'annullato';

notify pgrst, 'reload schema';

commit;

-- ── Controllo finale: ogni riga deve dire quello che c'è scritto fra parentesi ──
select 'Giro automatico ogni 2 minuti, mail fra le 9 e le 12 (deve dire ok)' as cosa,
       case when (select schedule from cron.job where jobname = 'promemoria-compleanno') = '*/2 7-11 * * *'
            then 'ok' else 'NO — ERRORE' end as valore
union all
select 'Esiti di EmailJS letti ogni 10 minuti, tutto il giorno (deve dire ok)',
       case when (select schedule from cron.job where jobname = 'promemoria-esiti') = '5,15,25,35,45,55 * * * *'
            then 'ok' else 'NO — ERRORE' end
union all
select 'Lavori dei promemoria programmati, giro + esiti (deve dire 2)',
       (select count(*)::text from cron.job
         where command ilike '%invia_promemoria_compleanno%' or command ilike '%leggi_esiti_promemoria%')
union all
select 'Trigger sugli ordini: crea e aggiorna i promemoria (deve dire ok)',
       case when exists (select 1 from pg_trigger where tgname = 'crea_promemoria_compleanno_trg'
                                                     and tgrelid = 'public.ordini'::regclass)
             and exists (select 1 from pg_trigger where tgname = 'sincronizza_promemoria_trg'
                                                     and tgrelid = 'public.ordini'::regclass)
            then 'ok' else 'NO — ERRORE' end
union all
select 'Un solo «primo» e un solo «secondo» per ordine (deve dire ok)',
       case when to_regclass('public.promemoria_ordine_tipo_uidx') is not null then 'ok'
            else 'NO: ci sono promemoria doppi per lo stesso ordine, guardali a mano' end
union all
select 'Promemoria senza data della festa (deve dire 0)',
       (select count(*)::text from public.promemoria_compleanno where anniversario is null)
union all
select 'Il sito pubblico può lanciare il giro o spedire mail? (deve dire no)',
       case when has_function_privilege('anon', 'public.invia_promemoria_compleanno(boolean)', 'execute')
              or has_function_privilege('anon', 'public.leggi_esiti_promemoria()', 'execute')
              or has_function_privilege('anon', 'public.invia_un_promemoria(uuid, text, text)', 'execute')
              or has_function_privilege('anon', 'public.invia_promemoria_ora(uuid)', 'execute')
              or has_function_privilege('anon', 'public.prova_promemoria(uuid, text, text)', 'execute')
            then 'SÌ — ERRORE' else 'no' end
union all
select 'Il cliente può togliere un promemoria dal link della mail? (deve dire sì)',
       case when has_function_privilege('anon', 'public.togli_promemoria(text)', 'execute')
             and has_function_privilege('anon', 'public.info_promemoria(text)', 'execute')
             and has_function_privilege('anon', 'public.stop_promemoria(text)', 'execute')
            then 'sì' else 'NO — ERRORE' end
union all
select 'Lo staff può togliere, rimettere in coda, disiscrivere? (deve dire sì)',
       case when has_function_privilege('authenticated', 'public.togli_ricorrenza_staff(uuid)', 'execute')
             and has_function_privilege('authenticated', 'public.rimetti_in_coda_promemoria(uuid)', 'execute')
             and has_function_privilege('authenticated', 'public.disiscrivi_email_promemoria(text)', 'execute')
            then 'sì' else 'NO — ERRORE' end
union all
select 'Template EmailJS pronto per l''anniversario',
       case when public.promemoria_template_ricorrenze() then 'sì'
            else 'non ancora (normale: si accende dopo aver aggiornato il template)' end;

-- ── DOPO aver aggiornato il template su EmailJS ──────────────
-- (docs/PROMEMORIA-COMPLEANNO.md) e aver fatto «Prova anniversario» dal
-- gestionale, si accendono i promemoria di anniversario con:
--
-- insert into public.app_config (key, value) values ('promemoria_template_ricorrenze', 'si')
-- on conflict (key) do update set value = excluded.value;
