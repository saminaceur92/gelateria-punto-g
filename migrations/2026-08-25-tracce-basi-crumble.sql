-- ============================================================
-- Possibili tracce anche per BASI e CRUMBLE — 2026-08-25
-- Da eseguire su Supabase (progetto Gelateria-punto-gi) UNA VOLTA,
-- dal SQL Editor, PRIMA del deploy del codice. Lo script è IDEMPOTENTE:
-- rieseguirlo non fa danni.
--
-- Finora le schede "Basi" e "Crumble" avevano un solo riquadro di allergeni
-- (quelli PRESENTI). Lucia vuole poter indicare anche le POSSIBILI TRACCE,
-- come già si fa nella scheda "Gusti e allergeni" (allergeni_certi /
-- allergeni_tracce). Aggiungiamo la colonna `allergeni_tracce` con lo stesso
-- formato della colonna `allergeni`: nomi separati da virgola
-- (es. 'Soia, Frutta a guscio').
--
-- Le tracce NON spengono le scelte nel configuratore (come per i gusti: lì
-- contano solo gli allergeni presenti); finiscono nel quaderno allergeni
-- generato dal gestionale, con il pallino "può contenerne tracce".
--
-- ⚠️ Perché PRIMA del deploy: il gestionale salva la riga con tutti i campi
-- della scheda; se la colonna non esiste ancora, il Salva delle schede Basi
-- e Crumble darebbe errore.
-- ============================================================

alter table public.basi    add column if not exists allergeni_tracce text default '';
alter table public.crumble add column if not exists allergeni_tracce text default '';

comment on column public.basi.allergeni_tracce    is 'possibili tracce (nomi separati da virgola), come allergeni_prodotti.allergeni_tracce';
comment on column public.crumble.allergeni_tracce is 'possibili tracce (nomi separati da virgola), come allergeni_prodotti.allergeni_tracce';

-- Controllo finale: le due colonne devono comparire entrambe.
select table_name, column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and table_name in ('basi', 'crumble')
   and column_name = 'allergeni_tracce'
 order by table_name;
