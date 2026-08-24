-- =============================================================================
-- Lacertosus Office OS — migrazione M8: aggiornamenti del workspace dal vivo
--
-- Finora il lavoro degli altri si vedeva solo ricaricando la pagina: chi non
-- lo faceva assegnava due volte lo stesso task o discuteva di una scheda che
-- nel frattempo era cambiata. La board è condivisa, ma ognuno ne guardava
-- una fotografia vecchia.
--
-- M4 aveva già acceso Realtime sulla chat. Qui si estende alle tabelle che
-- cambiano durante la giornata: l'annuncio arriva al browser, che rilegge.
-- Non passano dati sul canale — solo il fatto che qualcosa è cambiato — e
-- comunque la RLS resta l'ultima parola: Realtime consegna a ciascuno solo
-- le righe che quella persona potrebbe già leggere.
--
-- Come in M4, il blocco `exception` isola il caso in cui il ruolo che applica
-- la migrazione non possa toccare la publication: in quel caso si attiva a
-- mano dal dashboard, in Database › Publications.
--
-- Regola del repo: additiva. M1–M7 non si toccano.
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
