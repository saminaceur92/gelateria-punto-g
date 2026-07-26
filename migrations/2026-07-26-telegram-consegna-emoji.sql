-- ============================================================
-- Telegram: emoji per la consegna a domicilio (e crumble) — 2026-07-26
-- Da eseguire su Supabase UNA VOLTA.
--
-- `order_telegram_msg` è la funzione che trasforma il riepilogo dell'ordine nel
-- messaggio che arriva su Telegram: toglie gli asterischi e mette le emoji
-- davanti alle righe. Aveva la regola per "Da ritirare:" (📅) ma non per gli
-- ordini in consegna, che arrivavano spogli.
--
-- Aggiunge:  🛵 Consegna a domicilio · 📍 Indirizzo · 💶 Sovrapprezzo consegna
-- e allinea la nuova riga "Tipo di crumble" alle altre voci della torta (–).
--
-- Riguarda solo il messaggio Telegram: il riepilogo salvato nell'ordine e la
-- mail al cliente restano com'erano.
-- ============================================================

create or replace function public.order_telegram_msg(p_riepilogo text, p_cliente text)
returns text
language plpgsql
immutable
as $$
declare msg text;
begin
  msg := coalesce(nullif(btrim(regexp_replace(coalesce(p_riepilogo,''), '[*_]', '', 'g')), ''), '');
  if msg = '' then
    msg := '⚠ NUOVO ORDINE — Punto Gi!' || E'\n👤 Cliente: ' || coalesce(p_cliente, 'Cliente');
  else
    msg := replace(msg, '🎂 Nuova richiesta torta — Punto Gi!', '⚠ NUOVO ORDINE — Punto Gi!');
    msg := replace(msg, '🎂 Nuovo ordine in gelateria — Punto Gi!', '⚠ NUOVO ORDINE (in gelateria) — Punto Gi!');
    msg := replace(msg, 'Tipo:', '– Tipo:');
    msg := replace(msg, 'Forma:', '– Forma:');
    msg := replace(msg, 'Dimensione:', '– Dimensione:');
    msg := replace(msg, 'Base:', '– Base:');
    msg := replace(msg, 'Tipo di crumble:', '– Tipo di crumble:');   -- NUOVO
    msg := replace(msg, 'Strati / Gusti:', '– Strati / Gusti:');
    msg := replace(msg, 'Farcitura:', '– Farcitura:');
    msg := replace(msg, 'Copertura:', '– Copertura:');
    msg := replace(msg, 'Decorazione:', '– Decorazione:');
    msg := replace(msg, 'Scritta:', '– Scritta:');
    msg := replace(msg, 'Foto su cialda:', '– Foto su cialda:');
    msg := replace(msg, 'Candelina:', '– Candelina:');
    msg := replace(msg, 'Occasione:', '– Occasione:');
    msg := replace(msg, 'Da ritirare:', '📅 Da ritirare:');
    msg := replace(msg, 'Consegna a domicilio:', '🛵 Consegna a domicilio:');   -- NUOVO
    msg := replace(msg, 'Indirizzo:', '📍 Indirizzo:');                         -- NUOVO
    msg := replace(msg, 'Sovrapprezzo consegna:', '💶 Sovrapprezzo consegna:'); -- NUOVO
    msg := replace(msg, 'Cliente:', '👤 Cliente:');
    msg := replace(msg, 'Telefono:', '📞 Telefono:');
    msg := replace(msg, 'Email:', '📧 Email:');
    msg := replace(msg, 'Note:', '📝 Note:');
    msg := replace(msg, 'Stima:', 'Importo pagato:');
  end if;
  return msg;
end $$;

-- Anteprima del risultato sull'ultimo ordine in consegna (non manda niente).
select public.order_telegram_msg(riepilogo, cliente_nome) as anteprima
from public.ordini
where riepilogo like '%Consegna a domicilio%'
order by created_at desc
limit 1;
