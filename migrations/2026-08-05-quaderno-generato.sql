-- ============================================================
-- Quaderno allergeni generato dal gestionale — 2026-08-05
-- Da eseguire su Supabase (progetto Gelateria-punto-gi) UNA VOLTA,
-- dal SQL Editor. Lo script è IDEMPOTENTE: rieseguirlo non fa danni.
--
-- A cosa serve: da adesso il PDF ufficiale degli allergeni si può creare
-- con un pulsante, partendo dai dati della scheda "Gusti e allergeni" (più
-- basi, crumble, farciture, coperture, decorazioni ed extra). Così il PDF e
-- il sito non possono più dire cose diverse.
--
-- Queste due colonne servono al gestionale per accorgersi da solo quando il
-- PDF pubblicato è rimasto indietro rispetto ai dati:
--   generato   -> true se il PDF in linea l'ha creato il gestionale
--                 (false = caricato a mano, come si faceva prima)
--   dati_hash  -> "impronta" dei dati usati per generarlo. Se i dati cambiano
--                 l'impronta non combacia più e nella scheda "PDF e QR
--                 allergeni" compare l'avviso "rigenera il quaderno".
--
-- Finché non esegui questo script il sito NON si rompe: il pulsante genera e
-- pubblica lo stesso il PDF, semplicemente senza tenere traccia
-- dell'allineamento (quindi senza l'avviso automatico).
-- ============================================================

alter table public.documenti add column if not exists generato  boolean not null default false;
alter table public.documenti add column if not exists dati_hash text;

comment on column public.documenti.generato  is 'true = PDF creato dal gestionale dai dati in database; false = caricato a mano';
comment on column public.documenti.dati_hash is 'impronta dei dati usati per generare il PDF: se non combacia più, il PDF è da rigenerare';

-- Il PDF attualmente in linea è stato caricato a mano: lo si dichiara
-- esplicitamente, così l'avviso nel gestionale dice la verità dal primo giorno.
update public.documenti
   set generato = false
 where chiave = 'allergeni'
   and dati_hash is null;
