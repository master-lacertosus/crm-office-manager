-- =============================================================================
-- Lacertosus Office OS — migrazione iniziale (M1)
-- Specifica: docs/DATABASE_SCHEMA.md · Sicurezza: docs/SECURITY_MODEL.md
-- Regola: questa migrazione non si modifica dopo l'applicazione; ogni
-- evoluzione è un nuovo file additivo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabelle
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null
    constraint profiles_full_name_length
    check (char_length(trim(full_name)) between 1 and 80),
  avatar_url text,
  role text not null default 'member'
    constraint profiles_role_valid check (role in ('admin', 'member')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Profilo 1:1 con auth.users. Mai cancellato: si disattiva (is_active).';

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null
    constraint projects_name_length
    check (char_length(trim(name)) between 1 and 80),
  description text
    constraint projects_description_length
    check (description is null or char_length(description) <= 2000),
  is_archived boolean not null default false,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.projects is
  'Unico livello di raggruppamento dei task. Si archivia, non si cancella.';

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null
    constraint tasks_title_length
    check (char_length(trim(title)) between 1 and 200),
  description text
    constraint tasks_description_length
    check (description is null or char_length(description) <= 8000),
  status text not null default 'todo'
    constraint tasks_status_valid
    check (status in ('backlog', 'todo', 'in_progress', 'in_review', 'done')),
  priority text not null default 'normal'
    constraint tasks_priority_valid
    check (priority in ('low', 'normal', 'high')),
  owner_id uuid not null references public.profiles (id),
  created_by uuid not null references public.profiles (id),
  project_id uuid references public.projects (id) on delete set null,
  due_date date,
  position numeric not null
    default (extract(epoch from clock_timestamp()) * 1000),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.tasks.owner_id is
  'Unico responsabile primario (regola di prodotto): NOT NULL per costruzione.';
comment on column public.tasks.position is
  'Indice frazionario per l''ordinamento in colonna; il default epoch-ms mette i nuovi task in fondo.';

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  body text not null
    constraint task_comments_body_length
    check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.task_comments is 'Commenti piatti: niente thread.';

-- -----------------------------------------------------------------------------
-- 2. Indici
-- -----------------------------------------------------------------------------

create index tasks_status_idx on public.tasks (status);
create index tasks_owner_id_idx on public.tasks (owner_id);
create index tasks_project_id_idx on public.tasks (project_id);
create index tasks_due_date_idx on public.tasks (due_date);
create index task_comments_task_id_idx on public.task_comments (task_id);
create index task_comments_author_id_idx on public.task_comments (author_id);

-- -----------------------------------------------------------------------------
-- 3. Funzioni helper di sicurezza
--    Create dopo le tabelle: i corpi `language sql` sono validati alla
--    creazione e referenziano public.profiles.
--    SECURITY DEFINER: evitano la ricorsione RLS quando le policy di
--    `profiles` devono leggere `profiles`. STABLE: cache per statement
--    quando avvolte in (select …) nelle policy.
-- -----------------------------------------------------------------------------

create function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active
  );
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and p.is_active
  );
$$;

-- -----------------------------------------------------------------------------
-- 4. Funzioni di supporto e trigger
-- -----------------------------------------------------------------------------

-- updated_at automatico
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.task_comments
  for each row execute function public.set_updated_at();

-- Creazione automatica del profilo alla nascita dell'utente auth.
-- SECURITY DEFINER: l'insert avviene fuori dalle policy (nessuna policy
-- INSERT esiste su profiles, per progetto).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1),
      'Utente'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- completed_at segue le transizioni di stato
create function public.tasks_set_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done'
     and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.completed_at = now();
  elsif new.status <> 'done' then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

create trigger tasks_completed_at
  before insert or update on public.tasks
  for each row execute function public.tasks_set_completed_at();

-- Guardia profili: la RLS decide quali righe, questa guardia decide quali
-- transizioni. Vale anche per service_role (bypassa la RLS, non i trigger).
-- Le richieste senza JWT (migrazioni, seed, SQL editor: auth.uid() IS NULL)
-- saltano i controlli di permesso ma non le invarianti assolute.
create function public.profiles_guard()
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

create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.profiles_guard();

-- Guardia progetti: l'archivio lo cambia solo un admin
create function public.projects_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and new.is_archived is distinct from old.is_archived
     and not public.is_admin() then
    raise exception 'Solo un admin può archiviare o ripristinare un progetto'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger projects_guard
  before update on public.projects
  for each row execute function public.projects_guard();

-- -----------------------------------------------------------------------------
-- 5. Row Level Security
--    Tutte le policy sono TO authenticated: anon è negato ovunque.
--    Nessuna policy INSERT/DELETE su profiles: si nasce dal trigger,
--    si esce disattivando.
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;

-- profiles
create policy profiles_select_active_members
  on public.profiles for select to authenticated
  using ((select public.is_active_member()));

create policy profiles_update_self_or_admin
  on public.profiles for update to authenticated
  using (
    (select public.is_active_member())
    and (id = (select auth.uid()) or (select public.is_admin()))
  )
  with check (
    (select public.is_active_member())
    and (id = (select auth.uid()) or (select public.is_admin()))
  );

-- projects
create policy projects_select_active_members
  on public.projects for select to authenticated
  using ((select public.is_active_member()));

create policy projects_insert_own
  on public.projects for insert to authenticated
  with check (
    (select public.is_active_member())
    and created_by = (select auth.uid())
  );

create policy projects_update_active_members
  on public.projects for update to authenticated
  using ((select public.is_active_member()))
  with check ((select public.is_active_member()));

create policy projects_delete_admin
  on public.projects for delete to authenticated
  using ((select public.is_admin()));

-- tasks
create policy tasks_select_active_members
  on public.tasks for select to authenticated
  using ((select public.is_active_member()));

create policy tasks_insert_own
  on public.tasks for insert to authenticated
  with check (
    (select public.is_active_member())
    and created_by = (select auth.uid())
  );

create policy tasks_update_active_members
  on public.tasks for update to authenticated
  using ((select public.is_active_member()))
  with check ((select public.is_active_member()));

create policy tasks_delete_owner_creator_admin
  on public.tasks for delete to authenticated
  using (
    (select public.is_admin())
    or (
      (select public.is_active_member())
      and (created_by = (select auth.uid()) or owner_id = (select auth.uid()))
    )
  );

-- task_comments
create policy comments_select_active_members
  on public.task_comments for select to authenticated
  using ((select public.is_active_member()));

create policy comments_insert_own
  on public.task_comments for insert to authenticated
  with check (
    (select public.is_active_member())
    and author_id = (select auth.uid())
  );

create policy comments_update_own
  on public.task_comments for update to authenticated
  using (
    (select public.is_active_member())
    and author_id = (select auth.uid())
  )
  with check (author_id = (select auth.uid()));

create policy comments_delete_own_or_admin
  on public.task_comments for delete to authenticated
  using (
    (select public.is_admin())
    or (
      (select public.is_active_member())
      and author_id = (select auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- 6. Grant sulle funzioni helper
-- -----------------------------------------------------------------------------

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_active_member() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_active_member() to authenticated, service_role;
