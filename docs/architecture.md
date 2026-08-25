# Lacertosus Office OS — Piano di architettura

> **Stato: BOZZA — proposta, non ratificata.** L'unica fonte di requisiti nel
> repo è `docs/CLAUDE.md` (principi, stack, regole UI). Non contiene un elenco
> di funzionalità, né ruoli, né flussi di lavoro. Tutto ciò che segue è dedotto
> da quel documento e dalle esigenze standard di un piccolo ufficio marketing
> ed e-commerce. Confermare le decisioni aperte in §6 prima di implementare.

**Impianto generale:** un hub di task single-tenant. Quattro tabelle, cinque
stati fissi, due ruoli, cinque sezioni di navigazione, una sola vista board con
pannello laterale. Tutto il resto è rimandato, e la §5 elenca per nome le
trappole di complessità.

> **Emendamento (30/07/2026, richiesta esplicita del committente):** aggiunto
> un modulo **Report** (sesta voce di navigazione) — KPI, trend dei
> completamenti, carico per persona, distribuzione per progetto — con
> grafici SVG fatti in casa (regole in `design-system.md` §8b). Il
> drag-and-drop della board (M4) è stato anticipato in versione artigianale
> senza dipendenze. La §5 resta il riferimento per tutto il resto.
>
> **Secondo emendamento (30/07/2026, upgrade richiesti):** aggiunti
> Calendario mensile con drag delle scadenze (settima voce di navigazione),
> command palette ⌘K, allegati-link sui task (in attesa di Supabase
> Storage; futura tabella additiva `task_links`), ricorrenza "furba"
> (`tasks.repeat`: al completamento il task si ricrea — da aggiungere allo
> schema con migrazione additiva), timeline di progetto (mini-Gantt) e
> Focus di oggi + modalità standup in dashboard.
>
> **Terzo emendamento (30/07/2026, richiesta esplicita):** il vincolo
> «massimo 6 stati» è superato PER SCELTA DEL COMMITTENTE: aggiunta la
> fase core **«Problema»** (alert, triangolo rosso) e le **fasi custom**
> (max 3, colori pre-approvati, solo admin, gestite da Impostazioni →
> Workspace o dal «+» in coda alla board; alla rimozione i task tornano
> in «Da fare»). Con Supabase serviranno una tabella additiva
> `workspace_statuses` e l'allentamento del CHECK su `tasks.status`.
> Aggiunti inoltre: board a corsie, pagina Progetti operativa
> (avanzamento/composizione/team/prossima scadenza), «Polso del team» in
> dashboard e tour introduttivo per i nuovi utenti (?tour=1 per rivederlo).
>
> **Quarto emendamento (30/07/2026):** pacchetto collaborazione e problemi
> su richiesta — template di task, viste salvate (localStorage), snooze
> personale con risveglio notificato, bacheca di progetto con registro
> decisioni, reazioni rapide e marcatura «Decisione» sui commenti,
> menzione di gruppo @Team, flusso «Segnala problema» (motivo +
> avviso automatico ad admin e responsabile), pagina «Problemi» (ottava
> voce di navigazione) con tempo-in-fase, escalation automatica oltre le
> 48h. Con Supabase: colonne additive su tasks (problem_reason/since),
> tabelle project_comments, saved_views, task_snoozes; reazioni/decisioni
> come colonne su comments.
>
> **Quinto emendamento (31/07/2026, pianificazione mensile):** i template
> di task diventano **attività ricorrenti configurabili** dai responsabili
> (nome, descrizione, responsabile predefinito, progetto, priorità,
> ripetizione, giorno del mese proposto) gestite da Impostazioni →
> Workspace e persistite in locale nella fase placeholder. Nuovo
> **pianificatore «Ricorrenti»** nella pagina Task (solo admin, anche via
> ⌘K o /tasks?plan=1): segnala le attività standard già in corso e lancia
> le mancanti con data e responsabile regolabili. Ricorrenza estesa con
> **«Ogni 2 settimane»** (biweekly). Con Supabase: tabella additiva
> `workspace_templates`, colonna `tasks.template_id` (FK nullable) e
> nuovo valore nel CHECK di `tasks.repeat`.
>
> **Sesto emendamento (31/07/2026, pacchetto «deep» 1–10 + report a
> intervallo):** (1) checklist interattive sui task con avanzamento su
> card/elenco, materializzate dai template; (2) Annulla (undo) su
> spostamenti/completamenti (de-genera anche la ricorrenza), eliminazione
> template e fasi custom — toaster con pulsante azione; (3) template
> «pacchetto» multi-task (`WorkspaceTemplate.pack`, `tasks.batch_id`,
> offset dalla data àncora, fratelli visibili nel dettaglio);
> (4) **registro eventi** `task_events` append-only (creazione, cambi
> fase/scadenza/responsabile/priorità, archivio) → cronologia nel
> dettaglio e report; (5) vista Carico (Team ?view=carico); (6) campanella
> con tab Tutte/Menzioni/Solleciti (`notifications.kind`) e raggruppamento
> per task con segna-letto di gruppo; (7) auto-archivio dei Fatto >14g
> (`tasks.archived_at`) + vista Archivio ricercabile con ripristino; le
> viste operative escludono gli archiviati, i report li includono;
> (8) board da tastiera (frecce, Invio, Shift+←/→); (9) Report filtrabili
> per intervallo (preset + personalizzato) con export CSV e stampa; il
> trend nasce dai completamenti REALI; (10) backup/import JSON della
> configurazione. **Persistenza placeholder**: intero workspace in
> localStorage (`office-state`, versionato; bump di STATE_VERSION =
> reset ai seed) con ~60 giorni di storico sintetico deterministico.
> Con Supabase: tabelle additive `task_events`, colonne
> `tasks.batch_id/archived_at/checklist(jsonb)`,
> `notifications.kind`, `workspace_templates.pack/checklist (jsonb)`.
> Nota Next 16: per aggiornare i parametri della stessa pagina si usa la
> History API nativa (integrata dal router); `router.replace` che
> AGGIUNGE parametri su rotta statica li scarta. Il meccanismo canonico
> è `lib/shallow-nav.ts` (`updateSearch` a patch) e, per i link,
> `components/search-link.tsx` — mai History API a mano nei componenti.

