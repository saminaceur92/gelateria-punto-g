-- ============================================================
-- Rimozione della tabella `parole_evidenza` — 2026-08-25
-- Da eseguire su Supabase (SQL Editor). Si può eseguire anche più volte.
--
-- Storia, in breve: per un giorno è esistita nel gestionale la scheda
-- "Parole in grassetto", con cui si sarebbero potute aggiungere le parole da
-- evidenziare nel quaderno degli allergeni. Lucia ha deciso di non tenerla.
-- Il codice della scheda è già stato tolto dal sito: da quel momento questa
-- tabella non la legge più nessuno.
--
-- Questo script la cancella, così non resta roba inutile nel database.
--
-- ⚠️ Cancella la tabella e il suo contenuto (erano 21 righe, tutte spente e
-- già senza effetto sul quaderno). Non tocca nient'altro.
--
-- Il quaderno degli allergeni continua a funzionare esattamente come prima:
-- l'elenco delle parole da mettere in grassetto è tornato dentro al codice
-- del sito (src/lib/quadernoPdf.js), dov'era da sempre.
-- ============================================================

drop table if exists public.parole_evidenza;

-- Controllo finale: non deve trovare più niente (zero righe = tutto a posto).
select table_name
  from information_schema.tables
 where table_schema = 'public'
   and table_name = 'parole_evidenza';
