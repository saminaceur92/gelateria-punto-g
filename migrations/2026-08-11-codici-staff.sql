-- ============================================================
-- Codici personali dello staff — 2026-08-11
-- Da eseguire su Supabase (SQL Editor) UNA VOLTA.
--
-- Cosa cambia: ogni persona che lavora in gelateria ha un CODICE personale.
-- Serve per entrare nel gestionale e per firmare le tre azioni che contano:
-- creare un ordine al banco, eliminarlo, segnarlo Pronto. Chi ha un codice da
-- AMMINISTRATORE può creare e togliere i codici degli altri.
--
-- ⚠️ I codici NON sono salvati in chiaro: in tabella c'è solo la loro impronta
-- (bcrypt). Nemmeno chi guarda il database può leggere il codice di qualcuno:
-- se uno lo dimentica non si "recupera", se ne fa uno nuovo.
--
-- ⚠️ Un PIN di poche cifre è comodo al banco ma è corto: per questo c'è il
-- BLOCCO AUTOMATICO dopo 5 tentativi sbagliati (10 minuti). Senza quello, un
-- PIN a 4 cifre si indovina provando le 10.000 combinazioni.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ─────────────────────────────────────────────────────────────
-- 1. Chi lavora in gelateria
-- ─────────────────────────────────────────────────────────────
create table if not exists public.staff_codici (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  ruolo         text not null default 'staff' check (ruolo in ('admin', 'staff')),
  pin_hash      text not null,                -- impronta del codice, mai il codice
  attivo        boolean not null default true,
  -- Difesa contro chi prova i codici a tentativi
  tentativi     int not null default 0,
  bloccato_fino timestamptz,
  ultimo_uso    timestamptz,
  creato_il     timestamptz not null default now()
);

alter table public.staff_codici enable row level security;
-- Nessuno legge questa tabella dal browser, nemmeno lo staff: si passa sempre
-- dalle funzioni qui sotto, che non fanno mai uscire le impronte dei codici.
drop policy if exists "staff_codici_nessuno" on public.staff_codici;

-- ─────────────────────────────────────────────────────────────
-- 2. Storico attività: chi ha fatto cosa
-- ─────────────────────────────────────────────────────────────
create table if not exists public.attivita (
  id        bigserial primary key,
  quando    timestamptz not null default now(),
  chi_id    uuid references public.staff_codici(id) on delete set null,
  chi_nome  text not null default '',          -- copiato qui: resta anche se il codice viene tolto
  azione    text not null,
  dettaglio text
);

alter table public.attivita enable row level security;
drop policy if exists "attivita_staff_select" on public.attivita;
create policy "attivita_staff_select" on public.attivita
  for select to authenticated using (true);

create index if not exists attivita_quando_idx on public.attivita (quando desc);

