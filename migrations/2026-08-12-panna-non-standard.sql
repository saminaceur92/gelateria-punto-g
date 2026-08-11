-- ============================================================
-- La panna torna una SCELTA, non uno standard — 2026-08-12
-- Da eseguire su Supabase (SQL Editor).
--
-- Ieri (migrazione "gallery-ordine-e-panna-standard") ogni torta era uscita
-- con due file di ciuffi di serie, e le due decorazioni di panna erano state
-- spente. Lucia: la panna la deve avere solo chi la sceglie — e chi sceglie
-- una copertura di panna col sac-à-poche ha sul bordo di sopra UNA fila di
-- ciuffi grossi il doppio, non due file.
--
-- Qui si riaccendono le due decorazioni, col loro prezzo di prima (2 €).
-- ============================================================

update public.decorazioni
   set attivo = true,
       supplemento = 2
 where id in ('panna-deco', 'panna-colorata');

-- Controllo finale: devono uscire tutte e due, attive e a 2 €.
select id, nome, attivo, supplemento, ordine
  from public.decorazioni
 where id in ('panna-deco', 'panna-colorata')
 order by ordine;
