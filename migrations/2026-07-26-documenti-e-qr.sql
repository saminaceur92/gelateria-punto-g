-- ============================================================
-- Documenti pubblici (PDF Allergeni) + QR Code — 2026-07-26
-- Da eseguire su Supabase (progetto Gelateria-punto-gi) UNA VOLTA,
-- dal SQL Editor.
--
-- Cosa fa:
--  1. tabella `documenti`  -> tiene il link al PDF corrente, la data di
--     aggiornamento e l'indirizzo a cui punta il QR Code;
--  2. bucket storage `documenti` (pubblico, solo PDF, max 25 MB) -> ci
--     finiscono i PDF caricati dalla dashboard, senza rifare il deploy.
--
-- Dopo averla eseguita: dashboard /admin -> scheda "📄 PDF e QR allergeni".
-- Finché non la esegui il sito continua a funzionare col PDF statico
-- (public/documenti/quaderno-allergeni-punto-gi.pdf): niente si rompe.
-- ============================================================

-- ── 1. Tabella documenti ────────────────────────────────────
create table if not exists public.documenti (
  chiave        text primary key,          -- 'allergeni'
  titolo        text not null default '',
  file_url      text,                      -- URL pubblico del PDF corrente
  file_nome     text,                      -- nome del file caricato
  file_path     text,                      -- percorso dentro il bucket
  qr_url        text,                      -- destinazione del QR Code
  aggiornato_il timestamptz not null default now(),
  aggiornato_da text                       -- email di chi ha caricato
);

alter table public.documenti enable row level security;

-- Lettura pubblica: la pagina /allergeni deve poter leggere il link al PDF.
drop policy if exists "documenti_select_public" on public.documenti;
create policy "documenti_select_public" on public.documenti
  for select using (true);

-- Scrittura solo agli utenti autenticati (staff/titolari loggati in /admin).
drop policy if exists "documenti_write_auth" on public.documenti;
create policy "documenti_write_auth" on public.documenti
  for all to authenticated using (true) with check (true);

-- Riga del Quaderno Allergeni. `qr_url` = pagina pubblica a cui porta il QR:
-- quando collegherai il dominio, cambialo dalla dashboard e ristampa il QR.
insert into public.documenti (chiave, titolo, qr_url)
values ('allergeni', 'Quaderno Ingredienti e Allergeni', 'https://gelateria-punto-g.vercel.app/allergeni')
on conflict (chiave) do nothing;

-- ── 2. Bucket storage per i PDF ─────────────────────────────
-- Pubblico in lettura (il link nel QR/pagina deve aprirsi senza login),
-- solo file PDF, massimo 25 MB l'uno.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documenti', 'documenti', true, 26214400, array['application/pdf'])
on conflict (id) do update
  set public             = true,
      file_size_limit    = 26214400,
      allowed_mime_types = array['application/pdf'];

-- Chiunque può leggere/scaricare i file del bucket "documenti".
drop policy if exists "documenti_public_read" on storage.objects;
create policy "documenti_public_read" on storage.objects
  for select using (bucket_id = 'documenti');

-- Solo lo staff loggato può caricare / sostituire / cancellare.
drop policy if exists "documenti_auth_write" on storage.objects;
create policy "documenti_auth_write" on storage.objects
  for all to authenticated
  using (bucket_id = 'documenti')
  with check (bucket_id = 'documenti');

-- NB: se le due `create policy ... on storage.objects` dessero
-- "permission denied for table objects", crea il bucket a mano dalla sezione
-- Storage di Supabase (nome: documenti, spunta "Public bucket") e aggiungi le
-- policy dalla sua scheda "Policies": lettura per `public`, tutto per
-- `authenticated`. Il resto di questo script resta valido.
