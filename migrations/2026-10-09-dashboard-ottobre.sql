-- ============================================================
-- Gestionale, richieste di ottobre — 2026-10-09
-- Da eseguire su Supabase (SQL Editor) UNA VOLTA, tutto insieme.
-- Lo script è IDEMPOTENTE: rieseguirlo non fa danni.
--
-- Il sito e la dashboard funzionano anche PRIMA di questo script: le cose
-- nuove compaiono da sole appena le colonne esistono. Dopo averlo eseguito,
-- per provarlo sul serio c'è 2026-10-09-dashboard-ottobre-prova.sql.
--
-- 16. Ordini: «Note future». Ogni card della scheda 📦 Ordini ha un pulsante
--     che apre un riquadro di note dello staff su QUELL'ordine (colonna
--     ordini.note_future). Sono interne: non vanno su Telegram, nella mail o
--     sullo scontrino, che partono tutti all'arrivo dell'ordine, prima che
--     le note esistano. Lo staff le scrive come già scrive le note di
--     laboratorio (note_lab): nessuna regola di accesso nuova.
--
-- 17. Forme per torte normali e per torte alte. Nel tab Dimensioni, in cima
--     a ogni colonna forma (tonda, cuore, quadrata, rettangolare) delle due
--     griglie, c'è un interruttore: una forma si può spegnere solo per le
--     alte o solo per le normali (colonne forme.per_normali e forme.per_alte).
--     L'interruttore della scheda Forme (attivo) resta quello GENERALE: se è
--     spento la forma non la vede nessuno. Il gruppo lo decide il tipo di
--     torta: Alta semifreddo e Alta Gelato sono le alte. Al rilascio non
--     cambia niente di visibile: le colonne nascono accese per tutte.
--
-- 18. Ordine dei bottoni di ogni lista del configuratore, deciso dalla
--     dashboard con le frecce ▲ ▼ («↕ Cambia ordine» in ogni scheda).
--     a) I gusti delle torte hanno un ordine PROPRIO (colonna
--        allergeni_prodotti.ordine_torte): nella carta del gelato i gusti
--        stanno per categoria, nel configuratore in una griglia unica, e
--        spostare un gusto per le torte non deve scombinare la carta.
--     b) Una volta sola, i numeri di `ordine` diventano puliti (10, 20, 30…)
--        NELL'ORDINE CHE IL SITO MOSTRA GIÀ (ordine, poi id): sul sito non
--        si sposta niente. Le gemelle vegetali della panna ("-veg")
--        prendono il numero dell'originale, come oggi. Senza questa pulizia
--        la prima freccia su ogni lista riscriverebbe tutta la tabella.
--     c) La prima volta ordine_torte riparte dall'ordine di oggi dei gusti
--        per torte, così anche nel configuratore non cambia niente.
-- ============================================================

begin;

-- ── 16. Note future sugli ordini ─────────────────────────────
alter table public.ordini add column if not exists note_future text;

comment on column public.ordini.note_future is
  'Note interne dello staff su QUESTO ordine (pulsante «Note future» della scheda Ordini). Non arrivano al cliente: niente Telegram, mail o scontrino.';

-- ── 17. Forme per torte normali e per torte alte ─────────────
-- Nessuna regola di accesso nuova: valgono quelle che la tabella forme ha
-- già (la scheda Forme accende e spegne `attivo` allo stesso modo).
alter table public.forme add column if not exists per_normali boolean not null default true;
alter table public.forme add column if not exists per_alte    boolean not null default true;

comment on column public.forme.per_normali is
  'Si può scegliere per le torte normali (tutte tranne Alta semifreddo e Alta Gelato). Conta solo con attivo = true: l''interruttore della scheda Forme resta quello generale.';
comment on column public.forme.per_alte is
  'Si può scegliere per le torte alte (tipi piani e alta-gelato). Conta solo con attivo = true.';

-- ── 18a. Ordine dei gusti nel configuratore torte ────────────
alter table public.allergeni_prodotti add column if not exists ordine_torte integer;

comment on column public.allergeni_prodotti.ordine_torte is
  'Posizione del gusto nel configuratore torte (solo i gusti «Per torte»; vuoto = in fondo). La carta del gelato usa ordine.';

-- ── 18b. Numeri puliti 10, 20, 30… nell'ordine di oggi ───────
-- L'ordine è quello del sito: `ordine` (vuoti in fondo), a pari numero l'id.
-- Rieseguendola l'ordine non cambia: si riscrivono solo i numeri diversi.
do $$
declare
  t       text;
  v_doppi int;
