-- ============================================================
-- Tipi di CRUMBLE per il configuratore torte — 2026-07-26
-- Da eseguire su Supabase (progetto Gelateria-punto-gi) UNA VOLTA.
--
-- Nel configuratore, chi sceglie la base "Crumble croccante" (basi.id = 'crock')
-- vede un passo in più con i tipi di crumble disponibili. La lista è questa
-- tabella, gestibile dalla dashboard nella scheda "Crumble".
--
-- Finché non esegui questo script il sito NON si rompe: usa la copia di
-- sicurezza nel codice (crumble al cacao + crumble bianco).
-- ============================================================

create table if not exists public.crumble (
  id           text primary key,
  nome         text not null,
  descrizione  text default '',
  supplemento  numeric(10,2) not null default 0,
  colore       text default '#b88c5a',   -- usato dalla torta 3D
  allergeni    text default '',          -- nomi separati da virgola, come nelle altre schede
  attivo       boolean not null default true,
  ordine       integer not null default 0
);

alter table public.crumble enable row level security;

-- Lettura pubblica (il configuratore del sito è pubblico).
drop policy if exists "crumble_select_public" on public.crumble;
create policy "crumble_select_public" on public.crumble
  for select using (true);

-- Scrittura solo allo staff loggato nel gestionale.
drop policy if exists "crumble_write_auth" on public.crumble;
create policy "crumble_write_auth" on public.crumble
  for all to authenticated using (true) with check (true);

-- I due tipi di partenza. Gli altri li aggiunge la gelateria dalla dashboard.
-- ⚠️ Gli allergeni sono quelli oggi dichiarati per la base crumble ('Soia'):
-- vanno confermati col laboratorio e corretti dalla scheda "Crumble".
insert into public.crumble (id, nome, descrizione, supplemento, colore, allergeni, attivo, ordine) values
  ('cacao',  'Crumble al cacao', 'Biscottino croccante al cacao', 0, '#5a3520', 'Soia', true, 10),
  ('bianco', 'Crumble bianco',   'Biscottino croccante classico', 0, '#e0c49a', 'Soia', true, 20)
on conflict (id) do nothing;
