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
-- NESSUN CONTENUTO PRECARICATO — è voluto.
--
-- Una prima versione di questo script inseriva una ventina di parole
-- (crumble, biscotti, pan di spagna, frutta a guscio…) scelte guardando i
-- vostri testi degli ingredienti. È stato tolto: decidere quali parole sono
-- allergene non è una scelta da fare al posto dei titolari, nemmeno quando
-- sembra ovvia. Il quaderno deve continuare a evidenziare ESATTAMENTE quello
-- che evidenziava prima, e tutto ciò che si aggiunge lo si aggiunge dalla
-- scheda "Parole in grassetto" del gestionale.
--
-- Quindi: dopo questo script la scheda è VUOTA e il quaderno esce identico a
-- prima. Le righe si aggiungono a mano, dal gestionale, una alla volta.
--
-- (Se sul vostro database sono rimaste le righe della prima versione, sono
-- tutte spente e non hanno effetto: si tolgono dal gestionale col cestino,
-- oppure eseguendo migrations/2026-08-25-parole-evidenza-svuota.sql.)
-- ============================================================


-- Controllo finale: quante ne sono accese, divise per tipo.
select tipo,
       count(*) filter (where attivo)     as accese,
       count(*) filter (where not attivo) as spente
  from public.parole_evidenza
 group by tipo
 order by tipo;
