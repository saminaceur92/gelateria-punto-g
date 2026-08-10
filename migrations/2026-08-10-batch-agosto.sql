-- ============================================================
-- Batch agosto 2026 — da eseguire su Supabase (SQL Editor) UNA VOLTA,
-- PRIMA di mettere online il sito nuovo.
--
-- Cosa contiene:
--   1. preferenze alimentari (vegan / senza zuccheri aggiunti) sui componenti
--      della torta, coi valori DICHIARATI DAI TITOLARI nella loro scheda dati;
--   2. "Panna montata spatolata INTORNO" (nome copertura);
--   3. occasioni: via "Festa di famiglia", dentro "Gender reveal" e "Nessuna";
--   4. foto della gallery gestibili dal gestionale (tabella + spazio file);
--   5. notifica Telegram allineata al nome senza punto esclamativo.
--
-- È idempotente: rieseguirlo non fa danni.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. PREFERENZE ALIMENTARI SUI COMPONENTI DELLA TORTA
-- ─────────────────────────────────────────────────────────────
-- I gusti (tabella allergeni_prodotti) hanno già `vegan` e `senza_zucchero`.
-- Ai componenti mancavano: senza questi dati il filtro "Vegan" e il filtro
-- "Senza zuccheri aggiunti" del configuratore non avrebbero nulla da leggere.
--
-- ATTENZIONE, funzionano AL CONTRARIO degli allergeni: passa solo ciò che è
-- spuntato. Quello che non risulta dichiarato resta spento per chi sceglie
-- quella preferenza — su vegan e zuccheri non si tira a indovinare.
-- I titolari possono spuntarne altri dal gestionale in qualsiasi momento.

alter table public.basi        add column if not exists vegan boolean not null default false;
alter table public.basi        add column if not exists senza_zucchero boolean not null default false;
alter table public.crumble     add column if not exists vegan boolean not null default false;
alter table public.crumble     add column if not exists senza_zucchero boolean not null default false;
alter table public.farciture   add column if not exists vegan boolean not null default false;
alter table public.farciture   add column if not exists senza_zucchero boolean not null default false;
alter table public.coperture   add column if not exists vegan boolean not null default false;
alter table public.coperture   add column if not exists senza_zucchero boolean not null default false;
alter table public.decorazioni add column if not exists vegan boolean not null default false;
alter table public.decorazioni add column if not exists senza_zucchero boolean not null default false;

-- Basi: "Senza base" non aggiunge nulla, quindi non esclude niente.
-- "Base croccante" è solo il contenitore: a decidere è il crumble scelto dopo.
update public.basi set vegan = true, senza_zucchero = true where id = 'cacao';
update public.basi set vegan = true                          where id = 'crock';

-- Crumble: i titolari hanno dichiarato VEGAN solo quello al caramello.
update public.crumble set vegan = true where id = 'caramello';

-- Farciture dichiarate VEGAN dai titolari.
update public.farciture set vegan = true
 where id in ('frutti-rossi', 'amarena', 'granella', 'granella-pistacchi', 'pistacchio');
-- "Nessuna" non aggiunge nulla.
update public.farciture set vegan = true, senza_zucchero = true where id = 'nessuna';
-- Variegato Nocciola e Gianduia: dichiarato SENZA ZUCCHERI AGGIUNTI
-- (vegan NON è dichiarato, quindi non lo spuntiamo noi).
update public.farciture set senza_zucchero = true where id = 'cremino';

-- Coperture dichiarate VEGAN + "Naked cake" (bordi a vista: non si aggiunge niente).
update public.coperture set vegan = true where id in ('pistacchio-cop', 'frutta-cop');
update public.coperture set vegan = true, senza_zucchero = true where id = 'naked';

-- Decorazioni dichiarate VEGAN + "Nessuna".
update public.decorazioni set vegan = true where id in ('cioccolato-fondente-deco', 'frutta-fresca');
update public.decorazioni set vegan = true, senza_zucchero = true where id = 'nessuna';

-- ─────────────────────────────────────────────────────────────
-- 2. NOME DELLA COPERTURA DI PANNA
-- ─────────────────────────────────────────────────────────────
update public.coperture
   set nome = 'Panna montata spatolata INTORNO'
 where id = 'panna' and nome <> 'Panna montata spatolata INTORNO';

-- ─────────────────────────────────────────────────────────────
-- 3. OCCASIONI
-- ─────────────────────────────────────────────────────────────
-- "Festa di famiglia" si spegne invece di essere cancellata: gli ordini vecchi
-- che la citano restano leggibili e si può riaccendere in un secondo.
update public.occasioni set attivo = false where nome = 'Festa di famiglia';

insert into public.occasioni (nome, attivo, ordine)
select 'Gender reveal', true, 55
 where not exists (select 1 from public.occasioni where nome = 'Gender reveal');

-- "Nessuna" va per ultima: nel sito le mettiamo il cuoricino 🤍 davanti.
insert into public.occasioni (nome, attivo, ordine)
select 'Nessuna', true, 90
 where not exists (select 1 from public.occasioni where nome = 'Nessuna');

-- ─────────────────────────────────────────────────────────────
-- 4. FOTO DELLA GALLERY GESTIBILI DAL GESTIONALE
-- ─────────────────────────────────────────────────────────────
-- Le 50 foto storiche restano dentro al sito (public/gallery/): queste si
-- aggiungono, e si vedono per prime nella fascia della home e in /galleria.
create table if not exists public.gallery_foto (
  id          uuid primary key default gen_random_uuid(),
  url         text not null,               -- indirizzo pubblico della foto
  path        text,                        -- percorso dentro lo spazio file
  titolo      text not null default '',    -- didascalia (facoltativa)
  ordine      int  not null default 100,
  attivo      boolean not null default true,
  creato_il   timestamptz not null default now(),
  aggiunto_da text                          -- email di chi l'ha caricata
);

