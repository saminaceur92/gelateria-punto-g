-- PROVA della migrazione "gestionale, richieste di ottobre" — si lancia nel
-- SQL Editor DOPO 2026-10-09-dashboard-ottobre.sql. Finisce SEMPRE con un
-- errore voluto: "PROVE SUPERATE" vuol dire tutto bene, e l'errore annulla
-- tutto quello che la prova ha scritto (nessun ordine, forma o gusto resta
-- cambiato). Qualunque altro messaggio dice quale controllo non è passato.
--
-- I permessi si provano come li vede davvero chi li usa: la dashboard con una
-- sessione del personale (ruolo authenticated, profilo owner, come quella che
-- apre staff-login) e, per confronto, il sito pubblico (ruolo anon).
do $$
declare
  v_owner  uuid;
  v_ordine text;
  v_testo  text;
  v_forma  text;
  v_alte   boolean;
  n        int;
begin
  select id into v_owner from public.profiles where role = 'owner' limit 1;
  assert v_owner is not null, 'serve almeno un profilo owner';

  -- ── 16. Note future: lo staff le scrive, il sito pubblico no ──
  select id::text into v_ordine from public.ordini limit 1;
  if v_ordine is null then
    raise notice '16: nessun ordine nel database, prova delle note future saltata';
  else
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
    set local role authenticated;
    update public.ordini set note_future = 'PROVA note future' where id::text = v_ordine;
    get diagnostics n = row_count;
    reset role;
    assert n = 1, '16: lo staff non riesce a salvare le note future (righe toccate: ' || n || ')';
    select note_future into v_testo from public.ordini where id::text = v_ordine;
    assert v_testo = 'PROVA note future', '16: la nota non è stata salvata come scritta';

    perform set_config('request.jwt.claims', '', true);
    set local role anon;
    begin
      update public.ordini set note_future = 'scritta dal sito pubblico' where id::text = v_ordine;
      get diagnostics n = row_count;
    exception when insufficient_privilege then
      n := 0;
    end;
    reset role;
    assert n = 0, '16: il sito pubblico (anon) riesce a modificare un ordine!';
  end if;

  -- ── 17. Interruttori delle forme per gruppo ──
  select id::text, per_alte into v_forma, v_alte from public.forme order by ordine, id limit 1;
  assert v_forma is not null, '17: la tabella forme è vuota';

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.forme set per_alte = not per_alte where id::text = v_forma;
  get diagnostics n = row_count;
  reset role;
  assert n = 1, '17: lo staff non riesce a spegnere una forma per le alte (righe toccate: ' || n || ')';
  assert (select per_alte from public.forme where id::text = v_forma) = not v_alte, '17: interruttore non salvato';

  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  begin
    update public.forme set per_normali = false where id::text = v_forma;
    get diagnostics n = row_count;
  exception when insufficient_privilege then
    n := 0;
  end;
  reset role;
  assert n = 0, '17: il sito pubblico (anon) riesce a spegnere una forma!';

  raise exception 'PROVE SUPERATE (errore voluto: annulla tutto quello che la prova ha scritto)';
end $$;
