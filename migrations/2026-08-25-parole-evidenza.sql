-- ============================================================
-- Parole in grassetto nel quaderno allergeni — 2026-08-25
-- Da eseguire su Supabase (progetto Gelateria-punto-gi) UNA VOLTA,
-- dal SQL Editor. Lo script è IDEMPOTENTE: rieseguirlo non fa danni.
--
-- A cosa serve: nel quaderno degli allergeni le parole che indicano un
-- allergene escono in GRASSETTO E SOTTOLINEATO dentro la lista ingredienti.
-- Finora l'elenco di quelle parole era scritto dentro al codice del sito:
-- per aggiungerne una serviva un intervento dello sviluppatore.
--
-- Da adesso c'è la scheda "Parole in grassetto" nel gestionale: i titolari
-- aggiungono le parole che mancano (crumble, biscotti, cialde…) da soli.
--
-- COME FUNZIONA IL CONTO:
--   nucleo (nel codice) + parole di questa tabella = parole in grassetto
--
-- Il "nucleo" sono le ~55 parole di legge già riconosciute (latte, panna,
-- uova, soia, frumento, nocciole, frutta a guscio, base bianca…): stanno in
-- src/lib/evidenza.js e NON si possono spegnere da qui, per nessuna via —
-- né cancellando righe, né con un'eccezione, né svuotando la tabella.
--
-- Per essere precisi su cosa vuol dire: sui 44 gusti di oggi il quaderno
-- evidenzia 204 parole. Se questa tabella sparisse del tutto ne resterebbero
-- 181, cioè quelle del nucleo (le 23 che si perderebbero sono le aggiunte
-- fatte da qui: crumble, biscotti, cialde, pan di spagna, lecitina di soia…).
-- Resterebbe comunque sopra alle 159 di prima di questa modifica. Il punto è
-- che il pavimento del nucleo è garantito: un documento di sicurezza non deve
-- poter scendere sotto per colpa di una configurazione sbagliata.
--
-- Questa tabella quindi SOMMA. Le due colonne che contano:
--   tipo = 'evidenzia'  -> la parola va in grassetto dovunque compaia
--   tipo = 'eccezione'  -> questa FRASE non va in grassetto
--                          (es. "farina di riso" non è glutine)
--
-- Le eccezioni devono essere di almeno due parole: così è impossibile
-- scrivere "latte = eccezione" e togliere in un colpo solo il grassetto a
-- 37 righe del quaderno. Il vincolo è nel database, non solo nella schermata.
--
-- Finché non esegui questo script il sito NON si rompe: la tabella è
-- opzionale e il quaderno si genera col solo nucleo.
-- ============================================================

create table if not exists public.parole_evidenza (
  id         uuid primary key default gen_random_uuid(),
  parola     text not null,
  tipo       text not null default 'evidenzia',
  allergene  text default '',
  nota       text default '',
  attivo     boolean not null default true,
  ordine     integer not null default 100,
  constraint parole_evidenza_tipo_valido
    check (tipo in ('evidenzia', 'eccezione')),
  -- Un'eccezione di una parola sola spegnerebbe quell'allergene in tutto il
  -- quaderno: qui si pretende che ne contenga almeno due.
  -- `[[:alpha:]]` invece di `[A-Za-zÀ-ÿ]`: l'intervallo con le lettere
  -- accentate Postgres non lo accetta ("invalid character range"), la classe
  -- POSIX sì e per di più segue la lingua del database.
  constraint parole_evidenza_eccezione_di_due_parole
    check (tipo <> 'eccezione' or parola ~ '[[:alpha:]]+[^[:alpha:]]+[[:alpha:]]+')
);

comment on table  public.parole_evidenza     is 'Parole/frasi da mettere in grassetto+sottolineato nelle liste ingredienti del quaderno allergeni. Si somma al nucleo cablato in src/lib/evidenza.js.';
comment on column public.parole_evidenza.tipo      is 'evidenzia = va in grassetto | eccezione = questa frase NON va in grassetto';
comment on column public.parole_evidenza.allergene is 'a quale dei 7 allergeni si riferisce: serve solo a ritrovarsi nell''elenco';
comment on column public.parole_evidenza.nota      is 'promemoria per chi compila, non finisce nel PDF';

alter table public.parole_evidenza enable row level security;

-- Lettura pubblica come le altre tabelle di contenuto: non c'è nulla di
-- riservato e il quaderno si genera dal browser.
drop policy if exists "parole_evidenza_select_public" on public.parole_evidenza;
create policy "parole_evidenza_select_public" on public.parole_evidenza
  for select using (true);

