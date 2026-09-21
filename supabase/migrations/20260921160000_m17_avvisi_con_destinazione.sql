-- =============================================================================
-- Lacertosus Office OS -- migrazione M17: un avviso sa dove porta
--
-- COSA FARE: apri Supabase, "SQL Editor", incolla tutto questo file, "Run".
-- Si puo' eseguire due volte senza danno: rifa' soltanto cio' che manca.
--
-- -----------------------------------------------------------------------------
--
-- IL DIFETTO. La campanella sa portare in un posto solo: un task. Il gestore
-- del clic si chiama letteralmente `openTask` e naviga solo se l'avviso ha un
-- `task_id`. Ma meta' degli avvisi non ce l'ha e non puo' averlo, perche' non
-- parlano di task: una richiesta in attesa, una ferie da decidere, una
-- chiusura aziendale, una menzione nella bacheca di un progetto. Su quelli il
-- clic segna letto e finisce li'.
--
-- Non e' un difetto silenzioso: e' un difetto che MENTE. La riga resta un
-- pulsante, con lo sfondo che cambia al passaggio del mouse e l'anello del
-- fuoco da tastiera. Sembra cliccabile, si preme, non succede niente -- che
-- e' esattamente la segnalazione arrivata dall'ufficio.
--
-- LA CURA. Una colonna `link`: dove porta questo avviso. Nullable, perche'
-- qualche avviso una destinazione non ce l'ha davvero (la menzione in chat:
-- la chat e' un pannello, non una pagina), e in quel caso l'interfaccia
-- smettera' di fingere che sia cliccabile invece di inventarsi un indirizzo.
--
-- DUE DIFESE, perche' `link` finisce dentro una navigazione.
--
--   1. Solo percorsi RELATIVI. Il valore lo scrive il browser, e finisce in
--      `router.push`: senza vincolo, chiunque potrebbe farsi scrivere in
--      casella un avviso che porta fuori dall'applicazione. Il CHECK impone
--      che cominci con una barra e non con due (`//altro-sito` sarebbe un
--      indirizzo assoluto travestito).
--
--   2. Non si riscrive dopo l'invio. La guardia di M2 e' una lista di
--      DIVIETI, non di permessi: elenca message, from_user_id, to_user_id,
--      task_id, kind. Tutto cio' che e' stato aggiunto dopo -- `dedupe_key`
--      da M5, e ora `link` -- e' rimasto fuori, mentre
--      `notifications_update_recipient` lascia al destinatario l'UPDATE della
--      propria riga. Cioe': oggi chiunque puo' riscrivere la `dedupe_key` dei
--      propri avvisi. Qui si chiude anche quella, che non era stata notata da
--      nessuno.
--
-- Regola del repo: additiva. M1-M16 non si toccano.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Dove porta l'avviso
-- -----------------------------------------------------------------------------

alter table public.notifications
  add column if not exists link text;

alter table public.notifications
  drop constraint if exists notifications_link_relativo;

alter table public.notifications
  add constraint notifications_link_relativo check (
    link is null
    or (link ~ '^/[A-Za-z0-9/_?=&.,%-]*$' and link !~ '^//')
  );

comment on column public.notifications.link is
  'M17: percorso RELATIVO dove porta il clic (es. /requests, /leave, /projects/<id>). NULL = questo avviso non porta da nessuna parte, e l''interfaccia lo mostra inerte invece di fingere che sia cliccabile. Il vincolo impedisce indirizzi assoluti: il valore finisce in una navigazione.';

-- -----------------------------------------------------------------------------
-- 2. La guardia, aggiornata
--
-- Di un avviso ricevuto si cambia solo lo stato di lettura. Valeva gia' per
-- cinque colonne; ora vale per tutte e sette.
-- -----------------------------------------------------------------------------

create or replace function public.notifications_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.message is distinct from old.message
     or new.from_user_id is distinct from old.from_user_id
     or new.to_user_id is distinct from old.to_user_id
     or new.task_id is distinct from old.task_id
     or new.kind is distinct from old.kind
     -- Aggiunte da M17. `dedupe_key` esisteva da M5 ed era rimasta scoperta:
     -- il destinatario poteva riscriverla, e con essa la deduplicazione degli
     -- avvisi automatici.
     or new.dedupe_key is distinct from old.dedupe_key
     or new.link is distinct from old.link then
    raise exception 'Di un avviso si può cambiare solo lo stato di lettura'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Il trigger di M2 punta gia' a questa funzione: `create or replace` basta,
-- non serve ricrearlo.

-- -----------------------------------------------------------------------------
-- 3. Anche gli avvisi del lavoro pianificato
--
-- `run_escalations` (M5) scrive tre tipi di avviso, e due su tre non portano
-- da nessuna parte: la richiesta in attesa e la ferie da decidere. Si
-- ridefinisce la funzione QUI, in un file nuovo: modificare M5 non servirebbe
-- a niente, perche' una migrazione gia' applicata nessuno la riesegue. E' la
-- stessa strada con cui M9 ha rifatto le policy di M2.
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
  -- --- Problemi fermi da piu' di 48 ore -------------------------------------
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
  insert into public.notifications (to_user_id, from_user_id, message, task_id, kind, dedupe_key, link)
  select
    d.id,
    null,
    '⚠️ Fermo da oltre 48 ore: «' || f.title || '»',
    f.id,
    'sistema',
    'problem:' || f.id::text || ':' || extract(epoch from f.problem_since)::bigint::text || ':' || d.id::text,
    null
  from fermi f cross join destinatari d
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  get diagnostics aggiunti = row_count;
  inseriti := inseriti + aggiunti;

  -- --- Richieste di task in attesa da piu' di 3 giorni ----------------------
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
  insert into public.notifications (to_user_id, from_user_id, message, task_id, kind, dedupe_key, link)
  select
    d.id,
    null,
    '⏳ Richiesta in attesa da ' ||
      extract(day from now() - v.created_at)::integer::text || ' g: «' || v.title || '»',
    null,
    'sistema',
    'request:' || v.id::text || ':' || d.id::text,
    '/requests'
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
  insert into public.notifications (to_user_id, from_user_id, message, task_id, kind, dedupe_key, link)
  select
    d.id,
    null,
    '🗓️ ' || case when u.type = 'ferie' then 'Ferie' else 'Permesso' end ||
      ' da decidere: ' || coalesce(p.full_name, 'un collega') ||
      ', dal ' || to_char(u.start_date, 'DD/MM'),
    null,
    'sistema',
    'leave:' || u.id::text || ':' || d.id::text,
    '/leave'
  from urgenti u
  cross join destinatari d
  left join public.profiles p on p.id = u.requester_id
  where d.id <> u.requester_id
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  get diagnostics aggiunti = row_count;
  inseriti := inseriti + aggiunti;

  return inseriti;
end;
$$;

comment on function public.run_escalations() is
  'M5, esteso da M17: avvisa i responsabili di problemi fermi, richieste e assenze in attesa. Da M17 ogni avviso porta con se'' la pagina dove si decide.';

commit;

-- =============================================================================
-- Nota: la pianificazione di pg_cron NON si tocca. Il lavoro orario esegue
-- 'select public.run_escalations();', cioe' il NOME della funzione: ridefinire
-- il corpo basta, e il giro successivo usa gia' quello nuovo.
-- =============================================================================
