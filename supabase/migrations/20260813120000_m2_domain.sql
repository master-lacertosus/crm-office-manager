-- =============================================================================
-- Lacertosus Office OS — migrazione M2: il dominio completo
-- Specifica: docs/DATABASE_SCHEMA.md · Sicurezza: docs/SECURITY_MODEL.md
--
-- M1 aveva 4 tabelle (profiles, projects, tasks, task_comments). Da allora
-- l'app ha aggiunto fasi custom, checklist, cronologia, bacheche di progetto,
-- richieste di task, ferie e permessi, avvisi, template ricorrenti e le
-- preferenze personali. Questa migrazione colma il divario.
--
-- Regola del repo: additiva. M1 non si modifica; qui si estende soltanto.
-- Convenzioni ereditate da M1: policy sempre `to authenticated` (anon negato
-- ovunque), helper `is_active_member()` / `is_admin()` avvolti in (select …)
-- perché STABLE, `set search_path = ''` su ogni funzione.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Profili: colonne mancanti
--    L'email vive in auth.users, ma l'app la mostra in chiaro nelle liste
--    (menzioni, assegnazioni) e leggere auth.users dal client è vietato:
--    la si replica qui, popolata dal trigger di creazione.
-- -----------------------------------------------------------------------------

alter table public.profiles
  add column if not exists email text,
  add column if not exists title text
    constraint profiles_title_length
    check (title is null or char_length(trim(title)) between 1 and 80);

comment on column public.profiles.email is
  'Copia di auth.users.email: il client non può leggere lo schema auth.';
comment on column public.profiles.title is
  'Qualifica mostrata accanto al nome (es. «Responsabile · Webmaster»).';

