-- ============================================================
-- Allinea i gusti "Frutta e Vegan" al Quaderno Allergeni (PDF) — 2026-07-13
--
-- ⚠️ SICUREZZA ALIMENTARE: gli allergeni qui sotto sono stati letti dal PDF
-- (liste ingredienti + note "può contenere tracce"). PRIMA DI LANCIARE,
-- verifica ogni riga CERTI/TRACCE contro il Quaderno. Meglio segnalare un
-- allergene in più che in meno.
--
-- Riepilogo allergeni inseriti (CERTI | TRACCE):
--   Nero Nero .......... Soia | Latte, Frutta a guscio
--   Cocco .............. Solfiti | Latte, Soia
--   Mango .............. (nessuno) | (nessuno)
--   Nocciola e Gianduia  Frutta a guscio | Arachidi, Frutta a guscio, Soia, Latte
--   Pistacchio Salato .. Frutta a guscio | (nessuno)
--   Yogurt Mango&Passion (nessuno) | Uova, Arachidi, Frutta a guscio, Soia, Latte
--   Granita Pistacchio . Frutta a guscio, Soia | Arachidi, Frutta a guscio
--   Granita Mandorla ... Frutta a guscio, Soia | Arachidi, Frutta a guscio
--   Pompelmo ........... (nessuno) | Latte, Soia
--   Pesca .............. (nessuno) | Solfiti
--   Melone ............. (nessuno) | (nessuno)
-- (Limone e Fragola restano invariati: già nel Quaderno.)
-- ============================================================

-- 1) Rimuove i gusti Frutta/Vegan NON presenti nel Quaderno
delete from public.allergeni_prodotti
where categoria = 'frutta-vegan'
  and gusto in ('Mela Verde', 'Pistacchio Vegan', 'Nocciola Vegan', 'Stracciatella Vegan');

-- 2) Inserisce i gusti Frutta/Vegan del Quaderno
insert into public.allergeni_prodotti
  (categoria, gusto, base, ingredienti, allergeni_certi, allergeni_tracce, vegan, senza_glutine, senza_zucchero, colore, tag, per_torte, attivo, ordine)
values
  ('frutta-vegan', 'Nero Nero', 'Frutta', 'Zucchero, cioccolato fondente (cacao, pasta di cacao, burro di cacao, lecitina di soia), destrosio, fruttosio, cacao, fibra (inulina), addensanti e stabilizzanti.', 'Soia', 'Latte, Frutta a guscio', true, true, false, '#241a15', null, false, true, 46),
  ('frutta-vegan', 'Cocco', 'Frutta', 'Cocco 30% (latte di cocco in polvere, cocco essiccato), zucchero, destrosio, fruttosio, emulsionanti, grassi vegetali di cocco, stabilizzanti. Contiene residuo di anidride solforosa.', 'Solfiti', 'Latte, Soia', true, true, false, '#f5f0e6', null, false, true, 47),
  ('frutta-vegan', 'Mango', 'Frutta', 'Mango 59,5% (purea di mango Alphonso, succo di mango concentrato), zucchero, fibra vegetale, succo di limone concentrato, proteine del pisello.', '', '', true, true, false, '#f3a72d', null, false, true, 48),
  ('frutta-vegan', 'Nocciola e Gianduia', 'Vegan', 'Pasta pura di Nocciola naturale, nocciole (tonda gentile e trilobata), fibra vegetale, olio di girasole, cacao magro, emulsionante, edulcorante stevia.', 'Frutta a guscio', 'Arachidi, Frutta a guscio, Soia, Latte', true, true, true, '#8a5a3b', null, false, true, 49),
  ('frutta-vegan', 'Pistacchio Salato', 'Vegan', 'Pasta pura di Pistacchio naturale, granella di pistacchio, sale.', 'Frutta a guscio', '', true, true, true, '#7ea15a', null, false, true, 50),
  ('frutta-vegan', 'Yogurt con Mango e Passion fruit', 'Acqua', 'Edulcoranti (maltitoli, sorbitoli), grasso vegetale di cocco, fibre vegetali (inulina), proteina del pisello, stabilizzanti, edulcorante stevia; variegato mango e passion fruit.', '', 'Uova, Arachidi, Frutta a guscio, Soia, Latte', true, true, true, '#f2d97a', null, false, true, 51),
  ('frutta-vegan', 'Granita Pistacchio', 'Acqua', 'Pistacchi 50%, zucchero, destrosio, emulsionante E322 (soia), sale, antiossidanti.', 'Frutta a guscio, Soia', 'Arachidi, Frutta a guscio', true, true, false, '#9ab36a', null, false, true, 52),
  ('frutta-vegan', 'Granita Mandorla', 'Acqua', 'Mandorle 50%, zucchero, grassi vegetali (girasole), emulsionante E322 (soia), sale, aromi, antiossidanti.', 'Frutta a guscio, Soia', 'Arachidi, Frutta a guscio', true, true, false, '#e8dcc0', null, false, true, 53),
  ('frutta-vegan', 'Pompelmo', 'Acqua', 'Zucchero, destrosio, isomalto, acido citrico, sciroppo di glucosio, emulsionanti, addensanti, coloranti.', '', 'Latte, Soia', true, true, false, '#f28ca0', null, false, true, 54),
  ('frutta-vegan', 'Pesca', 'Frutta', 'Pesche fresche pulite e congelate, zucchero, sciroppo di glucosio, acidificante, gelificante, aromi.', '', 'Solfiti', true, true, false, '#f7b878', null, false, true, 55),
  ('frutta-vegan', 'Melone', 'Frutta', 'Polpa di melone pulito e congelato, zucchero.', '', '', true, true, false, '#f0d98a', null, false, true, 56);
