-- ============================================================
-- FIX — "Invia ora" e prova dei promemoria — 2026-07-26
-- Da eseguire su Supabase DOPO 2026-07-26-fix-token-promemoria.sql.
--
-- Problemi emersi provandolo dal vivo:
--  1. "Invia ora" spostava la data prevista a OGGI in modo permanente: dopo una
--     prova il promemoria restava agganciato alla data sbagliata.
--  2. Passava comunque dai controlli del job (fra cui "ha già ordinato di
--     recente"), quindi la riga veniva annullata e non partiva nulla — senza
--     spiegazioni utili a chi guarda la dashboard.
--  3. Non c'era modo di provare la mail senza consumare il promemoria vero.
--
-- Adesso:
--  · invia_un_promemoria()  = spedisce e basta (nessun controllo: li fa chi chiama)
--  · invia_promemoria_ora() = manda ADESSO al cliente, senza toccare la data
--  · prova_promemoria()     = manda una copia a un indirizzo a scelta, senza
--                             toccare la riga (per collaudare)
--  · il job giornaliero resta invariato nei controlli
-- In fondo ricalcola le date sbagliate rimaste in coda.
-- ============================================================

-- ── 1. La spedizione pura ───────────────────────────────────
create or replace function public.invia_un_promemoria(p_id uuid, p_email_override text default null)
returns bigint
language plpgsql
security definer
set search_path = public, net
as $$
declare
  r record;
  v_service text; v_template text; v_user text; v_access text; v_site text;
  v_gusti text; v_torta text; v_anniv date; v_dest text; v_req bigint;
begin
  select p.email, p.nome, p.token, o.tipo, o.dettagli, o.ritiro_data
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
  if v_service is null or v_template is null or v_user is null or v_access is null then return null; end if;
  v_site := coalesce(v_site, 'https://gelateria-punto-g.vercel.app');

  v_dest  := coalesce(nullif(trim(p_email_override), ''), r.email);
  v_anniv := (r.ritiro_data + interval '1 year')::date;
  select string_agg(f->>'name', ', ')
    into v_gusti
    from jsonb_array_elements(coalesce(r.dettagli->'flavors', '[]'::jsonb)) f;
  v_torta := coalesce(r.tipo, 'la tua torta')
             || case when coalesce(v_gusti, '') <> '' then ' — ' || v_gusti else '' end;

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
        'link_stop',   v_site || '/?stop='  || r.token
      )
    ),
    timeout_milliseconds := 20000
  ) into v_req;

  return v_req;
exception when others then
  return null;
end $$;

-- ── 2. Il job giornaliero (stessi controlli di prima) ───────
create or replace function public.invia_promemoria_compleanno()
returns integer
language plpgsql
security definer
set search_path = public, net
as $$
declare r record; st int; err text; v_req bigint; n integer := 0;
begin
  -- (a) esito degli invii recenti: 200 = EmailJS ha accettato la mail
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
    select p.id, p.email, p.invio_previsto
    from public.promemoria_compleanno p
    where p.stato = 'in_attesa' and p.invio_previsto <= current_date
    order by p.invio_previsto
  loop
    if exists (select 1 from public.promemoria_stop s where s.email = r.email) then
      update public.promemoria_compleanno set stato = 'annullato', nota = 'disiscritto' where id = r.id;
      continue;
    end if;

    if exists (
      select 1 from public.ordini o2
      where lower(coalesce(o2.cliente_email, o2.email, '')) = r.email
        and o2.created_at > now() - interval '60 days'
    ) then
      update public.promemoria_compleanno set stato = 'annullato', nota = 'ha già ordinato di recente' where id = r.id;
      continue;
    end if;

    if r.invio_previsto < current_date - 7 then
      update public.promemoria_compleanno set stato = 'annullato', nota = 'fuori tempo' where id = r.id;
      continue;
    end if;

    v_req := public.invia_un_promemoria(r.id);
    if v_req is null then
      update public.promemoria_compleanno set stato = 'errore', nota = 'invio non riuscito' where id = r.id;
    else
      update public.promemoria_compleanno
         set stato = 'inviato', inviato_il = now(), net_req = v_req, nota = null
       where id = r.id;
      n := n + 1;
    end if;
  end loop;

  return n;
end $$;

-- ── 3. "Invia ora": manda davvero, al cliente, subito ───────
-- Non tocca `invio_previsto` e salta i controlli del job: è una decisione
-- esplicita dello staff. Il promemoria risulta inviato (non ripartirà da solo).
--
-- Prima va cancellata: nella versione precedente restituiva un numero, ora un
-- messaggio da mostrare in dashboard, e Postgres non permette di cambiare il
-- tipo di risposta con "create or replace".
drop function if exists public.invia_promemoria_ora(uuid);

create or replace function public.invia_promemoria_ora(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_req bigint; v_dest text;
begin
  select email into v_dest from public.promemoria_compleanno where id = p_id;
  if v_dest is null then return 'Promemoria non trovato.'; end if;

  v_req := public.invia_un_promemoria(p_id);
  if v_req is null then
    return 'Invio non riuscito: controlla le chiavi EmailJS in app_config.';
  end if;

  update public.promemoria_compleanno
     set stato = 'inviato', inviato_il = now(), net_req = v_req, nota = 'inviato a mano dal gestionale'
   where id = p_id;
  return 'Mail inviata a ' || v_dest;
end $$;
grant execute on function public.invia_promemoria_ora(uuid) to authenticated;

-- ── 4. "Prova": copia a un indirizzo a scelta, riga intatta ─
create or replace function public.prova_promemoria(p_id uuid, p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_req bigint;
begin
  if coalesce(p_email, '') not like '%@%' then return 'Indirizzo non valido.'; end if;
  v_req := public.invia_un_promemoria(p_id, p_email);
  if v_req is null then
    return 'Invio non riuscito: controlla le chiavi EmailJS in app_config.';
  end if;
  return 'Prova inviata a ' || p_email || ' (il promemoria resta in coda)';
end $$;
grant execute on function public.prova_promemoria(uuid, text) to authenticated;

grant execute on function public.invia_un_promemoria(uuid, text) to authenticated;

-- ── 5. Ricalcola le date sballate rimaste in coda ───────────
update public.promemoria_compleanno p
   set invio_previsto = ((o.ritiro_data + interval '1 year')
                         - case p.tipo when 'primo' then interval '30 days' else interval '14 days' end)::date
  from public.ordini o
 where o.id = p.ordine_id
   and p.stato = 'in_attesa'
   and o.ritiro_data is not null
   and p.invio_previsto <> ((o.ritiro_data + interval '1 year')
                            - case p.tipo when 'primo' then interval '30 days' else interval '14 days' end)::date;

select tipo, invio_previsto, stato from public.promemoria_compleanno order by invio_previsto;