-- ─────────────────────────────────────────────────────────────
-- 3. Verifica di un codice
-- ─────────────────────────────────────────────────────────────
-- Risponde: chi sei e che ruolo hai. Non fa mai uscire i codici degli altri.
-- Dopo 5 tentativi sbagliati blocca QUEL codice per 10 minuti.
create or replace function public.verifica_codice(p_pin text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r public.staff_codici%rowtype;
  v_pin text := regexp_replace(coalesce(p_pin, ''), '\s', '', 'g');
begin
  if length(v_pin) < 4 then
    return json_build_object('ok', false, 'motivo', 'Codice non valido.');
  end if;

  -- Il codice non si può cercare per uguaglianza (in tabella c'è l'impronta):
  -- si prova riga per riga. Sono pochi (una manciata di persone).
  for r in select * from public.staff_codici where attivo order by ultimo_uso desc nulls last loop
    if r.bloccato_fino is not null and r.bloccato_fino > now() then
      continue; -- bloccato: si comporta come se il codice non esistesse
    end if;
    if r.pin_hash = crypt(v_pin, r.pin_hash) then
      update public.staff_codici
         set tentativi = 0, bloccato_fino = null, ultimo_uso = now()
       where id = r.id;
      return json_build_object('ok', true, 'id', r.id, 'nome', r.nome, 'ruolo', r.ruolo);
    end if;
  end loop;

  -- Nessuna corrispondenza: conto il tentativo su TUTTI i codici attivi non
  -- bloccati. È volutamente severo: è l'unica difesa di un codice corto.
  update public.staff_codici
     set tentativi = tentativi + 1,
         bloccato_fino = case when tentativi + 1 >= 5 then now() + interval '10 minutes' else bloccato_fino end
   where attivo and (bloccato_fino is null or bloccato_fino <= now());

  return json_build_object('ok', false, 'motivo', 'Codice non riconosciuto.');
end $$;

grant execute on function public.verifica_codice(text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. Registrare un'azione firmata dal codice
-- ─────────────────────────────────────────────────────────────
-- Il codice si verifica QUI: il browser non può dire "l'ha fatto Anna" senza
-- conoscere il codice di Anna.
create or replace function public.registra_attivita(p_pin text, p_azione text, p_dettaglio text default null)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v json;
begin
  v := public.verifica_codice(p_pin);
  if not (v ->> 'ok')::boolean then
    return v;
  end if;
  insert into public.attivita (chi_id, chi_nome, azione, dettaglio)
  values ((v ->> 'id')::uuid, v ->> 'nome', p_azione, p_dettaglio);
  return v;
end $$;

grant execute on function public.registra_attivita(text, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5. Gestione dei codici (solo amministratori)
-- ─────────────────────────────────────────────────────────────
create or replace function public.codici_elenco(p_pin text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v json; begin
  v := public.verifica_codice(p_pin);
  if not (v ->> 'ok')::boolean or (v ->> 'ruolo') <> 'admin' then
    return json_build_object('ok', false, 'motivo', 'Serve un codice da amministratore.');
  end if;
  return json_build_object('ok', true, 'elenco', coalesce((
    select json_agg(json_build_object(
      'id', id, 'nome', nome, 'ruolo', ruolo, 'attivo', attivo,
      'ultimo_uso', ultimo_uso, 'bloccato', (bloccato_fino is not null and bloccato_fino > now())
    ) order by nome)
    from public.staff_codici), '[]'::json));
end $$;

-- Crea una persona nuova e le assegna un codice. Il codice si vede UNA volta
-- sola, adesso: dopo resta solo la sua impronta.
create or replace function public.codice_crea(p_pin text, p_nome text, p_ruolo text, p_nuovo_pin text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v json; v_pin text := regexp_replace(coalesce(p_nuovo_pin, ''), '\s', '', 'g'); begin
  v := public.verifica_codice(p_pin);
  if not (v ->> 'ok')::boolean or (v ->> 'ruolo') <> 'admin' then
    return json_build_object('ok', false, 'motivo', 'Serve un codice da amministratore.');
  end if;
  if coalesce(trim(p_nome), '') = '' then
    return json_build_object('ok', false, 'motivo', 'Scrivi il nome della persona.');
  end if;
  if length(v_pin) < 4 then
    return json_build_object('ok', false, 'motivo', 'Il codice deve avere almeno 4 cifre.');
  end if;
  -- Due persone con lo stesso codice renderebbero impossibile capire chi è chi.
  if exists (select 1 from public.staff_codici where attivo and pin_hash = crypt(v_pin, pin_hash)) then
    return json_build_object('ok', false, 'motivo', 'Questo codice è già di qualcun altro: scegline un altro.');
  end if;

  insert into public.staff_codici (nome, ruolo, pin_hash)
  values (trim(p_nome), case when p_ruolo = 'admin' then 'admin' else 'staff' end,
          crypt(v_pin, gen_salt('bf')));

  insert into public.attivita (chi_id, chi_nome, azione, dettaglio)
  values ((v ->> 'id')::uuid, v ->> 'nome', 'Codice creato', trim(p_nome));
  return json_build_object('ok', true);
end $$;

create or replace function public.codice_elimina(p_pin text, p_id uuid)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v json; v_nome text; begin
  v := public.verifica_codice(p_pin);
  if not (v ->> 'ok')::boolean or (v ->> 'ruolo') <> 'admin' then
    return json_build_object('ok', false, 'motivo', 'Serve un codice da amministratore.');
  end if;
  if p_id = (v ->> 'id')::uuid then
    return json_build_object('ok', false, 'motivo', 'Non puoi togliere il tuo stesso codice.');
  end if;
  select nome into v_nome from public.staff_codici where id = p_id;
  -- Ultimo amministratore: se lo si toglie, nessuno può più gestire i codici.
  if (select ruolo from public.staff_codici where id = p_id) = 'admin'
     and (select count(*) from public.staff_codici where ruolo = 'admin' and attivo) <= 1 then
    return json_build_object('ok', false, 'motivo', 'È l''ultimo amministratore: prima nominane un altro.');
  end if;
  delete from public.staff_codici where id = p_id;
  insert into public.attivita (chi_id, chi_nome, azione, dettaglio)
  values ((v ->> 'id')::uuid, v ->> 'nome', 'Codice eliminato', coalesce(v_nome, '?'));
  return json_build_object('ok', true);
end $$;

grant execute on function public.codici_elenco(text) to authenticated;
grant execute on function public.codice_crea(text, text, text, text) to authenticated;
grant execute on function public.codice_elimina(text, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 6. Sugli ordini resta scritto CHI ha fatto cosa
-- ─────────────────────────────────────────────────────────────
alter table public.ordini add column if not exists creato_da text;   -- chi l'ha preso al banco
alter table public.ordini add column if not exists pronto_da text;   -- chi l'ha segnato Pronto
alter table public.ordini add column if not exists pronto_il timestamptz;

-- ─────────────────────────────────────────────────────────────
-- 7. PRIMO AMMINISTRATORE — DA PERSONALIZZARE PRIMA DI ESEGUIRE
-- ─────────────────────────────────────────────────────────────
-- ⚠️ QUESTO FILE STA IN UN REPOSITORY PUBBLICO SU GITHUB.
-- Il codice che scrivi qui sotto lo può leggere chiunque, per sempre (resta
-- anche nella storia delle modifiche). Ed è il codice più potente di tutti:
-- è quello che crea e toglie i codici di tutti gli altri.
--
-- Quindi: sostituisci CAMBIAMI con un codice vostro PRIMA di eseguire, e
-- appena sei entrato creane uno nuovo dalla scheda "Codici e attività" e
-- cancella questo. Non riscriverlo mai dentro un file.
insert into public.staff_codici (nome, ruolo, pin_hash)
select 'Titolare', 'admin', extensions.crypt('CAMBIAMI', extensions.gen_salt('bf'))
 where not exists (select 1 from public.staff_codici where ruolo = 'admin');

-- ─────────────────────────────────────────────────────────────
-- 8. Storico vecchio: si azzera (richiesta esplicita)
-- ─────────────────────────────────────────────────────────────
-- Lo storico attuale è fatto di accessi via email e non dice chi ha fatto cosa:
-- da qui in avanti ogni riga porta il nome della persona. Se la vecchia tabella
-- si chiama diversamente, questa riga semplicemente non trova nulla.
do $$
begin
  if to_regclass('public.staff_activity') is not null then
    execute 'delete from public.staff_activity';
  end if;
  if to_regclass('public.attivita_staff') is not null then
    execute 'delete from public.attivita_staff';
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Controllo finale
-- ─────────────────────────────────────────────────────────────
select 'Persone con un codice' as cosa, count(*)::text as valore from public.staff_codici
union all
select 'Di cui amministratori', count(*)::text from public.staff_codici where ruolo = 'admin'
union all
select 'Prova codice sbagliato', (public.verifica_codice('000000')::json ->> 'motivo');