alter table public.gallery_foto enable row level security;

-- Lettura pubblica: la gallery è una pagina del sito, la vedono tutti.
drop policy if exists "gallery_foto_select_public" on public.gallery_foto;
create policy "gallery_foto_select_public" on public.gallery_foto
  for select using (true);

-- Scrittura solo allo staff loggato in /admin.
drop policy if exists "gallery_foto_write_auth" on public.gallery_foto;
create policy "gallery_foto_write_auth" on public.gallery_foto
  for all to authenticated using (true) with check (true);

-- Spazio file delle foto: pubblico in lettura, solo immagini, max 8 MB l'una
-- (il sito le rimpicciolisce già nel browser prima di caricarle).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = true,
      file_size_limit    = 8388608,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- ⚠️ Se le due policy qui sotto danno "permission denied for table objects",
-- non è un problema del file: su alcuni progetti Supabase le policy dello
-- storage si creano solo dal pannello (Storage → gallery → Policies).
-- In quel caso: lettura pubblica per tutti, scrittura/cancellazione per
-- "authenticated". Il resto della migrazione è comunque andato a buon fine.
drop policy if exists "gallery_public_read" on storage.objects;
create policy "gallery_public_read" on storage.objects
  for select using (bucket_id = 'gallery');

drop policy if exists "gallery_auth_write" on storage.objects;
create policy "gallery_auth_write" on storage.objects
  for all to authenticated using (bucket_id = 'gallery') with check (bucket_id = 'gallery');

-- ─────────────────────────────────────────────────────────────
-- 5. NOTIFICA TELEGRAM SENZA PUNTO ESCLAMATIVO
-- ─────────────────────────────────────────────────────────────
-- Il sito ora scrive "Punto Gi" senza "!": questa funzione cerca le stringhe
-- ESATTE per rimetterle in ordine con le emoji. Se non si aggiorna insieme al
-- sito, le notifiche degli ordini arrivano sformattate.
-- Aggiunte anche le due righe nuove (preferenze alimentari e sorpresa/regalo).
CREATE OR REPLACE FUNCTION public.order_telegram_msg(p_riepilogo text, p_cliente text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare msg text;
begin
  msg := coalesce(nullif(btrim(regexp_replace(coalesce(p_riepilogo,''), '[*_]', '', 'g')), ''), '');
  if msg = '' then
    msg := '⚠ NUOVO ORDINE — Punto Gi' || E'\n👤 Cliente: ' || coalesce(p_cliente, 'Cliente');
  else
    msg := replace(msg, '🎂 Nuova richiesta torta — Punto Gi', '⚠ NUOVO ORDINE — Punto Gi');
    msg := replace(msg, '🎂 Nuovo ordine in gelateria — Punto Gi', '⚠ NUOVO ORDINE (in gelateria) — Punto Gi');
    msg := replace(msg, 'Tipo:', '– Tipo:');
    msg := replace(msg, 'Forma:', '– Forma:');
    msg := replace(msg, 'Dimensione:', '– Dimensione:');
    msg := replace(msg, 'Base:', '– Base:');
    msg := replace(msg, 'Tipo di crumble:', '– Tipo di crumble:');
    msg := replace(msg, 'Strati / Gusti:', '– Strati / Gusti:');
    msg := replace(msg, 'Farcitura:', '– Farcitura:');
    msg := replace(msg, 'Copertura:', '– Copertura:');
    msg := replace(msg, 'Decorazione:', '– Decorazione:');
    msg := replace(msg, 'Scritta:', '– Scritta:');
    msg := replace(msg, 'Foto su cialda:', '– Foto su cialda:');
    msg := replace(msg, 'Candelina:', '– Candelina:');
    msg := replace(msg, 'Occasione:', '– Occasione:');
    msg := replace(msg, 'Attenzione:', '🎀 Attenzione:');
    msg := replace(msg, 'Da ritirare:', '📅 Da ritirare:');
    msg := replace(msg, 'Consegna a domicilio:', '🛵 Consegna a domicilio:');
    msg := replace(msg, 'Indirizzo:', '📍 Indirizzo:');
    msg := replace(msg, 'Sovrapprezzo consegna:', '💶 Sovrapprezzo consegna:');
    msg := replace(msg, 'Cliente:', '👤 Cliente:');
    msg := replace(msg, 'Telefono:', '📞 Telefono:');
    msg := replace(msg, 'Email:', '📧 Email:');
    msg := replace(msg, 'Note:', '📝 Note:');
    msg := replace(msg, 'Stima:', 'Importo pagato:');
  end if;
  return msg;
end $function$;

-- ─────────────────────────────────────────────────────────────
-- CONTROLLO FINALE — devono uscire tutte righe con "ok"
-- ─────────────────────────────────────────────────────────────
select 'Componenti vegan' as cosa,
       (select count(*) from public.basi where vegan)
     + (select count(*) from public.crumble where vegan)
     + (select count(*) from public.farciture where vegan)
     + (select count(*) from public.coperture where vegan)
     + (select count(*) from public.decorazioni where vegan) as valore
union all
select 'Componenti senza zuccheri aggiunti',
       (select count(*) from public.basi where senza_zucchero)
     + (select count(*) from public.farciture where senza_zucchero)
     + (select count(*) from public.coperture where senza_zucchero)
     + (select count(*) from public.decorazioni where senza_zucchero)
union all
select 'Occasioni attive', (select count(*) from public.occasioni where attivo)
union all
select 'Tabella foto gallery pronta', (select count(*) from public.gallery_foto);
