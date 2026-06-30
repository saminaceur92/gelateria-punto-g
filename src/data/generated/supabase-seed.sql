-- Seed contenuti Gelateria Punto Gi! (generato da scripts/gen-supabase-seed.mjs)
-- Esecuzione idempotente: svuota e ricarica le tabelle dei contenuti.
truncate categorie, gusti, gusti_torte, tipi_torta, dimensioni, forme, basi, farciture, coperture, decorazioni, occasioni, orari restart identity cascade;

insert into categorie (id, nome, descrizione, attivo, ordine) values
  ('creme', 'Creme', 'I grandi classici reinterpretati con la nostra ricetta', true, 10),
  ('frutta', 'Frutta & Veggy', 'Solo frutta, niente latte. Naturalmente vegan', true, 20),
  ('semifreddi', 'Semifreddi', 'Eleganza tra cucchiaio e morso', true, 30),
  ('leccornie', 'Altre Leccornie', 'Pasticceria a freddo, torte e prelibatezze', true, 40);

insert into gusti (nome, categoria_id, colore, tag, attivo, ordine) values
  ('Fior di latte', 'creme', '#fff8e6', null, true, 10),
  ('Crema', 'creme', '#f5d97a', null, true, 20),
  ('After Eight', 'creme', '#1e3a2b', null, true, 30),
  ('Yogurt bianco', 'creme', '#fafafa', null, true, 40),
  ('Stracciatella', 'creme', '#f5f0dd', null, true, 50),
  ('Cheesecake ai frutti rossi', 'creme', '#c94a6b', null, true, 60),
  ('Spagnola', 'creme', '#d9b384', null, true, 70),
  ('Pino pinguino', 'creme', '#3a2418', null, true, 80),
  ('Nocciola', 'creme', '#8a5a3b', null, true, 90),
  ('Rocher', 'creme', '#5a3520', null, true, 100),
  ('Nutella', 'creme', '#3d2114', null, true, 110),
  ('Cioccolato al latte', 'creme', '#6b4226', null, true, 120),
  ('Caramello salato', 'creme', '#c8842b', null, true, 130),
  ('Super Kinder', 'creme', '#e6c79c', null, true, 140),
  ('Bacio', 'creme', '#3a2519', null, true, 150),
  ('Caffè', 'creme', '#4a2e1f', null, true, 160),
  ('Biscotto', 'creme', '#c89968', null, true, 170),
  ('Pistacchio', 'creme', '#7ea15a', null, true, 180),
  ('Punto Gi', 'creme', '#b651e4', 'firma', true, 190),
  ('Duplo', 'creme', '#7a4a2e', null, true, 200),
  ('Cremino al Pistacchio', 'creme', '#9bb678', null, true, 210),
  ('Cioccolato fondente', 'creme', '#2a160e', null, true, 220),
  ('Fragola', 'frutta', '#e84a6e', null, true, 10),
  ('Limone', 'frutta', '#f5e26a', null, true, 20),
  ('Mango', 'frutta', '#f3a72d', null, true, 30),
  ('Cocco', 'frutta', '#fafafa', null, true, 40),
  ('Pistacchio Veg', 'frutta', '#7ea15a', 'vegan', true, 50),
  ('Nocciola Veg', 'frutta', '#8a5a3b', 'vegan', true, 60),
  ('Giovanna', 'semifreddi', '#e8c79e', null, true, 10),
  ('Millefoglie', 'semifreddi', '#fff2d6', null, true, 20),
  ('Pasticcini', 'leccornie', '#f3a3c2', null, true, 10),
  ('Salame dolce', 'leccornie', '#5a3520', null, true, 20),
  ('Torte gelato', 'leccornie', '#b651e4', null, true, 30),
  ('Torte semifreddo', 'leccornie', '#a5cdcb', null, true, 40),
  ('Monoporzioni', 'leccornie', '#eb911e', null, true, 50),
  ('Prodotti stagionali', 'leccornie', '#7ea15a', 'stagione', true, 60);

insert into gusti_torte (nome, colore, tags, attivo, ordine) values
  ('Fior di latte', '#fff8e6', '{"gelato"}', true, 10),
  ('Crema', '#f5d97a', '{"gelato"}', true, 20),
  ('Stracciatella', '#f5f0dd', '{"gelato"}', true, 30),
  ('Yogurt bianco', '#fafafa', '{"gelato","sg"}', true, 40),
  ('Cheesecake frutti rossi', '#c94a6b', '{"semifreddo"}', true, 50),
  ('Pistacchio', '#7ea15a', '{"gelato","sg"}', true, 60),
  ('Nocciola', '#8a5a3b', '{"gelato"}', true, 70),
  ('Cioccolato fondente', '#2a160e', '{"gelato","vegano"}', true, 80),
  ('Cioccolato al latte', '#6b4226', '{"gelato"}', true, 90),
  ('Nutella', '#3d2114', '{"gelato"}', true, 100),
  ('Bacio', '#3a2519', '{"gelato"}', true, 110),
  ('Caffè', '#4a2e1f', '{"gelato"}', true, 120),
  ('Caramello salato', '#c8842b', '{"gelato"}', true, 130),
  ('Pino pinguino', '#3a2418', '{"gelato"}', true, 140),
  ('Punto Gi', '#b651e4', '{"gelato"}', true, 150),
  ('Fragola', '#e84a6e', '{"sorbetto","vegano","sg"}', true, 160),
  ('Limone', '#f5e26a', '{"sorbetto","vegano","sg"}', true, 170),
  ('Mango', '#f3a72d', '{"sorbetto","vegano","sg"}', true, 180),
  ('Cocco', '#fafafa', '{"gelato","sg"}', true, 190),
  ('After Eight', '#1e3a2b', '{"gelato"}', true, 200);

