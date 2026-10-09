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
--      nessuna forma: il configuratore non avrebbe forme da proporre.
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
            then 'ok' else 'NO — nessuna forma accesa per le torte alte' end;
