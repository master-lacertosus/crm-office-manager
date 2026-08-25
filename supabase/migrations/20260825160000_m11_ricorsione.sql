-- =============================================================================
-- Lacertosus Office OS -- migrazione M11: la policy che si mordeva la coda
--
-- M10 ha introdotto i sotto-task e, con loro, una regola: un dipendente puo'
-- creare un pezzo di un lavoro di cui e' referente e affidarlo a un collega.
-- Per verificarlo la policy di inserimento andava a leggere il lavoro padre:
--
--     and exists (
--       select 1 from public.tasks p
--       where p.id = parent_id and p.owner_id = (select auth.uid())
--     )
--
-- Scritto cosi', dentro una policy di `tasks`, non si puo' fare. Per leggere
-- quelle righe PostgreSQL deve applicare le policy di `tasks` -- che sono
-- esattamente quelle che sta gia' valutando. Il server se ne accorge e si
-- ferma: "infinite recursion detected in policy for relation tasks" (42P17).
--
-- L'effetto e' stato totale, non parziale: falliva OGNI creazione di task,
-- anche quelle senza padre. PostgreSQL non garantisce di valutare un AND da
-- sinistra a destra, quindi il controllo sul padre partiva comunque.
--
-- La via giusta esisteva gia' nello stesso file: `puo_modificare_task` legge
-- `tasks` senza ricorsione perche' e' `security definer` -- gira con i
-- diritti di chi l'ha creata e non ripassa dalle policy. Alla policy di
-- inserimento quella cortesia non era stata fatta.
--
-- Regola del repo: additiva. M1-M10 non si toccano.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. La domanda sul padre, chiusa in una funzione che non rientra
--
-- `security definer` e' cio' che rompe il ciclo: la lettura avviene con i
-- diritti del proprietario della funzione, quindi non riapre le policy di
-- `tasks`. `set search_path = ''` obbliga a nominare gli schemi per esteso,
-- cosi' nessuno puo' dirottare la funzione creando un oggetto omonimo.
--
-- `stable` dice al pianificatore che entro lo stesso statement la risposta
-- non cambia: puo' chiamarla una volta invece di una per riga.
-- -----------------------------------------------------------------------------
create or replace function public.e_referente_del_lavoro(padre uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select padre is not null
     and exists (
       select 1
       from public.tasks p
       where p.id = padre
         and p.owner_id = (select auth.uid())
     );
$$;

comment on function public.e_referente_del_lavoro(uuid) is
  'Vero se chi sta scrivendo e'' il responsabile del task indicato. Serve alle policy di public.tasks: chiamarla evita la ricorsione che si avrebbe leggendo tasks direttamente da una sua policy.';

-- Nessuno tocca questa funzione se non chi ha una sessione valida.
revoke all on function public.e_referente_del_lavoro(uuid) from public, anon;
grant execute on function public.e_referente_del_lavoro(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. La policy, identica nelle intenzioni, senza la lettura in linea
--
-- Le tre condizioni restano quelle di M10 e valgono insieme:
--   a) essere un membro attivo del workspace;
--   b) intestarsi cio' che si crea (created_by = chi scrive);
--   c) essere responsabile, OPPURE prendere in carico il task, OPPURE
--      appenderlo a un lavoro di cui si e' referenti.
-- -----------------------------------------------------------------------------
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
      or public.e_referente_del_lavoro(parent_id)
    )
  );
