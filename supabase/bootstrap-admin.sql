-- =============================================================================
-- Bootstrap del primo amministratore.
--
-- Perché serve: ogni profilo nasce con role = 'member' (default di M1), così
-- nessuno diventa amministratore semplicemente registrandosi. Ma il flusso di
-- invito richiede un admin che inviti: il primo va promosso a mano, una volta
-- sola, da qui.
--
-- Funziona perché `profiles_guard` salta i controlli di permesso quando la
-- richiesta non ha un JWT (auth.uid() is null) — il caso del SQL Editor. Le
-- invarianti assolute restano attive: resta sempre almeno un admin attivo.
--
-- PRIMA di eseguire: crea l'utente dal dashboard, in
-- Authentication › Users › Add user, con la mail dedicata del progetto.
-- Spunta «Auto Confirm User», altrimenti non potrà accedere finché non
-- conferma via email (e l'SMTP potrebbe non essere ancora configurato).
--
-- COME USARLO: sostituisci la mail nella riga marcata «← QUI», una volta
-- sola, poi esegui tutto il file. Niente \set: è un meta-comando di psql e
-- il SQL Editor di Supabase non lo conosce.
-- =============================================================================

do $$
declare
  -- ↓ ← QUI: la mail dell'utente da promuovere.
  target_email text := 'la-tua-mail@esempio.it';

  auth_id uuid;
  profile_row public.profiles%rowtype;
begin
  -- 1. L'utente esiste lato auth?
  select id into auth_id from auth.users where email = target_email;

  if auth_id is null then
    raise exception
      'Nessun utente auth con la mail %. Crealo da Authentication › Users › Add user, poi riesegui.',
      target_email;
  end if;

  -- 2. Il profilo è nato dal trigger?
  --    Questa è la prova sul campo del controllo 7 della verifica: se il
  --    profilo manca mentre l'utente auth esiste, il trigger
  --    on_auth_user_created non ha funzionato.
  select * into profile_row from public.profiles where id = auth_id;

  if not found then
    raise exception
      'Utente auth trovato (%), ma il profilo non esiste: il trigger on_auth_user_created non ha funzionato. Va sistemato prima di proseguire.',
      auth_id;
  end if;

  raise notice 'Profilo trovato: % — ruolo attuale: %', profile_row.full_name, profile_row.role;

  -- 3. Promozione.
  if profile_row.role = 'admin' and profile_row.is_active then
    raise notice 'Era già amministratore attivo: nessuna modifica.';
  else
    update public.profiles
    set role = 'admin', is_active = true
    where id = auth_id;
    raise notice 'Promosso ad amministratore.';
  end if;
end;
$$;

-- Conferma finale: deve mostrare una riga con role = admin e «OK».
-- ↓ sostituisci la mail anche qui.
select
  full_name,
  email,
  role,
  is_active,
  case when role = 'admin' and is_active
       then 'OK — puoi accedere e invitare gli altri'
       else 'ATTENZIONE — la promozione non ha avuto effetto' end as esito
from public.profiles
where email = 'la-tua-mail@esempio.it';
