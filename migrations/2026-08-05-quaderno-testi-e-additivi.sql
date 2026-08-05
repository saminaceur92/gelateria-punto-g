-- ============================================================
-- Testi fissi e glossario additivi del quaderno — 2026-08-05
-- Da eseguire su Supabase (progetto Gelateria-punto-gi) UNA VOLTA,
-- dal SQL Editor. Lo script è IDEMPOTENTE: rieseguirlo non fa danni.
--
-- A cosa serve: il quaderno generato dal gestionale (pulsante "Genera e
-- pubblica", scheda "PDF e QR allergeni") adesso contiene anche le parti
-- scritte a mano che c'erano nel quaderno impaginato in Word:
--   1. la copertina con logo, ragione sociale e frase di presentazione
--   2. "La nostra filosofia"
--   3. l'elenco di legge dei 14 allergeni (Allegato II Reg. UE 1169/2011)
--   4. il glossario degli additivi (E300, E202, E330…)
--
-- Tutte queste parti si modificano dal gestionale, nelle due schede nuove
-- "Testi del quaderno" e "Additivi (E-xxx)", accanto a "Gusti e allergeni".
--
-- Finché non esegui questo script il sito NON si rompe: le tabelle sono
-- opzionali e il quaderno si genera senza queste sezioni.
-- ============================================================


-- ============================================================
-- 1. TESTI DEL QUADERNO
-- `posizione` dice dove finisce il testo nel PDF:
--   'copertina' -> prima pagina, sotto il logo
--   'apertura'  -> dopo la copertina, prima delle tabelle dei gusti
--   'chiusura'  -> in fondo, dopo il glossario additivi
-- Nel testo, una riga che comincia con degli SPAZI viene stampata rientrata
-- e più piccola: è così che si scrivono i sotto-punti a) b) c).
-- ============================================================

-- `id` esiste perché l'editor del gestionale identifica le righe da lì, come
-- in tutte le altre schede; `chiave` resta il nome parlante usato dal codice.
create table if not exists public.quaderno_testi (
  id         uuid primary key default gen_random_uuid(),
  chiave     text not null unique,
  titolo     text default '',
  testo      text default '',
  posizione  text not null default 'apertura',
  attivo     boolean not null default true,
  ordine     integer not null default 0
);

alter table public.quaderno_testi enable row level security;

-- Lettura pubblica: il quaderno lo genera lo staff, ma la tabella non contiene
-- nulla di riservato e restare coerenti con le altre semplifica.
drop policy if exists "quaderno_testi_select_public" on public.quaderno_testi;
create policy "quaderno_testi_select_public" on public.quaderno_testi
  for select using (true);

drop policy if exists "quaderno_testi_write_auth" on public.quaderno_testi;
create policy "quaderno_testi_write_auth" on public.quaderno_testi
  for all to authenticated using (true) with check (true);

-- I testi sono ricopiati dal quaderno impaginato dai titolari
-- (public/documenti/quaderno-allergeni-punto-gi.pdf, pagine 1-3).
-- `do update` NON è previsto: se i titolari li modificano dal gestionale,
-- rieseguire lo script non deve riscriverli sopra.
insert into public.quaderno_testi (chiave, titolo, testo, posizione, attivo, ordine) values
  ('claim', '', 'Trasparenza e Qualità Artigianale', 'copertina', true, 10),

  ('intro', 'Al servizio della tua sicurezza',
   $txt$Il presente documento è redatto ai sensi del Regolamento (UE) n. 1169/2011 per garantire a tutti i nostri clienti una consultazione chiara e completa sulle sostanze o prodotti che possono provocare allergie o intolleranze.$txt$,
   'copertina', true, 20),

  ('filosofia', 'La nostra filosofia',
   $txt$Utilizziamo ingredienti di alta qualità, come latte intero di origine italiana e certificato cruelty free, uova pastorizzate e frutta selezionata. La nostra produzione è artigianale: per questo motivo, nonostante l'estrema attenzione del personale in ogni processo per creare i nostri prodotti, non è possibile escludere la presenza di tracce accidentali di allergeni in ogni creazione a causa delle lavorazioni in un unico laboratorio.$txt$,
   'apertura', true, 30),

  ('allergeni_legge', 'Sostanze o prodotti che provocano allergie o intolleranze',
   $txt$Allegato II del Regolamento (UE) n. 1169/2011 — Gazzetta Ufficiale dell'Unione Europea.

1. Cereali contenenti glutine, cioè: grano, segale, orzo, avena, farro, kamut o i loro ceppi ibridati e prodotti derivati, tranne:
   a) sciroppi di glucosio a base di grano, incluso destrosio; (*)
   b) maltodestrine a base di grano; (*)
   c) sciroppi di glucosio a base di orzo;
   d) cereali utilizzati per la fabbricazione di distillati alcolici, incluso l'alcol etilico di origine agricola.
