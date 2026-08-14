-- =============================================================================
-- Lacertosus Office OS — migrazione M5: le escalation passano al server
--
-- Problema che risolve: i promemoria automatici (problemi fermi da oltre 48
-- ore, richieste e ferie in attesa da giorni) erano generati dal browser di
-- chi aveva per caso una scheda aperta. Tre conseguenze:
--
--  1. se nessuno teneva l'app aperta, nessuno veniva avvisato;
--  2. la policy pretende `from_user_id = auth.uid()`, ma quelle notifiche
--     sono attribuite al richiedente: il database le rifiutava, quindi
--     restavano vive solo nella scheda che le aveva create;
--  3. i marcatori «già segnalato» stavano nel browser, quindi due persone
--     con l'app aperta producevano due avvisi per lo stesso fatto.
--
-- Qui diventano un lavoro pianificato del database: gira da solo, scrive
-- davvero, e non può duplicare.
--
-- Regola del repo: additiva. M1–M4 non si toccano.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Avvisi di sistema senza mittente umano
--
-- Finora ogni avviso doveva avere un mittente. Un promemoria automatico non
-- ha un mittente: attribuirlo a una persona è una piccola bugia che poi si
-- legge in interfaccia («Francesco ti ha scritto» quando Francesco non ha
-- fatto nulla). La colonna diventa opzionale.
-- -----------------------------------------------------------------------------

alter table public.notifications
  alter column from_user_id drop not null;

comment on column public.notifications.from_user_id is
  'NULL = avviso generato dal sistema, senza mittente umano.';

-- -----------------------------------------------------------------------------
-- 2. Chiave di deduplicazione
--
-- Invece di ricordare altrove che cosa è già stato segnalato, lo si deduce
-- da ciò che esiste: ogni avviso automatico porta una chiave deterministica e
-- un indice unico impedisce il secondo inserimento. Niente stato da tenere
-- allineato, e il lavoro pianificato può girare quante volte vuole.
--
-- L'indice è parziale: gli avvisi scritti dalle persone non hanno chiave e
-- devono poter essere ripetuti (un sollecito si manda anche due volte).
-- -----------------------------------------------------------------------------

alter table public.notifications
  add column if not exists dedupe_key text;

create unique index if not exists notifications_dedupe_key_idx
  on public.notifications (dedupe_key)
  where dedupe_key is not null;

-- La policy di inserimento di M2 pretende `from_user_id = auth.uid()`, il che
-- ora escluderebbe gli avvisi di sistema. Si sostituisce con una che ammette
-- entrambi i casi: o lo manda una persona a proprio nome, o non ha mittente —
-- e in quel caso può scriverlo solo chi bypassa la RLS, cioè la funzione
-- pianificata qui sotto.
drop policy if exists notifications_insert_sender on public.notifications;