insert into tipi_torta (id, nome, descrizione, prezzo_base, immagine, colore, attivo, ordine) values
  ('semifreddo', 'Semifreddo', 'Soffice, vellutato, perfetto a fine pasto', 24, '/torte.jpg', '#b651e4', true, 10),
  ('gelato', 'Torta Gelato', 'Strati di gelato artigianale dei tuoi gusti preferiti', 26, '/gelato.jpg', '#602e9e', true, 20),
  ('crock', 'CROCK', 'Base croccante + semifreddo: la nostra firma', 28, '/semifreddi.jpg', '#eb911e', true, 30),
  ('piani', 'A piani', 'Per occasioni speciali — scenografica e golosa', 38, '/torte.jpg', '#a5cdcb', true, 40);

insert into dimensioni (id, etichetta, diametro, supplemento, popolare, attivo, ordine) values
  ('6', '6 persone', 18, 0, false, true, 10),
  ('8', '8 persone', 20, 6, true, true, 20),
  ('10', '10 persone', 22, 12, false, true, 30),
  ('12', '12 persone', 24, 18, false, true, 40),
  ('16', '16 persone', 28, 28, false, true, 50),
  ('20', '20 persone', 30, 38, false, true, 60);

insert into forme (id, nome, descrizione, emoji, supplemento, attivo, ordine) values
  ('tonda', 'Tonda', 'Classica, perfetta per ogni occasione', '⬤', 0, true, 10),
  ('cuore', 'Cuore', 'Romantica, per dichiarazioni e ricorrenze', '❤', 4, true, 20),
  ('quadrata', 'Quadrata', 'Moderna, ideale per più persone', '◼', 2, true, 30),
  ('rettangolare', 'Rettangolare', 'Per buffet e tagli generosi', '▭', 3, true, 40);

insert into basi (id, nome, descrizione, supplemento, colore, attivo, ordine) values
  ('classica', 'Classica', 'Pan di Spagna sottile', 0, '#e8d2a8', true, 10),
  ('crock', 'Crock croccante', 'Base biscottata e croccante', 3, '#b88c5a', true, 20),
  ('cacao', 'Frolla al cacao', 'Friabile, intensa', 3, '#5a3520', true, 30),
  ('glutenfree', 'Senza glutine', 'Per intolleranze', 4, '#d8c098', true, 40);

insert into farciture (id, nome, descrizione, supplemento, colore, attivo, ordine) values
  ('nessuna', 'Nessuna', 'Strati puri', 0, null, true, 10),
  ('cremino', 'Variegato cremino', 'Nocciola e cioccolato', 2, '#5a3520', true, 20),
  ('caramello', 'Salsa caramello salato', 'Dolce e sapida', 2, '#c8842b', true, 30),
  ('frutti-rossi', 'Cuore frutti rossi', 'Lampone e ribes', 2, '#c93060', true, 40),
  ('amarena', 'Amarena', 'Classica, intensa', 2, '#8c1e3a', true, 50),
  ('ganache', 'Ganache fondente', 'Cioccolato puro', 2, '#2a160e', true, 60),
  ('biscotto', 'Biscotto sbriciolato', 'Croccantezza extra', 2, '#b88c5a', true, 70),
  ('granella', 'Granella di nocciole', 'Tostate del Piemonte', 2, '#8a5a3b', true, 80),
  ('pistacchio', 'Crema pistacchio', 'Bronte, vellutata', 3, '#7ea15a', true, 90);

insert into coperture (id, nome, descrizione, supplemento, colore, attivo, ordine) values
  ('panna', 'Panna montata', 'Soffice, classica', 0, '#fff8e6', true, 10),
  ('meringa', 'Meringa fiammeggiata', 'Effetto scenografico', 4, '#fffaf0', true, 20),
  ('ganache-cop', 'Ganache fondente', 'Lucida e intensa', 3, '#2a160e', true, 30),
  ('glassa-specchio', 'Glassa a specchio', 'Effetto wow', 5, '#b651e4', true, 40),
  ('frutta-cop', 'Copertura di frutta', 'Fresca, di stagione', 4, '#e84a6e', true, 50),
  ('naked', 'Naked cake', 'Bordi a vista, rustica', 0, null, true, 60),
  ('cioccolato-cop', 'Copertura cioccolato', 'Fondente o latte', 3, '#3d2114', true, 70);

insert into decorazioni (id, nome, descrizione, emoji, attivo, ordine) values
  ('nessuna', 'Nessuna', 'Top liscio, senza granella', '∅', true, 10),
  ('granella-nocciola-pistacchio', 'Granella nocciola e pistacchio', 'Croccante e tostata', '🌰', true, 20),
  ('zuccherini', 'Zuccherini colorati', 'Allegri e golosi', '🌈', true, 30),
  ('granella-frutta-secca', 'Granella di frutta secca', 'Mandorla, nocciola, noce', '🥜', true, 40);

insert into occasioni (nome, attivo, ordine) values
  ('Compleanno', true, 10),
  ('Anniversario', true, 20),
  ('Laurea', true, 30),
  ('Battesimo', true, 40),
  ('Comunione', true, 50),
  ('Festa di famiglia', true, 60),
  ('Solo per coccolarmi', true, 70);

insert into orari (giorno, orario, attivo, ordine) values
  ('Lun', 'Chiuso', true, 10),
  ('Mar', '15:00 – 23:00', true, 20),
  ('Mer', '15:00 – 23:00', true, 30),
  ('Gio', '15:00 – 23:00', true, 40),
  ('Ven', '15:00 – 23:30', true, 50),
  ('Sab', '14:30 – 23:30', true, 60),
  ('Dom', '14:30 – 23:00', true, 70);