2. Crostacei e prodotti a base di crostacei.
3. Uova e prodotti a base di uova.
4. Pesce e prodotti a base di pesce, tranne:
   a) gelatina di pesce utilizzata come supporto per preparati di vitamine o carotenoidi;
   b) gelatina o colla di pesce utilizzata come chiarificante nella birra e nel vino.
5. Arachidi e prodotti a base di arachidi.
6. Soia e prodotti a base di soia, tranne:
   a) olio e grasso di soia raffinato; (*)
   b) tocoferoli misti naturali (E306), tocoferolo D-alfa naturale, tocoferolo acetato D-alfa naturale, tocoferolo succinato D-alfa naturale a base di soia;
   c) oli vegetali derivati da fitosteroli e fitosteroli esteri a base di soia;
   d) estere di stanolo vegetale prodotto da steroli di olio vegetale a base di soia.
7. Latte e prodotti a base di latte (incluso lattosio), tranne:
   a) siero di latte utilizzato per la fabbricazione di distillati alcolici, incluso l'alcol etilico di origine agricola;
   b) lattiolo.
8. Frutta a guscio, vale a dire: mandorle (Amygdalus communis L.), nocciole (Corylus avellana), noci (Juglans regia), noci di acagiù (Anacardium occidentale), noci di pecan [Carya illinoinensis (Wangenh.) K. Koch], noci del Brasile (Bertholletia excelsa), pistacchi (Pistacia vera), noci macadamia o noci del Queensland (Macadamia ternifolia), e i loro prodotti, tranne per la frutta a guscio utilizzata per la fabbricazione di distillati alcolici, incluso l'alcol etilico di origine agricola.
9. Sedano e prodotti a base di sedano.
10. Senape e prodotti a base di senape.
11. Semi di sesamo e prodotti a base di semi di sesamo.
12. Anidride solforosa e solfiti in concentrazioni superiori a 10 mg/kg o 10 mg/litro in termini di SO2 totale da calcolarsi per i prodotti così come proposti pronti al consumo o ricostituiti conformemente alle istruzioni dei fabbricanti.
13. Lupini e prodotti a base di lupini.
14. Molluschi e prodotti a base di molluschi.

   (*) E i prodotti derivati, nella misura in cui la trasformazione che hanno subito non è suscettibile di elevare il livello di allergenicità valutato dall'Autorità per il prodotto di base da cui sono derivati.$txt$,
   'apertura', true, 40),

  ('guida', 'Guida rapida alla consultazione',
   $txt$All'interno trovi i gusti divisi per categorie:
   Le Creme Classiche: base latte e uova, senza variegatura, quindi lisci.
   I Nostri Golosoni: gusti con variegature, ovvero inclusioni quali biscotti, granelle, cialde.
   Linea Frutta e Vegan: gusti a base acqua, senza derivati animali.

I prodotti utilizzati per le preparazioni si intendono sia freschi, sia surgelati, che confezionati. Il personale è a tua completa disposizione per qualsiasi chiarimento.$txt$,
   'apertura', true, 50),

  -- posizione 'glossario' = fa da introduzione alla tabella degli additivi
  -- in fondo al quaderno (testo della "Sezione 6" dei titolari).
  ('glossario_intro', 'Approfondimento tecnico',
   $txt$Per garantire la cremosità e la conservazione ottimale del nostro gelato artigianale utilizziamo piccole quantità (inferiori al 3%) di addensanti e stabilizzanti naturali, già integrati nelle nostre basi.$txt$,
   'glossario', true, 60)
