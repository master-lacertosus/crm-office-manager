-- =============================================================================
-- Lacertosus Office OS — migrazione M6: collaboratori sui task
--
-- Il principio resta: «ogni task ha un solo responsabile primario»
-- (docs/CLAUDE.md), e `tasks.owner_id` non cambia. Quando tutti sono
-- responsabili, nessuno lo è davvero.
--
-- Ma un task può coinvolgere più persone, e finora l'unico modo di dirlo era
-- citarle in un commento: il coinvolgimento non si vedeva sulla scheda e non
-- rimaneva. Qui diventa un dato.
--
-- I collaboratori NON contano nel carico di lavoro: la vista Carico e i
-- report restano sul responsabile. Altrimenti lo stesso lavoro comparirebbe
-- contato più volte e i totali di squadra perderebbero senso.
--
-- Regola del repo: additiva. M1–M5 non si toccano.
-- =============================================================================

create table public.task_collaborators (
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Chi ha aggiunto la persona: utile nella cronologia, e permette di capire
  -- se qualcuno si è aggiunto da solo o è stato coinvolto.
  added_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

comment on table public.task_collaborators is
  'Chi lavora a un task oltre al responsabile. Il responsabile resta uno solo: tasks.owner_id.';

-- La lettura tipica è «chi collabora a questo task»; l'altra, meno frequente,
-- è «a cosa collaboro io». La chiave primaria copre la prima, questo indice
-- la seconda.
create index task_collaborators_user_idx
  on public.task_collaborators (user_id);

-- Il responsabile non è un collaboratore di sé stesso: comparirebbe due volte
-- sulla scheda, e il conteggio «+2 persone» direbbe il falso.
create function public.task_collaborators_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.tasks t
    where t.id = new.task_id and t.owner_id = new.user_id
  ) then
    raise exception 'È già il responsabile del task: non serve aggiungerlo come collaboratore'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger task_collaborators_guard
  before insert or update on public.task_collaborators
  for each row execute function public.task_collaborators_guard();

-- -----------------------------------------------------------------------------
-- Row Level Security
--
-- Stessa logica dei task: chi può vedere un task può vedere chi ci lavora, e
-- chi può modificarlo può cambiare la squadra. Non si aggiunge una gerarchia
-- nuova per un dato che è un dettaglio del task.
-- -----------------------------------------------------------------------------

alter table public.task_collaborators enable row level security;

create policy collaborators_select_active_members
  on public.task_collaborators for select to authenticated
  using ((select public.is_active_member()));

create policy collaborators_insert_active_members
  on public.task_collaborators for insert to authenticated
  with check (
    (select public.is_active_member())
    and added_by = (select auth.uid())
  );

create policy collaborators_delete_active_members
  on public.task_collaborators for delete to authenticated
  using ((select public.is_active_member()));
