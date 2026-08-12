-- ============================================================
-- Panna a ciuffi + "Drip cake" fra le decorazioni — 2026-08-11
-- Da eseguire su Supabase (SQL Editor).
--
-- 1. La panna INTORNO torna a chiamarsi così: nell'anteprima 3D adesso è fatta
--    a ciuffi col sac-à-poche (ruche verticali sul fianco + corona sopra), come
--    nelle loro torte — non spianata col coltello. "Spatolata" diceva il
--    contrario di quello che si vede.
--
-- 2. Le COLATURE non vengono più da sole con ogni copertura lucida. Erano uno
--    stile preciso — la "drip cake" — imposto a chiunque scegliesse una glassa:
--    chi voleva la copertura liscia se le ritrovava per forza. Ora sono una
--    decorazione che si sceglie, e funzionano su tutte le forme (prima solo
--    sulle tonde).
-- ============================================================

-- ── 1. Nome e descrizione della panna intorno ────────────────
update public.coperture
   set nome = 'Panna montata INTORNO',
       descrizione = 'Ciuffi di panna tutt''intorno alla torta'
 where id = 'panna';

-- Anche la panna sotto e sopra: sono corone di ciuffi, non fili spatolati.
update public.coperture
   set descrizione = 'Una corona di ciuffi sul bordo di sopra e una alla base'
 where id = 'panna-sotto-sopra';

-- ── 2. La nuova decorazione ──────────────────────────────────
-- Il prezzo (2 €) è un segnaposto: cambiatelo dalla scheda "Topping" se non va.
insert into public.decorazioni (id, nome, descrizione, emoji, supplemento, scelta_colore, colori, allergeni, attivo, ordine)
select 'drip', 'Drip cake', 'Colature di glassa che scendono dal bordo', '🍫', 2, false, '', '', true, 155
 where not exists (select 1 from public.decorazioni where id = 'drip');

-- ── Controllo finale ─────────────────────────────────────────
select 'Copertura panna' as cosa, nome as valore from public.coperture where id = 'panna'
union all
select 'Decorazione drip', coalesce((select nome from public.decorazioni where id = 'drip'), 'MANCA');
