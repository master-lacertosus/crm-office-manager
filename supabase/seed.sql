-- =============================================================================
-- Seed di SOLO SVILUPPO LOCALE (applicato da `supabase db reset`).
-- Mai eseguire in produzione: crea utenti con password nota.
-- Utenti di test (password comune: password123) — docs/SECURITY_MODEL.md.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Utenti auth (il trigger on_auth_user_created crea i profili)
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated',
    'alessia@lacertosus.local',
    crypt('password123', gen_salt('bf')),
    now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Alessia Fabbri"}',
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated',
    'marco@lacertosus.local',
    crypt('password123', gen_salt('bf')),
    now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Marco Bianchi"}',
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated',
    'giulia@lacertosus.local',
    crypt('password123', gen_salt('bf')),
    now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Giulia Romano"}',
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000004',
    'authenticated', 'authenticated',
    'luca@lacertosus.local',
    crypt('password123', gen_salt('bf')),
    now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Luca Verdi"}',
    now(), now(), '', '', '', ''
  );

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  u.id,
  u.id::text,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true
  ),
  'email',
  now(), now(), now()
from auth.users u
where u.email like '%@lacertosus.local';

-- Ruoli e stato (contesto server: auth.uid() è NULL, le guardie di permesso
-- non si applicano; le invarianti assolute sì — Luca non ha task aperti).
update public.profiles
  set role = 'admin'
  where id = '00000000-0000-4000-8000-000000000001';

update public.profiles
  set is_active = false
  where id = '00000000-0000-4000-8000-000000000004';

-- ---------------------------------------------------------------------------
-- Progetti
-- ---------------------------------------------------------------------------

insert into public.projects (id, name, description, created_by)
values
  (
    '00000000-0000-4000-8000-000000000101',
    'Black Friday 2026',
    'Campagna Q4: landing, ADV, email e coordinamento e-commerce.',
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    'Rebranding schede prodotto',
    'Refresh di copy e fotografia per le schede dei power rack e delle rig.',
    '00000000-0000-4000-8000-000000000002'
  );

-- ---------------------------------------------------------------------------
-- Task — 10, distribuiti sui 5 stati; Marco ha task aperti (serve al test
-- della guardia di disattivazione D8).
-- ---------------------------------------------------------------------------

insert into public.tasks
  (id, title, description, status, priority, owner_id, created_by, project_id, due_date)
values
  (
    '00000000-0000-4000-8000-000000000201',
    'Brief influencer Q4',
    'Selezione atleti e brief per la campagna Black Friday.',
    'backlog', 'normal',
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000101',
    null
  ),
  (
    '00000000-0000-4000-8000-000000000202',
    'Audit SEO categorie accessori',
    null,
    'backlog', 'low',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000002',
    null,
    null
  ),
  (
    '00000000-0000-4000-8000-000000000203',
    'Calendario editoriale ottobre',
    'Piano contenuti social e blog per ottobre.',
    'todo', 'normal',
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000101',
    current_date + 7
  ),
  (
    '00000000-0000-4000-8000-000000000204',
    'Foto still life OKTA RIG 3.5',
    'Still life su fondo bianco, dettaglio zigrinatura, tre angolazioni.',
    'todo', 'high',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000102',
    current_date + 3
  ),
  (
    '00000000-0000-4000-8000-000000000205',
    'Newsletter di settembre',
    'Focus nuovi arrivi + guida all''allenamento in rack.',
    'in_progress', 'high',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000101',
    current_date + 1
  ),
  (
    '00000000-0000-4000-8000-000000000206',
    'Aggiornare schede prodotto power rack PRO',
    'Nuove misure, tabella compatibilità accessori, video di montaggio.',
    'in_progress', 'normal',
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000102',
    current_date - 2
  ),
  (
    '00000000-0000-4000-8000-000000000207',
    'Landing Black Friday — copy',
    'Prima stesura hero + sezioni offerta. In attesa di revisione.',
    'in_review', 'high',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000101',
    current_date + 2
  ),
  (
    '00000000-0000-4000-8000-000000000208',
    'Banner homepage autunno',
    null,
    'in_review', 'normal',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000102',
    current_date
  ),
  (
    '00000000-0000-4000-8000-000000000209',
    'Setup tracking GA4 campagne',
    'Eventi e conversioni per le campagne Q4.',
    'done', 'normal',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000102',
    null
  ),
  (
    '00000000-0000-4000-8000-000000000210',
    'Migrazione listino B2B',
    null,
    'done', 'low',
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000003',
    null,
    null
  );

-- ---------------------------------------------------------------------------
-- Commenti
-- ---------------------------------------------------------------------------

insert into public.task_comments (id, task_id, author_id, body)
values
  (
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000207',
    '00000000-0000-4000-8000-000000000002',
    'Il tono del hero mi sembra troppo tecnico: proverei una variante più diretta.'
  ),
  (
    '00000000-0000-4000-8000-000000000302',
    '00000000-0000-4000-8000-000000000207',
    '00000000-0000-4000-8000-000000000001',
    'Concordo, preparo la variante B entro domani.'
  ),
  (
    '00000000-0000-4000-8000-000000000303',
    '00000000-0000-4000-8000-000000000205',
    '00000000-0000-4000-8000-000000000003',
    'Ricordati il blocco UGC con le foto dei clienti in palestra.'
  ),
  (
    '00000000-0000-4000-8000-000000000304',
    '00000000-0000-4000-8000-000000000208',
    '00000000-0000-4000-8000-000000000003',
    'Il verde del banner stona con la palette autunno: vedi moodboard.'
  );