on conflict (chiave) do nothing;


-- ============================================================
-- 2. GLOSSARIO ADDITIVI
-- Le sigle E-xxx che compaiono nelle liste ingredienti, spiegate.
-- Stampate in fondo al quaderno.
--
-- Tutte e 41 le voci sono ricopiate dalla "Sezione 6 — Approfondimento
-- tecnico" del quaderno impaginato dai titolari (pagine 22-26). Rispetto
-- all'originale sono state solo rimesse la punteggiatura e le lettere perse
-- nell'esportazione in PDF (le legature fi/fl: "dolcificante", "fluido",
-- "gelificante", "profilo", "modificate", "esterificato", "acidificante").
-- Qui l'ordine è per numero crescente, così si trovano a colpo d'occhio.
--
-- ⚠️ UNICO BUCO: nelle liste ingredienti in database compare anche E401
-- (alginato di sodio), che nel quaderno dei titolari non è spiegato.
-- Da aggiungere dal gestionale, scheda "Additivi (E-xxx)".
-- ============================================================

create table if not exists public.additivi (
  id          uuid primary key default gen_random_uuid(),
  codice      text not null unique,
  nome        text default '',
  descrizione text default '',
  attivo      boolean not null default true,
  ordine      integer not null default 0
);

alter table public.additivi enable row level security;

drop policy if exists "additivi_select_public" on public.additivi;
create policy "additivi_select_public" on public.additivi
  for select using (true);

drop policy if exists "additivi_write_auth" on public.additivi;
create policy "additivi_write_auth" on public.additivi
  for all to authenticated using (true) with check (true);

