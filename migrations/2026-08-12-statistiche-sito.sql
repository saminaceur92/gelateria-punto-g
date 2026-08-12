-- ============================================================
-- Statistiche del sito (click e visite) — 2026-08-12
-- Da eseguire su Supabase (SQL Editor) UNA VOLTA.
-- Lo script è IDEMPOTENTE: rieseguirlo non fa danni.
--
-- A cosa serve: dare al titolare, dentro la dashboard che già usa, i pochi
-- numeri su cui può DECIDERE qualcosa — quante persone arrivano, da dove,
-- quante lo contattano, e a che punto si fermano quelle che stanno ordinando
-- una torta. Niente di più: se un numero non cambia una decisione, non si
-- conta.
--
-- ⚠️ Qui NON si salvano dati personali, e non si salvano nemmeno gli eventi
-- singoli: si tengono dei CONTATORI per giorno. La riga "un visitatore, un
-- istante" non esiste mai, nemmeno per un secondo. È la differenza fra un
-- tracciamento anonimizzato dopo e un tracciamento che dati personali non ne
-- ha mai avuti: non c'è niente da anonimizzare, niente da cancellare, niente
-- da difendere. Per questo il sito resta fuori dall'obbligo di consenso e
-- questo tracciamento NON va aggiunto al banner cookie di iubenda.
--
-- Di conseguenza, cose che qui dentro non troverai mai e non vanno aggiunte:
-- l'indirizzo IP (in nessuna forma, nemmeno come impronta), il momento esatto
-- dell'evento, la stringa completa del browser, la query string delle pagine
-- (contiene i token personali dei promemoria), un identificatore di visitatore.
--
-- Sul "momento esatto" serve essere precisi, perché è l'unico punto in cui
-- questo file rischia di mentire a chi lo legge: una data e ora c'è, ed è
-- `aggiornato_il`. Serve a rispondere a "il tracciamento funziona ancora?" e
-- per questo viene salvata TRONCATA ALL'ORA. Il motivo è spiegato sulla
-- colonna: al microsecondo, ogni riga rimasta a conteggio 1 sarebbe di fatto
-- l'orario preciso di un singolo visitatore.
--
-- Conseguenza pratica da tenere a mente leggendo i numeri: si contano i
-- CLICK, non le persone. Chi apre il sito due volte conta due volte, e un
-- "imbuto" delle torte non dice che sono le stesse persone passo dopo passo,
-- dice quante volte ogni passo è stato raggiunto. Per sapere chi è chi
-- servirebbe un identificatore, cioè un cookie: non lo vogliamo.
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. Catalogo degli eventi
-- ─────────────────────────────────────────────────────────────
-- Elenco chiuso di cosa si può contare, con l'etichetta in italiano che poi
-- il titolare legge nella scheda. Sta in tabella e non nel codice del sito
-- per tre motivi: le etichette si correggono senza rifare il deploy, un
-- evento si spegne mettendo `attivo = false`, e soprattutto è la whitelist
-- che impedisce a chi ha letto la chiave pubblica nel bundle di inventarsi
-- nomi di eventi e riempire la tabella di spazzatura.
create table if not exists public.statistiche_eventi (
  chiave    text primary key,                    -- snake_case, <canale>_<posizione>
  etichetta text not null,                       -- come lo legge il titolare
  tipo      text not null check (tipo in ('visita','click')),
  gruppo    text not null check (gruppo in ('visite','contatti','vendita','social','torta','contenuti')),
  ordine    int  not null default 100,           -- posizione nella scheda (l'imbuto delle torte usa questo)
  attivo    boolean not null default true        -- spegnere un evento senza toccare il sito
);


-- ─────────────────────────────────────────────────────────────
-- 2. I numeri
-- ─────────────────────────────────────────────────────────────
-- Una riga per (giorno × evento × pagina × dispositivo × provenienza), con un
-- contatore dentro. In gelateria vuol dire 40-80 righe al giorno: il tetto è
-- strutturale, non dipende dal traffico, e la tabella resta di pochi megabyte
-- anche dopo anni.
--
-- Il giorno è una `date` e basta: l'ora è l'unica dimensione che riavvicina il
-- dato alla persona (tre visite alle 23:40 di martedì più lo scontrino fanno
-- una persona sola) e moltiplicherebbe le righe per 24 senza rispondere a
-- nessuna domanda che un gelataio si faccia davvero.
create table if not exists public.statistiche_sito (
  id            bigserial primary key,
  giorno        date        not null,
  tipo          text        not null check (tipo in ('visita','click')),
  -- La chiave esterna al catalogo è un vincolo di forma, non un vezzo: anche
  -- se qualcuno trovasse una strada per scrivere qui dentro, non può
  -- inventarsi un evento che non esiste.
  evento        text        not null references public.statistiche_eventi(chiave),
  pagina        text        not null default 'altro'
                check (pagina in ('home','allergeni','galleria','consegna','altro')),
  dispositivo   text        not null default 'desktop'
                check (dispositivo in ('mobile','desktop')),
  -- Sui click resta sempre vuota: la provenienza appartiene all'ARRIVO sul
  -- sito, ripeterla su ogni click moltiplicherebbe le righe per otto senza
  -- aggiungere una sola informazione.
  provenienza   text        not null default ''
                check (provenienza in ('','diretto','google','instagram','facebook','maps','qr','interno','altro')),
  conteggio     integer     not null default 0,
  -- Serve solo a capire se il tracciamento è ancora vivo, e per questo si
  -- salva TRONCATO ALL'ORA (vedi `registra_evento`). Non è un dettaglio:
  -- con `now()` pieno, tutte le righe che restano a conteggio 1 — cioè la
  -- maggioranza, in una gelateria di quartiere — conterrebbero l'istante
  -- esatto al microsecondo di quell'unico evento, insieme a pagina,
  -- dispositivo e provenienza. Incrociato con l'orario di una riga in
  -- `ordini`, quello lega una persona alla sua navigazione: è esattamente il
  -- quasi-identificatore che tutto il resto del file è costruito per evitare.
  -- Troncato all'ora la domanda "il tracciamento funziona ancora?" ha la
  -- stessa risposta, e quel filo non esiste.
  aggiornato_il timestamptz not null default date_trunc('hour', now()),
  constraint statistiche_sito_chiave
    unique (giorno, tipo, evento, pagina, dispositivo, provenienza)
);

-- L'indice unico qui sopra è quello che rende l'incremento una sola istruzione
-- atomica (vedi `registra_evento`). Questo secondo indice serve alla lettura:
-- la scheda chiede sempre "gli ultimi N giorni", mai tutto lo storico.
create index if not exists statistiche_sito_giorno_idx on public.statistiche_sito (giorno desc);
-- Di indici non ne servono altri: su una tabella da qualche migliaio di righe
-- ogni indice in più costa alla scrittura e non si fa notare in lettura.


-- ─────────────────────────────────────────────────────────────
-- 3. Chi può fare cosa (RLS)
-- ─────────────────────────────────────────────────────────────
alter table public.statistiche_eventi enable row level security;
alter table public.statistiche_sito   enable row level security;

-- Supabase, di suo, concede tutto sulle tabelle nuove anche al ruolo `anon`,
-- cioè a chiunque abbia la chiave pubblica che sta nel bundle JavaScript del
-- sito. Qui la togliamo a mano: al pubblico questa tabella non si tocca né in
-- lettura né in scrittura.
revoke all on public.statistiche_eventi from anon;
revoke all on public.statistiche_sito   from anon;

-- Il pubblico scrive SOLO passando dalla funzione `registra_evento` più sotto,
-- che è `security definer` e quindi non ha bisogno di nessuna policy. Perché
-- una RPC e non una policy "insert per anon": con l'insert diretto chiunque
-- apra la console del browser sceglie il valore di TUTTE le colonne — data
-- compresa, conteggio compreso — e legge gli errori dei vincoli per capire
-- com'è fatta la tabella. Con la funzione passa quattro stringhe, il resto lo
-- decide il database e gli errori non tornano mai indietro.
-- La lettura è legata a `is_staff()`, non al semplice "sei autenticato", come
-- su tutte le altre tabelle riservate del progetto. La differenza conta: essere
-- autenticati su Supabase e far parte del personale sono due cose diverse, e
-- basterebbe che un domani si aprisse la registrazione (o si aggiungesse un
-- accesso per i clienti) perché "authenticated using (true)" diventi "chiunque
-- si registri legge quanto incassa il negozio". Oggi non succede, ma è una
-- riga che si scrive una volta e regge da sola per sempre.
drop policy if exists "statistiche_eventi_select_staff" on public.statistiche_eventi;
create policy "statistiche_eventi_select_staff" on public.statistiche_eventi
  for select to authenticated using (is_staff());

drop policy if exists "statistiche_sito_select_staff" on public.statistiche_sito;
create policy "statistiche_sito_select_staff" on public.statistiche_sito
  for select to authenticated using (is_staff());

-- Nessuna policy di insert/update/delete, per nessuno: con la RLS accesa
-- "nessuna policy" vuol dire "vietato". Quindi nemmeno lo staff loggato può
-- ritoccare i numeri dalla dashboard, e i conteggi restano quello che sono.


-- ─────────────────────────────────────────────────────────────
-- 4. Il catalogo, riempito
-- ─────────────────────────────────────────────────────────────
-- Regola di nome: <canale>_<posizione>. Non è estetica: la lettura raggruppa
-- i totali di testata con `evento like 'whatsapp\_%'`, quindi il prefisso è
-- struttura.
--
-- Due cose che NON stanno nella chiave perché sono già colonne: la pagina
-- (`foto_aperta` sulla home e su /galleria è lo stesso evento) e
-- desktop/mobile (la voce di menù del telefono e quella del computer sono lo
-- stesso evento).
--
-- ⚠️ Aggiungere un evento nuovo vuol dire fare TRE cose nella stessa modifica:
-- la riga qui sotto, la costante in `src/lib/analytics.js`, e il punto in cui
-- si chiama. Se manca la riga qui, l'evento viene scartato in silenzio e non
-- se ne accorge nessuno per settimane.
insert into public.statistiche_eventi (chiave, etichetta, tipo, gruppo, ordine) values
  -- ── Visite ────────────────────────────────────────────────
  ('pagina_vista',            'Pagina vista',                                 'visita', 'visite',    1),
  ('qr_allergeni',            'QR allergeni inquadrato in gelateria',         'visita', 'visite',    2),

  -- ── Come ti contattano ────────────────────────────────────
  ('whatsapp_fab',            'WhatsApp — bottone tondo sempre visibile',     'click',  'contatti',  1),
  ('whatsapp_contatti',       'WhatsApp — sezione Contatti',                  'click',  'contatti',  2),
  ('whatsapp_footer',         'WhatsApp — piè di pagina',                     'click',  'contatti',  3),
  ('whatsapp_consegna',       'WhatsApp — pagina Consegna a domicilio',       'click',  'contatti',  4),
  ('whatsapp_galleria',       'WhatsApp — pagina Galleria',                   'click',  'contatti',  5),
  ('whatsapp_post_ordine',    'WhatsApp — dopo l''ordine della torta',        'click',  'contatti',  6),
  ('telefono',                'Telefono — tocca per chiamare',                'click',  'contatti',  7),
  ('mappa_contatti',          'Come arrivare — sezione Contatti',             'click',  'contatti',  8),
  ('mappa_footer',            'Come arrivare — piè di pagina',                'click',  'contatti',  9),

  -- ── Canali di vendita (click in uscita) ───────────────────
  ('deliveroo_consegna',      'Deliveroo — pagina Consegna',                  'click',  'vendita',   1),
  ('deliveroo_galleria',      'Deliveroo — pagina Galleria',                  'click',  'vendita',   2),
  ('glovo_consegna',          'Glovo — pagina Consegna',                      'click',  'vendita',   3),
  ('glovo_galleria',          'Glovo — pagina Galleria',                      'click',  'vendita',   4),

  -- ── Social ────────────────────────────────────────────────
  ('instagram_contatti',      'Instagram — sezione Contatti',                 'click',  'social',    1),
  ('instagram_footer',        'Instagram — piè di pagina',                    'click',  'social',    2),
  ('instagram_galleria',      'Instagram — pagina Galleria',                  'click',  'social',    3),
  ('instagram_post_ordine',   'Instagram — dopo l''ordine',                   'click',  'social',    4),
  ('facebook_footer',         'Facebook — piè di pagina',                     'click',  'social',    5),
  ('facebook_galleria',       'Facebook — pagina Galleria',                   'click',  'social',    6),
  ('facebook_post_ordine',    'Facebook — dopo l''ordine',                    'click',  'social',    7),

  -- ── Torte: i passi del configuratore (ordine 1→13) ────────
  -- Questo è l'imbuto, ed è la ragione per cui `ordine` esiste. Si conta la
  -- CHIAVE del passo che entra in scena, mai il numero del passo: i passi
  -- effettivi sono 11, 12 o 13 a seconda della torta (base e crumble
  -- compaiono solo a certe condizioni) e chi sceglie una torta già composta
  -- salta dritto alla scritta. Contando i click su "Avanti", quel percorso
  -- sparirebbe dai numeri.
  ('torta_passo_tipo',        '1. Tipo di torta',                             'click',  'torta',     1),
  ('torta_passo_dimensione',  '2. Dimensione',                                'click',  'torta',     2),
  ('torta_passo_allergie',    '3. Allergie',                                  'click',  'torta',     3),
  ('torta_passo_forma',       '4. Forma',                                     'click',  'torta',     4),
  ('torta_passo_base',        '5. Base',                                      'click',  'torta',     5),
  ('torta_passo_crumble',     '6. Crumble',                                   'click',  'torta',     6),
  ('torta_passo_gusti',       '7. Gusti',                                     'click',  'torta',     7),
  ('torta_passo_farcitura',   '8. Farcitura',                                 'click',  'torta',     8),
  ('torta_passo_copertura',   '9. Copertura',                                 'click',  'torta',     9),
  ('torta_passo_decorazione', '10. Decorazione',                              'click',  'torta',    10),
  ('torta_passo_scritta',     '11. Scritta',                                  'click',  'torta',    11),
  ('torta_passo_dati',        '12. Dati e consegna',                          'click',  'torta',    12),
  ('torta_passo_riepilogo',   '13. Riepilogo',                                'click',  'torta',    13),

  -- ── Torte: da dove aprono il configuratore (100+) ─────────
  -- Le tre diete restano separate di proposito: dicono cosa comprare.
  ('torta_apre_hero',         'Crea la tua torta — dalla prima schermata',    'click',  'torta',   101),
  ('torta_apre_navbar',       'Crea la tua torta — dal menù in alto',         'click',  'torta',   102),
  ('torta_apre_menu_mobile',  'Crea la tua torta — dal menù del telefono',    'click',  'torta',   103),
  ('torta_apre_servizi',      'Crea la tua torta — dalla scheda Servizi',     'click',  'torta',   104),
  ('torta_apre_cta',          'Crea la tua torta — dal riquadro "Inizia ora"','click',  'torta',   105),
  ('torta_apre_senza_glutine','Parte da "Senza glutine"',                     'click',  'torta',   106),
  ('torta_apre_senza_lattosio','Parte da "Senza lattosio"',                   'click',  'torta',   107),
  ('torta_apre_vegana',       'Parte da "Vegana"',                            'click',  'torta',   108),
  ('torta_apre_promemoria',   'Aperta dal promemoria compleanno',             'click',  'torta',   109),

  -- ── Torte: scelte ed esito (200+) ─────────────────────────
  ('torta_sorprendimi',       'Ha usato "Sorprendimi!"',                      'click',  'torta',   201),
  ('torta_consigliata',       'Ha scelto una torta già composta',             'click',  'torta',   202),
  ('torta_allergeni_aperti',  'Ha aperto l''elenco allergeni',                'click',  'torta',   203),
  ('torta_ritiro',            'Sceglie il ritiro in gelateria',               'click',  'torta',   204),
  ('torta_domicilio',         'Sceglie la consegna a domicilio',              'click',  'torta',   205),
  ('torta_extra_visti',       'Ha visto la proposta di extra',                'click',  'torta',   206),
  ('torta_extra_aggiunti',    'Ha aggiunto gli extra',                        'click',  'torta',   207),
  ('torta_extra_rifiutati',   'Ha rifiutato gli extra',                       'click',  'torta',   208),
  -- Del codice sconto si conta solo se è stato accettato o no: il codice in sé
  -- NON si salva mai, perché alcuni sono nominativi.
  ('torta_sconto_ok',         'Codice sconto accettato',                      'click',  'torta',   209),
  ('torta_sconto_ko',         'Codice sconto rifiutato',                      'click',  'torta',   210),
  ('torta_checkout_avviato',  'Mandato al pagamento',                         'click',  'torta',   211),
  ('torta_checkout_errore',   'Errore nell''avvio del pagamento',             'click',  'torta',   212),
  ('torta_pagamento_ok',      'Tornato dal pagamento: riuscito',              'click',  'torta',   213),
  ('torta_pagamento_annullato','Tornato dal pagamento: annullato',            'click',  'torta',   214),
  -- Non si porta dietro il passo raggiunto: l'imbuto dei 13 passi dice già
  -- dove si sono fermati, e portarsi dietro quel dettaglio vorrebbe dire
  -- aggiungere una dimensione alla chiave e moltiplicare le righe.
  ('torta_chiusa',            'Ha chiuso il configuratore',                   'click',  'torta',   215),

  -- ── Contenuti ─────────────────────────────────────────────
  ('nav_gusti',               'Menù — Gusti',                                 'click',  'contenuti', 1),
  ('nav_torte',               'Menù — Torte',                                 'click',  'contenuti', 2),
  ('nav_consegna',            'Menù — Consegna',                              'click',  'contenuti', 3),
  ('nav_galleria',            'Menù — Galleria',                              'click',  'contenuti', 4),
  ('nav_contatti',            'Menù — Contatti',                              'click',  'contenuti', 5),
  ('hero_scopri_gusti',       'Scopri i gusti (prima schermata)',             'click',  'contenuti', 6),
  ('servizio_consegna',       'Scheda Servizi — Consegna',                    'click',  'contenuti', 7),
  ('servizio_galleria',       'Scheda Servizi — Galleria',                    'click',  'contenuti', 8),
  ('servizio_gusti',          'Scheda Servizi — Gusti',                       'click',  'contenuti', 9),
  ('galleria_vedi_tutte',     'Vedi tutte le foto',                           'click',  'contenuti',10),
  ('foto_aperta',             'Ha ingrandito una foto',                       'click',  'contenuti',11),
  ('preferisco_scrivere',     'Preferisco scrivere (invece della torta online)','click','contenuti',12),
  ('allergeni_navbar',        'Allergeni — dal menù',                         'click',  'contenuti',13),
  ('allergeni_footer',        'Allergeni — piè di pagina',                    'click',  'contenuti',14),
  ('allergeni_pdf',           'Scaricato il PDF allergeni',                   'click',  'contenuti',15)
on conflict (chiave) do update
  set etichetta = excluded.etichetta,
      tipo      = excluded.tipo,
      gruppo    = excluded.gruppo,
      ordine    = excluded.ordine;
-- `attivo` di proposito NON viene toccato: se il titolare ha spento un evento,
-- rieseguire questo file non deve riaccenderlo alle sue spalle.


-- ─────────────────────────────────────────────────────────────
-- 5. Scrittura: la chiama il sito, una riga per click
-- ─────────────────────────────────────────────────────────────
-- ⚠️ Questa funzione NON legge l'indirizzo di chi chiama e non deve mai
-- farlo: niente `inet_client_addr()`, niente header della richiesta, niente
-- `now()` salvato come momento dell'evento. È un vincolo del progetto, non un
-- dettaglio implementativo. L'IP arriva a Supabase a livello di rete — è
-- inevitabile — ma qui dentro non entra e in tabella non esiste una colonna
-- che possa ospitarlo.
--
-- Non ritorna niente e non solleva mai un errore, nemmeno quando scarta la
-- chiamata: chi prova a sondare la tabella non riceve nessun segnale, e un
-- refuso in una chiave sul sito non fa comparire un errore rosso al cliente.
create or replace function public.registra_evento(
  p_evento      text,
  p_pagina      text,
  p_dispositivo text,
  p_provenienza text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tipo   text;
  v_pagina text;
  v_disp   text;
  v_prov   text;
begin
  -- Primo filtro, ed è quello che regge tutto: se l'evento non è a catalogo
  -- (o è stato spento) non succede niente. Un bot non può creare eventi
  -- nuovi: al massimo alza un contatore che esisteva già.
  select tipo into v_tipo
    from public.statistiche_eventi
   where chiave = p_evento and attivo;
  if not found then
    return;
  end if;

  -- Gli altri tre parametri si normalizzano contro le stesse liste dei
  -- `check` della tabella. Così un client malandrino non fa mai fallire un
  -- vincolo (e quindi non impara niente dagli errori): il valore fuori
  -- elenco diventa semplicemente "altro".
  v_pagina := case when p_pagina in ('home','allergeni','galleria','consegna')
                   then p_pagina else 'altro' end;
  v_disp   := case when p_dispositivo = 'mobile' then 'mobile' else 'desktop' end;
  v_prov   := case when p_provenienza in ('diretto','google','instagram','facebook','maps','qr','interno','altro')
                   then p_provenienza else '' end;

  -- La provenienza vale solo per l'arrivo sul sito: sui click si azzera.
  if v_tipo = 'click' then
    v_prov := '';
  end if;

  -- Il giorno lo decide il database, con il fuso di Roma. Mai `current_date`
  -- (su Supabase è UTC: d'estate la gelateria chiude tardi e i click dopo
  -- mezzanotte finirebbero nel giorno prima, rendendo il grafico
  -- inspiegabile) e mai una data mandata dal browser (orologio non fidato e
  -- falsificabile in due righe di console).
  --
  -- L'incremento è una sola istruzione: due click nello stesso istante non si
  -- sovrascrivono a vicenda. Non spostare mai la somma nel client.
  -- Il valore iniziale è 1 e non 0, altrimenti il primo evento di ogni
  -- giorno si perderebbe.
  --
  -- Il `where` finale è il tetto anti-gonfiaggio, e va letto per quello che è:
  -- limita una RIGA a 3.000, non un evento a 3.000. La differenza è grossa e
  -- va scritta, perché la chiave della riga contiene pagina, dispositivo e
  -- provenienza, che li sceglie chi chiama. Il conto vero, con la chiave
  -- pubblica presa dal bundle: `pagina_vista` è di tipo 'visita', quindi la
  -- provenienza NON viene azzerata qui sopra, e fa 5 pagine × 2 dispositivi ×
  -- 9 provenienze = 90 righe, cioè fino a 270.000 "visite" in un giorno.
  --
  -- Non è una svista lasciata lì: è il compromesso. Il freno vero è un altro
  -- ed è più a monte — il catalogo con la foreign key, che impedisce di
  -- inventare nomi di evento. Questo tetto serve solo a tenere il danno
  -- limitato e visibile: 270.000 visite in un giorno per una gelateria di
  -- Carpi non è un numero credibile, è un'anomalia che salta all'occhio nel
  -- grafico. Un tetto per (giorno, evento) vorrebbe dire una sottoquery a
  -- ogni click per un rischio che, senza un motivo per accanirsi su una
  -- gelateria, resta teorico.
  insert into public.statistiche_sito (giorno, tipo, evento, pagina, dispositivo, provenienza, conteggio)
  values ((now() at time zone 'Europe/Rome')::date, v_tipo, p_evento, v_pagina, v_disp, v_prov, 1)
  on conflict on constraint statistiche_sito_chiave do update
     set conteggio     = statistiche_sito.conteggio + 1,
         -- Troncato all'ora: vedi il commento sulla colonna. Mai `now()` pieno.
         aggiornato_il = date_trunc('hour', now())
   where statistiche_sito.conteggio < 3000;
end $$;

-- Il sito pubblico deve poterla chiamare: è il tracciamento stesso.
grant execute on function public.registra_evento(text, text, text, text) to anon, authenticated;


-- ─────────────────────────────────────────────────────────────
-- 6. Lettura: la chiama SOLO la scheda Statistiche della dashboard
-- ─────────────────────────────────────────────────────────────
-- Restituisce già tutto pronto in un colpo solo, così la scheda non deve fare
-- conti: sintesi con confronto sul periodo precedente, andamento giorno per
-- giorno, totali per evento, provenienze e pagine.
create or replace function public.statistiche_riepilogo(p_giorni int)
returns json
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  -- Solo quattro periodi possibili. Non è pigrizia: impedisce che qualcuno
  -- chieda dieci anni di storico in una volta, e rende la funzione
  -- prevedibile. Un gelataio non ha bisogno di scegliere il 14 marzo.
  v_giorni int  := case when p_giorni in (1, 7, 30, 90) then p_giorni else 30 end;
  -- Stesso fuso della scrittura, se no gli estremi del periodo non
  -- combaciano con i giorni salvati e il primo/ultimo giorno risulta a metà.
  v_oggi   date := (now() at time zone 'Europe/Rome')::date;
  v_da     date;
  v_prima  date;
  -- A 90 giorni le barre diventano illeggibili: si raggruppa per settimana.
  v_passo  int;
  v_primo  date;
  v_out    json;
begin
  -- ⚠️ Questa funzione è `security definer`: dentro di lei la RLS delle due
  -- tabelle NON viene applicata. Vuol dire che le policy scritte più sopra qui
  -- non proteggono niente, e l'unica difesa sarebbe il `grant` al ruolo
  -- `authenticated`. Troppo poco: "autenticato" non vuol dire "del personale".
  -- Il controllo va rifatto qui a mano, ed è questa riga — non il grant — a
  -- decidere chi vede i numeri del negozio.
  -- `is not true` e non `not is_staff()`: sono diversi quando la funzione
  -- restituisce NULL invece di false. Oggi non capita — `is_staff()` è scritta
  -- con `exists`, che torna sempre true o false — ma `not NULL` vale NULL, e
  -- un `if NULL then` in plpgsql non entra nel ramo: la funzione tirerebbe
  -- dritto e restituirebbe i numeri del negozio a chi non doveva vederli.
  -- Fail-open per una parola. Scritta così regge anche se un domani qualcuno
  -- riscrive `is_staff()` nel modo più ovvio (un `select role in (...) from
  -- profiles`, che per un utente senza riga torna proprio NULL).
  if is_staff() is not true then
    return null;
  end if;

  v_da    := v_oggi - (v_giorni - 1);
  v_prima := v_da - v_giorni;                                    -- periodo precedente di pari durata
  v_passo := case when v_giorni >= 90 then 7 else 1 end;
  v_primo := case when v_passo = 7 then (date_trunc('week', v_da::timestamp))::date else v_da end;

  with
  -- Due righe sempre presenti, anche se non c'è un solo dato: la scheda deve
  -- poter scrivere "0" e "−100%", non rompersi su un valore mancante.
  periodi(periodo, dal, al) as (
    values ('ora', v_da, v_oggi), ('prima', v_prima, v_da - 1)
  ),
  sintesi as (
    select p.periodo,
           coalesce(sum(s.conteggio) filter (where s.evento = 'pagina_vista'), 0)        as visite,
           -- "Ti hanno contattato": tutti i WhatsApp più il telefono. Il
           -- prefisso nella chiave serve esattamente a questo.
           coalesce(sum(s.conteggio) filter (where s.evento like 'whatsapp\_%'
                                                or s.evento = 'telefono'), 0)            as contatti,
           coalesce(sum(s.conteggio) filter (where s.evento like 'mappa\_%'), 0)         as mappe,
           coalesce(sum(s.conteggio) filter (where s.evento = 'torta_pagamento_ok'), 0)  as torte_pagate,
           coalesce(sum(s.conteggio) filter (where s.dispositivo = 'mobile'), 0)         as da_telefono,
           coalesce(sum(s.conteggio), 0)                                                 as eventi
      from periodi p
      left join public.statistiche_sito s on s.giorno between p.dal and p.al
     group by p.periodo
  ),
  -- I giorni senza traffico non hanno una riga in tabella: senza questa
  -- serie il grafico salterebbe i buchi e mentirebbe sull'andamento.
  scala as (
    select g::date as bucket
      from generate_series(v_primo, v_oggi, make_interval(days => v_passo)) g
  ),
  andamento as (
    select b.bucket,
           coalesce(sum(s.conteggio) filter (where s.evento = 'pagina_vista'), 0)  as visite,
           coalesce(sum(s.conteggio) filter (where s.evento like 'whatsapp\_%'
                                                or s.evento = 'telefono'), 0)      as contatti
      from scala b
      left join public.statistiche_sito s
             on s.giorno >= b.bucket
            and s.giorno <  b.bucket + v_passo
            and s.giorno between v_da and v_oggi    -- la prima settimana può iniziare prima del periodo
     group by b.bucket
  ),
  -- Si parte dal catalogo e non dai dati: un evento mai successo deve
  -- comparire con 0, altrimenti dall'imbuto sparirebbe proprio il passo dove
  -- la gente si ferma, che è l'informazione che vale il progetto.
  eventi as (
    select e.chiave, e.etichetta, e.gruppo, e.ordine,
           coalesce(sum(s.conteggio), 0) as conteggio
      from public.statistiche_eventi e
      left join public.statistiche_sito s
             on s.evento = e.chiave
            and s.giorno between v_da and v_oggi
     where e.attivo
     group by e.chiave, e.etichetta, e.gruppo, e.ordine
  ),
  -- Da dove arrivano: solo gli arrivi sul sito, e senza i rimbalzi interni
  -- fra una pagina e l'altra, che non sono una provenienza.
  provenienze as (
    select s.provenienza, sum(s.conteggio) as conteggio
      from public.statistiche_sito s
     where s.giorno between v_da and v_oggi
       and s.evento = 'pagina_vista'
       and s.provenienza not in ('', 'interno')
     group by s.provenienza
  ),
  pagine as (
    select s.pagina, sum(s.conteggio) as conteggio
      from public.statistiche_sito s
     where s.giorno between v_da and v_oggi
       and s.evento = 'pagina_vista'
     group by s.pagina
  )
  select json_build_object(
    'giorni', v_giorni,
    'dal',    to_char(v_da,   'YYYY-MM-DD'),
    'al',     to_char(v_oggi, 'YYYY-MM-DD'),
    'passo',  case when v_passo = 7 then 'settimana' else 'giorno' end,
    -- Quando è arrivato l'ultimo evento in assoluto: serve a capire a colpo
    -- d'occhio se il tracciamento è vivo o si è rotto qualcosa.
    'ultimo_evento', (select max(aggiornato_il) from public.statistiche_sito),
    'sintesi', (
      select json_object_agg(periodo, json_build_object(
               'visite',       visite,
               'contatti',     contatti,
               'mappe',        mappe,
               'torte_pagate', torte_pagate,
               'da_telefono',  da_telefono,
               'eventi',       eventi))
        from sintesi
    ),
    'andamento', coalesce((
      select json_agg(json_build_object(
               'giorno',   to_char(bucket, 'YYYY-MM-DD'),
               'visite',   visite,
               'contatti', contatti) order by bucket)
        from andamento), '[]'::json),
    'eventi', coalesce((
      select json_agg(json_build_object(
               'chiave',    chiave,
               'etichetta', etichetta,
               'gruppo',    gruppo,
               'ordine',    ordine,
               'conteggio', conteggio) order by gruppo, ordine, chiave)
        from eventi), '[]'::json),
    'provenienze', coalesce((
      select json_agg(json_build_object('voce', provenienza, 'conteggio', conteggio)
                      order by conteggio desc)
        from provenienze), '[]'::json),
    'pagine', coalesce((
      select json_agg(json_build_object('voce', pagina, 'conteggio', conteggio)
                      order by conteggio desc)
        from pagine), '[]'::json)
  ) into v_out;

  return v_out;
end $$;

-- ⚠️ Queste tre righe sono il punto in cui si vince o si perde tutto il
-- lavoro fatto sopra. In Postgres una funzione nasce eseguibile da CHIUNQUE:
-- senza il `revoke from public`, la scheda Statistiche sarebbe leggibile con
-- la chiave pubblica che sta nel bundle del sito, e i numeri del negozio
-- (quanti ordini, quanti contatti) li scaricherebbe chiunque passi di lì.
-- La verifica è in fondo al file: deve dire `false`.
revoke execute on function public.statistiche_riepilogo(int) from public;
revoke execute on function public.statistiche_riepilogo(int) from anon;
grant  execute on function public.statistiche_riepilogo(int) to authenticated;


-- ─────────────────────────────────────────────────────────────
-- 7. Pulizia, fra parecchio tempo
-- ─────────────────────────────────────────────────────────────
-- Nessun lavoro programmato: la tabella non cresce abbastanza da meritarne
-- uno, e un job in più è una cosa in più che si può rompere. Se fra due anni
-- qualcuno volesse alleggerirla, questa è la riga da lanciare a mano — la
-- lascio scritta qui perché fra due anni nessuno si ricorderà com'era fatta
-- la tabella:
--
--   delete from public.statistiche_sito where giorno < current_date - interval '24 months';


-- ─────────────────────────────────────────────────────────────
-- 8. Controllo finale
-- ─────────────────────────────────────────────────────────────
select 'Eventi a catalogo (devono essere 74)' as cosa,
       (select count(*)::text from public.statistiche_eventi) as valore
union all
select 'Di cui accesi',
       (select count(*)::text from public.statistiche_eventi where attivo)
union all
select 'Righe di conteggio già in tabella',
       (select count(*)::text from public.statistiche_sito)
union all
select 'Oggi, col fuso di Roma',
       ((now() at time zone 'Europe/Rome')::date)::text
union all
-- Le tre prove che contano: il pubblico non deve poter né leggere la tabella
-- né chiamare la funzione di lettura, ma deve poter chiamare quella di
-- scrittura. Tre "false, false, true" e la migrazione è a posto.
select 'Il pubblico può LEGGERE la tabella? (deve dire false)',
       has_table_privilege('anon', 'public.statistiche_sito', 'select')::text
union all
select 'Il pubblico può LEGGERE i riepiloghi? (deve dire false)',
       has_function_privilege('anon', 'public.statistiche_riepilogo(int)', 'execute')::text
union all
select 'Il pubblico può REGISTRARE un evento? (deve dire true)',
       has_function_privilege('anon', 'public.registra_evento(text,text,text,text)', 'execute')::text;