> **Settimo emendamento (13–14/08/2026, collegamento a Supabase):** finisce
> la fase placeholder. Gli emendamenti precedenti restano come sono — sono
> il registro di come ci si è arrivati — ma quanto vi si dice sulla
> persistenza è superato da questo.
>
> **Dati.** Non esiste più uno strato locale: `lib/mock-data.ts` è
> eliminato e `localStorage` non conserva più il workspace. Ogni entità sta
> su Supabase con RLS: profili, progetti, task, fasi, commenti, cronologia,
> checklist, allegati, richieste, ferie, chiusure, avvisi, template, viste
> salvate, focus e posticipi. Restano nel browser solo le preferenze
> personali (aspetto, layout della dashboard, fasi compresse), e comunque
> come copia: la verità è in `user_preferences`, così seguono la persona.
>
> **Migrazioni.** M2 porta lo schema da 4 a 20 tabelle; M3 aggiunge il primo
> accesso guidato (`profiles.onboarded_at`) e il bucket `avatars`; M4 la
> chat interna (`messages`, `message_reads`) con Realtime; M5 sposta le
> escalation su una funzione pianificata con `pg_cron`.
>
> **Regole nel database, non nell'interfaccia.** `completed_at`,
> `problem_since` ed `edited_at` li scrivono i trigger; `decided_by` e
> `decided_at` le guardie, che verificano anche chi sta decidendo. L'app non
> li invia mai. Le fasi della board sono diventate dati: `tasks.status` è
> una chiave esterna verso `task_statuses`.
>
> **Scritture.** Lo store mantiene la stessa API pubblica di prima, ma ogni
> mutazione è ottimistica e si annulla se il database rifiuta. Le collezioni
> append-only si sincronizzano per confronto di id (`useSincronizza`); le
> modifiche a righe esistenti si scrivono dove avvengono.
>
> **Next 16:** `middleware.ts` è deprecato — il file è `proxy.ts` con
> funzione `proxy`, e in questa versione gira di default su runtime Node.
> Le Server Action non sono coperte dal suo matcher: l'autorizzazione va
> verificata dentro ciascuna.
>
> **Ottavo emendamento (24/08/2026, ricorrenze):** le cadenze passano da tre
> a otto. Si aggiungono **ogni giorno**, **ogni giorno feriale** (weekend
> saltato), **a giorni alterni**, **ogni 3 mesi** e **ogni anno**; restano
> settimanale, ogni 2 settimane e mensile. Il lavoro quotidiano d'ufficio —
> controllo ordini, pubblicazioni, presidio delle campagne — non va più
> ricreato a mano ogni mattina.
>
> Il calcolo vive in `lib/repeat.ts`, unica regola condivisa: il giro
> successivo **non nasce mai nel passato**, i giri già trascorsi vengono
> saltati (con le cadenze fitte un completamento in ritardo avrebbe generato
> arretrato a ogni giro). Con Supabase: migrazione additiva **M7** che
> allarga i CHECK su `tasks.repeat` e `workspace_templates.repeat` —
> nessun dato da convertire, i valori esistenti restano validi.

