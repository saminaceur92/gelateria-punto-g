-- ============================================================
-- Foto delle torte su Storage — 2026-07-26
-- Da eseguire su Supabase UNA VOLTA.
--
-- Problema: gli ordini pagati dal sito arrivavano in dashboard SENZA la foto
-- della torta 3D. La riga la crea il webhook Stripe ricomponendola dai metadata
-- della sessione di pagamento, che sono campi da 500 caratteri: l'immagine
-- (20-30 KB in base64) non ci stava, quindi veniva esclusa. Gli ordini creati
-- dalla dashboard invece ce l'avevano, perché lì la riga si salva direttamente.
--
-- Soluzione: la foto viene caricata qui dal browser al momento dell'ordine e
-- nella riga finisce solo il link (~110 caratteri), che nei metadata ci sta.
--
-- Effetto collaterale utile: con la foto a un indirizzo web vero si può anche
-- mettere nelle mail (nei promemoria compleanno le immagini "incollate dentro"
-- non si vedrebbero).
-- ============================================================

-- Bucket pubblico in lettura: le foto si devono vedere in dashboard e nelle
-- mail senza login. Solo JPEG, massimo 2 MB l'una (le nostre pesano ~30 KB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('torte', 'torte', true, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public             = true,
      file_size_limit    = 2097152,
      allowed_mime_types = array['image/jpeg'];

-- Lettura per tutti.
drop policy if exists "torte_public_read" on storage.objects;
create policy "torte_public_read" on storage.objects
  for select using (bucket_id = 'torte');

-- Caricamento anche senza login: il configuratore del sito è pubblico e la foto
-- si carica PRIMA del pagamento. Solo inserimento (niente modifica o
-- cancellazione), limitato ai JPEG e a 2 MB dalle impostazioni del bucket.
drop policy if exists "torte_public_insert" on storage.objects;
create policy "torte_public_insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'torte');

-- Cancellazione riservata allo staff loggato (per fare pulizia).
drop policy if exists "torte_auth_delete" on storage.objects;
create policy "torte_auth_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'torte');

-- NB: chi abbandona il pagamento lascia una foto orfana nel bucket (~30 KB).
-- Per fare pulizia, ogni tanto: Storage → torte → elimina le cartelle vecchie
-- dei mesi passati che non servono più.
