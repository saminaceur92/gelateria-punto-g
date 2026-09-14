-- ============================================================
-- Taglie delle torte ALTE — 2026-09-14
-- Da eseguire su Supabase (progetto Gelateria-punto-gi) UNA VOLTA,
-- dal SQL Editor. Lo script è IDEMPOTENTE: rieseguirlo non fa danni.
-- Richiede la migrazione 2026-09-14-misure-per-forma (colonna `misure`).
--
-- Richiesta dei titolari: le alte (Alta semifreddo, Alta Gelato) sono in
-- pratica una torta doppia. Hanno bisogno di taglie proprie, con etichette,
-- supplementi e misure loro, gestite in una sezione a parte del tab
-- Dimensioni.
--
--  1. Colonna `alta`: false = taglia delle torte normali (tutte quelle di
--     oggi), true = taglia delle torte alte.
--  2. Bozza delle taglie alte: una copia di ogni taglia normale, con le stesse
--     etichette e misure e il supplemento RADDOPPIATO. Parte NASCOSTA
--     (attivo = false): i prezzi li decidono i titolari, che la controllano,
--     la correggono e la accendono dalla dashboard.
--
-- Finché nessuna taglia alta è accesa, sul sito le torte alte continuano a
-- usare le taglie normali, come prima.
-- ============================================================

alter table public.dimensioni
  add column if not exists alta boolean not null default false;

comment on column public.dimensioni.alta is
  'true = taglia delle torte alte (tipi piani e alta-gelato), false = torte normali.';

insert into public.dimensioni (id, etichetta, diametro, supplemento, popolare, attivo, ordine, misure, alta)
select
  'alta-' || d.id,
  d.etichetta,
  d.diametro,
  d.supplemento * 2,
  d.popolare,
  false,
  d.ordine,
  d.misure,
  true
from public.dimensioni d
where d.alta = false
  and d.id not like 'alta-%'
on conflict (id) do nothing;