drop policy if exists "parole_evidenza_write_auth" on public.parole_evidenza;
create policy "parole_evidenza_write_auth" on public.parole_evidenza
  for all to authenticated using (true) with check (true);


-- ============================================================
-- Contenuto iniziale.
--
-- Sono le parole trovate NEI VOSTRI TESTI degli ingredienti che indicano un
-- allergene ma che il programma non riconosceva. Le prime sono già accese
-- perché sono prodotti da forno, quindi farina, quindi glutine, comunque
-- siano fatti. Le ultime sono SPENTE apposta: dipendono dalla ricetta e le
-- deve confermare il laboratorio prima di accenderle dal gestionale.
--
-- NB: "frutta a guscio", "siero di latte", "anidride solforosa" e
-- "base bianca" non stanno qui: sono già nel nucleo, nel codice.
-- ============================================================

insert into public.parole_evidenza (parola, tipo, allergene, nota, attivo, ordine)
select v.parola, v.tipo, v.allergene, v.nota, v.attivo, v.ordine
  from (values
    -- ── da evidenziare, accese ──────────────────────────────
    ('crumble',      'evidenzia', 'Glutine', 'Biscotto sbriciolato: contiene farina.',            true,  10),
    ('biscotti',     'evidenzia', 'Glutine', '',                                                  true,  20),
    ('biscotto',     'evidenzia', 'Glutine', '',                                                  true,  30),
    ('cialde',       'evidenzia', 'Glutine', '',                                                  true,  40),
    ('cialda',       'evidenzia', 'Glutine', '',                                                  true,  50),
    ('pan di spagna','evidenzia', 'Glutine', 'Farina e uova: si cerca come frase intera.',         true,  60),
    ('frolla',       'evidenzia', 'Glutine', '',                                                  true,  70),
    ('cannoli',      'evidenzia', 'Glutine', '',                                                  true,  80),
    ('cannolo',      'evidenzia', 'Glutine', '',                                                  true,  90),
    ('tartellette',  'evidenzia', 'Glutine', '',                                                  true, 100),
    ('lecitina di soia', 'evidenzia', 'Soia', 'Come frase: la lecitina da sola può essere di girasole.', true, 110),

    -- ── eccezioni: queste frasi NON vanno in grassetto ──────
    ('farina di riso',       'eccezione', 'Glutine', 'Senza glutine: è nella Base Vegan.',    true, 200),
    ('farina di mais',       'eccezione', 'Glutine', 'Senza glutine.',                        true, 210),
    ('amido di mais',        'eccezione', 'Glutine', 'Senza glutine.',                        true, 220),
    ('cereali senza glutine','eccezione', 'Glutine', 'È scritto nel crumble ai cereali.',      true, 230),

    -- ── spente: da confermare col laboratorio prima di usarle ──
    ('farina',   'evidenzia', 'Glutine',        'SPENTA. Accendila solo se usate farine di grano: esistono anche farine senza glutine (riso, mais), per quelle ci sono già le eccezioni qui sopra.', false, 300),
    ('amido',    'evidenzia', 'Glutine',        'SPENTA. L''amido può essere di mais (senza glutine) o di frumento.',                    false, 310),
    ('cereali',  'evidenzia', 'Glutine',        'SPENTA. Solo i cereali CON glutine sono allergene.',                                    false, 320),
    ('kikere',   'evidenzia', 'Glutine',        'SPENTA. Compare nei Pasticcini Semifreddo: accendila se la ricetta ha farina.',          false, 330),
    ('bavaresi', 'evidenzia', 'Latte',          'SPENTA. Da confermare: dipende da come le fate.',                                       false, 340),
    ('lecitina', 'evidenzia', 'Soia',           'SPENTA. Da sola può essere di girasole: meglio la frase "lecitina di soia", già accesa.', false, 350)
  ) as v(parola, tipo, allergene, nota, attivo, ordine)
-- Il confronto è sulla SOLA parola, non sulla coppia (parola, tipo): se in
-- gestionale una riga viene spostata da "eccezione" a "evidenzia" (o
-- viceversa), rieseguire lo script non deve ricrearne una seconda copia col
-- tipo di partenza — si ritroverebbero due righe contraddittorie sulla stessa
-- parola, e l'eccezione avrebbe la meglio.
 where not exists (
   select 1 from public.parole_evidenza p
    where lower(p.parola) = lower(v.parola)
 );


-- Controllo finale: quante ne sono accese, divise per tipo.
select tipo,
       count(*) filter (where attivo)     as accese,
       count(*) filter (where not attivo) as spente
  from public.parole_evidenza
 group by tipo
 order by tipo;
