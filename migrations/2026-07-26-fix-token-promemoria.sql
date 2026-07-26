-- ============================================================
-- FIX — token dei promemoria compleanno — 2026-07-26
-- Da eseguire su Supabase DOPO 2026-07-26-promemoria-compleanno.sql.
--
-- Problema: il trigger generava il token con `gen_random_bytes` (pgcrypto), che
-- su Supabase sta nello schema `extensions`, non in `public`. Con
-- `search_path = public` la chiamata falliva, l'errore veniva inghiottito dalla
-- rete di sicurezza (che serve a non bloccare MAI il salvataggio dell'ordine) e
-- il promemoria non veniva creato: ordine salvato, coda vuota.
--
-- Soluzione: token da `gen_random_uuid()` (funzione di base di Postgres, sempre
-- disponibile) — 32 caratteri casuali, più che sufficienti per un link segreto.
--
-- Ripara anche gli ordini di compleanno già inseriti mentre il trigger era rotto.
-- ============================================================

create or replace function public.crea_promemoria_compleanno()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text;
  v_token text;
  v_anniv date;
begin
  v_email := lower(trim(coalesce(new.cliente_email, new.email, '')));

  if new.promemoria_ok is not true                              then return new; end if;
  if v_email = '' or v_email not like '%@%'                     then return new; end if;
  if coalesce(new.dettagli->>'occasion', '') <> 'Compleanno'    then return new; end if;
  if new.ritiro_data is null                                    then return new; end if;
  if exists (select 1 from public.promemoria_stop s where s.email = v_email) then return new; end if;

  v_anniv := (new.ritiro_data + interval '1 year')::date;
  -- 32 caratteri casuali, senza dipendere da pgcrypto
  v_token := replace(gen_random_uuid()::text, '-', '');

  insert into public.promemoria_compleanno (ordine_id, email, nome, tipo, invio_previsto, token)
  values
    (new.id, v_email, new.cliente_nome, 'primo',   (v_anniv - interval '30 days')::date, v_token),
    (new.id, v_email, new.cliente_nome, 'secondo', (v_anniv - interval '14 days')::date, v_token);

  return new;
exception when others then
  return new;  -- non deve MAI bloccare il salvataggio dell'ordine
end $$;

-- Recupera SOLO gli ordini persi per colpa del baco, cioè quelli arrivati dopo
-- l'installazione del trigger (26/07/2026 ~17:20 ora italiana). Lo storico
-- precedente resta fuori, come stabilito. Salta doppioni e disiscritti.
insert into public.promemoria_compleanno (ordine_id, email, nome, tipo, invio_previsto, token)
select o.id,
       lower(trim(coalesce(o.cliente_email, o.email))),
       o.cliente_nome,
       t.tipo,
       ((o.ritiro_data + interval '1 year') - t.giorni)::date,
       replace(gen_random_uuid()::text, '-', '')
from public.ordini o
cross join (values ('primo', interval '30 days'), ('secondo', interval '14 days')) as t(tipo, giorni)
where o.created_at >= timestamptz '2026-07-26 15:00:00+00'
  and o.promemoria_ok is true
  and o.ritiro_data is not null
  and coalesce(o.dettagli->>'occasion', '') = 'Compleanno'
  and coalesce(o.cliente_email, o.email, '') like '%@%'
  and not exists (select 1 from public.promemoria_compleanno p where p.ordine_id = o.id)
  and not exists (select 1 from public.promemoria_stop s
                   where s.email = lower(trim(coalesce(o.cliente_email, o.email))));

-- ⚠️ NB: le due righe dello stesso ordine ricevono qui token diversi (una per
-- riga). Non è un problema: ogni link funziona da solo, sia per "rifai la
-- torta" sia per la disiscrizione (che vale comunque per tutto l'indirizzo).

select count(*) as promemoria_in_coda from public.promemoria_compleanno;