---

## 1. Architettura dell'informazione

```
Lacertosus Office OS
├── Dashboard                  ← pagina di atterraggio dopo il login
│     I miei task aperti (per scadenza) · In ritardo · In scadenza questa settimana
├── Task                       ← il cuore del prodotto: un'unica board di team
│     Colonne = i 5 stati · filtri: responsabile, progetto
│     Pannello laterale del task (dettagli + commenti), indirizzabile via URL
├── Progetti                   ← l'UNICO livello di raggruppamento
│     Progetto = nome + descrizione; pagina progetto = la stessa board, filtrata
├── Team                       ← elenco persone; gli admin invitano/gestiscono qui
└── Impostazioni
      ├── Profilo              (nome, password)
      └── Workspace            (admin: inviti, ruoli, disattivazioni)
```

Principi applicati:

- **Una sola vista.** Nell'MVP la board è l'unica vista dei task. Le viste
  lista, calendario e timeline sono rimandate (§5).
- **Un solo livello di raggruppamento.** I progetti raggruppano i task; niente
  raggruppa i progetti. I progetti non hanno sotto-moduli (niente documenti,
  file o obiettivi di progetto).
- **Pannello laterale, non modale, non pagina.** Il dettaglio del task si apre
  come pannello sopra la board tramite il parametro `?task=<id>` — rispetta la
  regola "preferire i pannelli laterali" e mantiene i task linkabili e
  condivisibili.
- **Progressive disclosure.** La creazione rapida chiede solo il titolo (il
  responsabile è chi crea, lo stato è "Da fare"). Priorità, progetto, scadenza
  e descrizione vivono nel pannello.
- **Nessuna sezione admin.** I controlli amministrativi compaiono sul posto
  (pagina Team, impostazioni Workspace) e sono nascosti ai member.

## 2. Mappa delle route

Next.js App Router. `(public)` e `(app)` sono route group; `(app)` ha il
layout autenticato (sidebar + topbar) ed è protetto dal middleware.

| Route | Scopo | Accesso |
|---|---|---|
| `/login` | Accesso | Pubblica |
| `/auth/callback` | Scambio codice Supabase (link di invito, OAuth) | Pubblica |
| `/auth/reset-password` | Solo se si sceglie l'auth con password (§6 D3) | Pubblica |
| `/` | Redirect a `/dashboard` | Autenticata |
| `/dashboard` | Miei task aperti, in ritardo, in scadenza | Autenticata |
| `/tasks` | Board di team, colonne = stati | Autenticata |
| `/tasks?task=<id>` | Pannello laterale del task (deep link) | Autenticata |
| `/tasks?owner=&project=` | Filtri della board, persistiti nell'URL | Autenticata |
| `/projects` | Progetti attivi, archiviati dietro un toggle | Autenticata |
| `/projects/[projectId]` | Intestazione progetto + board filtrata (`?task=` funziona anche qui) | Autenticata |
| `/team` | Elenco persone; i controlli invito/ruoli compaiono solo agli admin | Autenticata |
| `/settings/profile` | Profilo personale | Autenticata |
| `/settings/workspace` | Inviti, ruoli, disattivazioni | Admin (UI + RLS) |

