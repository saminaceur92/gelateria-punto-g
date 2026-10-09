-- ============================================================
-- Pagamenti blindati: chi può scrivere gli ordini — 2026-10-09
-- Da eseguire su Supabase (SQL Editor) UNA VOLTA, tutto insieme.
-- Meglio PRIMA di ridistribuire le funzioni create-checkout e stripe-webhook
-- (funzionano anche senza, ma il webhook nuovo usa il vincolo unico del
-- punto 2). È rieseguibile: lanciarla due volte non fa danni.
--
-- Cosa cambia:
--   1. Il sito pubblico (ruolo `anon`) non può più né leggere né scrivere la
--      tabella `ordini`. Fino all'11/07/2026 il sito inseriva gli ordini da
--      solo; da allora li scrivono SOLO il webhook di Stripe (chiave di
--      servizio) e lo staff dalla dashboard (utenti autenticati). Un permesso
--      rimasto da allora permetterebbe a chiunque di creare un ordine "da
--      fare" (Telegram, mail, promemoria) senza pagare, o di leggere nomi e
--      telefoni dei clienti.
--   2. Un pagamento = un ordine: vincolo unico su `stripe_session_id`. Stripe
--      può mandare lo stesso evento due volte, anche nello stesso istante: il
--      secondo inserimento ora si ferma ("già registrato") invece di creare
--      un doppione, con due Telegram, due mail e il codice sconto scalato due
--      volte. Se OGGI ci sono già pagamenti salvati due volte l'indice non si
--      crea (non si cancella niente da soli): il controllo finale lo dice; si
--      tiene l'ordine più completo, si elimina l'altro dalla dashboard e si
--      rilancia questo file.
--   3. Il contatore dei codici sconto (`consuma_sconto`) lo muove solo il
--      webhook. La migrazione del 2026-08-11 lo toglieva solo ad `anon`, ma in
--      Postgres le funzioni nascono eseguibili da tutti (PUBLIC).
--
-- Non cambia niente per: la dashboard e gli ordini al banco (utenti
-- autenticati), i trigger su `ordini` (Telegram, mail, promemoria: girano coi
-- permessi del proprietario), il webhook (chiave di servizio).
-- Il controllo in fondo dice riga per riga se è tutto come deve essere.
-- ============================================================

begin;

-- ── 1. Il sito pubblico non tocca gli ordini ─────────────────
-- Toglie anche i permessi sulle singole colonne, se ce ne fossero.
-- Le eventuali regole (policy) RLS per anon restano, ma senza permessi
-- sulla tabella non servono più a niente (il controllo le elenca).
revoke all on table public.ordini from anon;

-- ── 2. Un pagamento = un ordine ──────────────────────────────
-- Stesso nome dell'indice proposto dalla migrazione dei promemoria: chi
-- arriva secondo lo trova già e non fa niente.
do $$
begin
  if exists (
    select 1 from public.ordini
     where stripe_session_id is not null
     group by stripe_session_id
    having count(*) > 1
  ) then
    raise notice 'Ci sono pagamenti salvati due volte: indice NON creato (vedi il controllo finale).';
  else
    create unique index if not exists ordini_stripe_session_uidx
      on public.ordini (stripe_session_id)
      where stripe_session_id is not null;
  end if;
end $$;

-- ── 3. I codici sconto li consuma solo il webhook ────────────
do $$
begin
  if to_regprocedure('public.consuma_sconto(text)') is null then
    raise notice 'consuma_sconto non esiste: esegui prima 2026-08-11-codici-sconto.sql.';
    return;
  end if;
  revoke execute on function public.consuma_sconto(text) from public, anon;
  grant execute on function public.consuma_sconto(text) to service_role;
end $$;

notify pgrst, 'reload schema';

commit;

-- ── Controllo finale: ogni riga deve dire quello che c'è fra parentesi ──
select 'Il sito pubblico può scrivere gli ordini? (deve dire no)' as cosa,
       case when has_any_column_privilege('anon', 'public.ordini', 'INSERT')
              or has_any_column_privilege('anon', 'public.ordini', 'UPDATE')
              or has_table_privilege('anon', 'public.ordini', 'DELETE')
            then 'SÌ — ERRORE' else 'no' end as valore
union all
select 'Il sito pubblico può leggere gli ordini? (deve dire no)',
       case when has_any_column_privilege('anon', 'public.ordini', 'SELECT') then 'SÌ — ERRORE' else 'no' end
union all
select 'Il webhook può salvare gli ordini? (deve dire sì)',
       case when has_table_privilege('service_role', 'public.ordini', 'INSERT') then 'sì' else 'NO — ERRORE' end
union all
select 'Lo staff può creare e modificare ordini? (deve dire sì)',
       case when has_table_privilege('authenticated', 'public.ordini', 'INSERT')
             and has_table_privilege('authenticated', 'public.ordini', 'UPDATE') then 'sì' else 'NO — ERRORE' end
union all
select 'Un pagamento = un ordine: vincolo unico presente? (deve dire sì)',
       case when to_regclass('public.ordini_stripe_session_uidx') is not null then 'sì'
            else 'NO — ci sono doppioni: vedi la riga sotto' end
union all
select 'Pagamenti salvati due volte (deve dire 0)',
       (select count(*)::text from (
          select 1 from public.ordini where stripe_session_id is not null
           group by stripe_session_id having count(*) > 1) d)
union all
select 'Ordini pagati arrivati SENZA riepilogo (0; altrimenti si ricostruiscono da Stripe)',
       (select count(*)::text from public.ordini
         where stripe_session_id is not null and coalesce(btrim(riepilogo), '') = '')
union all
select 'Il sito pubblico può consumare i codici sconto? (deve dire no)',
       case when to_regprocedure('public.consuma_sconto(text)') is null then 'funzione mancante'
            when has_function_privilege('anon', 'public.consuma_sconto(text)', 'execute') then 'SÌ — ERRORE'
            else 'no' end
union all
select 'Il webhook può consumare i codici sconto? (deve dire sì)',
       case when to_regprocedure('public.consuma_sconto(text)') is null then 'funzione mancante'
            when has_function_privilege('service_role', 'public.consuma_sconto(text)', 'execute') then 'sì'
            else 'NO — ERRORE' end
union all
select 'Regole RLS di ordini rivolte al pubblico (innocue senza permessi, si possono eliminare)',
       coalesce((select string_agg(policyname || ' (' || cmd || ')', ', ' order by policyname)
                   from pg_policies
                  where schemaname = 'public' and tablename = 'ordini'
                    and roles && array['anon', 'public']::name[]), 'nessuna');
