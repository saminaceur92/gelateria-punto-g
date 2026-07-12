-- ============================================================
-- Flag "senza lattosio" spostato nella scheda Allergeni — 2026-07-12
-- Il menu (carta del gelato) ora prende i badge dieta (Vegan / Senza glutine /
-- Senza lattosio) dalla tabella allergeni_prodotti (per nome del gusto), non più
-- dai flag della tabella gusti. Aggiungiamo la colonna mancante e vi copiamo i
-- valori esistenti dal menu, così nessun badge si perde.
-- Da eseguire su Supabase UNA VOLTA.
-- ============================================================

alter table public.allergeni_prodotti
  add column if not exists senza_lattosio boolean not null default false;

-- Copia i "senza lattosio" già impostati nel menu (gusti) sui prodotti allergeni,
-- abbinando per nome (case-insensitive).
update public.allergeni_prodotti ap
set senza_lattosio = g.senza_lattosio
from public.gusti g
where lower(trim(ap.gusto)) = lower(trim(g.nome));