Note:

- Il middleware verifica solo "esiste una sessione"; **la RLS è l'enforcement
  reale** di ogni capacità admin. Nascondere la UI è una cortesia, mai il
  confine di sicurezza.
- Le mutazioni passano da Server Action validate con Zod, usando il client
  Supabase server-side con **chiave anon + RLS**. La chiave service-role è
  usata in un solo punto: la Server Action di invito (l'admin API di Supabase
  la richiede). Non raggiunge mai il client, come da `CLAUDE.md`.

## 3. Modello entità-relazioni

Quattro tabelle. Postgres su Supabase, un'unica migrazione iniziale.

```
auth.users ──1:1── profiles
profiles ──1:*── projects        (created_by)
profiles ──1:*── tasks           (owner_id — l'unico responsabile primario)
profiles ──1:*── tasks           (created_by)
profiles ──1:*── task_comments   (author_id)
projects ──0..1:*── tasks        (project_id, opzionale; ON DELETE SET NULL)
tasks    ──1:*── task_comments   (ON DELETE CASCADE)
```

**profiles** — creata da un trigger all'insert su `auth.users`; mai cancellata
fisicamente (si disattiva, così lo storico conserva gli autori).

| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid PK | = `auth.users.id` |
| `full_name` | text not null | |
| `avatar_url` | text null | URL pubblico del file su Supabase Storage, bucket `avatars` (upload dal primo accesso o da Impostazioni) |
| `role` | text not null default `'member'` | CHECK in (`admin`, `member`) |
| `is_active` | boolean not null default true | disattivazione al posto della cancellazione |
| `created_at` / `updated_at` | timestamptz | `updated_at` via trigger |

**projects**

| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid PK | |
| `name` | text not null | |
| `description` | text | |
| `is_archived` | boolean not null default false | archiviare, non cancellare |
| `created_by` | uuid FK → profiles | |
| `created_at` / `updated_at` | timestamptz | |

**tasks**

| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid PK | |
| `title` | text not null | |
| `description` | text | testo semplice nell'MVP (niente editor rich-text, §5) |
| `status` | text not null default `'todo'` | CHECK in (`backlog`, `todo`, `in_progress`, `in_review`, `done`) — 5 dei 6 consentiti, **elenco fisso, non configurabile dall'utente** |
| `priority` | text not null default `'normal'` | CHECK in (`low`, `normal`, `high`); solo visuale, nessuna automazione |
| `owner_id` | uuid not null FK → profiles | **il NOT NULL impone "ogni task ha un unico responsabile primario"**; default: chi crea |
| `created_by` | uuid not null FK → profiles | |
| `project_id` | uuid null FK → projects | ON DELETE SET NULL |
| `due_date` | date null | solo data — niente orari (§5) |
| `position` | numeric not null | indice frazionario per l'ordinamento nella colonna |
| `completed_at` | timestamptz null | valorizzata quando lo stato passa a done |
| `created_at` / `updated_at` | timestamptz | |

**task_comments**

| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid PK | |
| `task_id` | uuid not null FK → tasks | ON DELETE CASCADE |
| `author_id` | uuid not null FK → profiles | |
| `body` | text not null | piatti — niente thread, reazioni o menzioni nell'MVP |
| `created_at` / `updated_at` | timestamptz | |

Indici: `tasks(status)`, `tasks(owner_id)`, `tasks(project_id)`,
`tasks(due_date)`, `task_comments(task_id)`.

