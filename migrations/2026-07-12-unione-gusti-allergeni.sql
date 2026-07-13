-- ============================================================
-- Unione Gusti + Allergeni — 2026-07-12
-- `allergeni_prodotti` diventa l'UNICA lista: alimenta sia la carta del gelato
-- (menu) sia la pagina pubblica /allergeni. Aggiungiamo colore e tag (come aveva
-- il menu) e copiamo i colori esistenti dal menu (gusti) per nome.
-- Da eseguire su Supabase UNA VOLTA, PRIMA del deploy del codice.
-- (La vecchia tabella `gusti` non viene più usata dal sito; la puoi lasciare.)
-- ============================================================

alter table public.allergeni_prodotti add column if not exists colore text default '#f5d97a';
alter table public.allergeni_prodotti add column if not exists tag text;

-- Copia i colori dal menu (gusti) sui prodotti con lo stesso nome (case-insensitive).
update public.allergeni_prodotti ap
set colore = g.colore
from public.gusti g
where lower(trim(ap.gusto)) = lower(trim(g.nome))
  and g.colore is not null;
