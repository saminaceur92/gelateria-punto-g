-- ============================================================
-- Svuota la scheda "Parole in grassetto" — 2026-08-25
-- Da eseguire su Supabase (SQL Editor) SOLO SE vuoi la scheda pulita.
--
-- Perché esiste: la prima versione di `2026-08-25-parole-evidenza.sql`
-- precaricava 21 righe (crumble, biscotti, cialde, pan di spagna,
-- lecitina di soia, più alcune eccezioni) scelte guardando i testi degli
-- ingredienti. Non era una decisione da prendere al posto dei titolari:
-- quali parole sono allergene lo decidono loro.
--
-- Quelle righe sono già state TUTTE SPENTE, quindi il quaderno esce già
-- identico a prima e non c'è nessuna urgenza. Restano però visibili nella
-- scheda. Questo script le toglie di mezzo del tutto.
--
-- In alternativa si possono cancellare una per una dal gestionale, col
-- cestino a destra di ogni riga: stesso risultato.
--
-- ⚠️ Cancella SOLO le righe spente. Se nel frattempo ne hai aggiunte o
-- accese di tue, quelle restano dove sono.
-- ============================================================

delete from public.parole_evidenza
 where attivo = false;

-- Controllo finale: cosa resta nella scheda.
select coalesce(count(*), 0) as righe_rimaste,
       count(*) filter (where attivo) as accese
  from public.parole_evidenza;