Semantica degli stati: *Backlog* = non ancora preso in carico; *Da fare*
(`todo`) = pianificato; *In corso*; *In revisione* (il lavoro di marketing ha
cicli di revisione — questa colonna si guadagna il posto); *Fatto*. Se il team
non usa Backlog, si scende a quattro — mai aggiungere uno **stato** "Bloccato":
se servirà, "bloccato" sarà un badge booleano, così la board resta a cinque
colonne pulite.

## 4. Matrice ruoli e permessi

Due ruoli: **Admin** e **Member**. L'ufficio è un team che si fida, quindi il
modello è trasparente — ogni membro vede tutto e può modificare qualsiasi task
(la ownership è responsabilità, non un lucchetto). Applicata in RLS;
rispecchiata nella UI.

| Capacità | Admin | Member |
|---|---|---|
| Vedere tutti i task, progetti, commenti, team | ✓ | ✓ |
| Creare task (con qualsiasi responsabile) | ✓ | ✓ |
| Modificare qualsiasi task, inclusi stato/responsabile | ✓ | ✓ |
| Cancellare task | ✓ tutti | ✓ se creatore o responsabile |
| Creare / modificare progetti | ✓ | ✓ |
| Archiviare / cancellare progetti | ✓ | — |
| Commentare qualsiasi task | ✓ | ✓ |
| Modificare / cancellare i propri commenti | ✓ | ✓ |
| Cancellare commenti altrui | ✓ | — |
| Modificare il proprio profilo | ✓ | ✓ |
| Invitare, cambiare ruoli, disattivare | ✓ | — |
| Impostazioni workspace | ✓ | — |

Note di implementazione RLS:

- Verifica del ruolo tramite una funzione helper `security definer` che legge
  `profiles.role` (semplice, e la revoca è immediata — vedi §6 D7).
- `profiles.role` e `is_active` sono modificabili solo dalle policy admin;
  nessuno può auto-promuoversi.
- Guardia: l'ultimo admin attivo non può essere retrocesso né disattivato.
- Gli utenti disattivati (`is_active = false`) falliscono tutte le policy —
  l'accesso muore anche se una sessione sopravvive.

Rimandato (⚠ complessità): un ruolo **Viewer**, permessi per progetto, task e
progetti privati. Un ruolo si aggiunge solo quando una persona concreta ne ha
bisogno.

## 5. Confini dell'MVP

### Dentro l'MVP

1. Auth solo su invito (nessuna auto-registrazione), gestione sessione, shell
   protetta.
2. Elenco team; invito / cambio ruolo / disattivazione da parte degli admin.
3. Task: titolo, descrizione, 5 stati fissi, un responsabile, priorità,
   scadenza, progetto opzionale.
4. Board di team con filtri responsabile/progetto; drag tra colonne **più** un
   menu a tendina dello stato nel pannello (percorso accessibile da tastiera,
   richiesto da `CLAUDE.md`).
5. Pannello laterale del task con dettagli e commenti piatti.
6. Progetti: creazione, modifica, archiviazione; pagina progetto = board
   filtrata.
7. Dashboard: miei task aperti, in ritardo, in scadenza questa settimana.
8. Tutti i form con stati loading / success / empty / error; desktop-first
   responsive; avatar con foto opzionale (iniziali come fallback).
9. Azione "Duplica task" — banale da costruire, e per ora sostituisce sia i
   task ricorrenti sia i template.
10. Ferie & permessi (ago 2026): richiesta con approvazione admin
    motivata (notifiche a richiedente e responsabili), calendario
    dell'ufficio con chiusure aziendali, conteggio in giorni lavorativi
    (weekend e chiusure esclusi). Presenze visibili anche in dashboard
    (Polso del team) e standup.

### Fuori dall'MVP — ogni voce è un rischio di complessità segnalato

