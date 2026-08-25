# Lacertosus Office OS — Modello di sicurezza

> Deriva dalla matrice ruoli/permessi approvata (`docs/architecture.md` §4).
> Implementazione: `supabase/migrations/20260730090000_init.sql`.
> Test: `supabase/tests/rls.test.sql`.

## Principi

1. **La RLS è il confine di sicurezza.** La UI nasconde, il middleware
   reindirizza, ma l'unico enforcement reale sono le policy sul database.
   Mai bypassare la RLS (regola di `CLAUDE.md`).
2. **La service role non tocca mai il client.** Vive solo in
   `SUPABASE_SERVICE_ROLE_KEY` (variabile server, mai `NEXT_PUBLIC_*`) ed è
   usata in un unico punto previsto: la Server Action di invito
   (`auth.admin.inviteUserByEmail`, milestone M2). Tutte le altre mutazioni
   usano il client server-side con chiave anon + sessione utente + RLS.
3. **Trasparenza in lettura, responsabilità in scrittura** (D5 rivista il
   25/08/2026, migrazione M9): ogni membro attivo VEDE tutto — il lavoro
   sensibile resta fuori dallo strumento — ma SCRIVE solo dove ha titolo.
   Il workspace ha due responsabili (`role = 'admin'`) che governano tutto;
   gli altri lavorano i task di cui rispondono: propri, creati da loro o
   dove collaborano. Assegnare lavoro ad altri, creare progetti e lanciare
   template sono atti di governo: per proporli c'è il flusso delle
   Richieste, che passa da un'approvazione.
4. **Utente disattivato = accesso morto**, anche con una sessione ancora
   valida: ogni policy richiede `is_active`.

## Ruoli

| Ruolo DB | Chi è | Come si autentica |
|---|---|---|
| `anon` | Nessuna sessione | Bloccato da tutte le policy (`TO authenticated`) |
| `authenticated` | Utente loggato | JWT Supabase; permessi decisi da `profiles.role` |
| `service_role` | Solo server (invito) | Bypassa la RLS **ma non i trigger di guardia** |
| `postgres` | Migrazioni e seed | Contesto amministrativo |

Ruoli applicativi in `profiles.role`: **`admin`** e **`member`**
(estensibili; `viewer` rimandato per decisione esplicita).

## Funzioni helper

Entrambe `SECURITY DEFINER` (evitano la ricorsione RLS su `profiles`),
`STABLE`, `search_path` bloccato, eseguibili solo da `authenticated` e
`service_role`. Nelle policy sono avvolte in `(select …)` per il caching
per statement.

- `public.is_admin()` → l'utente corrente è admin **e attivo**.
- `public.is_active_member()` → l'utente corrente esiste ed è attivo.

## Policy RLS — elenco completo

RLS abilitata su tutte e quattro le tabelle. Nessuna policy = negato
(niente INSERT/DELETE su `profiles` via API, per esempio).

| Tabella | Comando | Policy | Regola |
|---|---|---|---|
| `profiles` | SELECT | `profiles_select_active_members` | membro attivo → tutte le righe |
| `profiles` | UPDATE | `profiles_update_self_or_admin` | propria riga, oppure admin su qualunque riga (campi sensibili protetti dalla guardia, sotto) |
| `projects` | SELECT | `projects_select_active_members` | membro attivo |
| `projects` | INSERT | `projects_insert_own` | membro attivo e `created_by = auth.uid()` |
| `projects` | UPDATE | `projects_update_active_members` | membro attivo (archivio protetto dalla guardia) |
| `projects` | DELETE | `projects_delete_admin` | solo admin |
| `tasks` | SELECT | `tasks_select_active_members` | membro attivo |
| `tasks` | INSERT | `tasks_insert_own` | membro attivo e `created_by = auth.uid()` (owner libero: si può assegnare a chiunque) |
| `tasks` | UPDATE | `tasks_update_active_members` | membro attivo, qualunque task (trasparenza D5) |
| `tasks` | DELETE | `tasks_delete_owner_creator_admin` | admin, oppure membro attivo se creatore o responsabile |
| `task_comments` | SELECT | `comments_select_active_members` | membro attivo |
| `task_comments` | INSERT | `comments_insert_own` | membro attivo e `author_id = auth.uid()` |
| `task_comments` | UPDATE | `comments_update_own` | solo l'autore (nemmeno l'admin modifica commenti altrui) |
| `task_comments` | DELETE | `comments_delete_own_or_admin` | autore o admin |

## Guardie (trigger) — invarianti che la RLS da sola non copre

La RLS decide *quali righe*; queste guardie decidono *quali transizioni*.
Girano anche per `service_role` (bypassa la RLS, non i trigger). Le
richieste amministrative senza JWT (`auth.uid() IS NULL`: migrazioni, seed,
SQL editor) saltano i controlli di permesso ma **non** le invarianti
assolute.

| Guardia | Tabella | Regola |
|---|---|---|
| Campi sensibili | `profiles` | `role` e `is_active` modificabili solo da admin (un membro non può auto-promuoversi) |
| Ultimo admin | `profiles` | l'ultimo admin attivo non può essere retrocesso né disattivato — **invariante assoluta**, vale anche per gli admin |
| Disattivazione con task aperti | `profiles` | non si disattiva chi è responsabile di task non `done`: prima si riassegna (D8) — assoluta |
| Archivio progetti | `projects` | `is_archived` modificabile solo da admin |

## Utenti di test (solo locale — `supabase/seed.sql`)

Password comune `password123`. UUID deterministici per i test.

| Utente | Email | Ruolo | Note |
|---|---|---|---|
| Alessia Fabbri | `alessia@lacertosus.local` | admin | `…-000000000001` |
| Marco Bianchi | `marco@lacertosus.local` | member | `…-000000000002`; ha task aperti (per il test D8) |
| Giulia Romano | `giulia@lacertosus.local` | member | `…-000000000003` |
| Luca Verdi | `luca@lacertosus.local` | member disattivato | `…-000000000004`; senza task aperti |

## Test dei permessi critici

`supabase/tests/rls.test.sql` (pgTAP, transazione con rollback) copre:
anon e disattivato non leggono nulla; il member vede e modifica ogni task
ma non cancella task altrui, non cambia ruoli (nemmeno il proprio), non
tocca profili/commenti altrui, non archivia né cancella progetti; non può
falsificare `created_by`/`author_id`; l'admin gestisce ruoli, archivia,
cancella commenti altrui; ultimo admin e disattivazione con task aperti
sollevano errore.

Esecuzione (richiede Docker + Supabase CLI):

```bash
supabase init          # solo la prima volta (genera config.toml)
supabase start
npm run db:reset       # applica migrazione + seed
npm run db:test        # esegue i test pgTAP
```

## Regole operative

- Chiavi in `.env.local` (mai committate): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, e **solo lato server**
  `SUPABASE_SERVICE_ROLE_KEY`.
- Ogni nuova tabella nasce con RLS abilitata e policy esplicite nella stessa
  migrazione; ogni nuova policy aggiunge un test in `rls.test.sql`.
- Le migrazioni applicate non si modificano: solo nuovi file.