-- Il trigger di M1 non conosceva email e qualifica: lo si sostituisce.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url, title)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1),
      'Utente'
    ),
    new.email,
    new.raw_user_meta_data ->> 'avatar_url',
    nullif(trim(new.raw_user_meta_data ->> 'title'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Cambio email dal pannello auth: si riflette sul profilo.
create function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- 2. Fasi del flusso
--    M1 vincolava tasks.status a 5 valori con un CHECK. L'app ha aggiunto la
--    fase «Problema» e fino a 3 fasi custom decise dagli admin: un CHECK non
--    basta più (non può leggere un'altra tabella). Si normalizza in tabella
--    con chiave esterna, così le fasi custom sono dati e non DDL.
-- -----------------------------------------------------------------------------

create table public.task_statuses (
  key text primary key
    constraint task_statuses_key_format check (key ~ '^[a-z0-9_]{2,32}$'),
  label text not null
    constraint task_statuses_label_length
    check (char_length(trim(label)) between 1 and 40),
  -- Terna cromatica già verificata su superficie chiara (CUSTOM_STATUS_PRESETS).
  color text not null constraint task_statuses_color_hex check (color ~* '^#[0-9a-f]{6}$'),
  soft  text not null constraint task_statuses_soft_hex  check (soft  ~* '^#[0-9a-f]{6}$'),
  text_color text not null constraint task_statuses_text_hex check (text_color ~* '^#[0-9a-f]{6}$'),
  kind text not null
    constraint task_statuses_kind_valid check (kind in ('core', 'alert', 'custom')),
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.task_statuses is
  'Fasi della board: core e alert sono di sistema, le custom le aggiungono gli admin (max 3).';
comment on column public.task_statuses.sort_order is
  'Ordine in board. Le custom si inseriscono fra in_progress e in_review.';

-- Fasi di sistema. I colori rispecchiano lib/types.ts.
insert into public.task_statuses (key, label, color, soft, text_color, kind, sort_order) values
  ('backlog',     'Backlog',     '#64748B', '#F1F5F9', '#475569', 'core',  10),
  ('todo',        'Da fare',     '#0EA5E9', '#E0F2FE', '#0369A1', 'core',  20),
  ('in_progress', 'In corso',    '#F59E0B', '#FEF3C7', '#B45309', 'core',  30),
  ('in_review',   'In revisione','#8B5CF6', '#EDE9FE', '#6D28D9', 'core',  50),
  ('alert',       'Problema',    '#EF4444', '#FEE2E2', '#B91C1C', 'alert', 60),
  ('done',        'Fatto',       '#16A365', '#E7F6EF', '#0E7A4A', 'core',  70)
on conflict (key) do nothing;

-- Le fasi di sistema non si cancellano e non cambiano natura.
create function public.task_statuses_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.kind <> 'custom' then
      raise exception 'Le fasi di sistema non si eliminano'
        using errcode = 'P0001';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.kind <> new.kind then
    raise exception 'La natura di una fase non si cambia'
      using errcode = 'P0001';
  end if;

  -- Regola di prodotto: al massimo 3 fasi custom.
  if new.kind = 'custom'
     and (tg_op = 'INSERT' or old.kind <> 'custom') then
    if (select count(*) from public.task_statuses where kind = 'custom') >= 3 then
      raise exception 'Massimo 3 fasi personalizzate'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create trigger task_statuses_guard
  before insert or update or delete on public.task_statuses
  for each row execute function public.task_statuses_guard();

-- tasks.status: dal CHECK di M1 alla chiave esterna.
-- I task che stavano in una fase custom eliminata tornano in «Da fare»
-- (on delete set default), coerente con l'undo previsto dall'app.
alter table public.tasks
  drop constraint if exists tasks_status_valid;

alter table public.tasks
  alter column status set default 'todo';

alter table public.tasks
  add constraint tasks_status_fkey
  foreign key (status) references public.task_statuses (key)
  on update cascade on delete set default;

-- -----------------------------------------------------------------------------
-- 3. Task: colonne aggiunte dall'app dopo M1
-- -----------------------------------------------------------------------------

alter table public.tasks
  add column if not exists problem_reason text
    constraint tasks_problem_reason_length
    check (problem_reason is null or char_length(trim(problem_reason)) between 1 and 2000),
  add column if not exists problem_since timestamptz,
  add column if not exists repeat text not null default 'none'
    constraint tasks_repeat_valid
    check (repeat in ('none', 'weekly', 'biweekly', 'monthly')),
  add column if not exists template_id uuid,
  add column if not exists batch_id uuid,
  add column if not exists archived_at timestamptz;

comment on column public.tasks.problem_since is
  'Momento di ingresso in fase Problema: alimenta tempo-in-fase ed escalation.';
comment on column public.tasks.batch_id is
  'Task nati insieme da un template «pacchetto» condividono il batch.';
comment on column public.tasks.archived_at is
  'Auto-archivio dei Fatto: esce dalla board, resta nei report.';

-- problem_since ha senso solo in fase alert: lo si tiene allineato da trigger
-- invece che da codice applicativo, così vale anche per import e SQL diretto.
create function public.tasks_sync_problem_since()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'alert'
     and (tg_op = 'INSERT' or old.status is distinct from 'alert') then
    new.problem_since = now();
  elsif new.status <> 'alert' then
    new.problem_since = null;
    new.problem_reason = null;
  end if;
  return new;
end;
$$;

create trigger tasks_problem_since
  before insert or update on public.tasks
  for each row execute function public.tasks_sync_problem_since();

-- -----------------------------------------------------------------------------
-- 4. Checklist del task
--    Tabella e non JSON: le spunte si cambiano una alla volta e l'ordine conta.
-- -----------------------------------------------------------------------------

create table public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  -- «body» e non «text»: in Postgres `text` è anche un nome di tipo e dentro
  -- una CHECK verrebbe letto come cast.
  body text not null
    constraint checklist_body_length
    check (char_length(trim(body)) between 1 and 500),
  done boolean not null default false,
  position numeric not null
    default (extract(epoch from clock_timestamp()) * 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 5. Allegati-link
-- -----------------------------------------------------------------------------

create table public.task_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  url text not null
    constraint task_links_url_format check (url ~* '^https?://.{1,2000}$'),
  label text
    constraint task_links_label_length
    check (label is null or char_length(trim(label)) between 1 and 120),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 6. Cronologia dei task (registro append-only)
--    Alimenta la timeline del dettaglio e i report per intervallo di date.
-- -----------------------------------------------------------------------------

create table public.task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  actor_id uuid not null references public.profiles (id),
  type text not null
    constraint task_events_type_valid check (type in (
      'created', 'status_changed', 'due_changed',
      'owner_changed', 'priority_changed', 'archived', 'restored'
    )),
  from_value text,
  to_value text,
  created_at timestamptz not null default now()
);

comment on table public.task_events is
  'Append-only: nessuna policy UPDATE/DELETE se non per gli admin.';

-- -----------------------------------------------------------------------------
-- 7. Commenti: decisioni e reazioni
-- -----------------------------------------------------------------------------

alter table public.task_comments
  add column if not exists is_decision boolean not null default false;

comment on column public.task_comments.is_decision is
  'Marcato come decisione: finisce nel registro del progetto.';

create table public.task_comment_reactions (
  comment_id uuid not null references public.task_comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null
    constraint task_reactions_emoji_valid check (emoji in ('👍', '✅', '⚠️')),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id, emoji)
);

-- Bacheca di progetto: stessa forma dei commenti task.
create table public.project_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  body text not null
    constraint project_comments_body_length
    check (char_length(trim(body)) between 1 and 4000),
  is_decision boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_comment_reactions (
  comment_id uuid not null references public.project_comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null
    constraint project_reactions_emoji_valid check (emoji in ('👍', '✅', '⚠️')),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id, emoji)
);

-- -----------------------------------------------------------------------------
-- 8. Avvisi interni (la campanella)
-- -----------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  to_user_id uuid not null references public.profiles (id) on delete cascade,
  from_user_id uuid not null references public.profiles (id),
  message text not null
    constraint notifications_message_length
    check (char_length(trim(message)) between 1 and 1000),
  task_id uuid references public.tasks (id) on delete cascade,
  kind text not null default 'sistema'
    constraint notifications_kind_valid
    check (kind in ('mention', 'sollecito', 'sistema')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- -----------------------------------------------------------------------------
-- 9. Ferie, permessi e chiusure aziendali
-- -----------------------------------------------------------------------------

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  type text not null
    constraint leave_type_valid check (type in ('ferie', 'permesso')),
  start_date date not null,
  end_date date not null,
  -- Solo permesso: fascia oraria libera (es. «9:00–13:00»).
  time_range text
    constraint leave_time_range_length
    check (time_range is null or char_length(trim(time_range)) between 1 and 40),
  note text
    constraint leave_note_length
    check (note is null or char_length(note) <= 2000),
  status text not null default 'pending'
    constraint leave_status_valid check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  decision_note text
    constraint leave_decision_note_length
    check (decision_note is null or char_length(decision_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_range_ordered check (end_date >= start_date),
  -- Coerenza della decisione: o è tutto nullo, o è tutto valorizzato.
  constraint leave_decision_complete check (
    (status = 'pending' and decided_by is null and decided_at is null)
    or (status <> 'pending' and decided_by is not null and decided_at is not null)
  ),
  -- Il rifiuto esige una motivazione (regola di prodotto).
  constraint leave_rejection_needs_note check (
    status <> 'rejected' or char_length(trim(coalesce(decision_note, ''))) > 0
  )
);

comment on table public.leave_requests is
  'Le approvate compongono il calendario dell''ufficio, visibile a tutti.';

create table public.company_closures (
  id uuid primary key default gen_random_uuid(),
  title text not null
    constraint closure_title_length
    check (char_length(trim(title)) between 1 and 120),
  start_date date not null,
  end_date date not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint closure_range_ordered check (end_date >= start_date)
);

-- -----------------------------------------------------------------------------
-- 10. Richieste di task
-- -----------------------------------------------------------------------------

create table public.task_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null
    constraint request_title_length
    check (char_length(trim(title)) between 1 and 200),
  description text
    constraint request_description_length
    check (description is null or char_length(description) <= 8000),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    constraint request_status_valid check (status in ('pending', 'approved', 'rejected')),
  -- Proposte del richiedente: pre-compilano il form di approvazione.
  requested_due date,
  priority text not null default 'normal'
    constraint request_priority_valid check (priority in ('low', 'normal', 'high')),
  -- Esito.
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  rejection_reason text
    constraint request_rejection_length
    check (rejection_reason is null or char_length(rejection_reason) <= 2000),
  owner_id uuid references public.profiles (id),
  due_date date,
  project_id uuid references public.projects (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint request_decision_complete check (
    (status = 'pending' and decided_by is null and decided_at is null)
    or (status <> 'pending' and decided_by is not null and decided_at is not null)
  ),
  constraint request_rejection_needs_reason check (
    status <> 'rejected' or char_length(trim(coalesce(rejection_reason, ''))) > 0
  ),
  -- L'approvazione deve produrre un assegnatario.
  constraint request_approval_needs_owner check (
    status <> 'approved' or owner_id is not null
  )
);

-- -----------------------------------------------------------------------------
-- 11. Template di attività ricorrenti
--     links e checklist restano JSONB: sono liste brevi, sempre lette e
--     scritte per intero insieme al template, mai interrogate singolarmente.
--     Le voci del «pacchetto» invece sono righe: hanno responsabile e offset
--     propri e servono per generare i task.
-- -----------------------------------------------------------------------------

create table public.workspace_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null
    constraint template_name_length
    check (char_length(trim(name)) between 1 and 120),
  description text not null default ''
    constraint template_description_length check (char_length(description) <= 2000),
  project_id uuid references public.projects (id) on delete set null,
  owner_id uuid references public.profiles (id) on delete set null,
  priority text not null default 'normal'
    constraint template_priority_valid check (priority in ('low', 'normal', 'high')),
  repeat text not null default 'none'
    constraint template_repeat_valid
    check (repeat in ('none', 'weekly', 'biweekly', 'monthly')),
  -- Giorno del mese proposto come scadenza: 1–28 per esistere ovunque.
  due_day smallint
    constraint template_due_day_range check (due_day is null or due_day between 1 and 28),
  checklist jsonb not null default '[]'::jsonb
    constraint template_checklist_is_array check (jsonb_typeof(checklist) = 'array'),
  links jsonb not null default '[]'::jsonb
    constraint template_links_is_array check (jsonb_typeof(links) = 'array'),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_template_pack_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workspace_templates (id) on delete cascade,
  title text not null
    constraint pack_item_title_length
    check (char_length(trim(title)) between 1 and 200),
  owner_id uuid references public.profiles (id) on delete set null,
  -- Giorni rispetto alla data àncora scelta alla creazione (negativi = prima).
  offset_days integer not null default 0,
  position numeric not null
    default (extract(epoch from clock_timestamp()) * 1000),
  created_at timestamptz not null default now()
);

-- tasks.template_id acquista il vincolo ora che la tabella esiste.
alter table public.tasks
  add constraint tasks_template_id_fkey
  foreign key (template_id) references public.workspace_templates (id)
  on delete set null;

-- -----------------------------------------------------------------------------
-- 12. Stato personale
--     Focus di oggi, snooze, viste salvate e preferenze d'aspetto: righe
--     private, ognuno vede e scrive solo le proprie.
-- -----------------------------------------------------------------------------

create table public.user_task_state (
  user_id uuid not null references public.profiles (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  is_focus boolean not null default false,
  snoozed_until date,
  updated_at timestamptz not null default now(),
  primary key (user_id, task_id)
);

comment on table public.user_task_state is
  'Focus di oggi (max 3, vincolo applicativo) e snooze personale.';

create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null
    constraint saved_view_name_length
    check (char_length(trim(name)) between 1 and 80),
  -- Query string dei filtri della pagina Task.
  params text not null
    constraint saved_view_params_length check (char_length(params) <= 2000),
  created_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- Aspetto: accento, densità, movimento (Impostazioni › Aspetto).
  appearance jsonb not null default '{}'::jsonb
    constraint preferences_appearance_is_object
    check (jsonb_typeof(appearance) = 'object'),
  -- Layout della dashboard, per utente.
  dashboard_layout jsonb not null default '{}'::jsonb
    constraint preferences_dashboard_is_object
    check (jsonb_typeof(dashboard_layout) = 'object'),
  -- Fasi compresse in strip verticali sulla board.
  collapsed_statuses jsonb not null default '[]'::jsonb
    constraint preferences_collapsed_is_array
    check (jsonb_typeof(collapsed_statuses) = 'array'),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 13. Indici
--     Uno per ogni chiave esterna usata in join o filtro, più gli ordinamenti
--     che l'app fa davvero (cronologie e avvisi per data discendente).
-- -----------------------------------------------------------------------------

create index tasks_template_id_idx on public.tasks (template_id);
create index tasks_batch_id_idx on public.tasks (batch_id);
create index tasks_archived_at_idx on public.tasks (archived_at);

create index checklist_task_id_idx on public.task_checklist_items (task_id, position);
create index task_links_task_id_idx on public.task_links (task_id);

create index task_events_task_id_idx on public.task_events (task_id, created_at desc);
create index task_events_actor_id_idx on public.task_events (actor_id);
create index task_events_created_at_idx on public.task_events (created_at desc);

create index task_reactions_user_id_idx on public.task_comment_reactions (user_id);
create index project_comments_project_id_idx on public.project_comments (project_id, created_at desc);
create index project_comments_author_id_idx on public.project_comments (author_id);
create index project_reactions_user_id_idx on public.project_comment_reactions (user_id);

-- La campanella legge sempre «i miei, non letti, dal più recente».
create index notifications_to_user_idx
  on public.notifications (to_user_id, created_at desc);
create index notifications_unread_idx
  on public.notifications (to_user_id) where read_at is null;
create index notifications_task_id_idx on public.notifications (task_id);

create index leave_requester_idx on public.leave_requests (requester_id);
create index leave_status_idx on public.leave_requests (status);
create index leave_range_idx on public.leave_requests (start_date, end_date);
create index closures_range_idx on public.company_closures (start_date, end_date);

create index requests_requester_idx on public.task_requests (requester_id);
create index requests_status_idx on public.task_requests (status);
create index requests_task_id_idx on public.task_requests (task_id);

create index templates_project_id_idx on public.workspace_templates (project_id);
create index templates_owner_id_idx on public.workspace_templates (owner_id);
create index pack_items_template_id_idx on public.workspace_template_pack_items (template_id, position);

create index user_task_state_task_idx on public.user_task_state (task_id);
create index user_task_state_focus_idx
  on public.user_task_state (user_id) where is_focus;
create index saved_views_user_id_idx on public.saved_views (user_id);

-- -----------------------------------------------------------------------------
-- 14. updated_at automatico sulle nuove tabelle
-- -----------------------------------------------------------------------------

create trigger set_updated_at before update on public.task_statuses
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.task_checklist_items
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.project_comments
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.leave_requests
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.company_closures
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.task_requests
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.workspace_templates
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.user_task_state
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 15. Row Level Security
--     Come in M1: tutto `to authenticated`, anon negato ovunque.
-- -----------------------------------------------------------------------------

alter table public.task_statuses enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_links enable row level security;
alter table public.task_events enable row level security;
alter table public.task_comment_reactions enable row level security;
alter table public.project_comments enable row level security;
alter table public.project_comment_reactions enable row level security;
alter table public.notifications enable row level security;
alter table public.leave_requests enable row level security;
alter table public.company_closures enable row level security;
alter table public.task_requests enable row level security;
alter table public.workspace_templates enable row level security;
alter table public.workspace_template_pack_items enable row level security;
alter table public.user_task_state enable row level security;
alter table public.saved_views enable row level security;
alter table public.user_preferences enable row level security;

-- --- Fasi: le legge chiunque sia attivo, le tocca solo un admin ---------------

create policy statuses_select_active_members
  on public.task_statuses for select to authenticated
  using ((select public.is_active_member()));

create policy statuses_insert_admin
  on public.task_statuses for insert to authenticated
  with check ((select public.is_admin()));

create policy statuses_update_admin
  on public.task_statuses for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy statuses_delete_admin
  on public.task_statuses for delete to authenticated
  using ((select public.is_admin()));

-- --- Checklist: segue il task (chi può vederlo, può spuntarlo) ----------------

create policy checklist_select_active_members
  on public.task_checklist_items for select to authenticated
  using ((select public.is_active_member()));

create policy checklist_write_active_members
  on public.task_checklist_items for insert to authenticated
  with check ((select public.is_active_member()));

create policy checklist_update_active_members
  on public.task_checklist_items for update to authenticated
  using ((select public.is_active_member()))
  with check ((select public.is_active_member()));

create policy checklist_delete_active_members
  on public.task_checklist_items for delete to authenticated
  using ((select public.is_active_member()));

-- --- Allegati-link ------------------------------------------------------------

create policy links_select_active_members
  on public.task_links for select to authenticated
  using ((select public.is_active_member()));

create policy links_insert_own
  on public.task_links for insert to authenticated
  with check (
    (select public.is_active_member())
    and created_by = (select auth.uid())
  );

create policy links_delete_own_or_admin
  on public.task_links for delete to authenticated
  using (
    (select public.is_admin())
    or ((select public.is_active_member()) and created_by = (select auth.uid()))
  );

-- --- Cronologia: append-only. Si scrive a proprio nome, non si riscrive -------

create policy events_select_active_members
  on public.task_events for select to authenticated
  using ((select public.is_active_member()));

create policy events_insert_own
  on public.task_events for insert to authenticated
  with check (
    (select public.is_active_member())
    and actor_id = (select auth.uid())
  );

-- Nessuna policy UPDATE/DELETE: la cronologia non si corregge.

-- --- Reazioni: ognuno mette e toglie le proprie -------------------------------

create policy task_reactions_select_active_members
  on public.task_comment_reactions for select to authenticated
  using ((select public.is_active_member()));

create policy task_reactions_insert_own
  on public.task_comment_reactions for insert to authenticated
  with check (
    (select public.is_active_member())
    and user_id = (select auth.uid())
  );

create policy task_reactions_delete_own
  on public.task_comment_reactions for delete to authenticated
  using (
    (select public.is_active_member())
    and user_id = (select auth.uid())
  );

-- --- Bacheca di progetto ------------------------------------------------------

create policy project_comments_select_active_members
  on public.project_comments for select to authenticated
  using ((select public.is_active_member()));

create policy project_comments_insert_own
  on public.project_comments for insert to authenticated
  with check (
    (select public.is_active_member())
    and author_id = (select auth.uid())
  );

-- Il testo lo cambia solo l'autore; la marcatura «decisione» è collettiva,
-- quindi la si consente a ogni membro attivo (la guardia sotto separa i casi).
create policy project_comments_update_own_or_decision
  on public.project_comments for update to authenticated
  using ((select public.is_active_member()))
  with check ((select public.is_active_member()));

create policy project_comments_delete_own_or_admin
  on public.project_comments for delete to authenticated
  using (
    (select public.is_admin())
    or ((select public.is_active_member()) and author_id = (select auth.uid()))
  );

create function public.project_comments_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and new.body is distinct from old.body
     and old.author_id <> (select auth.uid()) then
    raise exception 'Solo l''autore può modificare il testo del messaggio'
      using errcode = '42501';
  end if;
  if new.author_id is distinct from old.author_id then
    raise exception 'L''autore di un messaggio non si cambia'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger project_comments_guard
  before update on public.project_comments
  for each row execute function public.project_comments_guard();

create policy project_reactions_select_active_members
  on public.project_comment_reactions for select to authenticated
  using ((select public.is_active_member()));

create policy project_reactions_insert_own
  on public.project_comment_reactions for insert to authenticated
  with check (
    (select public.is_active_member())
    and user_id = (select auth.uid())
  );

create policy project_reactions_delete_own
  on public.project_comment_reactions for delete to authenticated
  using (
    (select public.is_active_member())
    and user_id = (select auth.uid())
  );

-- --- Avvisi: li legge il destinatario, li scrive chi li manda ----------------
--     Nessuno può leggere gli avvisi altrui, nemmeno un admin: sono posta.

create policy notifications_select_recipient
  on public.notifications for select to authenticated
  using (to_user_id = (select auth.uid()));

create policy notifications_insert_sender
  on public.notifications for insert to authenticated
  with check (
    (select public.is_active_member())
    and from_user_id = (select auth.uid())
  );

-- Il destinatario può solo segnarli letti (la guardia impedisce il resto).
create policy notifications_update_recipient
  on public.notifications for update to authenticated
  using (to_user_id = (select auth.uid()))
  with check (to_user_id = (select auth.uid()));

create function public.notifications_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.message is distinct from old.message
     or new.from_user_id is distinct from old.from_user_id
     or new.to_user_id is distinct from old.to_user_id
     or new.task_id is distinct from old.task_id
     or new.kind is distinct from old.kind then
    raise exception 'Di un avviso si può cambiare solo lo stato di lettura'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger notifications_guard
  before update on public.notifications
  for each row execute function public.notifications_guard();

-- --- Ferie e permessi ---------------------------------------------------------
--     Visibili a tutti: compongono il calendario dell'ufficio. Decide un admin.

create policy leave_select_active_members
  on public.leave_requests for select to authenticated
  using ((select public.is_active_member()));

create policy leave_insert_own
  on public.leave_requests for insert to authenticated
  with check (
    (select public.is_active_member())
    and requester_id = (select auth.uid())
    and status = 'pending'
  );

create policy leave_update_own_or_admin
  on public.leave_requests for update to authenticated
  using (
    (select public.is_admin())
    or ((select public.is_active_member()) and requester_id = (select auth.uid()))
  )
  with check (
    (select public.is_admin())
    or ((select public.is_active_member()) and requester_id = (select auth.uid()))
  );

-- Ritiro: il richiedente cancella solo se ancora in attesa.
create policy leave_delete_own_pending_or_admin
  on public.leave_requests for delete to authenticated
  using (
    (select public.is_admin())
    or (
      (select public.is_active_member())
      and requester_id = (select auth.uid())
      and status = 'pending'
    )
  );

-- La decisione la prende un admin, e non su sé stesso.
create function public.leave_requests_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
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

create trigger leave_requests_guard
  before update on public.leave_requests
  for each row execute function public.leave_requests_guard();

-- --- Chiusure aziendali: le legge chiunque, le mette un admin -----------------

create policy closures_select_active_members
  on public.company_closures for select to authenticated
  using ((select public.is_active_member()));

create policy closures_insert_admin
  on public.company_closures for insert to authenticated
  with check (
    (select public.is_admin())
    and created_by = (select auth.uid())
  );

create policy closures_update_admin
  on public.company_closures for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy closures_delete_admin
  on public.company_closures for delete to authenticated
  using ((select public.is_admin()));

-- --- Richieste di task --------------------------------------------------------

create policy requests_select_active_members
  on public.task_requests for select to authenticated
  using ((select public.is_active_member()));

create policy requests_insert_own
  on public.task_requests for insert to authenticated
  with check (
    (select public.is_active_member())
    and requester_id = (select auth.uid())
    and status = 'pending'
  );

create policy requests_update_own_or_admin
  on public.task_requests for update to authenticated
  using (
    (select public.is_admin())
    or ((select public.is_active_member()) and requester_id = (select auth.uid()))
  )
  with check (
    (select public.is_admin())
    or ((select public.is_active_member()) and requester_id = (select auth.uid()))
  );

create policy requests_delete_own_pending_or_admin
  on public.task_requests for delete to authenticated
  using (
    (select public.is_admin())
    or (
      (select public.is_active_member())
      and requester_id = (select auth.uid())
      and status = 'pending'
    )
  );

create function public.task_requests_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if new.status is distinct from old.status then
    if not public.is_admin() then
      raise exception 'Solo un responsabile può decidere una richiesta di task'
        using errcode = '42501';
    end if;
    new.decided_by = (select auth.uid());
    new.decided_at = now();
  end if;

  return new;
end;
$$;

create trigger task_requests_guard
  before update on public.task_requests
  for each row execute function public.task_requests_guard();

-- --- Template: li legge chiunque, li configurano i responsabili ---------------

create policy templates_select_active_members
  on public.workspace_templates for select to authenticated
  using ((select public.is_active_member()));

create policy templates_insert_admin
  on public.workspace_templates for insert to authenticated
  with check (
    (select public.is_admin())
    and created_by = (select auth.uid())
  );

create policy templates_update_admin
  on public.workspace_templates for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy templates_delete_admin
  on public.workspace_templates for delete to authenticated
  using ((select public.is_admin()));

create policy pack_items_select_active_members
  on public.workspace_template_pack_items for select to authenticated
  using ((select public.is_active_member()));

create policy pack_items_write_admin
  on public.workspace_template_pack_items for insert to authenticated
  with check ((select public.is_admin()));

create policy pack_items_update_admin
  on public.workspace_template_pack_items for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy pack_items_delete_admin
  on public.workspace_template_pack_items for delete to authenticated
  using ((select public.is_admin()));

-- --- Stato personale: solo il proprio, admin inclusi --------------------------

create policy user_task_state_all_own
  on public.user_task_state for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy saved_views_all_own
  on public.saved_views for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy user_preferences_all_own
  on public.user_preferences for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
