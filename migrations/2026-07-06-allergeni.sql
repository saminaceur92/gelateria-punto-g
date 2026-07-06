-- ============================================================
-- Tabella ALLERGENI per il configuratore torte — 2026-07-06
-- Da eseguire su Supabase (progetto Gelateria-punto-gi) UNA VOLTA.
-- Crea la tabella, i permessi (lettura pubblica, scrittura staff) e i 7
-- allergeni ufficiali. Da lì li gestisci dalla scheda "Allergeni" in dashboard.
-- Il campo `id` è la chiave usata per l'ingrigimento: per glutine/latte/uova/
-- soia/frutta a guscio deve restare identico (coincide con gli allergeni dei gusti/basi).
-- ============================================================

create table if not exists public.allergeni (
  id      text primary key,
  nome    text not null,
  emoji   text default '',
  attivo  boolean not null default true,
  ordine  integer not null default 0
);

alter table public.allergeni enable row level security;

-- Lettura pubblica (come gli altri contenuti del sito)
drop policy if exists "allergeni_select_public" on public.allergeni;
create policy "allergeni_select_public" on public.allergeni
  for select using (true);

-- Scrittura solo agli utenti autenticati (staff/owner loggati nel gestionale).
-- NB: se le altre tabelle contenuti (es. basi, occasioni) usano una policy di
-- scrittura più stretta, rispecchiala qui al posto di questa.
drop policy if exists "allergeni_write_auth" on public.allergeni;
create policy "allergeni_write_auth" on public.allergeni
  for all to authenticated using (true) with check (true);

-- I 7 allergeni ufficiali (Reg. UE 1169/2011)
insert into public.allergeni (id, nome, emoji, ordine) values
  ('glutine',         'Glutine',         '🌾', 10),
  ('latte',           'Latte',           '🥛', 20),
  ('uova',            'Uova',            '🥚', 30),
  ('soia',            'Soia',            '🌱', 40),
  ('arachidi',        'Arachidi',        '🥜', 50),
  ('frutta a guscio', 'Frutta a guscio', '🌳', 60),
  ('solfiti',         'Solfiti',         '🍷', 70)
on conflict (id) do nothing;
