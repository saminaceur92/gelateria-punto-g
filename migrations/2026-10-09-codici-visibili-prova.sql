-- PROVA della migrazione "codici visibili" — si lancia nel SQL Editor DOPO la
-- migrazione. Finisce SEMPRE con un errore voluto: "PROVE SUPERATE" vuol dire
-- tutto bene, e l'errore annulla tutto quello che la prova ha scritto
-- (persone di prova, storico, tentativi). Qualunque altro messaggio dice
-- quale controllo non è passato.
do $$
declare
  v json;
  v_owner uuid;
  v_admin uuid;
  v_staff uuid;
begin
  -- Una sessione del personale finta, come quella che apre staff-login.
  select id into v_owner from public.profiles where role = 'owner' limit 1;
  assert v_owner is not null, 'serve almeno un profilo owner';
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  -- Codici lunghi e strani: non devono coincidere con quelli veri.
  insert into public.staff_codici (nome, ruolo, pin_hash)
  values ('ZZ prova admin', 'admin', extensions.crypt('90817263', extensions.gen_salt('bf')))
  returning id into v_admin;
  insert into public.staff_codici (nome, ruolo, pin_hash)
  values ('ZZ prova staff', 'staff', extensions.crypt('51627384', extensions.gen_salt('bf')))
  returning id into v_staff;

  -- 1. Riga "di prima": solo impronta, niente copia cifrata.
  assert (select pin_cifrato is null from public.staff_codici where id = v_staff), '1: copia già presente';

  -- 2. Primo uso del codice: la copia cifrata nasce da sola.
  v := public.verifica_codice('51627384');
  assert (v ->> 'ok')::boolean and (v ->> 'id')::uuid = v_staff, '2: verifica ' || v::text;
  assert (select pin_cifrato is not null from public.staff_codici where id = v_staff), '2: copia non creata';

  -- 3. L'elenco dice che si vede, ma non contiene il codice.
  v := public.codici_elenco('90817263');
  assert (v ->> 'ok')::boolean, '3: elenco ' || v::text;
  assert position('51627384' in v::text) = 0, '3: il codice è finito nell''elenco';

  -- 4. Rivela: il codice giusto accanto al nome giusto.
  v := public.codici_rivela('90817263', v_staff);
  assert (v ->> 'ok')::boolean, '4: rivela ' || v::text;
  assert (v -> 'codici' -> 0 ->> 'codice') = '51627384', '4: codice sbagliato ' || v::text;
  assert (v -> 'codici' -> 0 ->> 'nome') = 'ZZ prova staff', '4: nome sbagliato';
  assert exists (select 1 from public.attivita where azione = 'Ha visto un codice'
                  and dettaglio = 'ZZ prova staff'), '4: non scritto nello storico';
  assert not exists (select 1 from public.attivita where dettaglio like '%51627384%'), '4: codice nello storico!';

  -- 5. Un codice da staff non basta per vedere.
  v := public.codici_rivela('51627384', v_staff);
  assert not (v ->> 'ok')::boolean, '5: lo staff vede i codici';

  -- 6. Senza sessione del personale non si vede niente.
  perform set_config('request.jwt.claims', '', true);
  v := public.codici_rivela('90817263', v_staff);
  assert not (v ->> 'ok')::boolean, '6: senza sessione si vede';
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  -- 7. Reimposta con il codice che usa già: non cambia niente, diventa visibile.
  update public.staff_codici set pin_cifrato = null where id = v_staff;
  v := public.codice_reimposta('90817263', v_staff, '5162 7384');
  assert (v ->> 'esito') = 'uguale', '7: ' || v::text;
  assert (public.verifica_codice('51627384') ->> 'ok')::boolean, '7: il codice di prima non va più';

  -- 8. Reimposta con un codice nuovo: il vecchio non entra più, il nuovo sì.
  v := public.codice_reimposta('90817263', v_staff, '62738495');
  assert (v ->> 'esito') = 'cambiato', '8: ' || v::text;
  assert not (public.verifica_codice('51627384') ->> 'ok')::boolean, '8: il vecchio entra ancora';
  assert (public.verifica_codice('62738495') ->> 'ok')::boolean, '8: il nuovo non entra';
  assert (public.codici_rivela('90817263', v_staff) -> 'codici' -> 0 ->> 'codice') = '62738495', '8: copia vecchia';

  -- 9. Doppioni e regole.
  v := public.codice_reimposta('90817263', v_staff, '90817263');
  assert not (v ->> 'ok')::boolean, '9: accettato il codice di un altro';
  v := public.codice_crea('90817263', 'ZZ prova admin 2', 'admin', '1234');
  assert not (v ->> 'ok')::boolean, '9: admin con 4 cifre accettato';
  v := public.codice_reimposta('90817263', v_admin, '11112222');
  assert not (v ->> 'ok')::boolean, '9: reimpostato il proprio codice dalla scheda';

  -- 10. Ognuno cambia il suo.
  v := public.codice_cambia('62738495', '73849506');
  assert (v ->> 'ok')::boolean, '10: ' || v::text;
  assert (public.codici_rivela('90817263', v_staff) -> 'codici' -> 0 ->> 'codice') = '73849506', '10: copia non aggiornata';
  v := public.codice_cambia('00000000', '84950617');
  assert not (v ->> 'ok')::boolean, '10: cambiato senza il codice attuale';

  -- 11. Impronta cambiata a mano senza copia: la copia sparisce (niente codice sbagliato a schermo).
  update public.staff_codici set pin_hash = extensions.crypt('95061728', extensions.gen_salt('bf')) where id = v_staff;
  assert (select pin_cifrato is null from public.staff_codici where id = v_staff), '11: copia rimasta';

  -- 12. Copia illeggibile: rivela non si rompe, la toglie e dice "non visibile".
  update public.staff_codici set pin_cifrato = extensions.pgp_sym_encrypt('x', 'altra-chiave', 'cipher-algo=aes256') where id = v_staff;
  v := public.codici_rivela('90817263', v_staff);
  assert (v ->> 'ok')::boolean and (v -> 'codici' -> 0 ->> 'codice') is null, '12: ' || v::text;
  assert (select pin_cifrato is null from public.staff_codici where id = v_staff), '12: copia rotta rimasta';

  -- 13. Permessi.
  assert not has_function_privilege('anon', 'public.codici_rivela(text, uuid)', 'execute'), '13: anon rivela';
  assert not has_function_privilege('anon', 'public.codice_crea(text, text, text, text)', 'execute'), '13: anon crea';
  assert has_function_privilege('authenticated', 'public.codici_rivela(text, uuid)', 'execute'), '13: staff non rivela';
  assert has_function_privilege('service_role', 'public.verifica_codice(text)', 'execute'), '13: staff-login rotto';
  assert not has_table_privilege('anon', 'public.staff_codici', 'select'), '13: tabella leggibile';
  assert not has_schema_privilege('authenticated', 'private', 'usage'), '13: schema private visibile';

  raise exception 'PROVE SUPERATE (errore voluto: annulla tutto quello che la prova ha scritto)';
end $$;
