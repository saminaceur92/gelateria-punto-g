-- ============================================================
-- Scheda dati compilata dai titolari — 2026-08-04
-- Da eseguire su Supabase (progetto Gelateria-punto-gi) UNA VOLTA,
-- dal SQL Editor. Lo script è IDEMPOTENTE: rieseguirlo non fa danni.
--
-- Cosa fa: porta nel database tutto quello che i titolari hanno scritto
-- nella scheda "Scheda-dati-Gelateria-PuntoG" (agosto 2026):
--   1. tipi_torta   -> nomi/descrizioni/prezzi nuovi + 1 tipo nuovo ('alta-gelato')
--   2. dimensioni   -> diametri e supplementi tutti rivisti
--   3. forme        -> supplemento rettangolare 3 -> 2
--   4. basi         -> 1 base nuova ('classica-cioccolato'), 'crock' diventa gratis
--   5. crumble      -> 4 gusti nuovi, 'bianco' disattivato
--   6. farciture    -> 3 nuove, 'ganache' disattivata
--   7. coperture    -> 5 nuove, 3 disattivate
--   8. decorazioni  -> colonne nuove (supplemento, scelta_colore, colori) + 19 voci
--                     ("Nessuna" + 18 decorazioni vere), 2 disattivate
--   9. scritte      -> TABELLA NUOVA (stile della scritta sulla torta)
--  10. extra        -> TABELLA NUOVA (salame dolce e cabaret di pasticcini)
--  11. allergeni_prodotti -> colonna `descrizione`, rinomini, gusti nuovi,
--                            categoria 'leccornie', dati dalla scheda gusti
--
-- ⚠️ SICUREZZA ALIMENTARE: gli allergeni della sezione 11 sono quelli
-- dichiarati dai titolari nella scheda. In alcuni casi sono PIÙ STRETTI di
-- quelli oggi in database (vedi le note ⚠️ dentro la sezione 11): prima di
-- lanciare, ricontrolla quelle righe col Quaderno Allergeni.
--
-- Le voci non più in listino NON vengono cancellate ma disattivate
-- (attivo = false), così gli ordini storici restano leggibili.
-- Gli id NON cambiano mai: sono legati alla resa 3D e agli ordini passati.
--
-- Finché non esegui questo script il sito NON si rompe: le tabelle nuove
-- (scritte, extra) sono opzionali e il codice usa la copia di sicurezza.
-- ============================================================


-- ============================================================
-- 1. TIPI DI TORTA — 5 righe (una nuova: 'alta-gelato')
-- I prezzi base passano a 28 € (semifreddo/gelato/crock) e 30 € (le due alte).
-- La colonna `allergeni` non viene toccata: la scheda non la compila.
-- ============================================================

insert into public.tipi_torta (id, nome, descrizione, prezzo_base, immagine, colore, attivo, ordine) values
  ('semifreddo',  'Semifreddo',
   'Torta semifreddo adatta alla conservazione in frigorifero. Ideale per lunghi spostamenti o se non hai voglia di aspettare che scongeli.',
   28, '/torte.jpg', '#b651e4', true, 10),
  ('gelato',      'Torta Gelato',
   'Classica torta gelato da conservare in congelatore. Fresca, golosa e unica',
   28, '/gelato.jpg', '#602e9e', true, 20),
  ('crock',       'Torta gelato con base Salame al cioccolato',
   'Golosissima torta gelato con alla base il nostro mitico salame al cioccolato',
   28, '/semifreddi.jpg', '#eb911e', true, 30),
  ('piani',       'Alta semifreddo',
   'Una torta semifreddo che farà sì che tutti ricordino il tuo evento. Alta, decorata con panna anche colorata',
   30, '/torte.jpg', '#a5cdcb', true, 40),
  ('alta-gelato', 'Alta Gelato',
   'Una torta gelato che farà sì che tutti ricordino il tuo evento. Alta, decorata con panna anche colorata',
   30, '/gelato.jpg', '#7e5bbd', true, 50)
on conflict (id) do update set
  nome        = excluded.nome,
  descrizione = excluded.descrizione,
  prezzo_base = excluded.prezzo_base,
  immagine    = excluded.immagine,
  colore      = excluded.colore,
  attivo      = excluded.attivo,
  ordine      = excluded.ordine;

-- Nota per il codice: 'piani' e 'alta-gelato' sono le due torte ALTE
-- (fino a 4 gusti). In CakeConfigurator.jsx la costante TALL_TYPE va
-- sostituita da TALL_TYPES = ['piani', 'alta-gelato'].


-- ============================================================
-- 2. DIMENSIONI — 6 righe (diametri e supplementi tutti cambiati)
-- "Il più richiesto" si sposta da 8 a 10 persone.
-- ============================================================

insert into public.dimensioni (id, etichetta, diametro, supplemento, popolare, attivo, ordine) values
  ('6',  '6 persone',  19,  0, false, true, 10),
  ('8',  '8 persone',  21,  8, false, true, 20),
  ('10', '10 persone', 24, 16, true,  true, 30),
  ('12', '12 persone', 26, 24, false, true, 40),
  ('16', '16 persone', 30, 40, false, true, 50),
  ('20', '20 persone', 31, 56, false, true, 60)
on conflict (id) do update set
  etichetta   = excluded.etichetta,
  diametro    = excluded.diametro,
  supplemento = excluded.supplemento,
  popolare    = excluded.popolare,
  attivo      = excluded.attivo,
  ordine      = excluded.ordine;


