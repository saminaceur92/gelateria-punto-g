-- ============================================================
-- Torna la panna SPATOLATA, accanto a quella a ciuffi — 2026-08-11
-- Da eseguire su Supabase (SQL Editor).
--
-- Ieri "Panna montata INTORNO" era una sola voce e l'ho trasformata tutta in
-- panna col sac-à-poche: così però chi la vuole liscia non ha più modo di
-- chiederla. Adesso sono due coperture distinte, e chi ordina sceglie:
--
--   panna             → a CIUFFI: ruche verticali su tutto il fianco e una
--                       ghirlanda di ciuffi sul bordo di sopra
--   panna-spatolata    → LISCIA: spianata col coltello, come prima
--
-- Il prezzo è lo stesso per tutte e due (2 €), è lo stesso lavoro visto da
-- due parti. Se in negozio una delle due costa di più, cambiatelo dalla
-- scheda "Coperture" in dashboard.
-- ============================================================

-- ── 1. La voce di prima dice chiaramente che è quella a ciuffi ──
update public.coperture
   set nome = 'Panna montata a CIUFFI INTORNO',
       descrizione = 'Ciuffi di panna tutt''intorno alla torta e ghirlanda sul bordo'
 where id = 'panna';

-- ── 2. Quella liscia, che era sparita ──
insert into public.coperture (id, nome, descrizione, supplemento, colore, attivo, ordine, allergeni, vegan, senza_zucchero)
select 'panna-spatolata',
       'Panna montata SPATOLATA INTORNO',
       'Panna liscia, spianata col coltello tutt''intorno alla torta',
       2, '#fff8e6', true, 15, 'Latte', false, false
 where not exists (select 1 from public.coperture where id = 'panna-spatolata');

-- ── Controllo finale: devono uscire tutte e due ─────────────
select id, nome, supplemento, ordine
  from public.coperture
 where id in ('panna', 'panna-spatolata')
 order by ordine;