create policy notifications_insert_sender
  on public.notifications for insert to authenticated
  with check (
    (select public.is_active_member())
    and from_user_id = (select auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 3. Il lavoro di escalation
--
-- SECURITY DEFINER: gira per conto del sistema, non di una persona, e deve
-- poter scrivere avvisi destinati a chiunque. `search_path` vuoto come in
-- tutte le funzioni del progetto.
--
-- Le soglie ricalcano quelle che erano nel codice dell'app: 48 ore per un
-- problema fermo, 3 giorni per una richiesta o una ferie in attesa, più le
-- ferie che iniziano entro 3 giorni (decidere tardi è un no di fatto).
-- -----------------------------------------------------------------------------

create or replace function public.run_escalations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inseriti integer := 0;
  aggiunti integer;
begin
  -- --- Problemi fermi da più di 48 ore -------------------------------------
  -- La chiave include `problem_since`: se un task esce dalla fase Problema e
  -- ci rientra, è un episodio nuovo e merita un avviso nuovo.
  with destinatari as (
    select p.id from public.profiles p
    where p.role = 'admin' and p.is_active
  ),
  fermi as (
    select t.id, t.title, t.problem_since
    from public.tasks t
    where t.status = 'alert'
      and t.problem_since is not null
      and t.problem_since < now() - interval '48 hours'
      and t.archived_at is null
  )
  insert into public.notifications (to_user_id, from_user_id, message, task_id, kind, dedupe_key)
  select
    d.id,
    null,
    '⚠️ Fermo da oltre 48 ore: «' || f.title || '»',
    f.id,
    'sistema',
    'problem:' || f.id::text || ':' || extract(epoch from f.problem_since)::bigint::text || ':' || d.id::text
  from fermi f cross join destinatari d
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  get diagnostics aggiunti = row_count;
  inseriti := inseriti + aggiunti;

  -- --- Richieste di task in attesa da più di 3 giorni -----------------------
  with destinatari as (
    select p.id from public.profiles p
    where p.role = 'admin' and p.is_active
  ),
  vecchie as (
    select r.id, r.title, r.created_at
    from public.task_requests r
    where r.status = 'pending'
      and r.created_at < now() - interval '3 days'
  )
  insert into public.notifications (to_user_id, from_user_id, message, task_id, kind, dedupe_key)
  select
    d.id,
    null,
    '⏳ Richiesta in attesa da ' ||
      extract(day from now() - v.created_at)::integer::text || ' g: «' || v.title || '»',
    null,
    'sistema',
    'request:' || v.id::text || ':' || d.id::text
  from vecchie v cross join destinatari d
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  get diagnostics aggiunti = row_count;
  inseriti := inseriti + aggiunti;

  -- --- Ferie e permessi in attesa ------------------------------------------
  with destinatari as (
    select p.id from public.profiles p
    where p.role = 'admin' and p.is_active
  ),
  urgenti as (
    select l.id, l.type, l.start_date, l.requester_id
    from public.leave_requests l
    where l.status = 'pending'
      and (
        l.created_at < now() - interval '3 days'
        or (l.start_date >= current_date and l.start_date <= current_date + 3)
      )
  )
  insert into public.notifications (to_user_id, from_user_id, message, task_id, kind, dedupe_key)
  select
    d.id,
    null,
    '🗓️ ' || case when u.type = 'ferie' then 'Ferie' else 'Permesso' end ||
      ' da decidere: ' || coalesce(p.full_name, 'un collega') ||
      ', dal ' || to_char(u.start_date, 'DD/MM'),
    null,
    'sistema',
    'leave:' || u.id::text || ':' || d.id::text
  from urgenti u
  cross join destinatari d
  left join public.profiles p on p.id = u.requester_id
  -- Nessuno viene avvisato di decidere sulla propria assenza: la guardia
  -- glielo impedirebbe comunque, e l'avviso sarebbe solo rumore.
  where d.id <> u.requester_id
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  get diagnostics aggiunti = row_count;
  inseriti := inseriti + aggiunti;

  return inseriti;
end;
$$;

comment on function public.run_escalations() is
  'Promemoria automatici. Idempotente: la chiave di deduplicazione impedisce i doppioni, quindi si può eseguire quante volte si vuole.';

revoke execute on function public.run_escalations() from public, anon;

-- -----------------------------------------------------------------------------
-- 4. Pianificazione
--
-- Ogni ora è il ritmo giusto: le soglie sono di giorni, e controllare più
-- spesso costerebbe senza anticipare nulla.
--
-- Isolato in un blocco con gestione dell'eccezione, per la stessa ragione
-- della M4: pg_cron potrebbe non essere disponibile o non concesso, e il SQL
-- Editor esegue tutto in una transazione — un errore qui annullerebbe anche
-- la funzione e le colonne create sopra.
-- -----------------------------------------------------------------------------

do $$
begin
  create extension if not exists pg_cron;

  -- Rimuove una pianificazione precedente, così la migrazione è rieseguibile.
  perform cron.unschedule('escalations-orarie')
  where exists (select 1 from cron.job where jobname = 'escalations-orarie');

  perform cron.schedule(
    'escalations-orarie',
    '7 * * * *', -- al minuto 7 di ogni ora: fuori dai picchi del minuto zero
    'select public.run_escalations();'
  );

  raise notice 'Escalation pianificate ogni ora.';
exception
  when insufficient_privilege or undefined_file or feature_not_supported then
    raise warning
      'pg_cron non disponibile: la funzione run_escalations() e stata creata ma NON e pianificata. Attivala da Database > Extensions, poi esegui: select cron.schedule(''escalations-orarie'', ''7 * * * *'', ''select public.run_escalations();''); Tutto il resto della migrazione e andato a buon fine.';
end;
$$;
