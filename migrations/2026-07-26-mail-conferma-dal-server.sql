-- ============================================================
-- MAIL DI CONFERMA SPEDITA DAL DATABASE — 2026-07-26
-- Da eseguire su Supabase UNA VOLTA (dopo aver inserito le chiavi EmailJS).
--
-- Prima: la conferma partiva dal BROWSER del cliente al ritorno dal pagamento.
-- Se chiudeva la scheda subito dopo aver pagato, la mail non partiva mai. E
-- provando da localhost non partiva comunque, perché Stripe rimanda al sito in
-- produzione (memoria del browser diversa → parametri persi).
--
-- Adesso: la spedisce il database appena l'ordine viene salvato, esattamente
-- come fa la notifica Telegram. Vale sia per gli ordini pagati dal sito sia per
-- quelli creati in gelateria dalla dashboard.
--
-- Il TESTO della mail lo prepara comunque il sito (che conosce i nomi di gusti,
-- forme, basi…) e lo salva pronto in `ordini.email_params`: qui si spedisce
-- soltanto. Se quel campo è vuoto non parte nulla.
--
-- ⚠️ Va insieme alla nuova versione del sito: gli ordini vecchi non hanno
--    `email_params` e vengono semplicemente ignorati.
-- ============================================================

-- ── 1. Colonne di servizio ──────────────────────────────────
alter table public.ordini add column if not exists email_params    jsonb;   -- parametri pronti per EmailJS
alter table public.ordini add column if not exists email_req       bigint;  -- id richiesta pg_net
alter table public.ordini add column if not exists email_ok        boolean; -- true = EmailJS ha accettato
alter table public.ordini add column if not exists email_tentativi integer not null default 0;

-- ── 2. Il template della conferma ───────────────────────────
-- (è quello già in uso oggi dal sito: "Order Confirmation")
insert into public.app_config (key, value)
values ('emailjs_template_conferma', 'template_wornujj')
on conflict (key) do update set value = excluded.value;

-- ── 3. La spedizione vera e propria ─────────────────────────
create or replace function public.invia_mail_ordine(p_params jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, net
as $$
declare
  v_service text; v_template text; v_user text; v_access text; v_req bigint;
begin
  if p_params is null or coalesce(p_params->>'email', '') not like '%@%' then return null; end if;

  select value into v_service  from public.app_config where key = 'emailjs_service_id';
  select value into v_template from public.app_config where key = 'emailjs_template_conferma';
  select value into v_user     from public.app_config where key = 'emailjs_public_key';
  select value into v_access   from public.app_config where key = 'emailjs_private_key';
  if v_service is null or v_template is null or v_user is null or v_access is null then
    return null;  -- non configurato: non spedisce
  end if;

  select net.http_post(
    url  := 'https://api.emailjs.com/api/v1.0/email/send',
    body := jsonb_build_object(
      'service_id',      v_service,
      'template_id',     v_template,
      'user_id',         v_user,
      'accessToken',     v_access,
      'template_params', p_params
    ),
    timeout_milliseconds := 20000
  ) into v_req;

  return v_req;
exception when others then
  return null;
end $$;

-- ── 4. Trigger: mail appena l'ordine è salvato ──────────────
create or replace function public.notify_order_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_req bigint;
begin
  if new.email_params is null then return new; end if;

  v_req := public.invia_mail_ordine(new.email_params);
  if v_req is not null then
    update public.ordini
       set email_req = v_req, email_ok = false, email_tentativi = 1
     where id = new.id;
  end if;
  return new;
exception when others then
  return new;  -- non deve MAI bloccare il salvataggio dell'ordine
end $$;

drop trigger if exists notify_order_email_trg on public.ordini;
create trigger notify_order_email_trg
  after insert on public.ordini
  for each row execute function public.notify_order_email();

-- ── 5. Rinvio automatico se la prima volta non è andata ─────
-- Controlla l'esito (200 = EmailJS ha accettato) e riprova, al massimo 3 volte:
-- così un errore permanente non consuma il piano EmailJS a ripetizione.
create or replace function public.retry_mail_conferma()
returns void
language plpgsql
security definer
set search_path = public, net
as $$
declare r record; st int; err text; v_req bigint;
begin
  for r in
    select id, email_params, email_req, email_tentativi
    from public.ordini
    where email_params is not null
      and email_ok is not true
      and email_tentativi < 3
      and created_at > now() - interval '6 hours'
    order by created_at
  loop
    if r.email_req is not null then
      select status_code, error_msg into st, err from net._http_response where id = r.email_req;
      if st = 200 then
        update public.ordini set email_ok = true where id = r.id;   -- consegnata
        continue;
      elsif st is null and err is null then
        continue;  -- ancora in corso: si riprova al giro dopo
      end if;
    end if;

    v_req := public.invia_mail_ordine(r.email_params);
    update public.ordini
       set email_req = coalesce(v_req, email_req),
           email_tentativi = r.email_tentativi + 1
     where id = r.id;
  end loop;
end $$;

do $$ begin
  perform cron.unschedule('retry-mail-conferma');
exception when others then null;
end $$;
select cron.schedule('retry-mail-conferma', '*/2 * * * *', $$ select public.retry_mail_conferma(); $$);
