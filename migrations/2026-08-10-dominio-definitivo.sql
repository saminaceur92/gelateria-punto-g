-- ============================================================
-- Dominio definitivo: gelateriapuntogi.it — 2026-08-10
-- Da eseguire su Supabase (progetto Gelateria-punto-gi) dal SQL Editor.
--
-- CONTROLLATO IL 2026-08-10: era già tutto a posto tranne UNA cosa, il
-- ripiego (fallback) dentro la funzione `invia_un_promemoria`, che è quello
-- che ha fatto nascere questo file. Stato verificato:
--   ✅ documenti.qr_url        = https://www.gelateriapuntogi.it/allergeni
--   ✅ app_config.site_url     = https://www.gelateriapuntogi.it
--   ✅ secret Stripe SITE_URL  = https://www.gelateriapuntogi.it
--   ⚠️ invia_un_promemoria()   -> ripiego ancora sul vecchio indirizzo Vercel
--
-- Cos'è il "ripiego": la funzione che manda le mail di promemoria compleanno
-- legge l'indirizzo del sito da `app_config.site_url`; se quella riga sparisse
-- o venisse svuotata, userebbe l'indirizzo scritto dentro la funzione. Oggi è
-- ancora quello vecchio (vercel.app). Non è un guasto — la riga c'è ed è
-- giusta, e il vecchio indirizzo comunque rimanda a quello nuovo — ma è una
-- trappola per il futuro, e questo script la toglie.
--
-- È innocuo rieseguirlo: i due update in fondo non trovano niente da cambiare.
-- ============================================================

-- ── 1. Il ripiego dentro la funzione delle mail di compleanno ───────
-- Definizione presa TALE E QUALE da quella in produzione (pg_get_functiondef):
-- l'unica differenza è l'indirizzo alla riga contrassegnata qui sotto.
CREATE OR REPLACE FUNCTION public.invia_un_promemoria(p_id uuid, p_email_override text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net'
AS $function$
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
  v_site := coalesce(v_site, 'https://www.gelateriapuntogi.it');   -- ← UNICA RIGA CAMBIATA

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
end $function$;

-- ── 2. Rete di sicurezza (oggi non cambiano niente) ─────────────────
-- Servono solo se qualcuno rimettesse per sbaglio il vecchio indirizzo.
update public.documenti
   set qr_url = 'https://www.gelateriapuntogi.it/allergeni'
 where chiave = 'allergeni'
   and (qr_url is null or qr_url = '' or qr_url like '%vercel.app%');

update public.app_config
   set value = 'https://www.gelateriapuntogi.it'
 where key = 'site_url'
   and (value is null or value = '' or value like '%vercel.app%');

insert into public.app_config (key, value)
select 'site_url', 'https://www.gelateriapuntogi.it'
 where not exists (select 1 from public.app_config where key = 'site_url');

-- ── 3. Controllo finale ─────────────────────────────────────────────
-- Devono uscire tre righe, tutte col dominio nuovo e "nessuno" nell'ultima.
select 'QR allergeni'    as cosa, qr_url as indirizzo from public.documenti where chiave = 'allergeni'
union all
select 'Link nelle mail', value  from public.app_config where key = 'site_url'
union all
select 'Funzioni col vecchio indirizzo',
       coalesce(string_agg(p.proname, ', '), 'nessuno')
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prosrc like '%gelateria-punto-g.vercel.app%';
