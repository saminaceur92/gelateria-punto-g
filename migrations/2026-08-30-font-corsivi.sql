-- Corsivi più vicini ai modelli scritti a mano forniti dai titolari.
-- Idempotente: mantiene invariati gli id usati negli ordini storici.

update public.scritte
set font_family = '''Kalam'', cursive',
    corsivo = false
where id = 'corsivo';

update public.scritte
set font_family = '''Dancing Script'', cursive',
    corsivo = false
where id = 'corsivo-scolastico';

select id, nome, font_family
from public.scritte
where id in ('corsivo', 'corsivo-scolastico')
order by ordine;
