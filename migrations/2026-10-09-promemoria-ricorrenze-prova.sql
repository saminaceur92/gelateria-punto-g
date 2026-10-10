-- ============================================================
-- PROVA della migrazione "promemoria ricorrenze" — 2026-10-09
-- Si lancia nel SQL Editor DOPO 2026-10-09-promemoria-ricorrenze.sql.
-- Finisce SEMPRE con un errore voluto: "PROVE SUPERATE" vuol dire tutto bene,
-- e l'errore annulla tutto quello che la prova ha scritto (ordini e
-- promemoria di prova, impostazioni). Qualunque altro messaggio dice quale
-- controllo non è passato.
--
-- Non parte nessuna mail e nessun messaggio Telegram:
--  · durante la prova gli altri trigger sugli ordini (Telegram, mail di
--    conferma, foto) restano spenti, e si riaccendono da soli con l'annullamento;
--  · i promemoria vengono spediti "per finta" (app.promemoria_finto): risultano
--    spediti, ma EmailJS non viene chiamato;
--  · in ogni caso pg_net spedisce solo dopo il COMMIT, che qui non arriva mai.
-- Per un attimo (meno di un secondo) la tabella degli ordini resta bloccata:
-- un ordine che arriva proprio in quell'istante aspetta e poi passa.
-- ============================================================
do $$
declare
  -- Ordini "di due mesi fa": fuori dalla regola "ha ordinato negli ultimi 60 giorni".
  v_quando timestamptz := now() - interval '61 days';
  -- Date di ritiro dell'anno scorso: con la prima il «primo» promemoria scade oggi.
  v_oggi   date := (current_date + 30  - interval '1 year')::date;
  v_100    date := (current_date + 100 - interval '1 year')::date;
  v_200    date := (current_date + 200 - interval '1 year')::date;
  v_owner  uuid;
  v_a1 uuid; v_a2 uuid; v_c uuid; v_e uuid; v_f1 uuid; v_f3 uuid;
  v_id     uuid;
  v_tok    text;
  v_j      jsonb;
  v_t      text;