-- ============================================================
-- 3. FORME — cambia solo il supplemento della rettangolare (3 -> 2).
-- Nomi, descrizioni ed emoji restano quelli attuali: la scheda non li tocca.
-- ============================================================

update public.forme set supplemento = 0 where id = 'tonda';
update public.forme set supplemento = 4 where id = 'cuore';
update public.forme set supplemento = 2 where id = 'quadrata';
update public.forme set supplemento = 2 where id = 'rettangolare';


-- ============================================================
-- 4. BASI — 5 righe (nuova 'classica-cioccolato')
-- 'crock' passa da 3 € a 0 €: adesso il prezzo lo porta il singolo crumble
-- (vedi sezione 5), quindi non si paga due volte.
-- Nota dei titolari: le due basi "Classica" sono SENZA LATTOSIO. In questa
-- tabella non esiste una colonna per i flag dieta: l'informazione resta nella
-- descrizione / da aggiungere in futuro se serve mostrarla.
-- ============================================================

insert into public.basi (id, nome, descrizione, supplemento, colore, allergeni, attivo, ordine) values
  ('cacao',               'Senza base',           'Gelato direttamente sul piatto',                        0, '#efe7da', '',                                      true, 10),
  ('classica',            'Classica Vaniglia',    'Pan di Spagna sottile con bagna vaniglia',              1, '#e8d2a8', 'Glutine, Uova',                         true, 20),
  ('classica-cioccolato', 'Classica Cioccolato',  'Pan di Spagna sottile con bagna cioccolato',            1, '#8a5a3b', 'Glutine, Uova',                         true, 30),
  ('glutenfree',          'Salame al cioccolato', 'Il nostro inconfondibile salame per una base super golosa', 3, '#5a3520', 'Latte, Soia, Frutta a guscio, Glutine', true, 40),
  ('crock',               'Base croccante',       'Biscotto croccante: scegli sotto il gusto del crumble', 0, '#b88c5a', '',                                      true, 50)
on conflict (id) do update set
  nome        = excluded.nome,
  descrizione = excluded.descrizione,
  supplemento = excluded.supplemento,
  colore      = excluded.colore,
  allergeni   = excluded.allergeni,
  attivo      = excluded.attivo,
  ordine      = excluded.ordine;


-- ============================================================
-- 5. CRUMBLE — 5 gusti (4 nuovi), 'bianco' non si fa più.
-- I titolari li danno tutti GLUTEN FREE; il caramello è anche VEGAN e SENZA
-- LATTOSIO. La tabella non ha colonne per i flag dieta: informazione riportata
-- qui e da aggiungere in futuro se si vorrà mostrarla nel configuratore.
-- ============================================================

insert into public.crumble (id, nome, descrizione, supplemento, colore, allergeni, attivo, ordine) values
  ('cacao',         'Crumble cacao',                  'Base biscotto croccante al cacao',                                  2, '#5a3520', 'Latte, Frutta a guscio', true, 10),
  ('caramello',     'Crumble caramello',              'Base biscotto croccante al caramello',                              2, '#c8842b', 'Frutta a guscio',        true, 20),
  ('pistacchio',    'Crumble pistacchio',             'Base biscotto croccante al pistacchio',                             4, '#7ea15a', 'Latte, Frutta a guscio', true, 30),
  ('fruttato',      'Crumble fruttato',               'Base biscotto croccante con sapore fruttato adatto per torte con frutta', 2, '#e2a06a', 'Latte, Frutta a guscio', true, 40),
  ('cereali-cacao', 'Crumble cereali e fave di cacao','Base biscotto croccante con cereali senza glutine e fave di cacao',  2, '#6b4226', 'Latte, Frutta a guscio', true, 50)
on conflict (id) do update set
  nome        = excluded.nome,
  descrizione = excluded.descrizione,
  supplemento = excluded.supplemento,
  colore      = excluded.colore,
  allergeni   = excluded.allergeni,
  attivo      = excluded.attivo,
  ordine      = excluded.ordine;

-- Non più in listino.
update public.crumble set attivo = false where id = 'bianco';


-- ============================================================
-- 6. FARCITURE — 11 attive (3 nuove: nutella, kinder, granella-pistacchi)
-- ⚠️ Il "cremino" (ora "Variegato Nocciola e Gianduia") secondo i titolari NON
-- contiene più latte (lo danno senza latte, senza glutine, senza zuccheri
-- aggiunti): l'allergene Latte viene tolto.
-- ⚠️ "Biscotto" ora è SENZA GLUTINE ma contiene latte e frutta a guscio.
-- ============================================================