| ⚠ Funzionalità | Perché è una trappola |
|---|---|
| Stati custom / workflow configurabili | Il killer n°1 degli strumenti semplici. Contraddice "massimo sei stati". Gli stati restano un CHECK hardcoded. |
| Campi custom | Trasforma uno strumento di task in un prodotto-database; contagia ogni form, filtro e query. Da rifiutare anche dopo l'MVP. |
| Assegnatari multipli / follower | Viola direttamente "ogni task ha un unico responsabile primario". |
| Sottotask, dipendenze, checklist | UI ricorsiva, rilevamento cicli, logiche di roll-up. |
| Etichette/tag | Tabella M2M + UI di gestione + color picker + filtri, per un valore marginale alla scala di un ufficio. |
| Task ricorrenti | I motori di ricorrenza sono notoriamente complessi (fusi, salti, modifiche alla serie). "Duplica" copre l'80%. |
| Editor rich-text per le descrizioni | Tiptap/ProseMirror è un progetto a sé. Testo semplice con a-capo; al massimo rendering markdown più avanti. |
| Allegati file | Richiede bucket Storage, policy, anteprime, limiti di peso. Si incollano link. Primo candidato post-MVP, non MVP. |
| Notifiche (in-app o email) | Infrastruttura di consegna + preferenze + stato di lettura. A questa scala la dashboard *è* la superficie di notifica. Al massimo, post-MVP, un digest email giornaliero. |
| Sync realtime / presenza | Supabase Realtime è seducente ma aggiunge stato di connessione ovunque. MVP: aggiornamenti ottimistici + refetch al focus. |
| Modulo calendario editoriale | Un ufficio marketing lo chiederà. La risposta: una **vista calendario delle scadenze dei task** come v2 — mai un modulo separato con un proprio modello dati. |
| Viste lista/timeline/salvate | Ogni tipo di vista moltiplica la superficie di filtri/ordinamenti/persistenza. Una board. |
| Ricerca globale | La barra dei filtri copre un dataset da ufficio. Postgres FTS più avanti, se mai. |
| Report, analytics, time tracking, sprint, OKR | Un altro prodotto. |
| Wiki/documenti, chat | Altri prodotti. |
| Integrazioni (Shopify, Meta, Slack, …) | Ognuna è auth + sync + modalità di guasto. Nessuna prima che il nucleo si dimostri. |
| Multi-workspace / multi-tenant | Vedi §6 D2 — sconsigliato **in modo permanente** per questo strumento interno. |
| Dark mode, framework i18n | Rifiniture con superficie di test reale. Una lingua, hardcoded (§6 D4). L'upload avatar è rientrato (ago 2026): ritaglio client e data URL locale, Storage con Supabase. |

## 6. Rischi e decisioni architetturali aperte

**Decisioni da prendere prima del codice:**

- **D1 — Manca un vero PRD (rischio principale).** L'intero piano deduce il
  perimetro da un documento di principi. Un'ora di revisione di §1 e §5 con il
  responsabile dell'ufficio evita di costruire la cosa semplice sbagliata.
- **D2 — Single-tenant (raccomandato) vs multi-tenant.** L'unica scelta
  difficile da invertire. Raccomandazione: single-tenant — nessun
  `workspace_id` su nessuna tabella, RLS molto più semplice. Decidere
  esplicitamente ora.
- **D3 — Metodo di autenticazione.** Se l'ufficio usa Google Workspace, OAuth
  Google ristretto a `lacertosus.com` (zero gestione password, avatar
  gratis). Altrimenti email + password con inviti via email. Raccomandazione:
  OAuth Google se disponibile.