begin
  perform set_config('lock_timeout', '5s', true);

  -- 0. Una sessione del personale finta, come quella del gestionale.
  select id into v_owner from public.profiles where role = 'owner' limit 1;
  assert v_owner is not null, '0: serve almeno un profilo owner';
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  assert public.is_staff(), '0: la sessione finta non risulta del personale';
  assert v_quando >= timestamptz '2026-07-26 15:00:00+00', '0: lancia la prova dal 26/09/2026 in poi';

  -- Niente invii veri, niente trigger degli altri, coda vera ferma (10 anni avanti:
  -- l'annullamento finale la rimette com'era).
  perform set_config('app.promemoria_finto', 'on', true);
  begin
    alter table public.ordini disable trigger user;
    alter table public.ordini enable trigger crea_promemoria_compleanno_trg;
    alter table public.ordini enable trigger sincronizza_promemoria_trg;
  exception when insufficient_privilege or lock_not_available then
    -- Non si possono spegnere (tabella di un altro proprietario, o occupata):
    -- si va avanti lo stesso, tanto pg_net spedisce solo dopo il COMMIT.
    raise notice 'Trigger degli altri non spenti (%): la prova prosegue, non parte niente lo stesso.', sqlerrm;
  end;
  update public.promemoria_compleanno set invio_previsto = invio_previsto + 3650 where stato = 'in_attesa';
  insert into public.app_config (key, value) values
    ('emailjs_service_id', 'prova'), ('emailjs_template_compleanno', 'prova'),
    ('emailjs_public_key', 'prova'), ('emailjs_private_key', 'prova')
  on conflict (key) do update set value = coalesce(nullif(public.app_config.value, ''), excluded.value);
  insert into public.app_config (key, value) values ('promemoria_template_ricorrenze', 'si')
  on conflict (key) do update set value = excluded.value;

  -- Ordini di prova: indirizzi .invalid (non esistono) e telefoni finti.
  insert into public.ordini (cliente_nome, cliente_telefono, cliente_email, ritiro_data, ritiro_ora,
                             stato, tipo, riepilogo, dettagli, totale, created_at, promemoria_ok)
  select 'ZZ Prova Promemoria', t.tel, t.email, t.ritiro, '16:00', 'da_fare', 'Semifreddo',
         'PROVA dei promemoria (si annulla da sola)', t.det::jsonb, 1, v_quando, t.ok
    from (values
      ('000 000 0001', 'zz-a@promemoria.invalid', v_oggi, '{"occasion":"Compleanno","promemoria":true}', true),
      ('000 000 0002', 'zz-a@promemoria.invalid', v_oggi, '{"occasion":"Compleanno","promemoria":true}', true),
      ('000 000 0003', 'zz-b@promemoria.invalid', v_oggi, '{"occasion":"Anniversario"}', true),
      ('000 000 0004', 'zz-c@promemoria.invalid', v_oggi, '{"occasion":"Anniversario","promemoria":true}', true),
      ('000 000 0005', 'zz-d@promemoria.invalid', v_oggi, '{"occasion":"Compleanno","promemoria":false}', false),
      ('000 000 0006', 'zz-e@promemoria.invalid', v_oggi, '{"occasion":"Compleanno","promemoria":true}', true),
      ('000 000 0007', 'zz-f@promemoria.invalid', v_100,  '{"occasion":"Compleanno","promemoria":true}', true),
      ('000 000 0008', 'zz-f@promemoria.invalid', v_100 + 1, '{"occasion":"Compleanno","promemoria":true}', true),
      ('000 000 0009', 'zz-f@promemoria.invalid', v_200,  '{"occasion":"Compleanno","promemoria":true}', true)
    ) as t(tel, email, ritiro, det, ok);
  select id into v_a1 from public.ordini where cliente_telefono = '000 000 0001' and cliente_email like '%@promemoria.invalid';
  select id into v_a2 from public.ordini where cliente_telefono = '000 000 0002' and cliente_email like '%@promemoria.invalid';
  select id into v_c  from public.ordini where cliente_telefono = '000 000 0004' and cliente_email like '%@promemoria.invalid';
  select id into v_e  from public.ordini where cliente_telefono = '000 000 0006' and cliente_email like '%@promemoria.invalid';
  select id into v_f1 from public.ordini where cliente_telefono = '000 000 0007' and cliente_email like '%@promemoria.invalid';
  select id into v_f3 from public.ordini where cliente_telefono = '000 000 0009' and cliente_email like '%@promemoria.invalid';

  -- 1. Chi ha i promemoria e chi no.
  assert (select count(*) from public.promemoria_compleanno where ordine_id in (v_a1, v_a2)
            and occasione = 'Compleanno' and anniversario = (v_oggi + interval '1 year')::date) = 4,
         '1: compleanno, due ordini → 4 promemoria';
  assert not exists (select 1 from public.promemoria_compleanno where email = 'zz-b@promemoria.invalid'),
         '1: anniversario dal sito vecchio (senza avviso) → non doveva nascere niente';
  assert (select count(*) from public.promemoria_compleanno where ordine_id = v_c and occasione = 'Anniversario') = 2,
         '1: anniversario dal sito nuovo → 2 promemoria';
  assert not exists (select 1 from public.promemoria_compleanno where email = 'zz-d@promemoria.invalid'),
         '1: interruttore spento al banco → non doveva nascere niente';

  -- 2. Ordine annullato e poi ripristinato.
  update public.ordini set stato = 'annullato' where id = v_e;
  assert (select bool_and(stato = 'annullato' and nota = 'ordine annullato') from public.promemoria_compleanno where ordine_id = v_e),
         '2: ordine annullato → promemoria non fermati';
  update public.ordini set stato = 'da_fare' where id = v_e;
  assert (select bool_and(stato = 'in_attesa') from public.promemoria_compleanno where ordine_id = v_e),
         '2: ordine ripristinato → promemoria non ripartiti';
  update public.ordini set stato = 'annullato' where id = v_e;

  -- 3. Il giro: una mail per indirizzo, niente per l'ordine annullato.
  for i in 1 .. 10 loop
    perform public.invia_promemoria_compleanno(true);
  end loop;
  assert (select count(*) from public.promemoria_compleanno where email = 'zz-a@promemoria.invalid' and stato = 'inviato') = 1,
         '3: doppio ordine → doveva partire UNA mail';
  assert (select count(*) from public.promemoria_compleanno where ordine_id = v_c and stato = 'inviato') = 1,
         '3: anniversario col template pronto → doveva partire';
  assert not exists (select 1 from public.promemoria_compleanno where ordine_id = v_e and stato = 'inviato'),
         '3: ordine annullato → non doveva partire niente';

  -- 4. Mail già partita: né «Invia ora» né «Rimetti in coda».
  select id into v_id from public.promemoria_compleanno where email = 'zz-a@promemoria.invalid' and stato = 'inviato';
  begin
    perform public.invia_promemoria_ora(v_id);
    raise exception '4: «Invia ora» ha rimandato una mail già partita';
  exception when others then
    if sqlerrm not like 'Già inviato%' then raise; end if;
  end;
  begin
    perform public.rimetti_in_coda_promemoria(v_id);
    raise exception '4: «Rimetti in coda» ha accettato una mail già partita';
  exception when others then
    if sqlerrm not like 'È già stato inviato%' then raise; end if;
  end;

  -- 5. Il giorno dopo il doppione si ferma da solo.
  update public.promemoria_compleanno set inviato_il = inviato_il - interval '1 day'
   where email like '%@promemoria.invalid' and stato = 'inviato';
  for i in 1 .. 3 loop
    perform public.invia_promemoria_compleanno(true);
  end loop;
  assert (select count(*) from public.promemoria_compleanno where email = 'zz-a@promemoria.invalid' and stato = 'inviato') = 1,
         '5: il doppione è partito il giorno dopo';
  assert exists (select 1 from public.promemoria_compleanno where email = 'zz-a@promemoria.invalid'
                  and tipo = 'primo' and nota like 'doppione%'),
         '5: il doppione non è stato riconosciuto';

  -- 6. «Togli solo questo» dal link: la festa, non l'indirizzo.
  select token into v_tok from public.promemoria_compleanno where ordine_id = v_f1 limit 1;
  v_j := public.info_promemoria(v_tok);
  assert (v_j ->> 'in_coda')::int = 4 and v_j ->> 'occasione' = 'Compleanno' and position('@' in v_j::text) = 0,
         '6: info dal link sbagliata: ' || v_j::text;
  v_j := public.togli_promemoria(v_tok);
  assert (v_j ->> 'ok')::boolean and (v_j ->> 'tolti')::int = 4, '6: togli: ' || v_j::text;
  assert (select bool_and(stato = 'in_attesa') from public.promemoria_compleanno where ordine_id = v_f3),
         '6: è stato tolto anche l''altro compleanno';
  assert not exists (select 1 from public.promemoria_stop where email = 'zz-f@promemoria.invalid'),
         '6: «togli» ha disiscritto l''indirizzo da tutto';
  -- … e vale per sempre: il cliente riordina per la stessa festa (2 giorni
  -- dopo, l'anno prossimo) e il nuovo ordine non crea promemoria.
  insert into public.ordini (cliente_nome, cliente_telefono, cliente_email, ritiro_data, ritiro_ora,
                             stato, tipo, riepilogo, dettagli, totale, created_at, promemoria_ok)
  values ('ZZ Prova Promemoria', '000 000 0010', 'zz-f@promemoria.invalid',
          (v_100 + interval '1 year')::date + 2, '16:00', 'da_fare', 'Semifreddo',
          'PROVA dei promemoria (si annulla da sola)', '{"occasion":"Compleanno","promemoria":true}', 1, v_quando, true)
  returning id into v_id;
  assert not exists (select 1 from public.promemoria_compleanno where ordine_id = v_id),
         '6: la festa tolta dal cliente è tornata in coda con un ordine nuovo';
  v_j := public.info_promemoria(v_tok);
  assert (v_j ->> 'tolto')::boolean and (v_j ->> 'in_coda')::int = 0,
         '6: dopo «togli» il link non dice «già tolto»: ' || v_j::text;
  assert public.promemoria_stesso_giorno_anno(date '2029-02-28', date '2028-02-29')
     and public.promemoria_stesso_giorno_anno(date '2029-03-03', date '2028-02-29')
     and not public.promemoria_stesso_giorno_anno(date '2029-03-04', date '2028-02-29')
     and public.promemoria_stesso_giorno_anno(date '2028-01-02', date '2026-12-30'),
         '6: «stessa festa negli anni» sbagliata (29 febbraio o Capodanno)';

  -- 7. Staff: togli una ricorrenza, disiscrivi e riattiva un indirizzo.
  select id into v_id from public.promemoria_compleanno where ordine_id = v_f3 and tipo = 'primo';
  v_t := public.togli_ricorrenza_staff(v_id);
  assert v_t like 'Ricorrenza tolta: 2 mail%', '7: togli dal gestionale: ' || v_t;
  v_t := public.rimetti_in_coda_promemoria(v_id);
  assert v_t like 'Rimesso in coda%', '7: rimetti in coda: ' || v_t;
  v_t := public.disiscrivi_email_promemoria('ZZ-F@promemoria.invalid');
  assert exists (select 1 from public.promemoria_stop where email = 'zz-f@promemoria.invalid'), '7: disiscrivi: ' || v_t;
  v_t := public.riattiva_email_promemoria('zz-f@promemoria.invalid');
  assert not exists (select 1 from public.promemoria_stop where email = 'zz-f@promemoria.invalid')
     and exists (select 1 from public.promemoria_compleanno where ordine_id = v_f3 and stato = 'in_attesa'),
         '7: riattiva: ' || v_t;
  -- La prova non va alla casella tecnica del codice dello staff (non riceve niente).
  begin
    perform public.prova_promemoria(v_id, 'staff-zz@codici.gelateriapuntogi.it');
    raise exception '7: la prova è partita verso la casella tecnica dello staff';
  exception when others then
    if sqlerrm not like 'Questo è l''indirizzo tecnico%' then raise; end if;
  end;

  -- 8. Permessi.
  assert not has_function_privilege('anon', 'public.invia_promemoria_compleanno(boolean)', 'execute'), '8: anon lancia il giro';
  assert not has_function_privilege('anon', 'public.invia_un_promemoria(uuid, text, text)', 'execute'), '8: anon spedisce';
  assert not has_function_privilege('anon', 'public.invia_promemoria_ora(uuid)', 'execute'), '8: anon usa «Invia ora»';
  assert not has_function_privilege('anon', 'public.leggi_esiti_promemoria()', 'execute')
     and not has_function_privilege('authenticated', 'public.leggi_esiti_promemoria()', 'execute'),
         '8: la lettura degli esiti si può lanciare da fuori';
  assert exists (select 1 from cron.job where jobname = 'promemoria-esiti'),
         '8: manca il lavoro che legge tutto il giorno le risposte di EmailJS';
  assert has_function_privilege('anon', 'public.togli_promemoria(text)', 'execute'), '8: il link «togli» non funziona';
  assert has_function_privilege('authenticated', 'public.togli_ricorrenza_staff(uuid)', 'execute'), '8: lo staff non toglie';

  raise exception 'PROVE SUPERATE (errore voluto: annulla tutto quello che la prova ha scritto)';
end $$;
