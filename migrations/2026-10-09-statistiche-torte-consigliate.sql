-- ============================================================
-- Statistiche: QUALE torta già composta scelgono — 2026-10-09
-- Da eseguire su Supabase (SQL Editor) UNA VOLTA, tutto insieme.
-- Lo script è IDEMPOTENTE: rieseguirlo non fa danni.
-- Serve che sia già stata eseguita migrations/2026-08-12-statistiche-sito.sql.
--
-- QUANDO: prima di pubblicare il sito nuovo, o comunque il prima possibile.
-- Si può eseguire anche subito: aggiunge solo nove voci al catalogo, che il
-- sito di oggi non manda mai, quindi finché il sito nuovo non è online non
-- cambia niente. Al contrario, il sito nuovo SENZA queste voci perde in
-- silenzio le scelte delle torte già composte: `registra_evento` scarta
-- ogni evento che non è a catalogo, senza errori (è voluto, vedi il file del
-- 12 agosto). La scheda Statistiche lo segnala con un avviso rosso.
--
-- Cosa cambia:
--   · fino a oggi un tocco su una "consigliata" (le nove torte già composte
--     del passo Forma, nel configuratore) contava solo `torta_consigliata`,
--     cioè "ha scelto una torta già composta", senza dire quale. Da qui in
--     avanti ogni torta ha la sua voce, torta_consigliata_<gruppo>_<id>, col
--     gruppo (gelato o semifreddo) DENTRO la chiave. Il prefisso è struttura,
--     come per `whatsapp_%`: la scheda divide torte gelato e semifreddi e
--     trova la più scelta leggendo la chiave;
--   · la struttura non si tocca: nessuna colonna, nessun permesso, e le
--     funzioni `registra_evento` e `statistiche_riepilogo` restano quelle del
--     12 agosto. Il riepilogo restituisce già tutti gli eventi accesi del
--     catalogo, zeri compresi: le voci nuove arrivano alla scheda da sole;
--   · il gruppo nel catalogo resta 'torta' per tutte e nove, così non serve
--     allargare il `check` sulla colonna `gruppo`;
--   · il vecchio `torta_consigliata` RESTA a catalogo e acceso: porta i numeri
--     dei giorni passati (la scheda li somma al totale) e lo mandano ancora le
--     pagine aperte col sito di prima. Il sito nuovo non lo manda più, salvo
--     per una consigliata nuova che non avesse ancora la sua voce. Un tocco
--     resta UN evento: mai il vecchio e il nuovo insieme, se no la stessa
--     scelta conterebbe due volte nei "click contati".
--
-- Privacy: niente di nuovo. Sono contatori per giorno come tutti gli altri, e
-- il nome di una torta non dice niente di chi l'ha scelta.
--
-- ⚠️ Una consigliata nuova, tolta o rinominata (src/data/fallback/
-- cakeOptions.js) vuol dire: una riga come queste in una migrazione nuova
-- (etichetta = nome della torta), la costante in EV e la voce in
-- EV_CONSIGLIATA (src/lib/analytics.js). `node scripts/verifica-eventi.mjs`
-- controlla che i tre posti coincidano.
--
-- Per tornare indietro non serve toccare niente qui: le voci in più sono
-- innocue. Se proprio si vogliono spegnere:
--   update public.statistiche_eventi set attivo = false
--    where chiave like 'torta\_consigliata\_%';
-- ============================================================

begin;

-- Il catalogo del 12 agosto deve esserci. Senza, l'errore di Postgres
-- ("relation does not exist") non direbbe a nessuno cosa fare.
do $$
begin
  if to_regclass('public.statistiche_eventi') is null
     or to_regprocedure('public.registra_evento(text,text,text,text)') is null then
    raise exception 'Manca la base delle statistiche: esegui prima migrations/2026-08-12-statistiche-sito.sql';
  end if;
end $$;

