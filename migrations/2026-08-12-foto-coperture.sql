-- ============================================================
-- Foto di esempio per le coperture — 2026-08-12
-- Da eseguire su Supabase (SQL Editor).
--
-- Dalla dashboard (scheda "Coperture") si carica una foto vera per ogni
-- copertura: chi la sceglie nel configuratore trova il collegamento
-- "clicca qui per vedere un'immagine a scopo illustrativo" e la apre.
--
-- `foto` è l'indirizzo pubblico; `foto_path` il percorso del file nello
-- storage (bucket `gallery`, cartella coperture/), che serve per cancellare
-- il file quando la foto viene cambiata o tolta.
-- ============================================================

alter table public.coperture add column if not exists foto text;
alter table public.coperture add column if not exists foto_path text;

-- Controllo finale: le due colonne devono esserci.
select column_name
  from information_schema.columns
 where table_schema = 'public' and table_name = 'coperture'
   and column_name in ('foto', 'foto_path');