insert into public.additivi (codice, nome, descrizione, attivo, ordine) values
  ('E101',  'Vitamina B2',
   'Colorante naturale che conferisce la tonalità del giallo brillante.', true, 10),
  ('E122',  'Azorubina o Carmoisina',
   'Colorante azoico di sintesi che conferisce tonalità sul rosso-arancione. Può influire negativamente sull''attività e l''attenzione dei bambini.', true, 20),
  ('E129',  'Rosso Allura',
   'Colorante azoico di sintesi che conferisce tonalità sul rosso acceso. Può influire negativamente sull''attività e l''attenzione dei bambini.', true, 30),
  ('E133',  'Colorante Blu',
   'Colorante blu più usato al mondo. N.B. viene usato a bassissime dosi (0,01 g, ovvero una punta di stuzzicadenti in una vaschetta da un chilo).', true, 40),
  ('E150a', 'Caramello',
   'Colorante alimentare naturale dato dalla caramellizzazione dello zucchero da cucina.', true, 50),
  ('E160a', 'Beta-Carotene',
   'Pigmentazione di colore arancione estratta da carote, albicocche e zucche.', true, 60),
  ('E160c', 'Estratto di Paprika',
   'Estratto naturale chiamato anche capsantina o capsorubina, serve come colorante rosso arancione molto intenso, privo di gusto.', true, 70),
  ('E163',  'Antociani',
   'Coloranti naturali estratti da vegetali o frutti rossi/viola, utilizzati per conferire tonalità cromatiche stabili in ambiente acido.', true, 80),
  ('E202',  'Sorbato di Potassio',
   'Il sale conservante più utilizzato al mondo, serve a garantire la sicurezza igienica e a prolungare la vita soprattutto della frutta fresca in gelateria.', true, 90),
  ('E300',  'Acido Ascorbico',
   'Acido presente in natura, comunemente detto Vitamina C, forte antiossidante e regolatore di acidità.', true, 100),
  ('E304',  'Palmitato di Ascorbile',
   $t$È un acidificante e antiossidante che unisce due sostanze naturali: la Vitamina C e un acido grasso. Questo lo rende solubile nei grassi, risolvendo il limite della Vitamina C classica.$t$, true, 110),
  ('E306',  'Estratto ricco di Vitamina E',
   $t$È una miscela naturale di diverse forme di Vitamina E (alfa, beta, gamma e delta tocoferolo).$t$, true, 120),
  ('E307',  'Alfa-Tocoferolo (Vitamina E)',
   $t$È la forma più attiva della Vitamina E ed è forse l'antiossidante più potente in natura; serve a prevenire cambiamenti di colori o sapori.$t$, true, 130),
  ('E322',  'Lecitina di Soia',
   $t$È l'emulsionante naturale per eccellenza. Si estrae principalmente dai semi di soia, dal girasole o dal tuorlo d'uovo; serve a legare i grassi all'acqua.$t$, true, 140),
  ('E330',  'Acido Citrico',
   $t$Probabilmente l'acidificante e antiossidante più utilizzato al mondo. Sebbene sia presente naturalmente in grandi quantità negli agrumi, soprattutto limoni e simili.$t$, true, 150),
  ('E334',  'Acido Tartarico',
   $t$È un agente antiossidante e acidificante. È un composto organico naturalmente presente in molti frutti, ma la cui fonte principale è l'uva.$t$, true, 160),
  ('E406',  'Agar agar',
   $t$Gelificante e stabilizzante naturale ottenuto da diverse specie di alghe rosse. Utilizzato per dare consistenza, struttura e resistenza termica alle paste e ai variegati senza alterare il sapore.$t$, true, 170),
  ('E407',  'Carragenina',
   $t$Addensante e gelificante naturale estratto dalle alghe rosse; serve a mantenere stabile la struttura del gelato.$t$, true, 180),
  ('E410',  'Farina di semi di Carrube',
   $t$Probabilmente lo stabilizzante più pregiato e utilizzato nel gelato artigianale di alta qualità. Si ottiene dai semi dell'albero del carrubo, tipico dell'area mediterranea.$t$, true, 190),
  ('E412',  'Gomma di Guar',
   $t$Derivato naturalmente dalla macinazione di semi di guar, serve ad aiutare il gelato ad addensarsi naturalmente.$t$, true, 200),
  ('E415',  'Gomma di Xantano',
   $t$Ottenuto dalla fermentazione controllata di zuccheri, serve ad aiutare il gelato a non sgocciolare.$t$, true, 210),
  ('E417',  'Gomma di Tara',
   $t$Addensante e stabilizzante ottenuto dalla macinazione dei semi della Caesalpinia spinosa, una pianta originaria delle Ande peruviane.$t$, true, 220),
  ('E420ii', 'Sciroppo di Sorbitolo',
   $t$Famiglia dei polioli, è un alcol dello zucchero dato da una lavorazione naturale; serve a mantenere la struttura del gelato nel tempo senza utilizzare gli zuccheri.$t$, true, 230),
  ('E440',  'Pectina (E440i)',
   $t$Addensante e gelificante naturale estratto principalmente dalle bucce di agrume o mela; fondamentale per dare la giusta consistenza e viscosità alla linea frutta.$t$, true, 240),
  ('E450',  'Difosfati',
   $t$Stabilizzante naturale che impedisce all'acqua di cristallizzare e permette alla struttura di rimanere setosa nel tempo.$t$, true, 250),
  ('E466',  'Carbossimetilcellulosa',
   $t$Addensante e stabilizzante naturale preso dalla cellulosa; serve a mantenere la struttura del gelato anche facendo fronte a shock termici.$t$, true, 260),
  ('E470',  'Sali di acidi grassi',
   $t$È un emulsionante stabile che permette di legare i grassi all'acqua, evitando agglomerati e conferendo un'ottima cremosità.$t$, true, 270),
  ('E471',  'Mono e digliceridi degli acidi grassi',
   $t$È l'emulsionante più comune, derivato naturale della cellulosa; serve a prevenire cristalli di ghiaccio nel gelato. È il capostipite della famiglia (E472a, E472b ecc.), che non sono altro che versioni dell'E471 modificate.$t$, true, 280),
  ('E472a', 'Mono o digliceride dell''acido acetico (ACETEM)',
   $t$Agente emulsionante. Ottenuto dalla lavorazione dell'aceto, serve a rendere i grassi più spatolabili.$t$, true, 290),
  ('E472b', 'Esteri lattici di mono e digliceridi degli acidi grassi (LACTEM)',
   $t$È un emulsionante ottenuto con l'unione dell'acido lattico coi grassi alimentari. Serve a tenere legate le parti acquose e quelle grasse.$t$, true, 300),
  ('E472e', 'Esteri diacetiltartarici dei mono-digliceridi degli acidi grassi',
   $t$Emulsionante che conferisce un miglioramento della struttura e aiuta a sciogliere e disperdere meglio le particelle di cacao nella miscela.$t$, true, 310),
  ('E473',  'Sucresteri',
   $t$Emulsionante ottenuto legando lo zucchero con i grassi alimentari. Serve a prevenire la formazione di cristalli di ghiaccio.$t$, true, 320),
  ('E476',  'Poliricinoleato di poliglicerolo (PGPR)',
   $t$È un emulsionante per rendere il cioccolato fluido; serve soprattutto per la pasticceria e per le variegature in gelateria.$t$, true, 330),
  ('E477',  'Monoestere propilglicole',
   $t$Agente emulsionante esterificato del glicole propilenico con acidi grassi, serve ad aiutare il gelato ad avere molecole di aria all'interno.$t$, true, 340),
  ('E500',  'Carbonato di sodio',
   $t$Agente lievitante, regola l'acidità degli alimenti; variante del bicarbonato di calcio.$t$, true, 350),
  ('E500ii', 'Bicarbonato di sodio',
   $t$Agente lievitante, regola l'acidità degli alimenti; variante del carbonato di calcio. Uno dei sali più usati in cucina.$t$, true, 360),
  ('E503',  'Ammonio carbonato ("ammoniaca per dolci")',
   $t$È un sale che funge da agente lievitante (se E503ii, in ambiente acido), da non confondersi con l'ammoniaca liquida usata per le pulizie.$t$, true, 370),
  ('E953',  'Isomalto (isomalt)',
   $t$Agente di carica. Un sostituto dello zucchero ipocalorico che dona struttura e stabilità al gelato senza alterarne il profilo aromatico complessivo.$t$, true, 380),
  ('E960',  'Glicosidi steviolici (estratto della stevia)',
   $t$Dolcificante intensivo di origine naturale a 0 calorie. Ha un'eccellente tollerabilità nell'intestino ed è un alimento estremamente sicuro per la salute umana. In gelateria aiuta con la struttura del gelato e la dolcezza dei gusti senza zuccheri e senza zuccheri aggiunti.$t$, true, 390),
  ('E965i', 'Maltitolo',
   $t$È un dolcificante ipocalorico a basso impatto glicemico (inferiore allo zucchero da cucina); se assunto sopra ai 40-50 g può causare effetti lassativi.$t$, true, 400),
  ('E968',  'Eritritolo',
   $t$Dolcificante a 0 calorie in quanto non metabolizzabile; una volta sciolto in bocca lascia una spiccata sensazione di fresco. Utile per il suo apporto dolcificante senza calorie.$t$, true, 410)
on conflict (codice) do nothing;

-- Se una versione precedente di questo script era già stata eseguita, la
-- carragenina aveva la descrizione dell'agar agar: si corregge qui.
update public.additivi
   set nome = 'Carragenina',
       descrizione = $t$Addensante e gelificante naturale estratto dalle alghe rosse; serve a mantenere stabile la struttura del gelato.$t$
 where codice = 'E407'
   and descrizione like 'Gelificante e stabilizzante naturale ottenuto da diverse specie%';
