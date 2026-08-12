-- ============================================================
-- Codici: due correzioni — 2026-08-11
-- Da eseguire su Supabase (SQL Editor).
--
-- 1. La tabella dei codici sconto non aveva la colonna `ordine`, che la scheda
--    di modifica del gestionale usa per tenere le righe in ordine: senza,
--    la scheda dava errore e non si poteva aggiungere niente.
--
-- 2. Il blocco dopo i tentativi sbagliati era troppo severo nel modo sbagliato:
--    siccome dal codice digitato non si può risalire a CHI stava provando, un
--    tentativo errato faceva scattare il contatore su TUTTI i codici. Risultato:
--    una persona che sbaglia a digitare cinque volte al banco bloccava l'intera
--    gelateria per dieci minuti. Ora i tentativi falliti si contano a parte e
--    rallentano l'ingresso per un minuto: un ladro che prova diecimila
--    combinazioni non arriva da nessuna parte, ma chi sbaglia a battere non
--    chiude fuori i colleghi.
-- ============================================================

-- ── 1. Colonna che mancava ───────────────────────────────────
alter table public.codici_sconto add column if not exists ordine int not null default 100;

-- ── 2. Tentativi falliti, contati a parte ────────────────────
create table if not exists public.accessi_falliti (
  id     bigserial primary key,
  quando timestamptz not null default now()
);
alter table public.accessi_falliti enable row level security;
create index if not exists accessi_falliti_quando_idx on public.accessi_falliti (quando desc);

-- Nessuno era davvero bloccato: azzero quello che c'è, la difesa ora è l'altra.
update public.staff_codici set tentativi = 0, bloccato_fino = null;

create or replace function public.verifica_codice(p_pin text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r public.staff_codici%rowtype;
  v_pin text := regexp_replace(coalesce(p_pin, ''), '\s', '', 'g');
  v_falliti int;
begin
  if length(v_pin) < 4 then
    return json_build_object('ok', false, 'motivo', 'Codice non valido.');
  end if;

  -- Troppi errori di fila (da chiunque): si rallenta per un minuto. Serve a
  -- rendere inutile provare i codici a tappeto, non a punire chi sbaglia.
  select count(*) into v_falliti
    from public.accessi_falliti
   where quando > now() - interval '1 minute';
  if v_falliti >= 8 then
    return json_build_object('ok', false, 'motivo', 'Troppi tentativi. Aspetta un minuto e riprova.');
  end if;

  -- Il codice non si può cercare per uguaglianza (in tabella c'è l'impronta):
  -- si prova riga per riga. Sono pochi, una manciata di persone.
  for r in select * from public.staff_codici where attivo loop
    if r.pin_hash = crypt(v_pin, r.pin_hash) then
      update public.staff_codici set ultimo_uso = now(), tentativi = 0, bloccato_fino = null where id = r.id;
      -- Andata a buon fine: si fa pulizia dei tentativi vecchi.
      delete from public.accessi_falliti where quando < now() - interval '10 minutes';
      return json_build_object('ok', true, 'id', r.id, 'nome', r.nome, 'ruolo', r.ruolo);
    end if;
  end loop;

  insert into public.accessi_falliti default values;
  return json_build_object('ok', false, 'motivo', 'Codice non riconosciuto.');
end $$;

grant execute on function public.verifica_codice(text) to anon, authenticated;

-- ── Controllo finale ─────────────────────────────────────────
select 'Colonna ordine sui codici sconto' as cosa,
       (select count(*)::text from information_schema.columns
         where table_schema = 'public' and table_name = 'codici_sconto' and column_name = 'ordine') as valore
union all
select 'Persone bloccate adesso',
       (select count(*)::text from public.staff_codici where bloccato_fino is not null and bloccato_fino > now());