insert into public.farciture (id, nome, descrizione, supplemento, colore, allergeni, attivo, ordine) values
  ('nessuna',            'Nessuna',                       'Strati puri',                             0, null::text, '',                                true,  10),
  ('cremino',            'Variegato Nocciola e Gianduia', 'Nocciola e cioccolato',                   2, '#5a3520',  'Frutta a guscio, Soia',           true,  20),
  ('caramello',          'Salsa caramello salato',        'Dolce e sapida',                          2, '#c8842b',  'Latte',                           true,  30),
  ('frutti-rossi',       'Cuore frutti rossi',            'Salsa ai frutti rossi',                   2, '#c93060',  '',                                true,  40),
  ('amarena',            'Salsa di amarene',              'Classica, intensa',                       2, '#8c1e3a',  '',                                true,  50),
  ('nutella',            'Nutella',                       'Nutella… cosa devo spiegarti??',          2, '#3d2114',  'Latte, Soia, Frutta a guscio',    true,  60),
  ('kinder',             'Crema Kinder',                  'Farcitura golosa con pezzettini di wafer',2, '#e6c79c',  'Glutine, Soia, Latte',            true,  70),
  ('biscotto',           'Biscotto',                      'Croccante salsa con pezzetti di biscotti',2, '#b88c5a',  'Latte, Frutta a guscio',          true,  80),
  ('granella',           'Granella di nocciole',          'Croccante',                               1, '#8a5a3b',  'Frutta a guscio',                 true,  90),
  ('granella-pistacchi', 'Granella di Pistacchi',         'Croccante',                               1, '#9bbf6a',  'Frutta a guscio',                 true, 100),
  ('pistacchio',         'Crema di pistacchi',            'Con pistacchi interi cristallizzati',     2, '#7ea15a',  'Frutta a guscio',                 true, 110)
on conflict (id) do update set
  nome        = excluded.nome,
  descrizione = excluded.descrizione,
  supplemento = excluded.supplemento,
  colore      = excluded.colore,
  allergeni   = excluded.allergeni,
  attivo      = excluded.attivo,
  ordine      = excluded.ordine;

-- Non più in listino.
update public.farciture set attivo = false where id = 'ganache';


-- ============================================================
-- 7. COPERTURE — 9 attive (5 nuove)
-- La panna si sdoppia in tre modi di rifinire la torta (intorno / solo sopra /
-- sotto e sopra) con prezzi diversi.
-- ============================================================

insert into public.coperture (id, nome, descrizione, supplemento, colore, allergeni, attivo, ordine) values
  ('panna',                 'Panna montata INTORNO',           'Soffice, classica',                                                                 2, '#fff8e6', 'Latte',                        true, 10),
  ('panna-sopra',           'Panna montata SOLO SOPRA',        'Filo di panna solo sopra alla torta, con intorno un nastro trasparente non edibile',0, '#fff8e6', 'Latte',                        true, 20),
  ('panna-sotto-sopra',     'Panna montata SOTTO E SOPRA',     'Filo di panna sul bordo inferiore e superiore della torta',                          1, '#fff8e6', 'Latte',                        true, 30),
  ('cioccolato-cop',        'Copertura morbida al cioccolato', 'Copertura morbida al cioccolato al latte',                                           2, '#6b4226', 'Latte, Soia, Frutta a guscio', true, 40),
  ('pistacchio-cop',        'Copertura al pistacchio',         'Effetto wow',                                                                        4, '#7ea15a', 'Frutta a guscio',              true, 50),
  ('frutta-cop',            'Copertura di frutta',             'Fresca, di stagione',                                                                3, '#e84a6e', '',                             true, 60),
  ('naked',                 'Naked cake',                      'Bordi a vista, rustica',                                                             0, null::text,'',                             true, 70),
  ('cioccolato-bianco-cop', 'Copertura cioccolato bianco',     'Copertura morbida al cioccolato bianco',                                             2, '#f5f0dd', 'Latte, Soia',                  true, 80),
  ('nocciola-cop',          'Copertura Nocciola',              'Copertura morbida al gusto nocciola',                                                2, '#8a5a3b', 'Frutta a guscio, Latte, Soia', true, 90)
on conflict (id) do update set
  nome        = excluded.nome,
  descrizione = excluded.descrizione,
  supplemento = excluded.supplemento,
  colore      = excluded.colore,
  allergeni   = excluded.allergeni,
  attivo      = excluded.attivo,
  ordine      = excluded.ordine;

-- Non più in listino.
update public.coperture set attivo = false where id in ('meringa', 'ganache-cop', 'glassa-specchio');

-- Nota per il codice (Cake3D.jsx): l'anello di ciuffi (showRosetteRing) vale
-- ora per TUTTE le coperture panna ('panna', 'panna-sopra', 'panna-sotto-sopra');
-- le coperture lucide (glossy) sono 'cioccolato-cop', 'cioccolato-bianco-cop',
-- 'nocciola-cop', 'pistacchio-cop'.


