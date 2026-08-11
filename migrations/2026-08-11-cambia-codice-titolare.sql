-- ============================================================
-- Cambiare il codice del primo amministratore — 2026-08-11
--
-- Serve perché il codice di partenza era scritto dentro un file del progetto,
-- e il repository su GitHub è PUBBLICO: quel codice sarebbe leggibile da
-- chiunque, per sempre. Ed è il codice che crea e toglie tutti gli altri.
--
-- Come si usa: cambia le due parole in MAIUSCOLO qui sotto e lancia. Nient'altro.
-- Il codice nuovo NON va scritto da nessun'altra parte: appena eseguito questo,
-- svuota il riquadro del SQL Editor.
-- ============================================================

update public.staff_codici
   set nome     = 'IL TUO NOME',
       pin_hash = extensions.crypt('IL TUO CODICE NUOVO', extensions.gen_salt('bf')),
       tentativi = 0,
       bloccato_fino = null
 where ruolo = 'admin'
   and nome = 'Titolare';

-- Controllo: deve dire "no".
select 'Il vecchio codice funziona ancora?' as domanda,
       case when exists (
         select 1 from public.staff_codici where pin_hash = extensions.crypt('4071', pin_hash)
       ) then 'SÌ — qualcosa non ha funzionato, riprova' else 'no' end as risposta;
