-- ============================================================
-- Allergeni gestibili sui componenti torta — 2026-07-12
-- Finora gli allergeni di basi/farciture/coperture erano cablati nel codice
-- (e topping/tipi non ne avevano). Aggiungiamo una colonna `allergeni` (testo,
-- nomi separati da virgola come nella scheda "Gusti e allergeni") a tutte e 5 le
-- tabelle e vi copiamo i valori attuali, così sono modificabili dalla dashboard
-- e alimentano l'ingrigimento del configuratore.
-- Da eseguire su Supabase UNA VOLTA, PRIMA del deploy del codice.
-- ============================================================

alter table public.basi         add column if not exists allergeni text;
alter table public.farciture    add column if not exists allergeni text;
alter table public.coperture    add column if not exists allergeni text;
alter table public.decorazioni  add column if not exists allergeni text;
alter table public.tipi_torta   add column if not exists allergeni text;

-- BASI
update public.basi set allergeni = 'Glutine, Uova'  where id = 'classica';
update public.basi set allergeni = 'Soia'           where id = 'crock';
update public.basi set allergeni = ''               where id = 'cacao';
update public.basi set allergeni = 'Glutine, Latte' where id = 'glutenfree';

-- FARCITURE
update public.farciture set allergeni = ''                             where id = 'nessuna';
update public.farciture set allergeni = 'Latte, Frutta a guscio, Soia' where id = 'cremino';
update public.farciture set allergeni = 'Latte'                        where id = 'caramello';
update public.farciture set allergeni = ''                             where id = 'frutti-rossi';
update public.farciture set allergeni = ''                             where id = 'amarena';
update public.farciture set allergeni = 'Latte, Soia'                  where id = 'ganache';
update public.farciture set allergeni = 'Glutine'                      where id = 'biscotto';
update public.farciture set allergeni = 'Frutta a guscio'             where id = 'granella';
update public.farciture set allergeni = 'Latte, Frutta a guscio'      where id = 'pistacchio';

-- COPERTURE
update public.coperture set allergeni = 'Latte'       where id = 'panna';
update public.coperture set allergeni = 'Uova'        where id = 'meringa';
update public.coperture set allergeni = 'Latte, Soia' where id = 'ganache-cop';
update public.coperture set allergeni = 'Latte'       where id = 'glassa-specchio';
update public.coperture set allergeni = ''            where id = 'frutta-cop';
update public.coperture set allergeni = ''            where id = 'naked';
update public.coperture set allergeni = 'Latte, Soia' where id = 'cioccolato-cop';

-- TOPPING (decorazioni): le granelle contengono frutta a guscio
update public.decorazioni set allergeni = ''                 where id = 'nessuna';
update public.decorazioni set allergeni = 'Frutta a guscio'  where id = 'granella-nocciola-pistacchio';
update public.decorazioni set allergeni = ''                 where id = 'zuccherini';
update public.decorazioni set allergeni = 'Frutta a guscio'  where id = 'granella-frutta-secca';

-- TIPI TORTA: nessun allergene di default; li dichiara Lucia dalla dashboard
-- (es. il semifreddo di solito contiene Uova e Latte).
