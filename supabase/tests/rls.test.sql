-- =============================================================================
-- Test RLS e guardie — permessi critici (docs/SECURITY_MODEL.md).
-- Esecuzione: `supabase test db` (richiede stack locale avviato).
-- Tutto in transazione con rollback: il database resta pulito.
-- Presuppone il seed applicato (`supabase db reset`).
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

-- UUID degli utenti di test (supabase/seed.sql)
-- alessia (admin):  00000000-0000-4000-8000-000000000001
-- marco (member):   00000000-0000-4000-8000-000000000002
-- giulia (member):  00000000-0000-4000-8000-000000000003
-- luca (disattivo): 00000000-0000-4000-8000-000000000004

-- ---------------------------------------------------------------------------
-- Anonimo: nessun accesso
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{}', true);
set local role anon;

select results_eq(
  'select count(*)::int from public.tasks',
  array[0],
  'anon non vede alcun task'
);

reset role;

-- ---------------------------------------------------------------------------
-- Utente disattivato: accesso morto anche con sessione valida
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  'select count(*)::int from public.tasks',
  array[0],
  'utente disattivato non vede alcun task'
);

update public.profiles
  set full_name = 'Hacker'
  where id = '00000000-0000-4000-8000-000000000004';

reset role;

select is(
  (select full_name from public.profiles
    where id = '00000000-0000-4000-8000-000000000004'),
  'Luca Verdi',
  'utente disattivato non modifica nemmeno il proprio profilo'
);

-- ---------------------------------------------------------------------------
-- Member (Marco): trasparenza sì, privilegi no
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  'select count(*)::int from public.tasks',
  array[10],
  'un member attivo vede tutti i task (trasparenza D5)'
);

-- può modificare il task di chiunque (ownership = responsabilità, non lucchetto)
update public.tasks
  set status = 'in_review'
  where id = '00000000-0000-4000-8000-000000000206';

select is(
  (select status from public.tasks
    where id = '00000000-0000-4000-8000-000000000206'),
  'in_review',
  'un member può aggiornare lo stato del task di un altro'
);

select throws_ok(
  $$update public.profiles set role = 'admin'
      where id = '00000000-0000-4000-8000-000000000002'$$,
  '42501',
  null,
  'un member non può auto-promuoversi admin'
);

update public.profiles
  set full_name = 'Compromessa'
  where id = '00000000-0000-4000-8000-000000000003';

select is(
  (select full_name from public.profiles
    where id = '00000000-0000-4000-8000-000000000003'),
  'Giulia Romano',
  'un member non modifica il profilo di un altro'
);

delete from public.tasks
  where id = '00000000-0000-4000-8000-000000000206';

select results_eq(
  $$select count(*)::int from public.tasks
      where id = '00000000-0000-4000-8000-000000000206'$$,
  array[1],
  'un member non cancella un task che non ha creato e di cui non è responsabile'
);

delete from public.tasks
  where id = '00000000-0000-4000-8000-000000000202';

select results_eq(
  $$select count(*)::int from public.tasks
      where id = '00000000-0000-4000-8000-000000000202'$$,
  array[0],
  'un member cancella un task che ha creato ed è suo'
);

select throws_ok(
  $$insert into public.tasks (title, owner_id, created_by)
      values ('Spoof', '00000000-0000-4000-8000-000000000002',
              '00000000-0000-4000-8000-000000000001')$$,
  '42501',
  null,
  'un member non può falsificare created_by'
);

select lives_ok(
  $$insert into public.tasks (title, owner_id, created_by)
      values ('Test inserimento RLS',
              '00000000-0000-4000-8000-000000000003',
              '00000000-0000-4000-8000-000000000002')$$,
  'un member crea un task e può assegnarlo a chiunque'
);

select throws_ok(
  $$update public.projects set is_archived = true
      where id = '00000000-0000-4000-8000-000000000101'$$,
  '42501',
  null,
  'un member non archivia un progetto'
);

delete from public.projects
  where id = '00000000-0000-4000-8000-000000000101';

select results_eq(
  $$select count(*)::int from public.projects
      where id = '00000000-0000-4000-8000-000000000101'$$,
  array[1],
  'un member non cancella un progetto'
);

update public.task_comments
  set body = 'Manomesso'
  where id = '00000000-0000-4000-8000-000000000304';

select is(
  (select body from public.task_comments
    where id = '00000000-0000-4000-8000-000000000304'),
  'Il verde del banner stona con la palette autunno: vedi moodboard.',
  'un member non modifica il commento di un altro'
);

delete from public.task_comments
  where id = '00000000-0000-4000-8000-000000000304';

select results_eq(
  $$select count(*)::int from public.task_comments
      where id = '00000000-0000-4000-8000-000000000304'$$,
  array[1],
  'un member non cancella il commento di un altro'
);

select lives_ok(
  $$insert into public.task_comments (task_id, author_id, body)
      values ('00000000-0000-4000-8000-000000000205',
              '00000000-0000-4000-8000-000000000002',
              'Commento di test RLS')$$,
  'un member commenta a proprio nome'
);

reset role;

-- ---------------------------------------------------------------------------
-- Admin (Alessia): gestione ruoli e progetti, con invarianti
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

update public.profiles
  set role = 'admin'
  where id = '00000000-0000-4000-8000-000000000003';

select is(
  (select role from public.profiles
    where id = '00000000-0000-4000-8000-000000000003'),
  'admin',
  'un admin promuove un member'
);

update public.profiles
  set role = 'member'
  where id = '00000000-0000-4000-8000-000000000003';

select is(
  (select role from public.profiles
    where id = '00000000-0000-4000-8000-000000000003'),
  'member',
  'un admin retrocede un altro admin (non ultimo)'
);

select throws_ok(
  $$update public.profiles set role = 'member'
      where id = '00000000-0000-4000-8000-000000000001'$$,
  'P0001',
  null,
  'l''ultimo admin attivo non può retrocedersi'
);

select throws_ok(
  $$update public.profiles set is_active = false
      where id = '00000000-0000-4000-8000-000000000002'$$,
  'P0001',
  null,
  'niente disattivazione con task aperti (D8)'
);

update public.projects
  set is_archived = true
  where id = '00000000-0000-4000-8000-000000000101';

select is(
  (select is_archived from public.projects
    where id = '00000000-0000-4000-8000-000000000101'),
  true,
  'un admin archivia un progetto'
);

delete from public.task_comments
  where id = '00000000-0000-4000-8000-000000000304';

select results_eq(
  $$select count(*)::int from public.task_comments
      where id = '00000000-0000-4000-8000-000000000304'$$,
  array[0],
  'un admin cancella il commento di un altro'
);

delete from public.tasks
  where id = '00000000-0000-4000-8000-000000000203';

select results_eq(
  $$select count(*)::int from public.tasks
      where id = '00000000-0000-4000-8000-000000000203'$$,
  array[0],
  'un admin cancella qualunque task'
);

reset role;

-- ---------------------------------------------------------------------------
-- Visibilità profili
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  'select count(*)::int from public.profiles',
  array[4],
  'un member vede tutti i profili, incluso il disattivato'
);

reset role;

select * from finish();

rollback;
