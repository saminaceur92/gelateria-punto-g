-- ORDINI — integrazione flusso pagamenti Stripe con la tabella esistente.
--
-- La tabella `public.ordini` è già gestita dal backend (workflow di lavorazione:
-- stato = da_fare | in_lavorazione | pronto | consegnato | annullato, + user_id).
-- NON va ricreata. Qui aggiungiamo solo, in modo NON distruttivo, le colonne che
-- servono al pagamento web. Applicato in produzione il 2026-07-05.
--
-- Un ordine web viene salvato SOLO quando è pagato (dal webhook stripe-webhook),
-- con stato 'da_fare' → entra direttamente nella coda di lavorazione. Niente
-- ordini-fantasma non pagati.

alter table public.ordini add column if not exists cliente               text;
alter table public.ordini add column if not exists telefono              text;
alter table public.ordini add column if not exists email                 text;
alter table public.ordini add column if not exists ritiro                timestamptz;
alter table public.ordini add column if not exists stripe_session_id     text;
alter table public.ordini add column if not exists stripe_payment_intent text;
alter table public.ordini add column if not exists pagato_il             timestamptz;

-- Allinea i tipi usati dal flusso (sicuro: le colonne erano vuote).
alter table public.ordini alter column dettagli type jsonb using dettagli::jsonb;
alter table public.ordini alter column totale   type numeric(10,2) using totale::numeric;

create index if not exists ordini_stato_idx   on public.ordini (stato);
create index if not exists ordini_created_idx on public.ordini (created_at desc);