-- `ordine` dal 300 in su: 1-13 sono i passi, 101-109 le aperture, 201-215
-- le altre scelte. 301+ le torte gelato, 351+ i semifreddi, nell'ordine in
-- cui stanno in vetrina.
insert into public.statistiche_eventi (chiave, etichetta, tipo, gruppo, ordine) values
  -- ── Torte gelato ──────────────────────────────────────────
  ('torta_consigliata_gelato_golosa',         'La Golosa',        'click', 'torta', 301),
  ('torta_consigliata_gelato_delicata',       'La Delicata',      'click', 'torta', 302),
  ('torta_consigliata_gelato_fresca',         'La Fresca',        'click', 'torta', 303),
  ('torta_consigliata_gelato_classicissima',  'La Classicissima', 'click', 'torta', 304),
  ('torta_consigliata_gelato_vegan',          'La Vegan',         'click', 'torta', 305),
  -- ── Semifreddi ────────────────────────────────────────────
  ('torta_consigliata_semifreddo_nutellona',  'La Nutellona',     'click', 'torta', 351),
  ('torta_consigliata_semifreddo_cheesecake', 'La Cheesecake',    'click', 'torta', 352),
  ('torta_consigliata_semifreddo_biscottona', 'La Biscottona',    'click', 'torta', 353),
  ('torta_consigliata_semifreddo_rocher',     'La Rocher',        'click', 'torta', 354)
on conflict (chiave) do update
  set etichetta = excluded.etichetta,
      tipo      = excluded.tipo,
      gruppo    = excluded.gruppo,
      ordine    = excluded.ordine;
-- `attivo` di proposito NON viene toccato (stessa regola del 12 agosto): se il
-- titolare ha spento una voce, rieseguire questo file non la riaccende.

commit;

-- ── Controllo finale: ogni riga deve dire ok ──
with attese(chiave) as (values
  ('torta_consigliata_gelato_golosa'), ('torta_consigliata_gelato_delicata'),
  ('torta_consigliata_gelato_fresca'), ('torta_consigliata_gelato_classicissima'),
  ('torta_consigliata_gelato_vegan'), ('torta_consigliata_semifreddo_nutellona'),
  ('torta_consigliata_semifreddo_cheesecake'), ('torta_consigliata_semifreddo_biscottona'),
  ('torta_consigliata_semifreddo_rocher')
)
select 'Le 9 torte già composte sono a catalogo (deve dire ok)' as cosa,
       case when (select count(*) from attese a
                    join public.statistiche_eventi e on e.chiave = a.chiave
                   where e.tipo = 'click' and e.gruppo = 'torta') = 9
            then 'ok'
            else 'NO — ne trovo ' || (select count(*) from attese a
                                        join public.statistiche_eventi e on e.chiave = a.chiave)::text
       end as valore
union all
select 'Sono tutte accese (deve dire ok)',
       coalesce((select 'spente: ' || string_agg(e.chiave, ', ' order by e.ordine)
                   from public.statistiche_eventi e
                   join attese a on a.chiave = e.chiave
                  where not e.attivo), 'ok')
union all
select 'Il vecchio "ha scelto una torta già composta" è ancora acceso (deve dire ok)',
       case (select attivo from public.statistiche_eventi where chiave = 'torta_consigliata')
            when true then 'ok'
            when false then 'NO — spento: i numeri di prima spariscono dal totale'
            else 'NO — manca dal catalogo'
       end
union all
select 'Il sito può registrare i click (deve dire ok)',
       case when has_function_privilege('anon', 'public.registra_evento(text,text,text,text)', 'execute')
            then 'ok' else 'NO — ERRORE' end
union all
select 'Le statistiche restano private (deve dire ok)',
       case when has_function_privilege('anon', 'public.statistiche_riepilogo(int)', 'execute')
              or has_table_privilege('anon', 'public.statistiche_sito', 'select')
            then 'NO — ERRORE: il pubblico può leggerle' else 'ok' end;