-- ============================================================
-- 8. DECORAZIONI — adesso hanno un prezzo e alcune un colore a scelta
-- Colonne nuove:
--   supplemento    -> quanto costa la decorazione (finora non incideva sul totale)
--   scelta_colore  -> se true il cliente sceglie anche il colore
--   colori         -> lista dei colori proponibili, separati da virgola
-- Nota dei titolari: «le sfumature di questi colori non sono garantite, ma
-- possono essere richieste nelle note della torta» -> il configuratore lo
-- mostra come suggerimento sotto la scelta del colore.
--
-- COLORI: si propongono SOLO quelli davvero disponibili. Non esiste più una
-- tavolozza generica uguale per tutte le decorazioni: ogni lista è quella che i
-- titolari hanno scritto nella descrizione della decorazione stessa —
--   panna-colorata -> Rosa, Rossa, Azzurra, Blu, Verde, Nera, Gialla, Arcobaleno
--                     («colore a scelta tra…»: è l'unica con "tutti i colori")
--   perline        -> Oro, Argento, Rosa, Bianco   («placcate oro o argento o rosa o bianco»)
--   fiocchi        -> Nero, Rosa, Rosso, Oro       («in colore nero, rosa, rosso e oro»)
--   spumini        -> Rosa, Blu                    («Rosa o blu»)
--
-- Si sceglie il colore SOLO per queste quattro, cioè quelle per cui i titolari
-- hanno detto quali colori fanno davvero. Zuccherini, macarons, fiori eleganti e
-- fiori in ostia arrivano già colorati assortiti: nessuna scelta di colore
-- (indicazione dei titolari). Se un domani vorranno farli scegliere, basta
-- spuntare "Scelta colore" ed elencare i colori dalla dashboard,
-- scheda "Decorazioni".
--
-- Le stesse liste, parola per parola, stanno nella copia di sicurezza
-- src/data/fallback/cakeOptions.js (cakeDecorations, campo `colors`): le due
-- fonti sono lette dallo stesso codice, se cambi una cambia anche l'altra.
-- ============================================================

alter table public.decorazioni add column if not exists supplemento   numeric(10,2) not null default 0;
alter table public.decorazioni add column if not exists scelta_colore boolean       not null default false;
alter table public.decorazioni add column if not exists colori        text          default '';

insert into public.decorazioni (id, nome, descrizione, supplemento, emoji, allergeni, scelta_colore, colori, attivo, ordine) values
  ('nessuna',                  'Nessuna',                          'Top liscio',                                                                       0, '∅',  '',                             false, '', true,  10),
  ('granella-nocciola',        'Granella NOCCIOLA',                'Croccante e tostata',                                                              0, '🌰', 'Frutta a guscio',              false, '', true,  20),
  ('granella-pistacchio',      'Granella PISTACCHIO',              'Croccante e tostata',                                                              0, '🥜', 'Frutta a guscio',              false, '', true,  30),
  -- ⚠️ colori proposti da noi, non indicati dai titolari (vedi nota sopra)
  -- Gli zuccherini sono già colorati misti: nessuna scelta di colore (titolari).
  ('zuccherini',               'Zuccherini colorati',              'Zuccheri colorati misti',                                                          1, '🌈', '',                             false, '',                                                           true, 40),
  ('smarties',                 'Smarties',                         'I famosi confettini colorati ripieni di cioccolato',                               2, '🍬', 'Latte, Frutta a guscio, Soia', false, '', true,  50),
  ('perline',                  'Perline colorate',                 'Perline placcate oro, argento, rosa o bianco',                                     3, '⚪', '',                             true,  'Oro, Argento, Rosa, Bianco',                                 true, 60),
  ('fiocchi',                  'Fiocchi colorati',                 'In colore nero, rosa, rosso e oro',                                                4, '🎀', '',                             true,  'Nero, Rosa, Rosso, Oro',                                     true, 70),
  ('cioccolato-fondente-deco', 'Decorazioni cioccolato fondente',  'Allegri e golosi',                                                                 2, '🍫', '',                             false, '', true,  80),
  -- ⚠️ macarons: colori proposti da noi, non indicati dai titolari
  ('macarons',                 'Macarons',                         'Colorati assortiti',                                                               2, '🧁', 'Uova, Frutta a guscio, Latte', false, '',                                                           true, 90),
  ('spumini',                  'Spumini',                          'Rosa o blu',                                                                       1, '☁️', 'Uova',                         true,  'Rosa, Blu',                                                  true, 100),
  ('marshmallow',              'Marshmellow',                      'Morbidi e colorati',                                                               3, '🍡', '',                             false, '', true, 110),
  -- ⚠️ fiori (eleganti e in ostia): colori proposti da noi, non indicati dai titolari
  ('fiori-eleganti',           'Fiori eleganti',                   'In zucchero duro, in colori diversi',                                              5, '🌸', '',                             false, '',                                                           true, 120),
  ('fiori-ostia',              'Fiori ostia colorati',             'Delicati fiori in ostia, in colori diversi',                                        2, '🌼', '',                             false, '',                                                           true, 130),
  ('cioccolato-deco',          'Decorazioni cioccolato',           'Decorazioni in cioccolato bianco, latte e fondente',                               2, '🍫', 'Latte, Frutta a guscio, Soia', false, '', true, 140),
  ('frutta-fresca',            'Frutta fresca',                    'Ribes, more, lamponi…',                                                            4, '🫐', '',                             false, '', true, 150),
  ('panna-deco',               'Panna montata',                    'Panna montata spatolata intorno e decorazione con ciuffi',                         2, '🍦', 'Latte',                        false, '', true, 160),
  ('panna-colorata',           'Panna montata colorata',           'Colore a scelta tra rosa, rossa, azzurra, blu, verde, nera, gialla e arcobaleno',  2, '🎨', 'Latte',                        true,  'Rosa, Rossa, Azzurra, Blu, Verde, Nera, Gialla, Arcobaleno', true, 170),
  ('fantasia',                 'Fantasia del gelataio',            'Renderemo bella la torta per il tuo evento usando la nostra fantasia e il nostro estro', 3, '✨', '',                        false, '', true, 180),
  ('colorate',                 'Decorazioni colorate e divertenti','Lasciati stupire dalle nostre decorazioni colorate e simpatiche!',                  3, '🎉', '',                             false, '', true, 190)
on conflict (id) do update set
  nome          = excluded.nome,
  descrizione   = excluded.descrizione,
  supplemento   = excluded.supplemento,
  emoji         = excluded.emoji,
  allergeni     = excluded.allergeni,
  scelta_colore = excluded.scelta_colore,
  colori        = excluded.colori,
  attivo        = excluded.attivo,
  ordine        = excluded.ordine;

-- Le vecchie granelle "miste" sono sostituite dalle due separate (nocciola /
-- pistacchio), così chi è allergico a una sola può ancora ordinare.
update public.decorazioni set attivo = false where id in ('granella-nocciola-pistacchio', 'granella-frutta-secca');


-- ============================================================
-- 9. SCRITTE — TABELLA NUOVA
-- Stile della scritta sulla torta. Sostituisce la lista di font cablata nel
-- codice (StepMessage). Nessuna costa nulla: `supplemento` c'è per il futuro.
-- Finché non esegui questo script il sito NON si rompe: la tabella è opzionale
-- e il configuratore usa la copia di sicurezza nel codice.
-- ============================================================

create table if not exists public.scritte (
  id           text primary key,
  nome         text not null,
  font_family  text not null default '',   -- valore CSS pronto da usare
  esempio      text default '',            -- testo di anteprima nel configuratore
  maiuscolo    boolean not null default false,
  corsivo      boolean not null default false,
  supplemento  numeric(10,2) not null default 0,
  attivo       boolean not null default true,
  ordine       integer not null default 0
);

alter table public.scritte enable row level security;

-- Lettura pubblica (il configuratore del sito è pubblico).
drop policy if exists "scritte_select_public" on public.scritte;
create policy "scritte_select_public" on public.scritte
  for select using (true);

-- Scrittura solo allo staff loggato nel gestionale.
drop policy if exists "scritte_write_auth" on public.scritte;
create policy "scritte_write_auth" on public.scritte
  for all to authenticated using (true) with check (true);

insert into public.scritte (id, nome, font_family, esempio, maiuscolo, corsivo, supplemento, attivo, ordine) values
  ('stampatello',        'Stampatello maiuscolo', '''Inter'', sans-serif',   'AUGURI!', true,  false, 0, true, 10),
  ('corsivo',            'Corsivo',               '''Caveat'', cursive',     'Auguri!', false, false, 0, true, 20),
  ('corsivo-scolastico', 'Corsivo scolastico',    '''Fraunces'', serif',     'Auguri!', false, true,  0, true, 30)
on conflict (id) do update set
  nome        = excluded.nome,
  font_family = excluded.font_family,
  esempio     = excluded.esempio,
  maiuscolo   = excluded.maiuscolo,
  corsivo     = excluded.corsivo,
  supplemento = excluded.supplemento,
  attivo      = excluded.attivo,
  ordine      = excluded.ordine;

-- Nota per il codice: config.messageFont finora valeva 'inter' / 'caveat' /
-- 'fraunces'. La mappa per gli ordini storici è:
--   inter -> stampatello, caveat -> corsivo, fraunces -> corsivo-scolastico.
-- Il default diventa 'corsivo'. CakePreview.jsx e Cake3D.jsx devono accettare
-- sia i nuovi id sia i vecchi valori.


-- ============================================================
-- 10. EXTRA — TABELLA NUOVA
-- Prodotti che si possono aggiungere all'ordine della torta prima di pagare
-- («possono aggiungerlo alla torta prima del pagamento, come anche i nostri
-- pasticcini»). Il salame si vende al kg, quindi si ordina a mezzi chili:
-- `passo` è l'incremento della quantità (0.5 per il salame, 1 per i cabaret).
-- Anche questa tabella è opzionale: se manca, il passo "Extra" non compare.
-- ============================================================

create table if not exists public.extra (
  id           text primary key,
  nome         text not null,
  descrizione  text default '',
  prezzo       numeric(10,2) not null default 0,
  unita        text default '',            -- 'al kg', 'a cabaret'…
  passo        numeric(10,2) not null default 1,  -- incremento della quantità
  allergeni    text default '',            -- nomi separati da virgola, come nelle altre schede
  attivo       boolean not null default true,
  ordine       integer not null default 0
);

alter table public.extra enable row level security;

-- Lettura pubblica (il configuratore del sito è pubblico).
drop policy if exists "extra_select_public" on public.extra;
create policy "extra_select_public" on public.extra
  for select using (true);

-- Scrittura solo allo staff loggato nel gestionale.
drop policy if exists "extra_write_auth" on public.extra;
create policy "extra_write_auth" on public.extra
  for all to authenticated using (true) with check (true);

-- ⚠️ Per i cabaret i titolari hanno scritto «TUTTI» alla voce allergeni:
-- dichiariamo tutti quelli usati in gelateria tranne i solfiti, nell'ordine
-- indicato dalla scheda (Glutine, Latte, Uova, Soia, Frutta a guscio, Arachidi):
-- è lo stesso ordine della copia di sicurezza in src/data/fallback/cakeOptions.js,
-- così il cliente legge la stessa frase «Contiene: …» con i dati live e senza.
insert into public.extra (id, nome, descrizione, prezzo, unita, passo, allergeni, attivo, ordine) values
  ('salame-dolce', 'Salame dolce',                  'Il nostro mitico salame al cioccolato', 35, 'al kg',     0.5, 'Latte, Soia, Frutta a guscio, Glutine',              true, 10),
  ('cabaret-10',   'Cabaret pasticcini — 10 pezzi', 'Pasticcini mignon assortiti',           15, 'a cabaret', 1,   'Glutine, Latte, Uova, Soia, Frutta a guscio, Arachidi', true, 20),
  ('cabaret-15',   'Cabaret pasticcini — 15 pezzi', 'Pasticcini mignon assortiti',           20, 'a cabaret', 1,   'Glutine, Latte, Uova, Soia, Frutta a guscio, Arachidi', true, 30),
  ('cabaret-20',   'Cabaret pasticcini — 20 pezzi', 'Pasticcini mignon assortiti',           25, 'a cabaret', 1,   'Glutine, Latte, Uova, Soia, Frutta a guscio, Arachidi', true, 40)
on conflict (id) do update set
  nome        = excluded.nome,
  descrizione = excluded.descrizione,
  prezzo      = excluded.prezzo,
  unita       = excluded.unita,
  passo       = excluded.passo,
  allergeni   = excluded.allergeni,
  attivo      = excluded.attivo,
  ordine      = excluded.ordine;


-- ============================================================
-- 11. GUSTI E ALLERGENI (allergeni_prodotti)
-- Carta del gelato + pagina pubblica /allergeni.
-- ============================================================

-- ---- 11a. Descrizione del gusto (i titolari l'hanno scritta per ognuno) ----
alter table public.allergeni_prodotti add column if not exists descrizione text default '';


-- ---- 11c. Rinomini (l'id resta lo stesso: cambia solo il nome) ----
-- Le condizioni sono scritte in modo che rieseguire lo script non faccia nulla.
update public.allergeni_prodotti set gusto = 'Yogurt Bianco'
  where lower(trim(gusto)) = 'yogurt';
update public.allergeni_prodotti set gusto = 'Cioccolato'
  where lower(trim(gusto)) = 'cioccolato fondente';
update public.allergeni_prodotti set gusto = 'Cheesecake ai frutti rossi'
  where lower(trim(gusto)) = 'cheesecake';
update public.allergeni_prodotti set gusto = 'Kinder'
  where lower(trim(gusto)) = 'super kinder';


-- ---- 11d. Da disattivare ----
-- I titolari: «After Eight è la mentaciock» -> resta solo Mentaciock.
update public.allergeni_prodotti set attivo = false, per_torte = false
  where lower(trim(gusto)) = 'after eight';


-- ---- 11e/11f. Voci nuove ----
-- Righe "vuote": nome, categoria, colore e posizione. Descrizione, allergeni e
-- flag dieta arrivano tutti dal blocco 11g qui sotto, così i valori stanno
-- scritti in un posto solo. Se il gusto esiste già non viene toccato.
insert into public.allergeni_prodotti
  (id, categoria, gusto, base, ingredienti, descrizione,
   allergeni_certi, allergeni_tracce,
   vegan, senza_glutine, senza_lattosio, senza_zucchero,
   colore, tag, per_torte, attivo, ordine)
select gen_random_uuid(), v.categoria, v.gusto, '', '', '',
       '', '',
       false, false, false, false,
       v.colore, null::text, v.per_torte, true, v.ordine
from (values
  -- Gusti nuovi (11e)
  ('golosone'::text,  'Punto Gi'::text,            '#b651e4'::text, true,  30),
  ('golosone',        'Mentaciock',                '#8fd1a0',       true,  31),
  ('golosone',        'Duplo',                     '#7a4a2e',       true,  32),
  ('golosone',        'Giovanna',                  '#e8c79e',       false, 33),  -- è un semifreddo: non va nelle torte
  -- Altre leccornie (11f): voci di listino, non gusti da coppetta
  ('leccornie',       'Pasticcini',                '#f3a3c2',       false, 70),
  ('leccornie',       'Salame dolce',              '#5a3520',       false, 71),
  ('leccornie',       'Torte gelato',              '#b651e4',       false, 72),
  ('leccornie',       'Torte semifreddo',          '#a5cdcb',       false, 73),
  ('leccornie',       'Monoporzioni',              '#eb911e',       false, 74),
  ('leccornie',       'Prodotti stagionali',       '#7ea15a',       false, 75)
) as v(categoria, gusto, colore, per_torte, ordine)
where not exists (
  select 1 from public.allergeni_prodotti ap
  where lower(trim(ap.gusto)) = lower(trim(v.gusto))
);


-- ---- 11g. Dati di ogni gusto, come li hanno scritti i titolari ----
-- Descrizione, colore e allergeni vengono riscritti ogni volta (sono la verità
-- della scheda). I flag dieta invece si possono solo ACCENDERE (`or`): la
-- scheda segna con "Sì" quello che vale, e lascia vuoto il resto — un vuoto
-- non è un "no", quindi non spegniamo mai un flag già impostato.
--
-- Allergeni normalizzati come da regole concordate:
--   «/», «—», «-», «__», vuoto        -> nessun allergene
--   «altra frutta a guscio»            -> Frutta a guscio
--   «cereali contenenti glutine»       -> Glutine
--   «latte e derivati» / «soia e derivati» -> Latte / Soia
--
-- ⚠️ DA RICONTROLLARE COL QUADERNO ALLERGENI: per alcuni gusti la scheda
-- dichiara MENO allergeni certi di quelli oggi in database. In particolare:
--   • Cocco  -> oggi "Solfiti", la scheda non ne indica nessuno
--   • Nutella e Cheesecake -> la Soia passa da certa a traccia (Nutella)
--   • Biscotto -> le Uova passano da certe a tracce
-- Se il laboratorio conferma il vecchio dato, correggi dalla dashboard.
update public.allergeni_prodotti ap set
  descrizione      = v.descrizione,
  colore           = v.colore,
  allergeni_certi  = v.certi,
  allergeni_tracce = v.tracce,
  senza_glutine    = coalesce(ap.senza_glutine,  false) or v.sg,
  senza_lattosio   = coalesce(ap.senza_lattosio, false) or v.sl,
  senza_zucchero   = coalesce(ap.senza_zucchero, false) or v.sz,
  vegan            = coalesce(ap.vegan,          false) or v.vegan
from (values
  -- chiave (nome minuscolo)          descrizione                                                                                                       colore      allergeni certi                            allergeni tracce                        sg     sl     sz     vegan
  ('bacio'::text,                     'L''inconfondibile gusto della gianduia che incontra le nocciole intere tostate.'::text,                           '#3a2519'::text, 'Latte, Frutta a guscio'::text,            'Soia, Frutta a guscio'::text,          true,  false, false, false),
  ('nutella',                         'Ispirato alla crema spalmabile più famosa al mondo. Base di Nutella con pezzetti di Nutella',                     '#3d2114', 'Latte, Frutta a guscio',                  'Soia, Arachidi, Uova',                 true,  false, false, false),
  ('cioccolato',                      'Ispirato dal budino al cioccolato della nonna. Una base di cioccolato finissimo, con un retro sapore  di panna',  '#4a2c1a', 'Latte',                                   'Soia',                                 true,  false, false, false),
  ('nero nero',                       'Cioccolato fondente con la percentuale più alta di cacao: 80%',                                                   '#1a1008', 'Soia',                                    'Frutta a guscio, Latte',               true,  true,  false, true),
  ('nocciola',                        'Classico intramontabile. Il gelato fatto con le nocciole tostate trilobate italiane',                             '#8a5a3b', 'Latte, Frutta a guscio',                  'Soia, Arachidi',                       true,  false, false, false),
  ('stracciatella',                   'Uno dei nostri gusti più ricercati: una base di panna, con pezzetti croccanti di cioccolato',                     '#f5f0dd', 'Latte',                                   'Soia',                                 true,  false, false, false),
  ('crema',                           'Il gelao al gusto crema pasticcera, con infusione di scorze di limone',                                           '#f5d97a', 'Latte, Uova',                             'Soia',                                 true,  false, false, false),
  ('fior di latte',                   'il gusto più puro, il nostro fior di latte: corposo, saporito e pieno',                                           '#fff8e6', 'Latte',                                   'Soia',                                 true,  false, false, false),
  ('pistacchio',                      'Classico dei classici, fatto con pistacchi che ci facciamo spedire dalla Sicilia',                                '#7ea15a', 'Latte, Frutta a guscio',                  'Soia, Arachidi',                       true,  false, false, false),
  ('yogurt bianco',                   'Il nostro Yogurt: leggermente acido, saporito e cremoso.',                                                        '#fafafa', 'Latte',                                   'Soia',                                 true,  false, false, false),
  ('punto gi',                        'Che dire… una pasta di mandorla, con stracciatella e croccante alla mandorla',                                    '#b651e4', 'Latte, Frutta a guscio, Arachidi, Soia',  'Frutta a guscio',                      true,  false, false, false),
  ('kinder',                          'Una base di nocciola e cioccolato bianco, coi famosi waferini glassati alla nocciola',                            '#e6c79c', 'Latte, Glutine, Frutta a guscio, Soia',   'Frutta a guscio, Arachidi',            false, false, false, false),
  ('cocco',                           'Il nostro cocco SENZA latte',                                                                                     '#fafafa', '',                                        'Latte, Soia',                          true,  true,  false, true),
  ('spagnola',                        'sua maestà la crema impreziosita da una variegatura con le amarene di Vignola',                                   '#d9b384', 'Latte',                                   'Soia',                                 true,  false, false, false),
  ('limone',                          'Il limone, fatto con polpa di limone di Sorrento',                                                                '#f5e26a', '',                                        'Soia',                                 true,  true,  false, true),
  ('fragola',                         'La fragola….cosa dovrei dirti??',                                                                                 '#e84a6e', '',                                        'Soia',                                 true,  true,  false, true),
  ('mentaciock',                      'Una base di menta verde con stracciatella',                                                                       '#8fd1a0', 'Latte',                                   'Soia, Frutta a guscio',                true,  false, false, false),
  ('biscotto',                        'Il nostro biscotto con pepite di biscotto glassato al cioccolato.',                                               '#c89968', 'Latte, Frutta a guscio',                  'Soia, Frutta a guscio, Uova',          true,  false, false, false),
  ('mango',                           'il gusto frutta più inaspettato, fatto con percentuali altissime di purea pura di mango',                         '#f3a72d', '',                                        '',                                     true,  true,  false, true),
  ('pino pinguino',                   'Ispirato al Pinguì,base di panna con strati di Nutella morbida',                                                  '#3a2418', 'Latte, Frutta a guscio',                  'Soia, Arachidi',                       true,  false, false, false),
  ('caramello salato',                'Base di mandorla, con un caramello con piccoli fiocchi di sale di Cervia',                                        '#c8842b', 'Latte, Frutta a guscio',                  'Soia, Arachidi',                       true,  false, false, false),
  ('duplo',                           'Una base cremosa di nocciola, con pezzi di cialda, nocciole e cioccolato',                                        '#7a4a2e', 'Latte, Glutine, Frutta a guscio, Soia',   'Arachidi, Uova',                       false, false, false, false),
  ('cheesecake ai frutti rossi',      'Freschissima base al formaggio spalmabile, con biscotti croccanti al caramello e frutti rossi',                   '#c94a6b', 'Latte, Frutta a guscio, Soia',            'Arachidi',                             true,  false, false, false),
  ('giovanna',                        'SEMIFREDDO Panna montata con croccante alla mandorla',                                                            '#e8c79e', 'Latte, Frutta a guscio',                  'Soia, Arachidi',                       true,  false, false, false),
  ('nocciola e gianduia',             'Nocciola con gianduia e nocciole intere',                                                                          '#6b4226', 'Frutta a guscio',                         'Frutta a guscio, Arachidi, Soia, Latte', true, true,  true,  false),
  ('pistacchio salato',               'Pistacchio fatto con pesto di pistacchio. Salato per natura',                                                     '#9bbf6a', 'Frutta a guscio',                         '',                                     true,  true,  true,  false),
  -- Nella scheda si chiama «Yogurt Senza derivati del latte e senza zuccheri aggiunti»: è questo.
  ('yogurt con mango e passion fruit','Yogurt senza derivati animali, con mango e passion fruit. Da giù di testa',                                       '#f7c25a', '',                                        'Uova, Latte, Soia, Frutta a guscio, Arachidi', true, true, true, false),
  ('caffè',                           '',                                                                                                                '#4a2e1f', 'Latte',                                   'Soia',                                 true,  false, false, false),
  -- Altre leccornie: «TUTTI» = tutti gli allergeni della gelateria tranne i solfiti.
  ('pasticcini',                      '',                                                                                                                '#f3a3c2', 'Glutine, Latte, Uova, Soia, Arachidi, Frutta a guscio', '',                       false, false, false, false),
  ('salame dolce',                    '',                                                                                                                '#5a3520', 'Latte, Soia, Frutta a guscio, Glutine',   '',                                     false, false, false, false),
  ('torte gelato',                    '',                                                                                                                '#b651e4', 'Glutine, Latte, Uova, Soia, Arachidi, Frutta a guscio', '',                       false, false, false, false),
  ('torte semifreddo',                '',                                                                                                                '#a5cdcb', 'Glutine, Latte, Uova, Soia, Arachidi, Frutta a guscio', '',                       false, false, false, false),
  -- ⚠️ Monoporzioni e Prodotti stagionali: allergeni NON indicati dai titolari.
  ('monoporzioni',                    '',                                                                                                                '#eb911e', '',                                        '',                                     false, false, false, false),
  ('prodotti stagionali',             '',                                                                                                                '#7ea15a', '',                                        '',                                     false, false, false, false)
) as v(chiave, descrizione, colore, certi, tracce, sg, sl, sz, vegan)
where lower(trim(ap.gusto)) = v.chiave;


-- ---- 11h. Gusti selezionabili per le torte ----
-- Restano quelli già spuntati; i tre nuovi gusti "pieni" sono già inseriti con
-- per_torte = true qui sopra. Le leccornie non devono mai comparire fra i gusti
-- della torta (né 'Giovanna', che è un semifreddo).
update public.allergeni_prodotti set per_torte = false where categoria = 'leccornie';


-- ============================================================
-- 12. ORARI — nessuna modifica.
-- I titolari non hanno compilato la colonna «Va bene?»: gli orari 11:00-23:00
-- su 7 giorni restano quelli già in database. (Va invece allineato il fallback
-- nel codice, src/data/fallback/hours.js, che è fermo a orari vecchi.)
-- ============================================================


-- ============================================================
-- COSE CHE I TITOLARI NON HANNO COMPILATO — da chiedere prima del prossimo giro
-- ============================================================
--  1. ORARI: la colonna «Va bene?» è vuota per tutti e 7 i giorni e non è
--     indicato il giorno di chiusura.
--  2. WHATSAPP, INSTAGRAM, FACEBOOK: caselle lasciate vuote.
--  3. FERIE / CHIUSURE STAGIONALI: vuoto.
--  4. PREZZI DEL GELATO DI BANCO: coni, coppette, vaschette ed extra (panna,
--     granella): nessuna risposta.
--  5. ALLERGENI MANCANTI: «Monoporzioni» e «Prodotti stagionali» sono inseriti
--     senza allergeni dichiarati (nella scheda c'era «da indicare»).
--  6. «PANNA MONTATA SOLO SOPRA»: la colonna «Esiste?» non è compilata.
--     Inserita comunque, perché è descritta nel dettaglio.
--  7. «COPERTURA CIOCCOLATO BIANCO»: la descrizione era rimasta «Fondente o
--     latte», incoerente col nome: riscritta come «Copertura morbida al
--     cioccolato bianco».
--  8. PREAVVISO MINIMO, ZONE DI CONSEGNA, ACCONTO: risposte «già comunicato /
--     comunicati» senza i valori. Da confermare che quelli sul sito (5 ore,
--     zone di Carpi, pagamento completo) siano ancora giusti.
--  9. GUSTI IN DATABASE NON NOMINATI NELLA SCHEDA: Granita Pistacchio, Granita
--     Mandorla, Pompelmo, Pesca, Melone. Lasciati attivi e invariati: da
--     confermare.
-- 10. PREZZO BASE DELLE TORTE: scritto nella colonna dei segnaposto
--     (28/28/28/30/30) invece che in quella «CORRETTO». Trattato come valore
--     reale: da riconfermare.
-- ============================================================
