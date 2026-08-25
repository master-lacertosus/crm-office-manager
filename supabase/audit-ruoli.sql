-- =============================================================================
-- Audit dei ruoli: chi comanda davvero nel workspace.
--
-- L'interfaccia mostra quello che vuole, ma i permessi veri li decide la RLS
-- leggendo `profiles.role`. Questo file risponde a una domanda sola: chi è
-- amministratore, e chi dovrebbe esserlo?
--
-- COME USARLO: incolla tutto nel SQL Editor di Supabase ed esegui. La prima
-- parte LEGGE soltanto. La seconda, da scommentare, allinea i ruoli
-- all'elenco che decidi tu.
--
-- Nota: eseguito dal SQL Editor non c'è JWT, quindi `profiles_guard` salta i
-- controlli di permesso — restano attive le invarianti (almeno un admin
-- attivo deve sopravvivere).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Fotografia attuale: chi c'è e cosa può fare.
-- -----------------------------------------------------------------------------
select
  p.full_name                                   as persona,
  p.email,
  p.role                                        as ruolo,
  p.is_active                                   as attivo,
  case
    when p.role = 'admin' and p.is_active then 'RESPONSABILE — approva, decide, gestisce tutto'
    when p.role = 'admin' then 'admin ma disattivato: non entra'
    when p.is_active then 'dipendente'
    else 'disattivato'
  end                                           as significato,
  u.last_sign_in_at                             as ultimo_accesso,
  u.confirmed_at                                as email_confermata
from public.profiles p
left join auth.users u on u.id = p.id
order by (p.role = 'admin') desc, p.is_active desc, p.full_name;

-- -----------------------------------------------------------------------------
-- 2. Verifica secca: gli amministratori sono SOLO quelli previsti?
--    Sostituisci le due mail con quelle dei responsabili.
-- -----------------------------------------------------------------------------
with previsti as (
  select unnest(array[
    'francesco@lacertosus.com',   -- ← QUI: mail di Francesco
    'sara@lacertosus.com'         -- ← QUI: mail di Sara
  ]) as email
),
effettivi as (
  select email from public.profiles where role = 'admin' and is_active
)
select
  coalesce(e.email, p.email)                     as email,
  case
    when p.email is null then 'DA TOGLIERE — è amministratore ma non dovrebbe'
    when e.email is null then 'MANCANTE — dovrebbe essere amministratore'
    else 'ok'
  end                                            as esito
from effettivi e
full outer join previsti p on p.email = e.email
where p.email is null or e.email is null
order by esito, email;
-- Nessuna riga = tutto in ordine.

-- -----------------------------------------------------------------------------
-- 3. Allineamento (SCOMMENTARE per applicare).
--    Promuove i due responsabili e riporta TUTTI gli altri a dipendenti.
--    L'ordine conta: prima si promuove, poi si declassa, altrimenti si
--    rischia di restare senza amministratori a metà strada.
-- -----------------------------------------------------------------------------
-- do $$
-- declare
--   responsabili text[] := array[
--     'francesco@lacertosus.com',  -- ← QUI
--     'sara@lacertosus.com'        -- ← QUI
--   ];
--   mancanti text[];
-- begin
--   select array_agg(m) into mancanti
--   from unnest(responsabili) m
--   where not exists (select 1 from public.profiles where email = m);
--
--   if mancanti is not null then
--     raise exception 'Mail senza profilo: %. Controlla la scrittura prima di procedere.', mancanti;
--   end if;
--
--   update public.profiles
--   set role = 'admin', is_active = true
--   where email = any(responsabili);
--
--   update public.profiles
--   set role = 'member'
--   where role = 'admin' and not (email = any(responsabili));
--
--   raise notice 'Ruoli allineati: % responsabili, % dipendenti',
--     (select count(*) from public.profiles where role = 'admin'),
--     (select count(*) from public.profiles where role = 'member');
-- end;
-- $$;

-- -----------------------------------------------------------------------------
-- 4. Controprova: rieseguire il punto 1 e il punto 2 dopo l'allineamento.
-- -----------------------------------------------------------------------------
