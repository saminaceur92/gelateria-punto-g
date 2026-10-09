-- PROVA della migrazione "statistiche torte già composte" — si lancia nel SQL
-- Editor DOPO la migrazione. Finisce SEMPRE con un errore voluto: "PROVE
-- SUPERATE" vuol dire tutto bene, e l'errore annulla tutto quello che la
-- prova ha scritto (i click finti di oggi spariscono dai numeri). Qualunque
-- altro messaggio dice quale controllo non è passato.
do $$
declare
  v_oggi    date := (now() at time zone 'Europe/Rome')::date;
  v_golosa0 int;
  v_golosa1 int;
  v_nutella0 int;
  v_nutella1 int;
  v_vecchio0 int;
  v_vecchio1 int;
  v_id      uuid;
  v_staff   uuid;
  v         json;
  v_nota    text := '';
begin
  -- 1. Le nove voci ci sono, accese, di tipo click e nel gruppo torta.
  assert (select count(*) from public.statistiche_eventi
           where chiave like 'torta\_consigliata\_%'
             and attivo and tipo = 'click' and gruppo = 'torta') = 9,
         '1: le nove torte non sono tutte a catalogo e accese';

  -- 2. Due tocchi su La Golosa dal telefono, uno arrivando da Google: +2 sulla
  --    sua voce, e la provenienza NON si salva (è un click, non un arrivo).
  select coalesce(sum(conteggio), 0) into v_golosa0 from public.statistiche_sito
   where giorno = v_oggi and evento = 'torta_consigliata_gelato_golosa';
  perform public.registra_evento('torta_consigliata_gelato_golosa', 'home', 'mobile', 'google');
  perform public.registra_evento('torta_consigliata_gelato_golosa', 'home', 'mobile', '');
  select coalesce(sum(conteggio), 0) into v_golosa1 from public.statistiche_sito
   where giorno = v_oggi and evento = 'torta_consigliata_gelato_golosa';
  assert v_golosa1 = v_golosa0 + 2, '2: La Golosa doveva salire di 2, è salita di ' || (v_golosa1 - v_golosa0);
  assert not exists (select 1 from public.statistiche_sito
                      where evento like 'torta\_consigliata\_%' and provenienza <> ''),
         '2: provenienza salvata su un click';

  -- 3. Un semifreddo va sulla sua voce, non su quella della Golosa.
  select coalesce(sum(conteggio), 0) into v_nutella0 from public.statistiche_sito
   where giorno = v_oggi and evento = 'torta_consigliata_semifreddo_nutellona';
  perform public.registra_evento('torta_consigliata_semifreddo_nutellona', 'home', 'desktop', '');
  select coalesce(sum(conteggio), 0) into v_nutella1 from public.statistiche_sito
   where giorno = v_oggi and evento = 'torta_consigliata_semifreddo_nutellona';
  assert v_nutella1 = v_nutella0 + 1, '3: La Nutellona non è salita di 1';
  assert (select coalesce(sum(conteggio), 0) from public.statistiche_sito
           where giorno = v_oggi and evento = 'torta_consigliata_gelato_golosa') = v_golosa1,
         '3: il semifreddo è finito sulla Golosa';

  -- 4. Una chiave inventata non entra: nessun errore e nessuna riga.
  perform public.registra_evento('torta_consigliata_gelato_inventata', 'home', 'mobile', '');
  assert not exists (select 1 from public.statistiche_sito
                      where evento = 'torta_consigliata_gelato_inventata'),
         '4: una torta inventata è entrata nei numeri';

  -- 5. Il vecchio evento conta ancora: lo mandano le pagine aperte col sito di
  --    prima, e porta i numeri dei giorni passati.
  select coalesce(sum(conteggio), 0) into v_vecchio0 from public.statistiche_sito
   where giorno = v_oggi and evento = 'torta_consigliata';
  perform public.registra_evento('torta_consigliata', 'home', 'mobile', '');
  select coalesce(sum(conteggio), 0) into v_vecchio1 from public.statistiche_sito
   where giorno = v_oggi and evento = 'torta_consigliata';
  assert v_vecchio1 = v_vecchio0 + 1, '5: il vecchio torta_consigliata non conta più';

  -- 6. La lettura della scheda, fatta come la fa il personale: le nove voci ci
  --    sono, ognuna col numero che c'è in tabella. Serve un profilo del
  --    personale; se non se ne trova uno la prova lo dice e salta solo questo.
  for v_id in select id from public.profiles where role in ('owner', 'admin', 'staff') limit 20 loop
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_id, 'role', 'authenticated')::text, true);
    if public.is_staff() is true then
      v_staff := v_id;
      exit;
    end if;
  end loop;

  if v_staff is null then
    v_nota := ' — senza la prova 6: nessun profilo del personale trovato';
  else
    v := public.statistiche_riepilogo(1);
    assert v is not null, '6: il riepilogo non risponde al personale';
    assert (select count(*) from json_array_elements(v -> 'eventi') e
             where e ->> 'chiave' like 'torta\_consigliata\_%') = 9,
           '6: nel riepilogo non ci sono le nove torte';
    assert (select (e ->> 'conteggio')::int from json_array_elements(v -> 'eventi') e
             where e ->> 'chiave' = 'torta_consigliata_gelato_golosa') = v_golosa1,
           '6: il riepilogo dà alla Golosa un numero diverso dalla tabella';
    assert (select (e ->> 'conteggio')::int from json_array_elements(v -> 'eventi') e
             where e ->> 'chiave' = 'torta_consigliata_semifreddo_nutellona') = v_nutella1,
           '6: il riepilogo dà alla Nutellona un numero diverso dalla tabella';
    assert (select e ->> 'etichetta' from json_array_elements(v -> 'eventi') e
             where e ->> 'chiave' = 'torta_consigliata_semifreddo_rocher') = 'La Rocher',
           '6: etichetta della Rocher sbagliata';
    assert exists (select 1 from json_array_elements(v -> 'eventi') e
                    where e ->> 'chiave' = 'torta_consigliata'),
           '6: il vecchio evento è sparito dal riepilogo (i numeri di prima non si vedrebbero)';
  end if;

  raise exception 'PROVE SUPERATE% (errore voluto: annulla tutto quello che la prova ha scritto)', v_nota;
end $$;
