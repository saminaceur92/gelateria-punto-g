-- ============================================================
-- Codici sconto — 2026-08-11
-- Da eseguire su Supabase (SQL Editor) PRIMA di mettere online il sito nuovo.
--
-- Come funziona, in breve:
--   • i titolari creano i codici dalla dashboard (scheda "🏷️ Codici sconto");
--   • il cliente lo scrive alla fine del configuratore;
--   • lo sconto vero lo applica il SERVER quando prepara il pagamento, perché
--     è il server ad avere l'ultima parola sull'importo addebitato. Se lo
--     applicasse solo il sito, il cliente vedrebbe 40 € e Stripe gliene
--     addebiterebbe 45.
--
-- ⚠️ La tabella NON è leggibile dal pubblico: se lo fosse, chiunque potrebbe
-- aprire la console del browser e scaricarsi l'elenco dei codici attivi. Il
-- sito non la legge mai: chiede alla funzione `verifica_sconto` se un singolo
-- codice vale, e quella risponde sì o no.
-- ============================================================

-- NB: la chiave è un `id` come in tutte le altre tabelle del gestionale (la
-- scheda di modifica lavora così); il codice è comunque unico.
create table if not exists public.codici_sconto (
  id         uuid primary key default gen_random_uuid(),
  codice     text not null unique,               -- sempre in MAIUSCOLO, senza spazi
  descrizione text not null default '',         -- a cosa serve (uso interno)
  tipo       text not null default 'percentuale'
             check (tipo in ('percentuale', 'fisso')),
  valore     numeric not null default 0,        -- 10 = -10%  oppure  -10 €
  attivo     boolean not null default true,
  scadenza   date,                              -- vuoto = non scade mai
  usi_max    int,                               -- vuoto = utilizzi illimitati
  usi        int not null default 0,            -- quante volte è stato usato davvero
  ordine     int not null default 100,          -- ordine nella scheda del gestionale
  minimo     numeric not null default 0,        -- spesa minima perché valga
  creato_il  timestamptz not null default now()
);

alter table public.codici_sconto enable row level security;

-- Nessuna lettura pubblica: solo lo staff loggato vede e gestisce i codici.
drop policy if exists "codici_sconto_public_select" on public.codici_sconto;
drop policy if exists "codici_sconto_staff" on public.codici_sconto;
create policy "codici_sconto_staff" on public.codici_sconto
  for all to authenticated using (true) with check (true);

-- I codici si scrivono sempre in maiuscolo e senza spazi: così "estate10",
-- "Estate 10" e "ESTATE10" sono lo stesso codice e il cliente non sbaglia.
create or replace function public.normalizza_codice()
returns trigger
language plpgsql
as $$
begin
  new.codice := upper(regexp_replace(coalesce(new.codice, ''), '\s', '', 'g'));
  return new;
end $$;

drop trigger if exists normalizza_codice_trg on public.codici_sconto;
create trigger normalizza_codice_trg
  before insert or update on public.codici_sconto
  for each row execute function public.normalizza_codice();

-- ─────────────────────────────────────────────────────────────
-- Verifica di un codice (la usa il sito, e la usa il server)
-- ─────────────────────────────────────────────────────────────
-- Risponde SOLO su quel codice: non espone mai l'elenco.
-- Ritorna: valido, motivo (perché no), tipo, valore, sconto in euro,
-- totale scontato.
create or replace function public.verifica_sconto(p_codice text, p_totale numeric)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.codici_sconto%rowtype;
  v_cod text := upper(regexp_replace(coalesce(p_codice, ''), '\s', '', 'g'));
  v_tot numeric := coalesce(p_totale, 0);
  v_sconto numeric;
begin
  if length(v_cod) < 3 then
    return json_build_object('valido', false, 'motivo', 'Codice non valido.');
  end if;

  select * into c from public.codici_sconto where codice = v_cod;

  if not found or not c.attivo then
    return json_build_object('valido', false, 'motivo', 'Questo codice non esiste o non è più attivo.');
  end if;
  if c.scadenza is not null and c.scadenza < current_date then
    return json_build_object('valido', false, 'motivo', 'Questo codice è scaduto.');
  end if;
  if c.usi_max is not null and c.usi >= c.usi_max then
    return json_build_object('valido', false, 'motivo', 'Questo codice è già stato usato il numero massimo di volte.');
  end if;
  if v_tot < c.minimo then
    return json_build_object('valido', false,
      'motivo', 'Questo codice vale da ' || to_char(c.minimo, 'FM999990.00') || ' € in su.');
  end if;

  v_sconto := case when c.tipo = 'percentuale' then round(v_tot * c.valore / 100.0, 2) else c.valore end;
  -- Mai sotto zero e mai piu' del totale: uno sconto non regala soldi.
  v_sconto := least(greatest(v_sconto, 0), v_tot);

  return json_build_object(
    'valido', true,
    'codice', c.codice,
    'tipo', c.tipo,
    'valore', c.valore,
    'sconto', v_sconto,
    'totale_scontato', round(v_tot - v_sconto, 2),
    'descrizione', c.descrizione
  );
end $$;

-- Il sito pubblico deve poterla chiamare (il configuratore è aperto a tutti).
grant execute on function public.verifica_sconto(text, numeric) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Consumo di un codice (una volta che il pagamento è andato a buon fine)
-- ─────────────────────────────────────────────────────────────
-- La chiama il webhook di Stripe, cioè l'unico punto che sa con certezza che
-- il cliente ha pagato davvero. NON va chiamata quando si apre il pagamento:
-- un cliente che ci ripensa brucerebbe un utilizzo per niente.
create or replace function public.consuma_sconto(p_codice text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.codici_sconto
     set usi = usi + 1
   where codice = upper(regexp_replace(coalesce(p_codice, ''), '\s', '', 'g'));
end $$;

revoke execute on function public.consuma_sconto(text) from anon;
grant execute on function public.consuma_sconto(text) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- Sull'ordine restiamo con traccia di cosa è stato applicato davvero
-- ─────────────────────────────────────────────────────────────
alter table public.ordini add column if not exists sconto_codice text;
alter table public.ordini add column if not exists sconto_euro numeric;

-- ─────────────────────────────────────────────────────────────
-- Controllo finale
-- ─────────────────────────────────────────────────────────────
select 'Codici sconto in tabella' as cosa, count(*)::text as valore from public.codici_sconto
union all
select 'Prova su un codice inesistente', (public.verifica_sconto('NONESISTE', 50)::json ->> 'motivo');
