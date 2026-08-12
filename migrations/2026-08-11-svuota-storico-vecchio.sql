-- ============================================================
-- Svuotare il vecchio storico attività — 2026-08-11
-- Da eseguire su Supabase (SQL Editor).
--
-- Perché serve un secondo file: nella migrazione dei codici avevo provato a
-- svuotare lo storico vecchio, ma avevo tirato a indovinare il nome della
-- tabella (staff_activity / attivita_staff) e quella giusta si chiama
-- `activity_log`. Risultato: non ha cancellato niente, e nella scheda
-- "Accessi staff" si vedono ancora gli accessi da fine giugno.
--
-- ⚠️ È IRREVERSIBILE. Cosa si perde: 258 righe circa, dal 26 giugno a oggi,
-- quasi tutte "Accesso effettuato" con l'indirizzo email — cioè proprio quello
-- che avevi detto non servire. Quello che conta da qui in avanti sta nella
-- tabella nuova `attivita`, dove ogni riga porta il NOME della persona che ha
-- firmato col proprio codice.
--
-- Se preferisci tenerlo ancora un po', non eseguire: non dà fastidio a nulla.
-- ============================================================

-- Quante righe stai per cancellare (guarda prima di lanciare il resto).
select count(*) as righe_che_spariscono,
       min(created_at)::date as dalla_data,
       max(created_at)::date as fino_a
  from public.activity_log;

delete from public.activity_log;

-- Controllo: deve dire 0.
select count(*) as righe_rimaste_nel_vecchio_storico from public.activity_log;