begin
  foreach t in array array['tipi_torta', 'dimensioni', 'forme', 'basi', 'crumble', 'farciture',
                           'coperture', 'decorazioni', 'scritte', 'extra', 'occasioni',
                           'allergeni_prodotti'] loop
    if to_regclass('public.' || t) is null then
      continue; -- tabella che qui non c'è: niente da sistemare
    end if;
    -- "capi" = tutte le righe tranne le gemelle vegetali che hanno
    -- l'originale; la gemella prende il numero del suo originale.
    execute format($q$
      with capi as (
        select r.id::text as id,
               row_number() over (order by r.ordine nulls last, r.id) as pos
          from public.%1$I r
         where not (r.id::text like '%%-veg'
                    and exists (select 1 from public.%1$I o where o.id::text = left(r.id::text, -4)))
      )
      update public.%1$I r
         set ordine = c.pos * 10
        from capi c
       where (r.id::text = c.id or r.id::text = c.id || '-veg')
         and r.ordine is distinct from c.pos * 10
    $q$, t);
    -- Rete di sicurezza: due voci (gemelle a parte) con lo stesso numero
    -- vorrebbe dire una pulizia non riuscita. Allora si annulla tutto.
    execute format($q$
      select count(*) from (
        select r.ordine
          from public.%1$I r
         where not (r.id::text like '%%-veg'
                    and exists (select 1 from public.%1$I o where o.id::text = left(r.id::text, -4)))
         group by r.ordine
        having count(*) > 1
      ) d
    $q$, t) into v_doppi;
    if v_doppi > 0 then
      raise exception 'Pulizia dei numeri non riuscita sulla tabella %: niente è stato cambiato', t;
    end if;
  end loop;
end $$;

-- ── 18c. Prima volta: i gusti delle torte nell'ordine di oggi ─
-- Solo se nessun gusto ha ancora una posizione per le torte: rieseguendo lo
-- script non si perde l'ordine scelto nel frattempo dai titolari.
update public.allergeni_prodotti a
   set ordine_torte = x.pos * 10
  from (select id, row_number() over (order by ordine nulls last, id) as pos
          from public.allergeni_prodotti
         where per_torte) x
 where a.id = x.id
   and not exists (select 1 from public.allergeni_prodotti where ordine_torte is not null);

notify pgrst, 'reload schema';

commit;

-- ── Controllo finale (sola lettura): ogni riga deve dire ok ──
-- Se una riga dice NO, accanto c'è scritto cosa manca. I rimedi:
--  · "lo staff può scrivere le note future" = NO →
--      grant update (note_future) on public.ordini to authenticated;
--  · "tempo reale" = NO → la tabella ordini va (ri)messa nel tempo reale da
--      Database → Publications → supabase_realtime, con tutte le colonne;
--  · "lo staff può accendere e spegnere le forme" = NO →
--      grant update (per_normali, per_alte) on public.forme to authenticated;
--  · "almeno una forma in vendita" = NO → nella scheda Forme non è accesa
--      nessuna forma: il configuratore non avrebbe forme da proporre;
--  · "lo staff può cambiare l'ordine" = NO →
--      grant update (ordine_torte) on public.allergeni_prodotti to authenticated;
--  · "gusti per torte con la loro posizione": subito dopo la prima
--      esecuzione dice sempre ok. Se rieseguendo lo script più avanti dice
--      NO, è normale: un gusto spuntato «Per torte» dopo la migrazione sta in
--      fondo finché non lo si sposta con le frecce (scheda Gusti, riquadro 🎂).
select '16 · colonna ordini.note_future' as cosa,
       case when exists (select 1 from information_schema.columns
                          where table_schema = 'public' and table_name = 'ordini'
                            and column_name = 'note_future')
            then 'ok' else 'NO — colonna mancante' end as esito
union all
select '16 · lo staff può scrivere le note future',
       case when has_column_privilege('authenticated', 'public.ordini', 'note_future', 'UPDATE')
            then 'ok' else 'NO — manca il permesso (vedi sopra)' end
union all
-- Il pallino delle note compare da solo sugli altri dispositivi solo se la
-- colonna viaggia nel tempo reale. `attnames` esiste da Postgres 15: letta
-- via to_jsonb, la query non si rompe sulle versioni più vecchie (dove le
-- colonne viaggiano sempre tutte).
select '16 · le note future si aggiornano da sole sugli altri dispositivi',
       case
         when not exists (select 1 from pg_publication_tables p
                           where p.pubname = 'supabase_realtime'
                             and p.schemaname = 'public' and p.tablename = 'ordini')
           then 'NO — la tabella ordini non è nel tempo reale'
         when exists (select 1 from pg_publication_tables p
                       where p.pubname = 'supabase_realtime'
                         and p.schemaname = 'public' and p.tablename = 'ordini'
                         and coalesce(to_jsonb(p) -> 'attnames', '["note_future"]'::jsonb) ? 'note_future')
           then 'ok'
         else 'NO — la colonna non è fra quelle del tempo reale'
       end
