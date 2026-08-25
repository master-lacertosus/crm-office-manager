-- =============================================================================
-- Lacertosus Office OS -- AGGIORNAMENTO DEL DATABASE
--
-- COSA FARE, in breve:
--   1. Apri Supabase, voce "SQL Editor" nel menu a sinistra.
--   2. Incolla tutto questo file.
--   3. Premi "Run".
--
-- E' tutto. Non c'e' niente da scommentare, niente da modificare, niente da
-- decidere. E se lo esegui due volte non succede niente di male: il file
-- rifa' soltanto cio' che manca.
--
-- Alla fine leggerai un elenco di righe "NOTICE": sono il resoconto, non
-- errori. Un errore, se capita, si presenta in rosso e ferma tutto -- in quel
-- caso non e' stato applicato niente, e il messaggio dice cosa non e' andato.
--
-- COSA PORTA (le quattro cose ferme in attesa di questo file):
--   M7  Ricorrenze: da tre cadenze a otto
--   M8  La board si aggiorna da sola
--   M9  Responsabili e dipendenti: il confine
--   M10 Sotto-task: un lavoro, piu' mani
--
-- Questo file NON tocca i dati esistenti: non cancella e non riscrive righe.
-- Aggiunge regole, permessi e una colonna.
-- =============================================================================

begin;


-- #############################################################################
-- M7 -- Ricorrenze: da tre cadenze a otto
-- (equivale a supabase/migrations/20260824120000_m7_ricorrenze.sql)
-- #############################################################################

-- =============================================================================
-- Lacertosus Office OS -- migrazione M7: ricorrenze piu' fitte
--
-- Il vincolo ammetteva tre sole cadenze: settimanale, ogni due settimane,
-- mensile. Fuori restava tutto cio' che in un ufficio marketing si ripete
-- davvero ogni giorno -- il controllo degli ordini, la pubblicazione sui
-- social, il presidio delle campagne -- e chi ci provava doveva ricreare il
-- task a mano ogni mattina.
--
-- Si aggiungono cinque cadenze: quotidiana, nei soli giorni feriali, a giorni
-- alterni, trimestrale e annuale. "weekdays" non e' un passo fisso in giorni:
-- il salto lo calcola l'applicazione (primo giorno feriale successivo), qui
-- serve solo che il valore sia ammesso.
--
-- I valori esistenti restano validi: nessun dato da convertire. Il vincolo
-- viene ricreato perche' in PostgreSQL un CHECK non si allarga sul posto.
--
-- Regola del repo: additiva. M1-M6 non si toccano.
-- =============================================================================

alter table public.tasks
  drop constraint if exists tasks_repeat_valid;

alter table public.tasks
  add constraint tasks_repeat_valid check (
    repeat in (
      'none',
      'daily',
      'weekdays',
      'every_other_day',
      'weekly',
      'biweekly',
      'monthly',
      'quarterly',
      'yearly'
    )
  );

comment on column public.tasks.repeat is
  'Cadenza con cui il task si ricrea al completamento. «weekdays» = primo giorno feriale successivo (sabato e domenica saltati). La scadenza del nuovo giro non nasce mai nel passato: i giri già trascorsi vengono saltati.';

-- Gli stessi valori valgono per le attivita' ricorrenti del workspace: se il
-- template ammettesse cadenze che il task non puo' avere, il planner
-- creerebbe righe rifiutate dal vincolo qui sopra.
alter table public.workspace_templates
  drop constraint if exists template_repeat_valid;

alter table public.workspace_templates
  add constraint template_repeat_valid check (
    repeat in (
      'none',
      'daily',
      'weekdays',
      'every_other_day',
      'weekly',
      'biweekly',
      'monthly',
      'quarterly',
      'yearly'
    )
  );

-- #############################################################################
-- M8 -- La board si aggiorna da sola
-- (equivale a supabase/migrations/20260824140000_m8_realtime_workspace.sql)
-- #############################################################################

-- =============================================================================
-- Lacertosus Office OS -- migrazione M8: aggiornamenti del workspace dal vivo
--
-- Finora il lavoro degli altri si vedeva solo ricaricando la pagina: chi non
-- lo faceva assegnava due volte lo stesso task o discuteva di una scheda che
-- nel frattempo era cambiata. La board e' condivisa, ma ognuno ne guardava
-- una fotografia vecchia.
--
-- M4 aveva gia' acceso Realtime sulla chat. Qui si estende alle tabelle che
-- cambiano durante la giornata: l'annuncio arriva al browser, che rilegge.
-- Non passano dati sul canale -- solo il fatto che qualcosa e' cambiato -- e
-- comunque la RLS resta l'ultima parola: Realtime consegna a ciascuno solo
-- le righe che quella persona potrebbe gia' leggere.
--
-- Come in M4, il blocco `exception` isola il caso in cui il ruolo che applica
-- la migrazione non possa toccare la publication: in quel caso si attiva a
-- mano dal dashboard, in Database > Publications.
--
-- Regola del repo: additiva. M1-M7 non si toccano.
-- =============================================================================

