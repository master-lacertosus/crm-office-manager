-- =============================================================================
-- Lacertosus Office OS — migrazione M9: responsabili e dipendenti
--
-- Il modello di M1 era la «trasparenza D5»: ogni membro attivo poteva
-- modificare qualunque cosa, perché la proprietà era responsabilità e non un
-- lucchetto. Decisione del committente del 25/08/2026: il workspace ha due
-- responsabili (Francesco e Sara) che governano tutto; gli altri sono
-- dipendenti e mettono le mani su ciò che li riguarda.
--
-- Questa migrazione sposta quel confine dove conta — nel database. Nasconde
-- un pulsante è cosmetica: chi conosce l'API scrive lo stesso.
--
-- Insieme al confine si chiudono i buchi emersi dall'audit, che erano tali
-- anche col modello vecchio:
--   · una ferie GIÀ APPROVATA restava modificabile dal richiedente (date
--     spostate a piacere, e persino la firma di chi aveva approvato);
--   · idem per una richiesta di task approvata;
--   · si poteva cancellare il task di chiunque in due mosse: prima
--     riassegnarlo a sé, poi eliminarlo da «proprietario»;
--   · si potevano zittire le escalation verso i responsabili inserendo
--     avvisi con la chiave di deduplicazione indovinata;
--   · il registro append-only accettava eventi inventati su task altrui,
--     con data a piacere;
--   · si potevano marcare come «decisione» i commenti altrui, spostarli di
--     progetto e retrodatarli;
--   · si poteva togliere qualunque collaboratore da qualunque task;
--   · si poteva cambiare la propria email desincronizzandola da auth.
--
-- Un admin che approva la propria richiesta di task era possibile: sulle
-- ferie il divieto c'era già, sulle richieste no. Ora sono simmetriche.
--
-- Regola del repo: additiva. M1–M8 non si toccano. (M7 e M8 sono nelle PR
-- #28 e #29: questa migrazione non le presuppone e non le tocca.)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Chi può mettere le mani su un task
--
-- Una funzione sola, usata da tutte le policy che dipendono da questa
-- domanda: il responsabile del task, chi l'ha creato, i collaboratori, e i
-- responsabili del workspace. Se la regola cambia, cambia qui.
-- -----------------------------------------------------------------------------
create function public.puo_modificare_task(task_id uuid)
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
-- 1. Task: si modifica ciò che è proprio
-- -----------------------------------------------------------------------------
drop policy if exists tasks_update_active_members on public.tasks;

create policy tasks_update_own_or_admin
  on public.tasks for update to authenticated
  using ((select public.puo_modificare_task(id)))
  with check ((select public.puo_modificare_task(id)));

-- Chi crea un task lo prende in carico: assegnare lavoro ad altri è dei
-- responsabili, e per proporlo esiste il flusso delle Richieste.
drop policy if exists tasks_insert_own on public.tasks;

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

-- La riassegnazione e la paternità non si toccano da dipendenti: senza
-- questa guardia bastava passarsi un task per poterlo poi cancellare.
create function public.tasks_guard()
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

create trigger tasks_guard
  before update on public.tasks
  for each row execute function public.tasks_guard();

-- -----------------------------------------------------------------------------
-- 2. Progetti: nascono e cambiano per mano di un responsabile
-- -----------------------------------------------------------------------------
drop policy if exists projects_insert_own on public.projects;
drop policy if exists projects_update_active_members on public.projects;

create policy projects_insert_admin
  on public.projects for insert to authenticated
  with check (
    (select public.is_admin())
    and created_by = (select auth.uid())
  );

create policy projects_update_admin
  on public.projects for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- 3. Checklist: si spunta ciò che si può lavorare
-- -----------------------------------------------------------------------------
drop policy if exists checklist_write_active_members on public.task_checklist_items;
drop policy if exists checklist_update_active_members on public.task_checklist_items;
drop policy if exists checklist_delete_active_members on public.task_checklist_items;

create policy checklist_write_own_task
  on public.task_checklist_items for insert to authenticated
  with check ((select public.puo_modificare_task(task_id)));

create policy checklist_update_own_task
  on public.task_checklist_items for update to authenticated
  using ((select public.puo_modificare_task(task_id)))
  with check ((select public.puo_modificare_task(task_id)));

create policy checklist_delete_own_task
  on public.task_checklist_items for delete to authenticated
  using ((select public.puo_modificare_task(task_id)));

-- -----------------------------------------------------------------------------
-- 4. Ferie: una volta decise, le tocca solo un responsabile
-- -----------------------------------------------------------------------------
drop policy if exists leave_update_own_or_admin on public.leave_requests;

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
-- 6. Avvisi: la chiave di deduplicazione è del sistema
--
-- Indovinandola (il formato è deterministico) si poteva inserire in anticipo
-- l'avviso che le escalation avrebbero mandato ai responsabili: il vero
-- allarme sarebbe poi caduto sul conflitto, in silenzio.
-- -----------------------------------------------------------------------------
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
--    a piacere. È un registro: se si può riscrivere, non è un registro.
-- -----------------------------------------------------------------------------
drop policy if exists events_insert_own on public.task_events;

create policy events_insert_own_task
  on public.task_events for insert to authenticated
  with check (
    actor_id = (select auth.uid())
    and (select public.puo_modificare_task(task_id))
  );

create function public.task_events_guard()
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

create trigger task_events_guard
  before insert on public.task_events
  for each row execute function public.task_events_guard();

-- -----------------------------------------------------------------------------
-- 8. Collaboratori: li toglie chi ha titolo, o chi se ne va da solo
-- -----------------------------------------------------------------------------
drop policy if exists collaborators_delete_active_members on public.task_collaborators;

create policy collaborators_delete_own_task_or_self
  on public.task_collaborators for delete to authenticated
  using (
    (select public.puo_modificare_task(task_id))
    or user_id = (select auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 9. Commenti: restano dove sono nati, e la «decisione» la marca chi ha
--    titolo per farlo
-- -----------------------------------------------------------------------------
create function public.task_comments_guard()
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

create trigger task_comments_guard
  before update on public.task_comments
  for each row execute function public.task_comments_guard();

create or replace function public.project_comments_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $
begin
  -- L'autore non si cambia mai, nemmeno dal server: è la firma del messaggio.
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

  -- Nuovo: un messaggio resta nel progetto in cui è nato, con la sua data.
  if new.project_id is distinct from old.project_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Un messaggio non si sposta di progetto e non si retrodata'
      using errcode = '42501';
  end if;

  -- Nuovo: la marcatura «decisione» la mette chi ha scritto, o un
  -- responsabile. Prima poteva farlo chiunque sul messaggio di chiunque.
  if new.is_decision is distinct from old.is_decision
     and old.author_id <> (select auth.uid())
     and not public.is_admin() then
    raise exception 'Marca come decisione chi ha scritto il messaggio, o un responsabile'
      using errcode = '42501';
  end if;

  return new;
end;
$;

-- -----------------------------------------------------------------------------
-- 10. Profili: l'email è quella con cui si entra, non un'etichetta
-- -----------------------------------------------------------------------------
create or replace function public.profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $
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
$;
