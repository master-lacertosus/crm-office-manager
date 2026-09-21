-- =============================================================================
-- Test RLS e guardie — permessi critici (docs/SECURITY_MODEL.md).
-- Esecuzione: `supabase test db` (richiede stack locale avviato).
-- Tutto in transazione con rollback: il database resta pulito.
-- Presuppone il seed applicato (`supabase db reset`).
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(36);

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

-- ---------------------------------------------------------------------------
-- Timbrature (M16): le proprie ore le vede solo chi le ha fatte.
--
-- È la policy più stretta del prodotto, insieme a quella degli avvisi: qui
-- nemmeno un admin guarda dentro. Se un giorno qualcuno allentasse la select
-- «tanto agli admin serve», questi test si accendono di rosso — ed è
-- esattamente il momento in cui si vuole essere fermati e costretti a
-- deciderlo di nuovo, invece di scoprirlo dopo.
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

insert into public.timbrature (profile_id, giorno, entrata, uscita)
values (
  '00000000-0000-4000-8000-000000000002',
  current_date,
  now() - interval '8 hours',
  now()
);

select results_eq(
  'select count(*)::int from public.timbrature',
  array[1],
  'marco vede la propria giornata'
);

select throws_ok(
  $q$insert into public.timbrature (profile_id, giorno, entrata)
     values ('00000000-0000-4000-8000-000000000003', current_date, now())$q$,
  '42501',
  null,
  'marco non puo'' timbrare per giulia'
);

select throws_ok(
  $q$update public.timbrature set giorno = current_date - 1$q$,
  'P0001',
  null,
  'di una giornata non si cambia la data'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  'select count(*)::int from public.timbrature',
  array[0],
  'giulia non vede le ore di marco'
);

-- E l'admin nemmeno: qui non c'è l'eccezione che hanno le altre tabelle.
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  'select count(*)::int from public.timbrature',
  array[0],
  'nemmeno un admin vede le ore altrui'
);

-- ---------------------------------------------------------------------------
-- Sondaggi (M19): l'urna e il registro
--
-- Il voto è anonimo, e l'anonimato qui non è una promessa scritta
-- nell'interfaccia: è il fatto che la scheda di un altro non si può proprio
-- leggere. La RLS di PostgreSQL è row level e non sa nascondere una colonna,
-- quindi «chi ha votato» e «cosa ha votato» sono due tabelle diverse — e
-- questi test sono ciò che impedisce di ricucirle per comodità.
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $q$select public.lancia_sondaggio('Che giorno facciamo la riunione?', array['Martedì', 'Giovedì'], 24)$q$,
  'marco lancia un sondaggio'
);

select throws_ok(
  $q$select public.lancia_sondaggio('E una seconda?', array['Sì', 'No'], 24)$q$,
  'P0001',
  null,
  'se ne fa uno per volta'
);

select throws_ok(
  $q$select public.lancia_sondaggio('Con una sola risposta?', array['Va bene'], 24)$q$,
  'P0001',
  null,
  'un sondaggio ha almeno due risposte'
);

-- Il voto vero, e il conteggio che ne deriva.
insert into public.sondaggio_schede (sondaggio_id, profile_id, opzione_id)
select o.sondaggio_id, '00000000-0000-4000-8000-000000000002', o.id
  from public.sondaggio_opzioni o
  join public.sondaggi s on s.id = o.sondaggio_id
 where s.chiuso_at is null and o.posizione = 1;

select results_eq(
  'select sum(voti)::int from public.sondaggio_opzioni',
  array[1],
  'il voto finisce nel conteggio dell''opzione'
);

select results_eq(
  'select count(*)::int from public.sondaggio_firme',
  array[1],
  'e la firma finisce nel registro'
);

-- Giulia: vede che marco ha votato, non che cosa.
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);

select results_eq(
  'select count(*)::int from public.sondaggio_firme',
  array[1],
  'giulia vede CHE marco ha votato'
);

select results_eq(
  'select count(*)::int from public.sondaggio_schede',
  array[0],
  'ma non vede COSA ha votato marco'
);

-- E nemmeno un admin. Se il titolare può vedere come hai votato, non hai
-- votato: hai risposto.
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select results_eq(
  'select count(*)::int from public.sondaggio_schede',
  array[0],
  'nemmeno un admin apre l''urna'
);

reset role;

select * from finish();

rollback;
