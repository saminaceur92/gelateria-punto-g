-- ============================================================
-- PROMEMORIA COMPLEANNO — 2026-07-26
-- Da eseguire su Supabase (progetto Gelateria-punto-gi) UNA VOLTA.
--
-- Cosa fa: quando un ordine ha occasione "Compleanno" e l'email del cliente,
-- mette in coda DUE promemoria per l'anno dopo (30 e 14 giorni prima
-- dell'anniversario del ritiro). Un job giornaliero li spedisce via EmailJS,
-- con la stessa tecnica (pg_cron + pg_net) già usata per le notifiche Telegram.
--
-- ⚠️ PRIMA di attivare il job servono le chiavi EmailJS in `app_config`:
--    vedi in fondo, sezione 8. Finché non ci sono, la funzione non spedisce
--    nulla (esce subito) e la coda si riempie e basta: nessun rischio.
-- ============================================================

-- ── 1. Ordini: interruttore per-ordine ──────────────────────
-- Oggi è sempre true (non c'è una casella da spuntare, solo l'avviso al
-- momento dell'ordine + il link di disiscrizione in ogni mail). La colonna
-- resta per poter aggiungere in futuro una spunta senza rifare la migrazione.
alter table public.ordini add column if not exists promemoria_ok boolean not null default true;

-- ── 2. Chi si è disiscritto (vale per sempre) ───────────────
create table if not exists public.promemoria_stop (
  email     text primary key,
  creato_il timestamptz not null default now()
);
alter table public.promemoria_stop enable row level security;
-- Nessuna policy: ci accedono solo le funzioni qui sotto (security definer).

-- ── 3. La coda dei promemoria ───────────────────────────────
create table if not exists public.promemoria_compleanno (
  id             uuid primary key default gen_random_uuid(),
  ordine_id      uuid not null references public.ordini(id) on delete cascade,
  email          text not null,
  nome           text,
  tipo           text not null,                       -- 'primo' (-30 gg) | 'secondo' (-14 gg)
  invio_previsto date not null,
  stato          text not null default 'in_attesa',   -- in_attesa | inviato | annullato | errore
  inviato_il     timestamptz,
  nota           text,                                -- motivo dell'annullamento o errore
  net_req        bigint,                              -- id della richiesta pg_net (per il controllo esito)
  token          text not null,                       -- link "rifai la torta" / "disiscriviti"
  created_at     timestamptz not null default now()
);
create index if not exists promemoria_da_inviare_idx on public.promemoria_compleanno (stato, invio_previsto);
create index if not exists promemoria_token_idx      on public.promemoria_compleanno (token);

alter table public.promemoria_compleanno enable row level security;

-- Lo staff loggato li vede e li può annullare dal gestionale.
drop policy if exists "promemoria_read_auth" on public.promemoria_compleanno;
create policy "promemoria_read_auth" on public.promemoria_compleanno
  for select to authenticated using (true);
drop policy if exists "promemoria_update_auth" on public.promemoria_compleanno;
create policy "promemoria_update_auth" on public.promemoria_compleanno
  for update to authenticated using (true) with check (true);

-- ── 4. Trigger: l'ordine di compleanno mette in coda i 2 promemoria ──
create or replace function public.crea_promemoria_compleanno()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text;
  v_token text;
  v_anniv date;
begin
  v_email := lower(trim(coalesce(new.cliente_email, new.email, '')));

  if new.promemoria_ok is not true                              then return new; end if;
  if v_email = '' or v_email not like '%@%'                     then return new; end if;
  if coalesce(new.dettagli->>'occasion', '') <> 'Compleanno'    then return new; end if;
  if new.ritiro_data is null                                    then return new; end if;
  if exists (select 1 from public.promemoria_stop s where s.email = v_email) then return new; end if;

  v_anniv := (new.ritiro_data + interval '1 year')::date;
  -- 32 caratteri casuali (niente pgcrypto: su Supabase sta in `extensions`)
  v_token := replace(gen_random_uuid()::text, '-', '');   -- stesso token per i due invii

  insert into public.promemoria_compleanno (ordine_id, email, nome, tipo, invio_previsto, token)
  values
    (new.id, v_email, new.cliente_nome, 'primo',   (v_anniv - interval '30 days')::date, v_token),
    (new.id, v_email, new.cliente_nome, 'secondo', (v_anniv - interval '14 days')::date, v_token);

  return new;
exception when others then
  return new;  -- non deve MAI bloccare il salvataggio dell'ordine
end $$;

drop trigger if exists crea_promemoria_compleanno_trg on public.ordini;
create trigger crea_promemoria_compleanno_trg
  after insert on public.ordini
  for each row execute function public.crea_promemoria_compleanno();

-- ── 5. L'invio (chiamato dal job giornaliero) ───────────────
create or replace function public.invia_promemoria_compleanno()
returns integer
language plpgsql
security definer
set search_path = public, net
as $$
declare
  r record;
  v_service text; v_template text; v_user text; v_access text; v_site text;
  v_gusti text; v_torta text; v_anniv date; v_req bigint;
  st int; err text; n integer := 0;
begin
  select value into v_service  from public.app_config where key = 'emailjs_service_id';
  select value into v_template from public.app_config where key = 'emailjs_template_compleanno';
  select value into v_user     from public.app_config where key = 'emailjs_public_key';
  select value into v_access   from public.app_config where key = 'emailjs_private_key';
  select value into v_site     from public.app_config where key = 'site_url';
  -- Non configurato: non spedisce nulla (la coda resta lì, non si perde niente).
  if v_service is null or v_template is null or v_user is null or v_access is null then
    return 0;
  end if;
  v_site := coalesce(v_site, 'https://gelateria-punto-g.vercel.app');

  -- (a) esito degli invii recenti: EmailJS risponde 200 se ha accettato la mail
  for r in
    select id, net_req from public.promemoria_compleanno
    where stato = 'inviato' and net_req is not null and inviato_il > now() - interval '2 days'
  loop
    select status_code, error_msg into st, err from net._http_response where id = r.net_req;
    if st is not null and st <> 200 then
      update public.promemoria_compleanno
         set stato = 'errore', nota = 'EmailJS ' || st || coalesce(' · ' || err, '')
       where id = r.id;
    end if;
  end loop;

  -- (b) i promemoria di oggi
  for r in
    select p.id, p.email, p.nome, p.token, p.invio_previsto,
           o.tipo, o.dettagli, o.ritiro_data
    from public.promemoria_compleanno p
    join public.ordini o on o.id = p.ordine_id
    where p.stato = 'in_attesa' and p.invio_previsto <= current_date
    order by p.invio_previsto
  loop
    -- disiscritto nel frattempo
    if exists (select 1 from public.promemoria_stop s where s.email = r.email) then
      update public.promemoria_compleanno set stato = 'annullato', nota = 'disiscritto' where id = r.id;
      continue;
    end if;

    -- ha già ordinato di recente: inutile ricordarglielo (vale anche come
    -- "stop" al secondo invio se ha ordinato dopo il primo)
    if exists (
      select 1 from public.ordini o2
      where lower(coalesce(o2.cliente_email, o2.email, '')) = r.email
        and o2.created_at > now() - interval '60 days'
    ) then
      update public.promemoria_compleanno set stato = 'annullato', nota = 'ha già ordinato di recente' where id = r.id;
      continue;
    end if;

    -- job fermo a lungo: non spedire promemoria ormai fuori tempo
    if r.invio_previsto < current_date - 7 then
      update public.promemoria_compleanno set stato = 'annullato', nota = 'fuori tempo' where id = r.id;
      continue;
    end if;

    v_anniv := (r.ritiro_data + interval '1 year')::date;
    select string_agg(f->>'name', ', ')
      into v_gusti
      from jsonb_array_elements(coalesce(r.dettagli->'flavors', '[]'::jsonb)) f;
    v_torta := coalesce(r.tipo, 'la tua torta')
               || case when coalesce(v_gusti, '') <> '' then ' — ' || v_gusti else '' end;

    begin
      select net.http_post(
        url  := 'https://api.emailjs.com/api/v1.0/email/send',
        body := jsonb_build_object(
          'service_id',  v_service,
          'template_id', v_template,
          'user_id',     v_user,
          'accessToken', v_access,
          'template_params', jsonb_build_object(
            'email',       r.email,
            'cliente',     coalesce(nullif(split_part(coalesce(r.nome, ''), ' ', 1), ''), 'ciao'),
            'torta',       v_torta,
            'quando',      to_char(v_anniv, 'DD/MM/YYYY'),
            'anno_scorso', to_char(r.ritiro_data, 'DD/MM/YYYY'),
            'link_torta',  v_site || '/?torta=' || r.token,
            'link_stop',   v_site || '/?stop='  || r.token
          )
        ),
        timeout_milliseconds := 20000
      ) into v_req;

      update public.promemoria_compleanno
         set stato = 'inviato', inviato_il = now(), net_req = v_req, nota = null
       where id = r.id;
      n := n + 1;
    exception when others then
      update public.promemoria_compleanno set stato = 'errore', nota = sqlerrm where id = r.id;
    end;
  end loop;

  return n;
end $$;

-- ── 6. Job giornaliero (07:30 UTC = 09:30 in Italia d'estate) ──
do $$ begin
  perform cron.unschedule('promemoria-compleanno');
exception when others then null;
end $$;
select cron.schedule('promemoria-compleanno', '30 7 * * *', $$ select public.invia_promemoria_compleanno(); $$);

-- ── 7. Funzioni per il sito e per il gestionale ─────────────

-- "Rifai questa torta": dal token torna la configurazione dell'anno scorso,
-- SENZA i dati di contatto e senza le date (si ricompilano nel configuratore).
create or replace function public.torta_da_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb; v_nome text;
begin
  select o.dettagli, p.nome into v, v_nome
  from public.promemoria_compleanno p
  join public.ordini o on o.id = p.ordine_id
  where p.token = p_token
  limit 1;

  if v is null then return null; end if;

  v := v - 'phone' - 'email' - 'deliveryAddress' - 'notes'
         - 'pickupDate' - 'pickupTime' - 'delivery'
         - 'photo' - 'photoTransform';

  return jsonb_build_object('nome', v_nome, 'config', v);
end $$;
grant execute on function public.torta_da_token(text) to anon, authenticated;

-- Disiscrizione dal link nella mail: vale per l'indirizzo, per sempre.
create or replace function public.stop_promemoria(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_email text;
begin
  select email into v_email from public.promemoria_compleanno where token = p_token limit 1;
  if v_email is null then return false; end if;

  insert into public.promemoria_stop (email) values (v_email) on conflict (email) do nothing;
  update public.promemoria_compleanno
     set stato = 'annullato', nota = 'disiscritto'
   where email = v_email and stato = 'in_attesa';
  return true;
end $$;
grant execute on function public.stop_promemoria(text) to anon, authenticated;

-- La dashboard non può leggere `app_config` (contiene i segreti): questa dice
-- solo se le chiavi EmailJS ci sono, così può avvisare che manca la configurazione.
create or replace function public.promemoria_configurato()
returns boolean
language sql
security definer
set search_path = public
as $$
  select count(*) = 4 from public.app_config
   where key in ('emailjs_service_id', 'emailjs_template_compleanno',
                 'emailjs_public_key', 'emailjs_private_key')
     and coalesce(value, '') <> '';
$$;
grant execute on function public.promemoria_configurato() to authenticated;

-- "Invia ora" dal gestionale: anticipa un promemoria a oggi e fa girare l'invio
-- (serve per provare che tutto funzioni senza aspettare un anno).
create or replace function public.invia_promemoria_ora(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.promemoria_compleanno
     set invio_previsto = current_date, stato = 'in_attesa', nota = null
   where id = p_id;
  return public.invia_promemoria_compleanno();
end $$;
grant execute on function public.invia_promemoria_ora(uuid) to authenticated;

-- ── 8. CHIAVI EMAILJS (da inserire a mano, una volta) ───────
-- Sostituisci i valori e lancia. La private key si trova su emailjs.com →
-- Account → General → "Private Key" (va anche attivata l'opzione
-- "Allow EmailJS API for non-browser applications" nella stessa pagina).
--
-- insert into public.app_config (key, value) values
--   ('emailjs_service_id',           'service_84b0jde'),
--   ('emailjs_public_key',           'BTO4welmqMDIfQLbp'),
--   ('emailjs_private_key',          'LA_TUA_PRIVATE_KEY'),
--   ('emailjs_template_compleanno',  'template_1jgkt0l'),
--   ('site_url',                     'https://gelateria-punto-g.vercel.app')
-- on conflict (key) do update set value = excluded.value;
