-- ============================================================
-- Gusti torte nella lista unica — 2026-07-12
-- Aggiunge il flag `per_torte` a allergeni_prodotti ("Gusti e allergeni").
-- Il configuratore torte legge i gusti da qui (quelli con per_torte = true),
-- usando colore e allergeni della lista unica. La vecchia tabella gusti_torte
-- non è più gestita dalla dashboard (la puoi lasciare come backup).
-- Da eseguire su Supabase UNA VOLTA, PRIMA del deploy del codice.
-- ============================================================

alter table public.allergeni_prodotti
  add column if not exists per_torte boolean not null default false;

-- Spunta "per torte" i gusti che erano nella vecchia lista gusti_torte (per nome).
update public.allergeni_prodotti ap
set per_torte = true
from public.gusti_torte gt
where lower(trim(ap.gusto)) = lower(trim(gt.nome));
