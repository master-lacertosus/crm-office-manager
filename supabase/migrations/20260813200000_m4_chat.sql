-- =============================================================================
-- Lacertosus Office OS — migrazione M4: chat interna
--
-- Comunicazione rapida: un canale «Generale» per tutto l'ufficio e un canale
-- per ogni progetto. Niente conversazioni private a due (per ora): sarebbero
-- policy diverse, una lista conversazioni e un conteggio non letti per
-- ciascuna, cioè un altro impianto.
--
-- Il canale è dato da `project_id`: nullo significa Generale. Una tabella
-- «canali» separata avrebbe aggiunto una join a ogni lettura per rappresentare
-- un dato che i progetti già contengono.
--
-- Regola del repo: additiva. M1, M2 e M3 non si toccano.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Messaggi
-- -----------------------------------------------------------------------------

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  -- NULL = canale Generale. Il progetto cancellato porta via i suoi messaggi:
  -- sono conversazioni su quel lavoro, non hanno senso orfane.
  project_id uuid references public.projects (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null
    constraint messages_body_length
    check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  -- Valorizzato solo se il testo è stato cambiato dopo l'invio: l'interfaccia
  -- mostra «modificato», e senza distinzione fra creazione e modifica non si
  -- potrebbe.
  edited_at timestamptz
);

comment on table public.messages is
  'Chat interna. project_id nullo = canale Generale, altrimenti canale del progetto.';

-- La chat si legge sempre allo stesso modo: un canale, dal più recente.
create index messages_channel_idx
  on public.messages (project_id, created_at desc);
create index messages_author_idx on public.messages (author_id);
-- Il canale Generale è il più battuto e project_id nullo non entra
-- nell'indice composito sopra: gli serve il suo.
create index messages_general_idx
  on public.messages (created_at desc) where project_id is null;

-- L'autore non si cambia, e `edited_at` lo decide il database: lasciarlo
-- all'app significherebbe fidarsi del client su «questo messaggio è
-- originale».
create function public.messages_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.author_id is distinct from old.author_id then
    raise exception 'L''autore di un messaggio non si cambia'
      using errcode = 'P0001';
  end if;
  if new.project_id is distinct from old.project_id then
    raise exception 'Un messaggio non si sposta di canale'
      using errcode = 'P0001';
  end if;
  if new.body is distinct from old.body then
    new.edited_at = now();
  end if;
  return new;
end;
$$;

create trigger messages_guard
  before update on public.messages
  for each row execute function public.messages_guard();

-- -----------------------------------------------------------------------------
-- 2. Segnalibro di lettura
--
-- Serve a mostrare quanti messaggi non letti ha ciascun canale. Si tiene un
-- istante per canale e per persona, non un elenco di messaggi letti: con
-- l'istante il conteggio è una sola condizione sulla data, con l'elenco
-- crescerebbe senza limite.
--
-- La chiave del canale è testo perché `project_id` è nullo per il Generale, e
-- una colonna nulla in una chiave primaria non funziona come ci si aspetta.
-- -----------------------------------------------------------------------------

create table public.message_reads (
  user_id uuid not null references public.profiles (id) on delete cascade,
  channel_key text not null
    constraint message_reads_channel_format
    check (channel_key = 'general' or channel_key ~ '^[0-9a-f-]{36}$'),
  last_read_at timestamptz not null default now(),
  primary key (user_id, channel_key)
);

-- -----------------------------------------------------------------------------
-- 3. Row Level Security
-- -----------------------------------------------------------------------------

alter table public.messages enable row level security;
alter table public.message_reads enable row level security;

create policy messages_select_active_members
  on public.messages for select to authenticated
  using ((select public.is_active_member()));

create policy messages_insert_own
  on public.messages for insert to authenticated
  with check (
    (select public.is_active_member())
    and author_id = (select auth.uid())
  );

-- Si corregge solo ciò che si è scritto. Nemmeno un admin riscrive le parole
-- di un altro: può cancellarle, non cambiarle.
create policy messages_update_own
  on public.messages for update to authenticated
  using (
    (select public.is_active_member())
    and author_id = (select auth.uid())
  )
  with check (author_id = (select auth.uid()));

create policy messages_delete_own_or_admin
  on public.messages for delete to authenticated
  using (
    (select public.is_admin())
    or (
      (select public.is_active_member())
      and author_id = (select auth.uid())
    )
  );

create policy message_reads_all_own
  on public.message_reads for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- 4. Realtime
--
-- Senza questa riga i messaggi arrivano solo ricaricando: la RLS permette di
-- leggerli, ma nessuno li annuncia. È il passaggio che manca più spesso
-- quando «la chat non si aggiorna da sola».
--
-- Le policy valgono anche qui: Realtime consegna a ciascuno solo le righe che
-- avrebbe potuto leggere comunque.
-- -----------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
