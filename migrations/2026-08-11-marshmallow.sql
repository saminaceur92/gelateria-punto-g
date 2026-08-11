-- ============================================================
-- "Marshmellow" → "Marshmallow" — 2026-08-11
-- Da eseguire su Supabase (SQL Editor).
--
-- Il nome della decorazione arriva dal database, quindi correggerlo nel codice
-- del sito non basta: finché non si lancia questo, in vetrina resta scritto
-- come prima. (Si scrive con la A: marsh + mallow, dalla pianta.)
-- ============================================================

update public.decorazioni
   set nome = 'Marshmallow'
 where id = 'marshmallow' and nome <> 'Marshmallow';

-- Controllo: deve rispondere "Marshmallow".
select nome as come_si_legge_ora from public.decorazioni where id = 'marshmallow';
