-- ============================================================
-- Misure della torta per FORMA — 2026-09-14
-- Da eseguire su Supabase (progetto Gelateria-punto-gi) UNA VOLTA,
-- dal SQL Editor. Lo script è IDEMPOTENTE: rieseguirlo non fa danni.
--
-- Richiesta dei titolari: nel tab Dimensioni poter scrivere la misura di
-- ogni taglia per ciascuna forma. Una torta da 10 persone tonda non misura
-- quanto una quadrata, e la quadrata un diametro non ce l'ha nemmeno.
--
--  - `diametro` resta com'è ed è la misura della TONDA.
--  - `misure` (nuova) tiene le altre forme, in centimetri:
--        { "cuore": [22], "quadrata": [20], "rettangolare": [24, 34] }
--    quadrata = lato; rettangolare = lato corto e lato lungo.
--    Forma assente = misura non indicata: il cuore ripiega sul diametro
--    della tonda, quadrata e rettangolare non mostrano nessuna misura.
--
-- Finché questo script non gira, il sito continua a funzionare come prima
-- e dalla dashboard si può già salvare la colonna della tonda.
--
-- Nessuna policy nuova: la colonna segue le regole di lettura e scrittura
-- che la tabella `dimensioni` ha già.
-- ============================================================

alter table public.dimensioni
  add column if not exists misure jsonb not null default '{}'::jsonb;

comment on column public.dimensioni.misure is
  'Misure in cm per le forme diverse dalla tonda: {"cuore":[22],"quadrata":[20],"rettangolare":[24,34]}. La tonda usa la colonna diametro.';
