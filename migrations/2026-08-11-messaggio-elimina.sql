-- ============================================================
-- Messaggio più utile quando provi a togliere il TUO codice — 2026-08-11
-- Da eseguire su Supabase (SQL Editor).
--
-- Il divieto resta (serve a non chiudersi fuori da soli: se togliessi il codice
-- con cui sei entrato, resteresti dentro con un codice che non esiste più).
-- Cambia solo la spiegazione, che prima diceva cosa NON si può fare senza dire
-- come si fa.
-- ============================================================

create or replace function public.codice_elimina(p_pin text, p_id uuid)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v json; v_nome text; begin
  v := public.verifica_codice(p_pin);
  if not (v ->> 'ok')::boolean or (v ->> 'ruolo') <> 'admin' then
    return json_build_object('ok', false, 'motivo', 'Serve un codice da amministratore.');
  end if;
  if p_id = (v ->> 'id')::uuid then
    return json_build_object('ok', false, 'motivo',
      'Questo è il codice con cui sei entrato adesso: toglierlo ti chiuderebbe fuori. Premi "Blocca la scheda", rientra con un altro codice da amministratore e da lì puoi eliminarlo.');
  end if;
  select nome into v_nome from public.staff_codici where id = p_id;
  -- Ultimo amministratore: se lo si toglie, nessuno può più gestire i codici.
  if (select ruolo from public.staff_codici where id = p_id) = 'admin'
     and (select count(*) from public.staff_codici where ruolo = 'admin' and attivo) <= 1 then
    return json_build_object('ok', false, 'motivo', 'È l''ultimo amministratore: prima nominane un altro.');
  end if;
  delete from public.staff_codici where id = p_id;
  insert into public.attivita (chi_id, chi_nome, azione, dettaglio)
  values ((v ->> 'id')::uuid, v ->> 'nome', 'Codice eliminato', coalesce(v_nome, '?'));
  return json_build_object('ok', true);
end $$;

grant execute on function public.codice_elimina(text, uuid) to authenticated;

select 'Fatto: ora il messaggio spiega anche come fare.' as esito;
