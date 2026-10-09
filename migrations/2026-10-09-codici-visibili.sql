-- ============================================================
-- Codici dello staff: gli amministratori li possono VEDERE — 2026-10-09
-- Da eseguire su Supabase (SQL Editor) UNA VOLTA, tutto insieme.
-- Controlla da sola se usare il Vault; serve che esista public.is_staff().
--
-- Cosa cambia:
--   · l'impronta (bcrypt) resta, ed è ancora l'UNICA cosa che decide se un
--     codice è giusto: entrare e firmare non dipendono da niente di nuovo;
--   · accanto c'è una copia CIFRATA del codice (AES-256, pgcrypto). La chiave
--     sta nel Vault di Supabase (o, se il Vault non si può usare, in una tabella
--     che il sito non raggiunge), mai in app_config;
--   · solo `codici_rivela` decifra, e solo con una sessione del personale E un
--     codice da amministratore. Ogni volta resta scritto nello storico;
--   · i codici di prima hanno solo l'impronta, che non si inverte: la copia
--     cifrata nasce DA SOLA la prima volta che la persona usa il suo codice
--     (entrata o firma), oppure quando un amministratore glielo reimposta;
--   · due funzioni nuove: `codice_reimposta` (l'amministratore dà un codice a
--     qualcuno senza cancellarlo e ricrearlo) e `codice_cambia` (ognuno
--     cambia il proprio).
-- ============================================================

begin;

create extension if not exists pgcrypto with schema extensions;

-- ── 1. Uno schema che le API del sito non vedono ─────────────
create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;
alter default privileges in schema private revoke execute on functions from public;

-- ── 2. La chiave ─────────────────────────────────────────────
-- Generata qui dentro: nessuno la scrive, nessuno la vede, non sta in nessun
-- file. Di preferenza nel Vault di Supabase, che la cifra con una chiave tenuta
-- FUORI dal database: un dump o un backup da soli non bastano a leggere i
-- codici. Se il Vault non c'è o non si può usare, va in una tabella dello
-- schema private, che le API del sito non raggiungono (più debole: finisce
-- nei backup, ma resta irraggiungibile dal sito). La migrazione sceglie da sola.
-- Se la chiave c'è già (migrazione lanciata due volte) non si tocca:
-- cambiarla renderebbe illeggibili le copie già cifrate.
create table if not exists private.segreti (
  nome      text primary key,
  valore    text not null,
  creato_il timestamptz not null default now()
);
alter table private.segreti enable row level security;
revoke all on table private.segreti from public, anon, authenticated;

do $$
declare
  v_vault boolean := false;
  v_c_e   boolean := false;
begin
  begin
    execute 'select exists (select 1 from vault.decrypted_secrets where name = ''staff_codici_chiave'')' into v_c_e;
    v_vault := true;
  exception when others then
    v_vault := false;
  end;
  if v_c_e or exists (select 1 from private.segreti where nome = 'staff_codici_chiave') then
    return;
  end if;
  if v_vault then
    begin
      execute 'select vault.create_secret($1, $2, $3)'
        using encode(extensions.gen_random_bytes(32), 'hex'),
              'staff_codici_chiave',
              'Chiave delle copie cifrate dei codici dello staff. Non cancellarla e non cambiarla a mano: senza, i codici non si possono più MOSTRARE (per entrare funzionano lo stesso).';
      return;
    exception when others then
      null; -- Vault presente ma non utilizzabile: si ripiega sulla tabella.
    end;
  end if;
  insert into private.segreti (nome, valore)
  values ('staff_codici_chiave', encode(extensions.gen_random_bytes(32), 'hex'));
end $$;

