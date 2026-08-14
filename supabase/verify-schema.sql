-- =============================================================================
-- Verifica dello schema dopo le migrazioni M1 + M2.
-- Sola lettura: non modifica niente, si può rieseguire quante volte si vuole.
-- Da incollare nel SQL Editor di Supabase. Ogni riga è un controllo:
-- «OK» = a posto, «MANCA»/«ATTENZIONE» = da sistemare.
-- =============================================================================

with
-- Le 20 tabelle che l'app si aspetta (4 da M1 + 16 da M2).
attese(nome) as (
  values
    ('profiles'), ('projects'), ('tasks'), ('task_comments'),
    ('task_statuses'), ('task_checklist_items'), ('task_links'),
    ('task_events'), ('task_comment_reactions'), ('project_comments'),
    ('project_comment_reactions'), ('notifications'), ('leave_requests'),
    ('company_closures'), ('task_requests'), ('workspace_templates'),
    ('workspace_template_pack_items'), ('user_task_state'),
    ('saved_views'), ('user_preferences')
),
presenti as (
  select c.relname::text as nome, c.relrowsecurity as rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
mancanti as (
  select a.nome from attese a
  left join presenti p on p.nome = a.nome
  where p.nome is null
),
senza_rls as (
  select p.nome from presenti p
  join attese a on a.nome = p.nome
  where not p.rls
)

select '1. Tabelle attese' as controllo,
       (select count(*) from attese)::text || ' attese, '
       || (select count(*) from presenti join attese using (nome))::text || ' presenti' as valore,
       case when (select count(*) from mancanti) = 0 then 'OK'
            else 'MANCA: ' || (select string_agg(nome, ', ') from mancanti) end as esito

union all
select '2. RLS attiva ovunque',
       (select count(*) from senza_rls)::text || ' tabelle senza RLS',
       case when (select count(*) from senza_rls) = 0 then 'OK'
            else 'ATTENZIONE: ' || (select string_agg(nome, ', ') from senza_rls) end

union all
select '3. Policy RLS',
       (select count(*)::text from pg_policies where schemaname = 'public'),
       case when (select count(*) from pg_policies where schemaname = 'public') >= 62
            then 'OK' else 'ATTENZIONE: attese almeno 62 (13 da M1 + 49 da M2)' end

union all
select '4. Fasi di sistema',
       coalesce((select string_agg(key, ', ' order by sort_order)
                 from public.task_statuses), '(tabella assente)'),
       case when (select count(*) from public.task_statuses where kind in ('core','alert')) = 6
            then 'OK' else 'ATTENZIONE: attese 6 fasi di sistema' end

union all
select '5. tasks.status è chiave esterna',
       coalesce((select conname::text from pg_constraint
                 where conname = 'tasks_status_fkey'), '(assente)'),
       case when exists (select 1 from pg_constraint where conname = 'tasks_status_fkey')
            then 'OK' else 'MANCA: il vincolo di M2 non è stato creato' end

union all
select '6. Vecchio CHECK di M1 rimosso',
       case when exists (select 1 from pg_constraint where conname = 'tasks_status_valid')
            then 'ancora presente' else 'rimosso' end,
       case when exists (select 1 from pg_constraint where conname = 'tasks_status_valid')
            then 'ATTENZIONE: convive col nuovo vincolo' else 'OK' end

union all
-- Il punto più fragile: auth.users appartiene a supabase_auth_admin e in
-- alcuni progetti il SQL Editor non può creare trigger su quella tabella.
select '7. Trigger su auth.users',
       coalesce((select string_agg(tgname, ', ' order by tgname)
                 from pg_trigger t
                 join pg_class c on c.oid = t.tgrelid
                 join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'auth' and c.relname = 'users'
                   and not t.tgisinternal), '(nessuno)'),
       case when (select count(*) from pg_trigger t
                  join pg_class c on c.oid = t.tgrelid
                  join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'auth' and c.relname = 'users'
                    and not t.tgisinternal
                    and t.tgname in ('on_auth_user_created', 'on_auth_user_email_changed')) = 2
            then 'OK'
            else 'MANCA: senza questi, i profili non nascono al signup' end

union all
select '8. Colonne aggiunte a profiles',
       (select string_agg(column_name, ', ' order by column_name)
        from information_schema.columns
        where table_schema = 'public' and table_name = 'profiles'
          and column_name in ('email', 'title')),
       case when (select count(*) from information_schema.columns
                  where table_schema = 'public' and table_name = 'profiles'
                    and column_name in ('email', 'title')) = 2
            then 'OK' else 'MANCA: email e/o title' end

union all
select '9. Colonne aggiunte a tasks',
       (select count(*)::text || ' / 6'
        from information_schema.columns
        where table_schema = 'public' and table_name = 'tasks'
          and column_name in ('problem_reason', 'problem_since', 'repeat',
                              'template_id', 'batch_id', 'archived_at')),
       case when (select count(*) from information_schema.columns
                  where table_schema = 'public' and table_name = 'tasks'
                    and column_name in ('problem_reason', 'problem_since', 'repeat',
                                        'template_id', 'batch_id', 'archived_at')) = 6
            then 'OK' else 'MANCA: colonne di M2 su tasks' end

union all
select '10. Funzioni di sicurezza',
       (select string_agg(proname, ', ' order by proname)
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and proname in ('is_admin', 'is_active_member', 'handle_new_user')),
       case when (select count(*) from pg_proc p
                  join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public'
                    and proname in ('is_admin', 'is_active_member', 'handle_new_user')) = 3
            then 'OK' else 'MANCA: helper di M1' end

order by controllo;
