-- =============================================================================
-- CHI COMANDA NEL WORKSPACE — sola lettura, non modifica niente.
--
-- L'interfaccia mostra quello che vuole; i permessi veri li decide il
-- database leggendo `profiles.role`. Questo file risponde a una domanda
-- sola: chi è responsabile adesso?
--
-- COME SI USA: aprire il dashboard Supabase › SQL Editor, incollare tutto,
-- premere «Run». Niente da modificare, niente da scommentare.
--
-- Se qualcuno risulta responsabile e non dovrebbe (o viceversa), il file
-- che sistema è `supabase/allinea-ruoli.sql`.
-- =============================================================================

select
  case
    when p.role = 'admin' and p.is_active then '★ RESPONSABILE'
    when p.role = 'admin' then '☆ responsabile disattivato'
    when p.is_active then '· dipendente'
    else '· disattivato'
  end                                            as ruolo,
  p.full_name                                    as persona,
  p.email,
  case
    when p.role = 'admin' and p.is_active
      then 'approva, decide, gestisce tutto'
    when p.is_active
      then 'lavora i task di cui risponde'
    else 'non entra'
  end                                            as cosa_puo_fare,
  u.last_sign_in_at                              as ultimo_accesso
from public.profiles p
left join auth.users u on u.id = p.id
order by
  (p.role = 'admin' and p.is_active) desc,
  p.is_active desc,
  p.full_name;

-- Conteggio secco, per non doverli contare a occhio.
select
  count(*) filter (where role = 'admin' and is_active)  as responsabili_attivi,
  count(*) filter (where role <> 'admin' and is_active) as dipendenti_attivi,
  count(*) filter (where not is_active)                 as disattivati
from public.profiles;