-- Prima il Vault, poi la tabella. SQL dinamico: la funzione si crea anche
-- dove lo schema vault non esiste.
create or replace function private.chiave_codici()
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v text;
begin
  begin
    execute 'select nullif(ds.decrypted_secret, '''') from vault.decrypted_secrets ds where ds.name = ''staff_codici_chiave'' limit 1'
      into v;
  exception when others then
    v := null;
  end;
  if v is null then
    select nullif(s.valore, '') into v from private.segreti s where s.nome = 'staff_codici_chiave';
  end if;
  return v;
end $$;

create or replace function private.cifra_codice(p_codice text)
returns bytea
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_chiave text := private.chiave_codici();
begin
  if v_chiave is null then
    raise exception 'Chiave dei codici mancante (Vault: staff_codici_chiave)';
  end if;
  -- aes256 scritto per esteso: con cipher-algo bf/cast5 pgp_sym_encrypt non
  -- cifrava davvero (Postgres 15.19 / 17.11, settembre 2026).
  return extensions.pgp_sym_encrypt(p_codice, v_chiave, 'cipher-algo=aes256');
end $$;

create or replace function private.decifra_codice(p_cifrato bytea)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_chiave text := private.chiave_codici();
begin
  if p_cifrato is null then
    return null;
  end if;
  if v_chiave is null then
    raise exception 'Chiave dei codici mancante (Vault: staff_codici_chiave)';
  end if;
  return extensions.pgp_sym_decrypt(p_cifrato, v_chiave);
end $$;

-- Spazi tolti come ha sempre fatto verifica_codice ("12 34" = "1234").
create or replace function private.codice_pulito(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(coalesce(p, ''), '\s', '', 'g');
$$;

-- Le regole di un codice NUOVO, in un posto solo (crea, reimposta, cambia).
-- Torna NULL se va bene, altrimenti la frase da mostrare.
create or replace function private.codice_problema(p_codice text, p_ruolo text, p_escludi uuid)
returns text
language plpgsql
stable
set search_path = ''
as $$
begin
  if length(p_codice) < 4 then
    return 'Il codice deve avere almeno 4 cifre.';
  end if;
  -- Un codice da amministratore adesso apre anche i codici di tutti. Con 8
  -- tentativi sbagliati al minuto (vedi verifica_codice) 4 cifre si provano
  -- tutte in meno di un giorno; 6 cifre in circa tre mesi.
  -- Se i titolari preferiscono 4 anche per gli amministratori: 6 → 4.
  if p_ruolo = 'admin' and length(p_codice) < 6 then
    return 'Il codice di un amministratore deve avere almeno 6 cifre.';
  end if;
  -- Due persone con lo stesso codice renderebbero impossibile capire chi è chi.
  if exists (select 1 from public.staff_codici s
              where s.attivo
                and s.id is distinct from p_escludi
                and s.pin_hash = extensions.crypt(p_codice, s.pin_hash)) then
    return 'Questo codice è già di qualcun altro: scegline un altro.';
  end if;
  return null;
end $$;

revoke execute on all functions in schema private from public, anon, authenticated;

-- ── 3. La copia cifrata, accanto all'impronta ────────────────
alter table public.staff_codici add column if not exists pin_cifrato bytea;
comment on column public.staff_codici.pin_cifrato is
  'Copia cifrata del codice (pgp_sym_encrypt aes256, chiave nel Vault: staff_codici_chiave). La legge solo public.codici_rivela() con un codice da amministratore. NULL = non ancora visibile: si riempie al primo uso del codice.';

-- Se qualcuno cambia l'impronta a mano (es. migrations/2026-08-11-cambia-
-- codice-titolare.sql) senza rifare la copia cifrata, la copia mostrerebbe
-- il codice VECCHIO. Meglio "non ancora visibile" che un codice sbagliato.
create or replace function private.staff_codici_coerenza()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.pin_hash is distinct from old.pin_hash
     and new.pin_cifrato is not distinct from old.pin_cifrato then
    new.pin_cifrato := null;
  end if;
  return new;
end $$;

drop trigger if exists staff_codici_coerenza on public.staff_codici;
create trigger staff_codici_coerenza
  before update of pin_hash on public.staff_codici
  for each row execute function private.staff_codici_coerenza();

-- ── 4. Verifica: identica a prima, più la copia cifrata al primo uso ──
create or replace function public.verifica_codice(p_pin text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r public.staff_codici%rowtype;
  v_pin text := private.codice_pulito(p_pin);
  v_falliti int;
begin
  if length(v_pin) < 4 then
    return json_build_object('ok', false, 'motivo', 'Codice non valido.');
  end if;

  -- Troppi errori di fila (da chiunque): si rallenta per un minuto.
  select count(*) into v_falliti
    from public.accessi_falliti
   where quando > now() - interval '1 minute';
  if v_falliti >= 8 then
    return json_build_object('ok', false, 'motivo', 'Troppi tentativi. Aspetta un minuto e riprova.');
  end if;

  for r in select * from public.staff_codici where attivo loop
    if r.pin_hash = extensions.crypt(v_pin, r.pin_hash) then
      update public.staff_codici
         set ultimo_uso = now(), tentativi = 0, bloccato_fino = null
       where id = r.id;
      -- Codici nati prima di questa migrazione: la copia cifrata non c'è.
      -- Il codice giusto è in mano adesso, ed è l'unico momento in cui si può
      -- farla. Qualunque intoppo qui NON deve impedire di entrare.
      if r.pin_cifrato is null then
        begin
          update public.staff_codici
             set pin_cifrato = private.cifra_codice(v_pin)
           where id = r.id and pin_cifrato is null;
        exception when others then
          null;
        end;
      end if;
      delete from public.accessi_falliti where quando < now() - interval '10 minutes';
      return json_build_object('ok', true, 'id', r.id, 'nome', r.nome, 'ruolo', r.ruolo);
    end if;
  end loop;

  insert into public.accessi_falliti default values;
  return json_build_object('ok', false, 'motivo', 'Codice non riconosciuto.');
end $$;

-- ── 5. Elenco: dice anche se il codice si può già mostrare ───
create or replace function public.codici_elenco(p_pin text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v json;
begin
  v := public.verifica_codice(p_pin);
  if not coalesce((v ->> 'ok')::boolean, false) or (v ->> 'ruolo') is distinct from 'admin' then
    return json_build_object('ok', false, 'motivo', 'Serve un codice da amministratore.');
  end if;
  return json_build_object('ok', true, 'elenco', coalesce((
    select json_agg(json_build_object(
      'id', s.id, 'nome', s.nome, 'ruolo', s.ruolo, 'attivo', s.attivo,
      'ultimo_uso', s.ultimo_uso,
      'bloccato', (s.bloccato_fino is not null and s.bloccato_fino > now()),
      'visibile', s.pin_cifrato is not null,
      'sei_tu', s.id = (v ->> 'id')::uuid
    ) order by s.nome)
    from public.staff_codici s), '[]'::json));
end $$;

-- ── 6. Mostrare i codici (uno o tutti) ───────────────────────
create or replace function public.codici_rivela(p_pin text, p_id uuid default null)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v json;
  r record;
  v_codice text;
  v_out jsonb := '[]'::jsonb;
  v_nomi text[] := '{}';
begin
  -- 1. Serve una sessione del personale: la chiave pubblica del sito non basta.
  --    `is not true` e non `not`: se is_staff() tornasse NULL, `not NULL`
  --    non entrerebbe nel ramo e la funzione tirerebbe dritto.
  if public.is_staff() is not true then
    return json_build_object('ok', false, 'motivo', 'Riservato al personale.');
  end if;
  -- 2. …e un codice da amministratore, verificato qui: i tentativi sbagliati
  --    contano come tutti gli altri (8 al minuto, poi si aspetta).
  v := public.verifica_codice(p_pin);
  if not coalesce((v ->> 'ok')::boolean, false) or (v ->> 'ruolo') is distinct from 'admin' then
    return json_build_object('ok', false, 'motivo', 'Serve un codice da amministratore.');
  end if;
  -- 3. Senza chiave non si decifra niente, e non si tocca niente.
  if private.chiave_codici() is null then
    return json_build_object('ok', false, 'motivo', 'Manca la chiave dei codici: avvisa chi gestisce il sito.');
  end if;

  for r in
    select s.id, s.nome, s.pin_cifrato
      from public.staff_codici s
     where p_id is null or s.id = p_id
     order by s.nome
  loop
    v_codice := null;
    if r.pin_cifrato is not null then
      begin
        v_codice := private.decifra_codice(r.pin_cifrato);
      exception when others then
        -- Copia illeggibile (fatta con un'altra chiave, o rovinata): si toglie,
        -- così al prossimo uso del codice si rifà da sola.
        update public.staff_codici set pin_cifrato = null where id = r.id;
      end;
    end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object('id', r.id, 'nome', r.nome, 'codice', v_codice));
    if v_codice is not null then
      v_nomi := v_nomi || r.nome;
    end if;
  end loop;

  -- Ogni volta che qualcuno guarda dei codici resta scritto chi e quali.
  -- Il codice NON va mai nello storico: `attivita` la legge tutto lo staff.
  if cardinality(v_nomi) > 0 then
    insert into public.attivita (chi_id, chi_nome, azione, dettaglio)
    values ((v ->> 'id')::uuid, v ->> 'nome',
            case when p_id is null then 'Ha visto i codici' else 'Ha visto un codice' end,
            array_to_string(v_nomi, ', '));
  end if;

  return json_build_object('ok', true, 'codici', v_out);
end $$;

-- ── 7. Creare: come prima, più la copia cifrata ──────────────
create or replace function public.codice_crea(p_pin text, p_nome text, p_ruolo text, p_nuovo_pin text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v json;
  v_pin text := private.codice_pulito(p_nuovo_pin);
  v_ruolo text := case when p_ruolo = 'admin' then 'admin' else 'staff' end;
  v_problema text;
  v_cifrato bytea;
begin
  v := public.verifica_codice(p_pin);
  if not coalesce((v ->> 'ok')::boolean, false) or (v ->> 'ruolo') is distinct from 'admin' then
    return json_build_object('ok', false, 'motivo', 'Serve un codice da amministratore.');
  end if;
  if coalesce(trim(p_nome), '') = '' then
    return json_build_object('ok', false, 'motivo', 'Scrivi il nome della persona.');
  end if;
  v_problema := private.codice_problema(v_pin, v_ruolo, null);
  if v_problema is not null then
    return json_build_object('ok', false, 'motivo', v_problema);
  end if;
  begin
    v_cifrato := private.cifra_codice(v_pin);
  exception when others then
    return json_build_object('ok', false, 'motivo', 'Manca la chiave dei codici: avvisa chi gestisce il sito.');
  end;

  insert into public.staff_codici (nome, ruolo, pin_hash, pin_cifrato)
  values (trim(p_nome), v_ruolo, extensions.crypt(v_pin, extensions.gen_salt('bf')), v_cifrato);

  insert into public.attivita (chi_id, chi_nome, azione, dettaglio)
  values ((v ->> 'id')::uuid, v ->> 'nome', 'Codice creato', trim(p_nome));
  return json_build_object('ok', true);
end $$;

-- ── 8. Reimpostare il codice di un'altra persona ─────────────
-- Stessa riga, stesso id: resta lo storico, resta l'utente tecnico di
-- staff-login (staff-<id>@codici…), non serve cancellare e ricreare.
-- Se l'amministratore scrive il codice che la persona usa GIÀ, per lei non
-- cambia niente: si salva solo la copia cifrata (lo dice l'impronta).
create or replace function public.codice_reimposta(p_pin text, p_id uuid, p_nuovo_pin text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v json;
  t public.staff_codici%rowtype;
  v_pin text := private.codice_pulito(p_nuovo_pin);
  v_problema text;
  v_cifrato bytea;
  v_uguale boolean;
begin
  if public.is_staff() is not true then
    return json_build_object('ok', false, 'motivo', 'Riservato al personale.');
  end if;
  v := public.verifica_codice(p_pin);
  if not coalesce((v ->> 'ok')::boolean, false) or (v ->> 'ruolo') is distinct from 'admin' then
    return json_build_object('ok', false, 'motivo', 'Serve un codice da amministratore.');
  end if;
  if p_id = (v ->> 'id')::uuid then
    return json_build_object('ok', false, 'motivo', 'Il tuo codice lo cambi da "Il mio codice", in alto.');
  end if;
  select * into t from public.staff_codici where id = p_id;
  if not found then
    return json_build_object('ok', false, 'motivo', 'Questa persona non c''è più: ricarica la scheda.');
  end if;

  v_uguale := length(v_pin) >= 4 and t.pin_hash = extensions.crypt(v_pin, t.pin_hash);
  if not v_uguale then
    v_problema := private.codice_problema(v_pin, t.ruolo, t.id);
    if v_problema is not null then
      return json_build_object('ok', false, 'motivo', v_problema);
    end if;
  end if;

  begin
    v_cifrato := private.cifra_codice(v_pin);
  exception when others then
    return json_build_object('ok', false, 'motivo', 'Manca la chiave dei codici: avvisa chi gestisce il sito.');
  end;

  if v_uguale then
    update public.staff_codici set pin_cifrato = v_cifrato where id = t.id;
    insert into public.attivita (chi_id, chi_nome, azione, dettaglio)
    values ((v ->> 'id')::uuid, v ->> 'nome', 'Codice reso visibile', t.nome);
    return json_build_object('ok', true, 'esito', 'uguale');
  end if;

  update public.staff_codici
     set pin_hash = extensions.crypt(v_pin, extensions.gen_salt('bf')),
         pin_cifrato = v_cifrato,
         tentativi = 0,
         bloccato_fino = null
   where id = t.id;
  insert into public.attivita (chi_id, chi_nome, azione, dettaglio)
  values ((v ->> 'id')::uuid, v ->> 'nome', 'Codice reimpostato', t.nome);
  return json_build_object('ok', true, 'esito', 'cambiato');
end $$;

-- ── 9. Cambiare il PROPRIO codice (staff e amministratori) ───
create or replace function public.codice_cambia(p_pin text, p_nuovo_pin text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v json;
  v_id uuid;
  v_pin text := private.codice_pulito(p_nuovo_pin);
  v_problema text;
  v_cifrato bytea;
begin
  if public.is_staff() is not true then
    return json_build_object('ok', false, 'motivo', 'Riservato al personale.');
  end if;
  v := public.verifica_codice(p_pin);
  if not coalesce((v ->> 'ok')::boolean, false) then
    return json_build_object('ok', false, 'motivo',
      case when (v ->> 'motivo') like 'Troppi%' then v ->> 'motivo'
           else 'Il codice attuale non è giusto.' end);
  end if;
  v_id := (v ->> 'id')::uuid;
  if v_pin = private.codice_pulito(p_pin) then
    return json_build_object('ok', false, 'motivo', 'Il codice nuovo è uguale a quello di adesso.');
  end if;
  v_problema := private.codice_problema(v_pin, v ->> 'ruolo', v_id);
  if v_problema is not null then
    return json_build_object('ok', false, 'motivo', v_problema);
  end if;
  begin
    v_cifrato := private.cifra_codice(v_pin);
  exception when others then
    return json_build_object('ok', false, 'motivo', 'Manca la chiave dei codici: avvisa chi gestisce il sito.');
  end;

  update public.staff_codici
     set pin_hash = extensions.crypt(v_pin, extensions.gen_salt('bf')),
         pin_cifrato = v_cifrato
   where id = v_id;
  insert into public.attivita (chi_id, chi_nome, azione, dettaglio)
  values (v_id, v ->> 'nome', 'Ha cambiato il suo codice', null);
  return json_build_object('ok', true);
end $$;

-- ── 10. Chi può chiamare cosa ────────────────────────────────
-- In Postgres una funzione nasce eseguibile da CHIUNQUE, anche con la chiave
-- pubblica che sta nel bundle del sito. Le funzioni dei codici si usano solo
-- dal gestionale, cioè con una sessione aperta: `anon` fuori.
revoke execute on function public.codici_rivela(text, uuid)           from public, anon;
revoke execute on function public.codice_reimposta(text, uuid, text)  from public, anon;
revoke execute on function public.codice_cambia(text, text)           from public, anon;
revoke execute on function public.codici_elenco(text)                 from public, anon;
revoke execute on function public.codice_crea(text, text, text, text) from public, anon;
revoke execute on function public.codice_elimina(text, uuid)          from public, anon;
revoke execute on function public.registra_attivita(text, text, text) from public, anon;
grant  execute on function public.codici_rivela(text, uuid)           to authenticated;
grant  execute on function public.codice_reimposta(text, uuid, text)  to authenticated;
grant  execute on function public.codice_cambia(text, text)           to authenticated;
grant  execute on function public.codici_elenco(text)                 to authenticated;
grant  execute on function public.codice_crea(text, text, text, text) to authenticated;
grant  execute on function public.codice_elimina(text, uuid)          to authenticated;
grant  execute on function public.registra_attivita(text, text, text) to authenticated;
-- verifica_codice NON cambia permessi: la usa staff-login (chiave di servizio).
-- Lo si ribadisce per service_role: se mancasse, nessuno entrerebbe più.
grant  execute on function public.verifica_codice(text) to anon, authenticated, service_role;

-- Le tabelle dei codici non si leggono dalle API, nemmeno dallo staff:
-- si passa sempre dalle funzioni qui sopra.
revoke all on table public.staff_codici    from anon, authenticated;
revoke all on table public.accessi_falliti from anon, authenticated;

notify pgrst, 'reload schema';

commit;

-- ── Controllo finale: ogni riga deve dire ok / no / sì come indicato ──
select 'Chiave dei codici presente' as cosa,
       case when private.chiave_codici() is not null then 'ok' else 'MANCA' end as valore
union all
select 'Prova cifra e decifra (deve dire ok)',
       case when private.decifra_codice(private.cifra_codice('0000')) = '0000' then 'ok' else 'NO' end
union all
select 'Codici già visibili',
       (select count(*) filter (where pin_cifrato is not null)::text || ' su ' || count(*)::text
          from public.staff_codici)
union all
select 'Il sito pubblico può mostrare i codici? (deve dire no)',
       case when has_function_privilege('anon', 'public.codici_rivela(text, uuid)', 'execute') then 'SÌ — ERRORE' else 'no' end
union all
select 'staff-login può verificare i codici? (deve dire sì)',
       case when has_function_privilege('service_role', 'public.verifica_codice(text)', 'execute') then 'sì' else 'NO — ERRORE' end
union all
select 'is_staff() presente (deve dire sì)',
       case when to_regprocedure('public.is_staff()') is not null then 'sì' else 'NO — ERRORE' end;
