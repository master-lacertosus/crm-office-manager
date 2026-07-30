# Lacertosus Office OS — Schema del database

> Specifica formale dello schema Supabase/PostgreSQL per l'MVP approvato
> (deriva da `docs/architecture.md` §3). Implementazione:
> `supabase/migrations/20260730090000_init.sql`. Il modello di sicurezza
> (RLS, ruoli, service role) è in `docs/SECURITY_MODEL.md`.

## Piano di migrazione

**Una sola migrazione iniziale** (`0001 — init`): il design è noto e
`CLAUDE.md` vieta di modificare migrazioni già applicate; ogni evoluzione
futura sarà un nuovo file additivo. Ordine interno della migrazione:

1. Tabelle: `profiles` → `projects` → `tasks` → `task_comments` (ordine FK).
2. Indici.
3. Funzioni helper di sicurezza (`is_admin`, `is_active_member`) — dopo le
   tabelle: i corpi `language sql` sono validati alla creazione.
4. Funzioni e trigger: `updated_at`, creazione profilo da `auth.users`,
   `completed_at`, guardie (ruoli/ultimo admin/disattivazione/archivio).
5. Abilitazione RLS + tutte le policy.
6. Grant espliciti sulle funzioni.

Convenzioni: chiavi `uuid` con `gen_random_uuid()`; enum come `text` +
`CHECK` (evoluzione più semplice degli enum nativi); timestamp `timestamptz`;
nessuna cancellazione fisica dei profili (si disattiva).

## Tabelle

### `profiles` — 1:1 con `auth.users`

| Colonna | Tipo | Vincoli |
|---|---|---|
| `id` | uuid PK | FK → `auth.users(id)` ON DELETE CASCADE |
| `full_name` | text NOT NULL | 1–80 caratteri (trim) |
| `avatar_url` | text NULL | riempita dall'OAuth se usato |
| `role` | text NOT NULL DEFAULT `'member'` | CHECK in (`admin`, `member`) |
| `is_active` | boolean NOT NULL DEFAULT true | disattivazione ≠ cancellazione |
| `created_at` / `updated_at` | timestamptz NOT NULL DEFAULT now() | `updated_at` via trigger |

Creata automaticamente dal trigger `on_auth_user_created` (AFTER INSERT su
`auth.users`): `full_name` da `raw_user_meta_data->>'full_name'`, fallback
sulla parte locale dell'email. Nessuna INSERT/DELETE via API (niente policy).

### `projects`

| Colonna | Tipo | Vincoli |
|---|---|---|
| `id` | uuid PK DEFAULT `gen_random_uuid()` | |
| `name` | text NOT NULL | 1–80 caratteri (trim) |
| `description` | text NULL | ≤ 2000 caratteri |
| `is_archived` | boolean NOT NULL DEFAULT false | modificabile solo da admin (guardia) |
| `created_by` | uuid NOT NULL | FK → `profiles(id)` |
| `created_at` / `updated_at` | timestamptz NOT NULL DEFAULT now() | |

### `tasks`

| Colonna | Tipo | Vincoli |
|---|---|---|
| `id` | uuid PK DEFAULT `gen_random_uuid()` | |
| `title` | text NOT NULL | 1–200 caratteri (trim) |
| `description` | text NULL | ≤ 8000 caratteri; testo semplice |
| `status` | text NOT NULL DEFAULT `'todo'` | CHECK in (`backlog`, `todo`, `in_progress`, `in_review`, `done`) — lista fissa, 5 dei 6 consentiti |
| `priority` | text NOT NULL DEFAULT `'normal'` | CHECK in (`low`, `normal`, `high`) |
| `owner_id` | uuid NOT NULL | FK → `profiles(id)`; **il NOT NULL impone "un unico responsabile primario"** |
| `created_by` | uuid NOT NULL | FK → `profiles(id)` |
| `project_id` | uuid NULL | FK → `projects(id)` ON DELETE SET NULL |
| `due_date` | date NULL | solo data, niente orari |
| `position` | numeric NOT NULL DEFAULT epoch ms | indice frazionario per l'ordinamento in colonna; il default mette i nuovi task in fondo |
| `completed_at` | timestamptz NULL | gestita dal trigger su transizione di `status` |
| `created_at` / `updated_at` | timestamptz NOT NULL DEFAULT now() | |

### `task_comments`

| Colonna | Tipo | Vincoli |
|---|---|---|
| `id` | uuid PK DEFAULT `gen_random_uuid()` | |
| `task_id` | uuid NOT NULL | FK → `tasks(id)` ON DELETE CASCADE |
| `author_id` | uuid NOT NULL | FK → `profiles(id)` |
| `body` | text NOT NULL | 1–4000 caratteri (trim); piatti, niente thread |
| `created_at` / `updated_at` | timestamptz NOT NULL DEFAULT now() | |

## Indici

- `tasks_status_idx (status)` · `tasks_owner_id_idx (owner_id)` ·
  `tasks_project_id_idx (project_id)` · `tasks_due_date_idx (due_date)`
- `task_comments_task_id_idx (task_id)` · `task_comments_author_id_idx (author_id)`

## Trigger

| Trigger | Tabella | Funzione |
|---|---|---|
| `on_auth_user_created` | `auth.users` AFTER INSERT | crea la riga in `profiles` (SECURITY DEFINER) |
| `set_updated_at` | tutte e 4 BEFORE UPDATE | `updated_at = now()` |
| `tasks_completed_at` | `tasks` BEFORE INSERT/UPDATE | entra in `done` → `completed_at = now()`; esce → NULL |
| `profiles_guard` | `profiles` BEFORE UPDATE | vedi SECURITY_MODEL §Guardie |
| `projects_guard` | `projects` BEFORE UPDATE | `is_archived` modificabile solo da admin |

## Regole di cancellazione

- **Profili: mai cancellati** — si disattiva (`is_active = false`). Le FK da
  `tasks`/`task_comments` verso `profiles` sono NO ACTION: la cancellazione
  fisica di un profilo con storico fallisce rumorosamente, per progetto.
- Progetto eliminato (solo admin) → `tasks.project_id = NULL` (i task
  sopravvivono senza progetto).
- Task eliminato → i suoi commenti cadono in cascata.

## Seed (solo sviluppo locale)

`supabase/seed.sql` — applicato dalla CLI solo con `supabase db reset` in
locale, mai in produzione. Contiene gli utenti di test (UUID deterministici,
password `password123`), 2 progetti, 10 task distribuiti sui 5 stati e
commenti di esempio. Dettaglio utenti in `docs/SECURITY_MODEL.md` §Utenti di
test.

## Bootstrap del primo admin (produzione)

Il trigger crea ogni nuovo utente come `member`. Il primo admin si promuove
una tantum dall'SQL editor di Supabase:

```sql
update public.profiles set role = 'admin' where id = '<uuid-utente>';
```

(Le guardie permettono l'operazione da contesto server: nessun JWT utente.)
