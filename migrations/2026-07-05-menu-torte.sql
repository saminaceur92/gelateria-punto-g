-- ============================================================
-- Aggiornamento contenuti configuratore torte — 2026-07-05
-- Da applicare su Supabase (progetto Gelateria-punto-gi) UNA VOLTA.
-- Il sito legge questi dati LIVE da Supabase: finché non giri questo
-- script, sul sito restano i vecchi nomi. Gli ID NON cambiano (sono
-- legati al codice/3D): cambiano solo nome/descrizione/supplemento/colore.
-- ============================================================

-- ---- Tipi torta ----
update tipi_torta
  set nome = 'Gi Selection',
      descrizione = 'La nostra firma: selezione speciale Punto Gi'
  where id = 'crock';

update tipi_torta
  set nome = 'Alta',
      descrizione = 'Alta 7 cm — scenografica, fino a 4 gusti'
  where id = 'piani';

-- ---- Basi ----
-- "Crock croccante" -> "Crumble croccante"
update basi
  set nome = 'Crumble croccante',
      descrizione = 'Biscottino croccante'
  where id = 'crock';

-- "Frolla al cacao" -> "Senza base" (gelato/semifreddo direttamente sul piatto)
update basi
  set nome = 'Senza base',
      descrizione = 'Gelato/semifreddo direttamente sul piatto',
      supplemento = 0,
      colore = '#efe7da'
  where id = 'cacao';

-- "Senza glutine" -> "Salame al cioccolato"
update basi
  set nome = 'Salame al cioccolato',
      descrizione = 'Sfiziosa base con il nostro salame al cioccolato – solo per i golosoni',
      supplemento = 3,
      colore = '#5a3520'
  where id = 'glutenfree';

-- ---- Occasioni ----
delete from occasioni where nome = 'Solo per coccolarmi';

-- Nota: gli allergeni delle basi sono gestiti dal codice (src/data/live.js,
-- mappa per id), già aggiornati nel fallback: 'cacao' -> nessuno,
-- 'glutenfree' (Salame al cioccolato) -> glutine + latte.
