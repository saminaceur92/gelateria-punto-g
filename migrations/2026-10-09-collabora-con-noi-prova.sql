-- PROVA della migrazione «Collabora con noi» — si lancia nel SQL Editor DOPO
-- la migrazione 2026-10-09-collabora-con-noi.sql.
-- Finisce SEMPRE con un errore voluto: "PROVE SUPERATE" vuol dire tutto
-- bene, e l'errore annulla tutto quello che la prova ha scritto (proposte di
-- prova, statistiche, avvisi in coda). Su Telegram non parte niente: pg_net
-- spedisce solo dopo il commit, e qui il commit non arriva mai.
-- Qualunque altro messaggio dice quale controllo non è passato.
do $$
declare
  v       json;
  v_n     int;
  v_mail  text := 'zz-prova-collabora@example.com';
  v_owner uuid;
  v_staff uuid;
begin
  -- Come il sito: ruolo anon, cioè la chiave pubblica che sta nel bundle.
  execute 'set local role anon';

  -- 1. Una proposta valida (spazi e maiuscole li sistema il database).
  v := public.invia_collaborazione('eventi', '  ZZ   Prova  ', null, ' ZZ-Prova-Collabora@Example.com ',
         '059 623 1234', 'Prova della migrazione: viene annullata subito dopo.', true, null, 9000);
  assert (v ->> 'ok')::boolean and (v ->> 'gia_ricevuta') is null, '1: ' || v::text;

  -- 2. Doppio tocco: stessa email e stesso testo → già ricevuta, niente doppione.
  v := public.invia_collaborazione('eventi', 'ZZ Prova', null, v_mail,
         null, 'Prova della migrazione: viene annullata subito dopo.', true, null, 9000);
  assert coalesce((v ->> 'gia_ricevuta')::boolean, false), '2: ' || v::text;

  -- 3. Bot: trappola compilata o modulo compilato in meno di 3 secondi →
  --    risponde "fatto" ma non salva niente.
  v := public.invia_collaborazione('eventi', 'ZZ Bot', null, 'zz-bot-collabora@example.com',
         null, 'Messaggio di un robot, abbastanza lungo da passare.', true, 'http://spam.example', 9000);
  assert (v ->> 'ok')::boolean, '3a: ' || v::text;
  v := public.invia_collaborazione('eventi', 'ZZ Bot', null, 'zz-bot-collabora@example.com',
         null, 'Messaggio di un robot, abbastanza lungo da passare.', true, null, 800);
  assert (v ->> 'ok')::boolean, '3b: ' || v::text;

  -- 4. Gli stessi controlli del modulo.
  v := public.invia_collaborazione('eventi', 'ZZ Prova', null, 'zz@', null,
         'Messaggio abbastanza lungo per passare.', true, null, 9000);
  assert v ->> 'campo' = 'email', '4a: ' || v::text;
  v := public.invia_collaborazione('eventi', 'ZZ Prova', null, v_mail, '12 34',
         'Messaggio abbastanza lungo per passare.', true, null, 9000);
  assert v ->> 'campo' = 'telefono', '4b: ' || v::text;
  v := public.invia_collaborazione('eventi', 'ZZ Prova', null, v_mail, null,
         'Troppo corto', true, null, 9000);
  assert v ->> 'campo' = 'messaggio', '4c: ' || v::text;
  v := public.invia_collaborazione('eventi', 'ZZ Prova', null, v_mail, null,
         'Messaggio abbastanza lungo per passare.', false, null, 9000);
  assert v ->> 'campo' = 'privacy', '4d: ' || v::text;
  -- un'emoji nell'indirizzo (chr(127846) è 🍦) non passa
  v := public.invia_collaborazione('eventi', 'ZZ Prova', null, 'zz' || chr(127846) || '@example.com', null,
         'Messaggio abbastanza lungo per passare.', true, null, 9000);
  assert v ->> 'campo' = 'email' and v ->> 'motivo' like '%emoji%', '4e: ' || v::text;

  -- 5. Il pubblico non legge le proposte e non scrive direttamente in tabella.
  begin
    perform 1 from public.collaborazioni limit 1;
    raise exception '5a: il pubblico legge le proposte';
  exception when insufficient_privilege then
    null;
  end;
  begin
    insert into public.collaborazioni (nome, email, messaggio, privacy_il, privacy_testo)
    values ('ZZ Furbo', 'zz-furbo@example.com', 'Inserimento diretto che non deve passare.', now(), 'x');
    raise exception '5b: il pubblico scrive direttamente nella tabella';
  exception when insufficient_privilege then
    null;
  end;

  -- 6. Statistiche: la pagina "collabora" è riconosciuta.
  perform public.registra_evento('collabora_inviata', 'collabora', 'mobile', '');

  execute 'reset role';

  assert exists (select 1 from public.statistiche_sito
                  where evento = 'collabora_inviata' and pagina = 'collabora'
                    and giorno = (now() at time zone 'Europe/Rome')::date), '6: pagina collabora non registrata';

  -- 7. Salvata una volta sola, pulita, con la spunta privacy registrata.
  select count(*) into v_n from public.collaborazioni where email = v_mail;
  assert v_n = 1, '7a: righe salvate ' || v_n;
  assert exists (select 1 from public.collaborazioni
                  where email = v_mail and nome = 'ZZ Prova' and telefono = '059 623 1234'
                    and tipo = 'eventi' and stato = 'nuova' and privacy_il is not null
                    and privacy_testo like '%iubenda%'), '7b: riga salvata male';
  assert not exists (select 1 from public.collaborazioni where email = 'zz-bot-collabora@example.com'),
         '7c: salvata la proposta di un bot';

  -- 7d. Sito e menù (https://www.…, due link normali) non tolgono l'avviso
  --     Telegram. Si prova solo se nelle ultime 24 ore non è arrivata nessun
  --     altra proposta: con tante proposte il filtro scatta per quelle, ed è
  --     giusto così.
  if (select count(*) from public.collaborazioni where created_at > now() - interval '24 hours') = 1 then
    execute 'set local role anon';
    v := public.invia_collaborazione('locale', 'ZZ Due Link', null, 'zz-link-collabora@example.com', null,
           'Il nostro sito https://www.zz-esempio.it e il menù https://www.zz-esempio.it/menu', true, null, 9000);
    execute 'reset role';
    assert (v ->> 'ok')::boolean, '7d: ' || v::text;
    assert exists (select 1 from public.collaborazioni
                    where email = 'zz-link-collabora@example.com' and not silenziata),
           '7d: due link normali bastano a togliere l''avviso Telegram';
  end if;

  -- 8. L'avviso Telegram è stato preparato (se le chiavi degli ordini ci sono).
  if coalesce((select value from public.app_config where key = 'telegram_bot_token'), '') <> ''
     and coalesce((select value from public.app_config where key = 'telegram_chat_id'), '') <> '' then
    assert exists (select 1 from public.collaborazioni
                    where email = v_mail and (silenziata or telegram_req is not null)),
           '8: avviso Telegram non preparato';
  end if;

  -- 9. Un titolare la vede e ne cambia stato e nota, ma non email e testo.
  select id into v_owner from public.profiles where role = 'owner' limit 1;
  if v_owner is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into v_n from public.collaborazioni where email = v_mail;
    assert v_n = 1, '9a: il titolare non vede la proposta';
    update public.collaborazioni set stato = 'letta', nota_staff = 'prova' where email = v_mail;
    begin
      update public.collaborazioni set email = 'zz-altra@example.com' where email = v_mail;
      raise exception '9b: dalla dashboard si cambia l''email';
    exception when insufficient_privilege then
      null;
    end;
    execute 'reset role';
    assert exists (select 1 from public.collaborazioni
                    where email = v_mail and stato = 'letta' and nota_staff = 'prova'
                      and aggiornata_il is not null), '9c: stato o nota non salvati';
  end if;

  -- 10. Chi è staff ma non titolare non vede niente.
  select id into v_staff from public.profiles where role = 'staff' limit 1;
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into v_n from public.collaborazioni where email = v_mail;
    execute 'reset role';
    assert v_n = 0, '10: lo staff non titolare vede le proposte';
  end if;
  perform set_config('request.jwt.claims', '', true);

  raise exception 'PROVE SUPERATE (errore voluto: annulla tutto quello che la prova ha scritto)';
end $$;
