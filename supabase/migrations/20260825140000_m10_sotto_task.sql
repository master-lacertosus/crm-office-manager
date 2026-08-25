-- =============================================================================
-- Lacertosus Office OS — migrazione M10: un lavoro, più mani
--
-- In un ufficio marketing/e-commerce/video il lavoro non è mai un blocco
-- solo: «Video prodotto X» sono riprese, montaggio, testi, caricamento,
-- ADV — mani diverse, tempi diversi. Finora c'erano tre mezze risposte:
-- la checklist (passaggi senza nome), i collaboratori (nomi senza lavoro
-- proprio) e i pacchetti da template (lavori con nome, ma solo partendo da
-- un template e senza padre).
--
-- Qui arriva la risposta intera: un task può contenere SOTTO-TASK, e ogni
-- sotto-task è un task vero — con il suo responsabile, la sua scadenza, il
-- suo stato. Compare nella board e nel carico di chi lo esegue, perché è
-- lavoro suo; il padre resta il quadro d'insieme, con un referente che
-- risponde del risultato.
--
-- Il principio del prodotto non si rompe: OGNI task (padre o figlio) ha un
-- solo responsabile. «Più responsabili su un lavoro» significa più pezzi con
-- un nome ciascuno, non più nomi sullo stesso pezzo — altrimenti carico,
-- solleciti ed escalation non saprebbero più a chi rivolgersi.
--
-- UN SOLO LIVELLO di annidamento, per scelta: servono liste di lavori, non
-- alberi in cui perdersi. Un sotto-task non può avere figli.
--
-- Regola del repo: additiva. M1–M9 non si toccano.
-- (M7 e M8 vivono nelle PR #28 e #29; questa migrazione non le presuppone.)
-- =============================================================================

alter table public.tasks
  add column if not exists parent_id uuid
    references public.tasks (id) on delete cascade;

comment on column public.tasks.parent_id is
  'Task padre di cui questo è un pezzo. NULL = lavoro principale. Un solo livello: un sotto-task non può avere figli. Cancellando il padre spariscono i pezzi (on delete cascade).';

-- La lettura tipica è «i pezzi di questo lavoro».
create index if not exists tasks_parent_idx
  on public.tasks (parent_id)
  where parent_id is not null;

-- -----------------------------------------------------------------------------
-- 1. Le regole della gerarchia
--
-- Un solo livello, niente cicli, e il pezzo sta nel progetto del suo lavoro:
-- se i due divergessero, report e board racconterebbero storie diverse.
-- -----------------------------------------------------------------------------
create function public.tasks_gerarchia_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  padre public.tasks%rowtype;
begin
  if new.parent_id is null then
    -- Un lavoro che ha pezzi non può diventare a sua volta un pezzo: si
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

create trigger tasks_gerarchia_guard
  before insert or update of parent_id, project_id on public.tasks
  for each row execute function public.tasks_gerarchia_guard();

-- -----------------------------------------------------------------------------
-- 2. Chi lavora un pezzo
--
-- Si estende la regola di M9: oltre a responsabile, creatore, collaboratori
-- e responsabili del workspace, un pezzo lo governa anche il REFERENTE DEL
-- LAVORO PADRE. Chi guida un lavoro deve poterlo organizzare senza chiedere
-- il permesso a ogni passo — è la scelta presa il 25/08/2026.
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
-- di un lavoro però deve poter distribuire i pezzi del PROPRIO lavoro: è
-- l'eccezione decisa insieme, e vale solo dentro il perimetro del padre.
-- -----------------------------------------------------------------------------
drop policy if exists tasks_insert_own_or_admin on public.tasks;

create policy tasks_insert_own_or_delegato
  on public.tasks for insert to authenticated
  with check (
    (select public.is_active_member())
    and created_by = (select auth.uid())
    and (
      (select public.is_admin())
      -- Un lavoro per sé: sempre.
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

-- La riassegnazione segue la stessa logica: il referente del lavoro può
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