do $$
declare
  tabella text;
begin
  foreach tabella in array array[
    'tasks',
    'task_checklist_items',
    'task_links',
    'task_collaborators',
    'task_comments',
    'project_comments',
    'task_requests',
    'leave_requests',
    'notifications'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tabella
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        tabella
      );
      raise notice 'Realtime attivo su public.%.', tabella;
    else
      raise notice 'Realtime era gia attivo su public.%.', tabella;
    end if;
  end loop;
exception
  when insufficient_privilege or wrong_object_type then
    raise notice
      'Publication non modificabile con questo ruolo: attivare Realtime a mano dal dashboard (Database > Publications).';
end;
$$;

-- #############################################################################
-- M9 -- Responsabili e dipendenti: il confine
-- (equivale a supabase/migrations/20260825120000_m9_permessi.sql)
-- #############################################################################

-- =============================================================================
-- Lacertosus Office OS -- migrazione M9: responsabili e dipendenti
--
-- Il modello di M1 era la "trasparenza D5": ogni membro attivo poteva
-- modificare qualunque cosa, perche' la proprieta' era responsabilita' e non un
-- lucchetto. Decisione del committente del 25/08/2026: il workspace ha due
-- responsabili (Francesco e Sara) che governano tutto; gli altri sono
-- dipendenti e mettono le mani su cio' che li riguarda.
--
-- Questa migrazione sposta quel confine dove conta -- nel database. Nasconde
-- un pulsante e' cosmetica: chi conosce l'API scrive lo stesso.
--
-- Insieme al confine si chiudono i buchi emersi dall'audit, che erano tali
-- anche col modello vecchio:
--   - una ferie GIA' APPROVATA restava modificabile dal richiedente (date
--     spostate a piacere, e persino la firma di chi aveva approvato);
--   - idem per una richiesta di task approvata;
--   - si poteva cancellare il task di chiunque in due mosse: prima
--     riassegnarlo a se', poi eliminarlo da "proprietario";
--   - si potevano zittire le escalation verso i responsabili inserendo
--     avvisi con la chiave di deduplicazione indovinata;
--   - il registro append-only accettava eventi inventati su task altrui,
--     con data a piacere;
--   - si potevano marcare come "decisione" i commenti altrui, spostarli di
--     progetto e retrodatarli;
--   - si poteva togliere qualunque collaboratore da qualunque task;
--   - si poteva cambiare la propria email desincronizzandola da auth.
--
-- Un admin che approva la propria richiesta di task era possibile: sulle
-- ferie il divieto c'era gia', sulle richieste no. Ora sono simmetriche.
--
-- Regola del repo: additiva. M1-M8 non si toccano. (M7 e M8 sono nelle PR
-- #28 e #29: questa migrazione non le presuppone e non le tocca.)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Chi puo' mettere le mani su un task
--
-- Una funzione sola, usata da tutte le policy che dipendono da questa
-- domanda: il responsabile del task, chi l'ha creato, i collaboratori, e i
-- responsabili del workspace. Se la regola cambia, cambia qui.
-- -----------------------------------------------------------------------------
create or replace function public.puo_modificare_task(task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.tasks t
      where t.id = task_id
        and public.is_active_member()
        and (
          t.owner_id = (select auth.uid())
          or t.created_by = (select auth.uid())
          or exists (
            select 1 from public.task_collaborators c
            where c.task_id = t.id and c.user_id = (select auth.uid())
          )
        )
    );
$$;

comment on function public.puo_modificare_task is
  'Vero se chi chiama è responsabile del task, lo ha creato, vi collabora, oppure è un responsabile del workspace.';

revoke all on function public.puo_modificare_task(uuid) from public, anon;
grant execute on function public.puo_modificare_task(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 1. Task: si modifica cio' che e' proprio
-- -----------------------------------------------------------------------------
drop policy if exists tasks_update_active_members on public.tasks;

drop policy if exists tasks_update_own_or_admin on public.tasks;
create policy tasks_update_own_or_admin
  on public.tasks for update to authenticated
  using ((select public.puo_modificare_task(id)))
  with check ((select public.puo_modificare_task(id)));

-- Chi crea un task lo prende in carico: assegnare lavoro ad altri e' dei
-- responsabili, e per proporlo esiste il flusso delle Richieste.
drop policy if exists tasks_insert_own on public.tasks;

drop policy if exists tasks_insert_own_or_admin on public.tasks;
create policy tasks_insert_own_or_admin
  on public.tasks for insert to authenticated
  with check (
    (select public.is_active_member())
    and created_by = (select auth.uid())
    and (
      (select public.is_admin())
      or owner_id = (select auth.uid())
    )
  );

-- La riassegnazione e la paternita' non si toccano da dipendenti: senza
-- questa guardia bastava passarsi un task per poterlo poi cancellare.
create or replace function public.tasks_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'La paternità di un task non si cambia'
      using errcode = '42501';
  end if;

  if new.owner_id is distinct from old.owner_id and not public.is_admin() then
    raise exception 'Solo un responsabile può riassegnare un task'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_guard on public.tasks;
create trigger tasks_guard
  before update on public.tasks
  for each row execute function public.tasks_guard();

-- -----------------------------------------------------------------------------
-- 2. Progetti: nascono e cambiano per mano di un responsabile
-- -----------------------------------------------------------------------------
drop policy if exists projects_insert_own on public.projects;
drop policy if exists projects_update_active_members on public.projects;

drop policy if exists projects_insert_admin on public.projects;
create policy projects_insert_admin
  on public.projects for insert to authenticated
  with check (
    (select public.is_admin())
    and created_by = (select auth.uid())
  );

drop policy if exists projects_update_admin on public.projects;
create policy projects_update_admin
  on public.projects for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- 3. Checklist: si spunta cio' che si puo' lavorare
-- -----------------------------------------------------------------------------
drop policy if exists checklist_write_active_members on public.task_checklist_items;
drop policy if exists checklist_update_active_members on public.task_checklist_items;
drop policy if exists checklist_delete_active_members on public.task_checklist_items;

drop policy if exists checklist_write_own_task on public.task_checklist_items;
create policy checklist_write_own_task
  on public.task_checklist_items for insert to authenticated
  with check ((select public.puo_modificare_task(task_id)));

drop policy if exists checklist_update_own_task on public.task_checklist_items;
create policy checklist_update_own_task
  on public.task_checklist_items for update to authenticated
  using ((select public.puo_modificare_task(task_id)))
  with check ((select public.puo_modificare_task(task_id)));

drop policy if exists checklist_delete_own_task on public.task_checklist_items;
create policy checklist_delete_own_task
  on public.task_checklist_items for delete to authenticated
  using ((select public.puo_modificare_task(task_id)));

-- -----------------------------------------------------------------------------
-- 4. Ferie: una volta decise, le tocca solo un responsabile
-- -----------------------------------------------------------------------------
drop policy if exists leave_update_own_or_admin on public.leave_requests;

drop policy if exists leave_update_pending_or_admin on public.leave_requests;
create policy leave_update_pending_or_admin
  on public.leave_requests for update to authenticated
  using (
    (select public.is_admin())
    or (
      (select public.is_active_member())
      and requester_id = (select auth.uid())
      and status = 'pending'
    )
  )
  with check (
    (select public.is_admin())
    or (
      (select public.is_active_member())
      and requester_id = (select auth.uid())
      and status = 'pending'
    )
  );

create or replace function public.leave_requests_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  -- La firma della decisione non si riscrive: la mette il trigger, resta
  -- del responsabile che ha deciso.
  if not public.is_admin() and (
       new.decided_by is distinct from old.decided_by
       or new.decided_at is distinct from old.decided_at
       or new.decision_note is distinct from old.decision_note
       or new.requester_id is distinct from old.requester_id
     ) then
    raise exception 'Solo un responsabile può toccare la decisione'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if not public.is_admin() then
      raise exception 'Solo un responsabile può decidere una richiesta di assenza'
        using errcode = '42501';
    end if;
    if new.requester_id = (select auth.uid()) then
      raise exception 'Non si decide sulla propria richiesta di assenza'
        using errcode = '42501';
    end if;
    new.decided_by = (select auth.uid());
    new.decided_at = now();
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Richieste di task: stesse regole delle ferie
-- -----------------------------------------------------------------------------
drop policy if exists requests_update_own_or_admin on public.task_requests;

drop policy if exists requests_update_pending_or_admin on public.task_requests;
create policy requests_update_pending_or_admin
  on public.task_requests for update to authenticated
  using (
    (select public.is_admin())
    or (
      (select public.is_active_member())
      and requester_id = (select auth.uid())
      and status = 'pending'
    )
  )
  with check (
    (select public.is_admin())
    or (
      (select public.is_active_member())
      and requester_id = (select auth.uid())
      and status = 'pending'
    )
  );

create or replace function public.task_requests_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  -- La firma della decisione la mette il trigger e resta di chi ha deciso.
  if not public.is_admin() and (
       new.decided_by is distinct from old.decided_by
       or new.decided_at is distinct from old.decided_at
       or new.rejection_reason is distinct from old.rejection_reason
       or new.requester_id is distinct from old.requester_id
       or new.task_id is distinct from old.task_id
     ) then
    raise exception 'Solo un responsabile può toccare la decisione'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if not public.is_admin() then
      raise exception 'Solo un responsabile può decidere una richiesta di task'
        using errcode = '42501';
    end if;
    -- Simmetria con le ferie: chi propone non si approva da solo.
    if new.requester_id = (select auth.uid()) then
      raise exception 'Non si decide sulla propria richiesta di task'
        using errcode = '42501';
    end if;
    new.decided_by = (select auth.uid());
    new.decided_at = now();
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Avvisi: la chiave di deduplicazione e' del sistema
--
-- Indovinandola (il formato e' deterministico) si poteva inserire in anticipo
-- l'avviso che le escalation avrebbero mandato ai responsabili: il vero
-- allarme sarebbe poi caduto sul conflitto, in silenzio.
-- -----------------------------------------------------------------------------
drop policy if exists notifications_insert_sender on public.notifications;

drop policy if exists notifications_insert_sender on public.notifications;
create policy notifications_insert_sender
  on public.notifications for insert to authenticated
  with check (
    (select public.is_active_member())
    and from_user_id = (select auth.uid())
    and dedupe_key is null
  );

-- -----------------------------------------------------------------------------
-- 7. Cronologia: eventi solo sui task che si possono lavorare, e mai datati
--    a piacere. E' un registro: se si puo' riscrivere, non e' un registro.
-- -----------------------------------------------------------------------------
drop policy if exists events_insert_own on public.task_events;

drop policy if exists events_insert_own_task on public.task_events;
create policy events_insert_own_task
  on public.task_events for insert to authenticated
  with check (
    actor_id = (select auth.uid())
    and (select public.puo_modificare_task(task_id))
  );

create or replace function public.task_events_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.created_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists task_events_guard on public.task_events;
create trigger task_events_guard
  before insert on public.task_events
  for each row execute function public.task_events_guard();

-- -----------------------------------------------------------------------------
-- 8. Collaboratori: li toglie chi ha titolo, o chi se ne va da solo
-- -----------------------------------------------------------------------------
drop policy if exists collaborators_delete_active_members on public.task_collaborators;

drop policy if exists collaborators_delete_own_task_or_self on public.task_collaborators;
create policy collaborators_delete_own_task_or_self
  on public.task_collaborators for delete to authenticated
  using (
    (select public.puo_modificare_task(task_id))
    or user_id = (select auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 9. Commenti: restano dove sono nati, e la "decisione" la marca chi ha
--    titolo per farlo
-- -----------------------------------------------------------------------------
create or replace function public.task_comments_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if new.task_id is distinct from old.task_id
     or new.author_id is distinct from old.author_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Un commento non si sposta e non si retrodata'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists task_comments_guard on public.task_comments;
create trigger task_comments_guard
  before update on public.task_comments
  for each row execute function public.task_comments_guard();

create or replace function public.project_comments_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- L'autore non si cambia mai, nemmeno dal server: e' la firma del messaggio.
  if new.author_id is distinct from old.author_id then
    raise exception 'L''autore di un messaggio non si cambia'
      using errcode = 'P0001';
  end if;

  if (select auth.uid()) is null then
    return new;
  end if;

  if new.body is distinct from old.body
     and old.author_id <> (select auth.uid()) then
    raise exception 'Solo l''autore può modificare il testo del messaggio'
      using errcode = '42501';
  end if;

  -- Nuovo: un messaggio resta nel progetto in cui e' nato, con la sua data.
  if new.project_id is distinct from old.project_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Un messaggio non si sposta di progetto e non si retrodata'
      using errcode = '42501';
  end if;

  -- Nuovo: la marcatura "decisione" la mette chi ha scritto, o un
  -- responsabile. Prima poteva farlo chiunque sul messaggio di chiunque.
  if new.is_decision is distinct from old.is_decision
     and old.author_id <> (select auth.uid())
     and not public.is_admin() then
    raise exception 'Marca come decisione chi ha scritto il messaggio, o un responsabile'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. Profili: l'email e' quella con cui si entra, non un'etichetta
-- -----------------------------------------------------------------------------
create or replace function public.profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Permesso: ruolo e stato attivo li cambia solo un admin
  if (select auth.uid()) is not null
     and (new.role is distinct from old.role
          or new.is_active is distinct from old.is_active)
     and not public.is_admin() then
    raise exception 'Solo un admin può modificare ruolo o stato attivo'
      using errcode = '42501';
  end if;

  -- Nuovo: l'email arriva da auth. Cambiarla qui la desincronizza, e in
  -- elenchi e menzioni si finisce per leggere una persona per un'altra.
  if (select auth.uid()) is not null
     and new.email is distinct from old.email
     and not public.is_admin() then
    raise exception 'L''email si cambia dalle impostazioni di accesso'
      using errcode = '42501';
  end if;

  -- Invariante assoluta: deve restare almeno un admin attivo
  if old.role = 'admin' and old.is_active
     and (new.role <> 'admin' or not new.is_active) then
    if not exists (
      select 1 from public.profiles p
      where p.role = 'admin' and p.is_active and p.id <> old.id
    ) then
      raise exception 'Operazione negata: è l''ultimo admin attivo'
        using errcode = 'P0001';
    end if;
  end if;

  -- Invariante assoluta (D8): niente disattivazione con task aperti
  if old.is_active and not new.is_active then
    if exists (
      select 1 from public.tasks t
      where t.owner_id = old.id and t.status <> 'done'
    ) then
      raise exception
        'L''utente è responsabile di task aperti: riassegnarli prima di disattivarlo'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

-- #############################################################################
-- M10 -- Sotto-task: un lavoro, piu' mani
-- (equivale a supabase/migrations/20260825140000_m10_sotto_task.sql)
-- #############################################################################

-- =============================================================================
-- Lacertosus Office OS -- migrazione M10: un lavoro, piu' mani
--
-- In un ufficio marketing/e-commerce/video il lavoro non e' mai un blocco
-- solo: "Video prodotto X" sono riprese, montaggio, testi, caricamento,
-- ADV -- mani diverse, tempi diversi. Finora c'erano tre mezze risposte:
-- la checklist (passaggi senza nome), i collaboratori (nomi senza lavoro
-- proprio) e i pacchetti da template (lavori con nome, ma solo partendo da
-- un template e senza padre).
--
-- Qui arriva la risposta intera: un task puo' contenere SOTTO-TASK, e ogni
-- sotto-task e' un task vero -- con il suo responsabile, la sua scadenza, il
-- suo stato. Compare nella board e nel carico di chi lo esegue, perche' e'
-- lavoro suo; il padre resta il quadro d'insieme, con un referente che
-- risponde del risultato.
--
-- Il principio del prodotto non si rompe: OGNI task (padre o figlio) ha un
-- solo responsabile. "Piu' responsabili su un lavoro" significa piu' pezzi con
-- un nome ciascuno, non piu' nomi sullo stesso pezzo -- altrimenti carico,
-- solleciti ed escalation non saprebbero piu' a chi rivolgersi.
--
-- UN SOLO LIVELLO di annidamento, per scelta: servono liste di lavori, non
-- alberi in cui perdersi. Un sotto-task non puo' avere figli.
--
-- Regola del repo: additiva. M1-M9 non si toccano.
-- (M7 e M8 vivono nelle PR #28 e #29; questa migrazione non le presuppone.)
-- =============================================================================

alter table public.tasks
  add column if not exists parent_id uuid
    references public.tasks (id) on delete cascade;

comment on column public.tasks.parent_id is
  'Task padre di cui questo è un pezzo. NULL = lavoro principale. Un solo livello: un sotto-task non può avere figli. Cancellando il padre spariscono i pezzi (on delete cascade).';

-- La lettura tipica e' "i pezzi di questo lavoro".
create index if not exists tasks_parent_idx
  on public.tasks (parent_id)
  where parent_id is not null;

-- -----------------------------------------------------------------------------
-- 1. Le regole della gerarchia
--
-- Un solo livello, niente cicli, e il pezzo sta nel progetto del suo lavoro:
-- se i due divergessero, report e board racconterebbero storie diverse.
-- -----------------------------------------------------------------------------
create or replace function public.tasks_gerarchia_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  padre public.tasks%rowtype;
begin
  if new.parent_id is null then
    -- Un lavoro che ha pezzi non puo' diventare a sua volta un pezzo: si
    -- creerebbe il secondo livello dalla porta di servizio.
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'Un task non può essere pezzo di sé stesso'
      using errcode = '23514';
  end if;

  select * into padre from public.tasks where id = new.parent_id;

  if not found then
    raise exception 'Il task padre non esiste' using errcode = '23503';
  end if;

  if padre.parent_id is not null then
    raise exception 'Un sotto-task non può avere sotto-task: si divide il lavoro, non lo si annida'
      using errcode = '23514';
  end if;

  if exists (
    select 1 from public.tasks f
    where f.parent_id = new.id
  ) then
    raise exception 'Questo task ha già dei pezzi: non può diventare pezzo di un altro'
      using errcode = '23514';
  end if;

  -- Il pezzo segue il progetto del lavoro: nessuna divergenza possibile.
  new.project_id = padre.project_id;

  return new;
end;
$$;

drop trigger if exists tasks_gerarchia_guard on public.tasks;
create trigger tasks_gerarchia_guard
  before insert or update of parent_id, project_id on public.tasks
  for each row execute function public.tasks_gerarchia_guard();

-- -----------------------------------------------------------------------------
-- 2. Chi lavora un pezzo
--
-- Si estende la regola di M9: oltre a responsabile, creatore, collaboratori
-- e responsabili del workspace, un pezzo lo governa anche il REFERENTE DEL
-- LAVORO PADRE. Chi guida un lavoro deve poterlo organizzare senza chiedere
-- il permesso a ogni passo -- e' la scelta presa il 25/08/2026.
-- -----------------------------------------------------------------------------
create or replace function public.puo_modificare_task(task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.tasks t
      left join public.tasks p on p.id = t.parent_id
      where t.id = task_id
        and public.is_active_member()
        and (
          t.owner_id = (select auth.uid())
          or t.created_by = (select auth.uid())
          or p.owner_id = (select auth.uid())
          or exists (
            select 1 from public.task_collaborators c
            where c.task_id = t.id and c.user_id = (select auth.uid())
          )
        )
    );
$$;

comment on function public.puo_modificare_task is
  'Vero se chi chiama è responsabile del task, lo ha creato, vi collabora, è referente del lavoro padre, oppure è un responsabile del workspace.';

-- -----------------------------------------------------------------------------
-- 3. Creare un pezzo e darlo a un collega
--
-- M9 aveva chiuso l'assegnazione ad altri ai soli responsabili. Il referente
-- di un lavoro pero' deve poter distribuire i pezzi del PROPRIO lavoro: e'
-- l'eccezione decisa insieme, e vale solo dentro il perimetro del padre.
-- -----------------------------------------------------------------------------
drop policy if exists tasks_insert_own_or_admin on public.tasks;

drop policy if exists tasks_insert_own_or_delegato on public.tasks;
create policy tasks_insert_own_or_delegato
  on public.tasks for insert to authenticated
  with check (
    (select public.is_active_member())
    and created_by = (select auth.uid())
    and (
      (select public.is_admin())
      -- Un lavoro per se': sempre.
      or owner_id = (select auth.uid())
      -- Un pezzo del proprio lavoro, affidato a un collega.
      or (
        parent_id is not null
        and exists (
          select 1 from public.tasks p
          where p.id = parent_id and p.owner_id = (select auth.uid())
        )
      )
    )
  );

-- La riassegnazione segue la stessa logica: il referente del lavoro puo'
-- spostare un pezzo da una persona all'altra, dentro il suo perimetro.
create or replace function public.tasks_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  referente_padre uuid;
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'La paternità di un task non si cambia'
      using errcode = '42501';
  end if;

  if new.owner_id is distinct from old.owner_id and not public.is_admin() then
    select p.owner_id into referente_padre
    from public.tasks p
    where p.id = new.parent_id;

    if referente_padre is null or referente_padre <> (select auth.uid()) then
      raise exception 'Solo un responsabile, o il referente del lavoro, può riassegnare'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

commit;

-- =============================================================================
-- Fatto. Da qui in poi il CRM puo' usare le ricorrenze fitte, gli aggiornamenti
-- dal vivo, il confine fra responsabili e dipendenti e i sotto-task.
-- =============================================================================