union all
-- Salvare una nota è un UPDATE sull'ordine: se esistesse un automatismo su
-- UPDATE (nel repo sono tutti all'INSERT), partirebbe a ogni nota salvata.
select '16 · nessun automatismo parte quando si salva una nota',
       case when exists (select 1 from pg_trigger t
                          where t.tgrelid = 'public.ordini'::regclass
                            and not t.tgisinternal
                            and (t.tgtype & 16) <> 0)
            then 'da controllare — c''è un trigger su UPDATE degli ordini'
            else 'ok' end
union all
select '17 · colonne forme.per_normali e forme.per_alte',
       case when (select count(*) from information_schema.columns
                   where table_schema = 'public' and table_name = 'forme'
                     and column_name in ('per_normali', 'per_alte')) = 2
            then 'ok' else 'NO — colonne mancanti' end
union all
select '17 · lo staff può accendere e spegnere le forme per gruppo',
       case when has_column_privilege('authenticated', 'public.forme', 'per_normali', 'UPDATE')
             and has_column_privilege('authenticated', 'public.forme', 'per_alte', 'UPDATE')
            then 'ok' else 'NO — manca il permesso (vedi sopra)' end
union all
select '17 · torte normali: almeno una forma in vendita',
       case when exists (select 1 from public.forme where attivo and per_normali)
            then 'ok' else 'NO — nessuna forma accesa per le torte normali' end
union all
select '17 · torte alte: almeno una forma in vendita',
       case when exists (select 1 from public.forme where attivo and per_alte)
            then 'ok' else 'NO — nessuna forma accesa per le torte alte' end
union all
select '18 · colonna allergeni_prodotti.ordine_torte',
       case when exists (select 1 from information_schema.columns
                          where table_schema = 'public' and table_name = 'allergeni_prodotti'
                            and column_name = 'ordine_torte')
            then 'ok' else 'NO — colonna mancante' end
union all
select '18 · lo staff può cambiare l''ordine dei gusti nelle torte',
       case when has_column_privilege('authenticated', 'public.allergeni_prodotti', 'ordine_torte', 'UPDATE')
             and has_column_privilege('authenticated', 'public.allergeni_prodotti', 'ordine', 'UPDATE')
            then 'ok' else 'NO — manca il permesso (vedi sopra)' end
union all
select '18 · gusti per torte con la loro posizione',
       case when not exists (select 1 from public.allergeni_prodotti where per_torte and ordine_torte is null)
            then 'ok'
            else 'NO — ' || (select count(*) from public.allergeni_prodotti where per_torte and ordine_torte is null)
                 || ' gusti senza posizione (vedi sopra)' end
union all
-- Gemelle vegetali allo stesso numero dell'originale: a chi è vegano la
-- vegetale compare al posto di quella col latte, nello stesso punto.
select '18 · panna vegetale allo stesso posto della panna',
       case when exists (select 1 from public.coperture v join public.coperture c on v.id = c.id || '-veg'
                          where v.ordine is distinct from c.ordine)
              or exists (select 1 from public.decorazioni v join public.decorazioni c on v.id = c.id || '-veg'
                          where v.ordine is distinct from c.ordine)
            then 'NO — una gemella vegetale ha un numero diverso' else 'ok' end
union all
select '18 · nessun numero doppio nelle liste (gemelle vegetali a parte)',
       case when exists (
         with tutte as (
           select 'tipi_torta' as t, id::text as id, ordine from public.tipi_torta
           union all select 'dimensioni', id::text, ordine from public.dimensioni
           union all select 'forme', id::text, ordine from public.forme
           union all select 'basi', id::text, ordine from public.basi
           union all select 'crumble', id::text, ordine from public.crumble
           union all select 'farciture', id::text, ordine from public.farciture
           union all select 'coperture', id::text, ordine from public.coperture
           union all select 'decorazioni', id::text, ordine from public.decorazioni
           union all select 'scritte', id::text, ordine from public.scritte
           union all select 'extra', id::text, ordine from public.extra
           union all select 'occasioni', id::text, ordine from public.occasioni
           union all select 'allergeni_prodotti', id::text, ordine from public.allergeni_prodotti
         )
         select 1 from tutte a
          where not (a.id like '%-veg' and exists (select 1 from tutte b where b.t = a.t and b.id = left(a.id, -4)))
          group by a.t, a.ordine
         having count(*) > 1)
            then 'NO — due voci con lo stesso numero' else 'ok' end;
