-- ============================================================
-- Gallery completamente gestibile + panna standard — 2026-08-11
-- Da eseguire una volta su Supabase (SQL Editor).
--
-- 1. Importa nella tabella anche le 50 foto storiche del sito. Da quel momento
--    dashboard e sito usano un solo elenco: ogni foto si può ordinare o
--    eliminare. Il marcatore in app_config impedisce che una foto eliminata
--    venga ricreata eseguendo nuovamente questa migrazione.
-- 2. Disattiva le vecchie decorazioni di panna: le due file di ciuffi sono ora
--    comprese e compaiono automaticamente su ogni torta.
-- ============================================================

do $$
declare
  v_base integer;
begin
  if not exists (
    select 1
      from public.app_config
     where key = 'gallery_storiche_importate'
  ) then
    -- Prima si rende regolare l'ordine delle foto già caricate dalla dashboard.
    with classifica as (
      select id,
             row_number() over (order by ordine asc, creato_il desc, id)::integer as posizione
        from public.gallery_foto
    )
    update public.gallery_foto as g
       set ordine = c.posizione * 10
      from classifica as c
     where g.id = c.id;

    select coalesce(max(ordine), 0)
      into v_base
      from public.gallery_foto;

    -- Le storiche restano dopo le foto caricate di recente, come nel sito di
    -- prima. In dashboard si possono poi trascinare in qualsiasi posizione.
    insert into public.gallery_foto (url, path, titolo, ordine, attivo)
    select v.url, null, '', v_base + v.posizione * 10, true
      from (values
        ( 1, '/gallery/gallery-01.jpg'),
        ( 2, '/gallery/gallery-02.jpg'),
        ( 3, '/gallery/gallery-03.jpg'),
        ( 4, '/gallery/gallery-04.jpg'),
        ( 5, '/gallery/gallery-05.jpg'),
        ( 6, '/gallery/gallery-06.jpg'),
        ( 7, '/gallery/gallery-07.jpg'),
        ( 8, '/gallery/gallery-08.jpg'),
        ( 9, '/gallery/gallery-09.jpg'),
        (10, '/gallery/gallery-10.jpg'),
        (11, '/gallery/gallery-11.jpg'),
        (12, '/gallery/gallery-12.jpg'),
        (13, '/gallery/gallery-13.jpg'),
        (14, '/gallery/gallery-14.jpg'),
        (15, '/gallery/gallery-15.jpg'),
        (16, '/gallery/gallery-16.jpg'),
        (17, '/gallery/gallery-17.jpg'),
        (18, '/gallery/gallery-18.jpg'),
        (19, '/gallery/gallery-19.jpg'),
        (20, '/gallery/gallery-20.jpg'),
        (21, '/gallery/gallery-21.jpg'),
        (22, '/gallery/gallery-22.jpg'),
        (23, '/gallery/gallery-23.jpg'),
        (24, '/gallery/gallery-24.jpg'),
        (25, '/gallery/gallery-25.jpg'),
        (26, '/gallery/gallery-26.jpg'),
        (27, '/gallery/gallery-27.jpg'),
        (28, '/gallery/gallery-28.jpg'),
        (29, '/gallery/gallery-29.jpg'),
        (30, '/gallery/gallery-30.jpg'),
        (31, '/gallery/gallery-31.jpg'),
        (32, '/gallery/gallery-32.jpg'),
        (33, '/gallery/gallery-33.jpg'),
        (34, '/gallery/gallery-34.jpg'),
        (35, '/gallery/gallery-35.jpg'),
        (36, '/gallery/gallery-36.jpg'),
        (37, '/gallery/gallery-37.jpg'),
        (38, '/gallery/gallery-38.jpg'),
        (39, '/gallery/gallery-39.jpg'),
        (40, '/gallery/gallery-40.jpg'),
        (41, '/gallery/gallery-41.jpg'),
        (42, '/gallery/gallery-42.jpg'),
        (43, '/gallery/gallery-43.jpg'),
        (44, '/gallery/gallery-44.jpg'),
        (45, '/gallery/gallery-45.jpg'),
        (46, '/gallery/gallery-46.jpg'),
        (47, '/gallery/gallery-47.jpg'),
        (48, '/gallery/gallery-48.jpg'),
        (49, '/gallery/gallery-49.jpg'),
        (50, '/gallery/gallery-50.jpg')
      ) as v(posizione, url)
     where not exists (
       select 1 from public.gallery_foto as g where g.url = v.url
     );

    insert into public.app_config (key, value)
    values ('gallery_storiche_importate', '2026-08-11')
    on conflict (key) do update set value = excluded.value;

    -- Riga tecnica invisibile: resta anche se dalla dashboard vengono eliminate
    -- tutte le foto e impedisce al sito di ripristinare il vecchio fallback.
    insert into public.gallery_foto (id, url, path, titolo, ordine, attivo)
    values (
      '00000000-0000-0000-0000-000000000001',
      '__gallery_configurata__',
      null,
      '',
      -1,
      false
    )
    on conflict (id) do nothing;
  end if;
end
$$;

-- La panna non è più un topping selezionabile o con supplemento: è compresa in
-- due file standard su ogni torta. Le righe restano per leggere ordini vecchi.
update public.decorazioni
   set attivo = false,
       supplemento = 0
 where id in ('panna-deco', 'panna-colorata');

-- Controllo finale: 50 storiche importate una volta e nessuna panna attiva fra
-- le decorazioni. Le eventuali foto caricate si sommano alle 50.
select 'Foto totali gestibili' as cosa, count(*)::text as valore
  from public.gallery_foto
 where attivo
union all
select 'Foto storiche importate', count(*)::text
  from public.gallery_foto
 where url like '/gallery/gallery-%.jpg'
union all
select 'Decorazioni panna ancora attive', count(*)::text
  from public.decorazioni
 where id in ('panna-deco', 'panna-colorata')
   and attivo;
