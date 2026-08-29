-- ============================================================
-- Panna VEGETALE per chi sceglie Vegan o evita il latte — 2026-08-29
-- Da eseguire su Supabase (SQL Editor). È idempotente: rieseguirlo non fa danni.
--
-- Chi nel configuratore dichiara "Vegan" o l'allergene "Latte" si ritrovava
-- spente TUTTE le coperture e le decorazioni di panna. Lucia: la panna
-- vegetale esiste, e la torta viene uguale — cambia l'ingrediente, non
-- l'aspetto.
--
-- Come funziona:
--   · ogni voce di panna ha una GEMELLA con lo stesso id più "-veg"
--     (panna → panna-veg, panna-colorata → panna-colorata-veg, …);
--   · il sito la mostra AL POSTO della versione con latte a chi ha scelto
--     Vegan o evita il latte; agli altri mostra solo quella con latte
--     (la lista non si allunga, la gemella prende lo stesso posto);
--   · la torta 3D e la scheda la disegnano identica alla versione con latte;
--   · se il cliente sceglie prima la panna e POI dichiara "Vegan", la scelta
--     passa da sola alla gemella (colore compreso, per la panna colorata).
--
-- Prezzo, colore 3D e posizione in lista si copiano dalla voce con latte
-- (se manca, valgono i valori di sicurezza del sito). Cambiateli dalla
-- dashboard come per tutte le altre voci: schede "Coperture" e "Topping".
--
-- ⚠️ ALLERGENI: la panna vegetale nasce SENZA allergeni dichiarati, perché
--    dipende dal prodotto che usate (molte contengono SOIA o frutta a guscio).
--    Vanno spuntati dalla dashboard sulle sei voci nuove prima di fidarsi del
--    filtro. La spunta "vegan" invece è già messa: senza, la gemella resterebbe
--    spenta proprio a chi è fatta per servire.
-- ============================================================

-- ── 1. Coperture: le quattro gemelle ────────────────────────
insert into public.coperture
       (id, nome, descrizione, supplemento, colore, attivo, ordine, allergeni, vegan, senza_zucchero)
select v.id_veg,
       v.nome_veg,
       v.descrizione_veg,
       coalesce(c.supplemento, v.supplemento_default),
       coalesce(c.colore, '#fff8e6'),
       true,
       coalesce(c.ordine, 0) + 1,        -- subito dopo la versione con latte
       '',                               -- allergeni: da confermare in dashboard
       true,
       coalesce(c.senza_zucchero, false)
  from (values
    ('panna',             'panna-veg',             'Panna VEGETALE a CIUFFI INTORNO',  'Ciuffi di panna vegetale al sapore di vaniglia tutt''intorno alla torta e ghirlanda sul bordo', 2),
    ('panna-spatolata',   'panna-spatolata-veg',   'Panna VEGETALE SPATOLATA INTORNO', 'Panna vegetale al sapore di vaniglia, liscia e spianata col coltello tutt''intorno alla torta',     2),
    ('panna-sopra',       'panna-sopra-veg',       'Panna VEGETALE SOLO SOPRA',        'Filo di panna vegetale al sapore di vaniglia solo sopra alla torta, con intorno un nastro trasparente non edibile', 0),
    ('panna-sotto-sopra', 'panna-sotto-sopra-veg', 'Panna VEGETALE SOTTO E SOPRA',     'Filo di panna vegetale al sapore di vaniglia sul bordo inferiore e superiore della torta',        1)
  ) as v(id_latte, id_veg, nome_veg, descrizione_veg, supplemento_default)
  left join public.coperture c on c.id = v.id_latte
 where not exists (select 1 from public.coperture x where x.id = v.id_veg);

-- ── 2. Decorazioni: le due gemelle ──────────────────────────
-- `colori` (per la panna colorata) si copia dalla voce con latte: sono gli
-- otto colori indicati dai titolari, e la gemella li deve avere identici.
insert into public.decorazioni
       (id, nome, descrizione, emoji, supplemento, scelta_colore, colori, allergeni, attivo, ordine, vegan, senza_zucchero)
select v.id_veg,
       v.nome_veg,
       v.descrizione_veg,
       coalesce(d.emoji, v.emoji_default),
       coalesce(d.supplemento, 2),
       coalesce(d.scelta_colore, v.colore_default),
       coalesce(d.colori, v.colori_default),
       '',                               -- allergeni: da confermare in dashboard
       true,
       coalesce(d.ordine, 0) + 1,
       true,
       coalesce(d.senza_zucchero, false)
  from (values
    ('panna-deco',     'panna-deco-veg',     'Panna VEGETALE montata',          'Panna vegetale al sapore di vaniglia, spatolata intorno e decorazione con ciuffi', '🍦', false, ''),
    ('panna-colorata', 'panna-colorata-veg', 'Panna VEGETALE montata colorata', 'Panna vegetale al sapore di vaniglia, colore a scelta tra rosa, rossa, azzurra, blu, verde, nera, gialla e arcobaleno', '🎨', true,
       'Rosa, Rossa, Azzurra, Blu, Verde, Nera, Gialla, Arcobaleno')
  ) as v(id_latte, id_veg, nome_veg, descrizione_veg, emoji_default, colore_default, colori_default)
  left join public.decorazioni d on d.id = v.id_latte
 where not exists (select 1 from public.decorazioni x where x.id = v.id_veg);

-- ── Controllo finale: devono uscire 6 righe, tutte vegan e attive ──
select 'copertura' as tipo, id, nome, supplemento, ordine, vegan, attivo, allergeni
  from public.coperture
 where id like 'panna%-veg'
union all
select 'decorazione', id, nome, supplemento, ordine, vegan, attivo, allergeni
  from public.decorazioni
 where id like 'panna%-veg'
 order by 1, ordine;