- **D4 — Lingua della UI.** Italiano o inglese — sceglierne una, stringhe
  hardcoded, nessun framework i18n. (Lacertosus è italiana; probabilmente
  italiano. La documentazione di progetto è già in italiano per preferenza
  esplicita dell'utente.)
- **D5 — Modello di trasparenza.** Confermare che "tutti vedono tutto" va
  bene, e che il lavoro sensibile (HR, personale) semplicemente resta fuori
  dallo strumento. I task privati ridisegnerebbero la RLS — deciderlo prima,
  non dopo.
- **D6 — Nomi definitivi degli stati** (in italiano o inglese nella UI, e se
  Backlog resta).
- **D7 — Verifica dei ruoli in RLS:** funzione helper che legge `profiles`
  (raccomandata: più semplice, revoca immediata) vs custom claim nel JWT
  (più veloce ma stantio fino al refresh del token). Alla scala di un ufficio
  il costo della subquery è irrilevante.
- **D8 — Disattivazione di un responsabile:** bloccare la disattivazione di
  chi ha ancora task aperti finché non vengono riassegnati (raccomandato —
  una sola guardia, nessun lavoro orfano).

**Rischi di esecuzione:**

- **Lo scope creep è il rischio di prodotto n°1** — lo stack è noioso di
  proposito; il pericolo è la tabella della §5. Questo documento è la difesa:
  le aggiunte dovrebbero prima emendarlo.
- **Gli errori RLS sono il rischio di sicurezza n°1.** Le policy hanno
  bisogno di test dedicati (pgTAP o Vitest contro Supabase locale): un member
  non può cambiare ruoli, non può cancellare commenti altrui, un utente
  disattivato non legge nulla.
- **Accessibilità del drag-and-drop.** Il solo DnD viola la regola della
  tastiera; il menu dello stato nel pannello deve uscire nella stessa
  milestone, non dopo.
- **Disciplina delle migrazioni.** `CLAUDE.md` vieta di modificare migrazioni
  già applicate — workflow con Supabase CLI dal primo giorno; le modifiche
  sono sempre nuovi file di migrazione.
- **Lockout admin.** Imporre ≥1 admin attivo a livello di database.

## 7. Sequenza di implementazione raccomandata

Ogni milestone è una funzionalità delimitata (come da workflow in
`CLAUDE.md`), che si chiude con lint, typecheck e test verdi.

| # | Milestone | Contenuto | Criteri di uscita |
|---|---|---|---|
| M0 | Scaffold | Next.js + TS strict + Tailwind + shadcn/ui, ESLint, Vitest, config Playwright; design token (arancione = solo azioni primarie) | `lint && typecheck && test` verdi su una shell vuota |
| M1 | Schema + auth | **Un'unica migrazione iniziale**: 4 tabelle, CHECK, indici, trigger, RLS completa; login, callback, middleware, shell `(app)` con sidebar | Login funzionante; test delle policy RLS verdi |
| M2 | Team e ruoli | Elenco persone, Server Action di invito (unico punto con service-role), cambio ruolo, disattivazione con guardia di riassegnazione | Un admin invita un member end-to-end |
| M3 | Task: lettura + pannello | Board (lettura), creazione rapida (solo titolo), pannello laterale con modifica completa incluso il menu dello stato | Creare → modificare → completare un task usando solo la tastiera |
| M4 | Interazione board + commenti | Drag tra/dentro le colonne (`position` frazionaria), aggiornamenti ottimistici, commenti piatti | Il drag persiste; il CRUD dei commenti rispetta la matrice |
| M5 | Progetti | CRUD + archiviazione, pagina progetto che riusa la board, filtro progetto | Riuso della board — nessun codice board duplicato |
| M6 | Dashboard | Query miei aperti / in ritardo / in scadenza | Landing utile; `/` reindirizza qui |
| M7 | Hardening e rifinitura | Quattro stati dei form ovunque, audit tastiera + responsive, empty state, script di seed, smoke test Playwright (login, creazione, spostamento, commento), aggiornamento docs | Tutte le regole UI di `CLAUDE.md` verificabilmente rispettate |

Logica della sequenza: lo schema esce intero in M1 perché il design è noto e
`CLAUDE.md` vieta di rilavorare migrazioni applicate — le migrazioni additive
restano possibili. I task vengono prima dei progetti perché `project_id` è
nullable, quindi la board è utile già da M3. Ordine dei post-MVP, guidato
dalla domanda reale: allegati → vista calendario delle scadenze → digest email
giornaliero → ruolo viewer.
