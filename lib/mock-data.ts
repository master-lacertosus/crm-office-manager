import { addDaysIso } from "@/lib/format";
import type {
  AppNotification,
  Profile,
  Project,
  ProjectComment,
  Task,
  TaskComment,
} from "@/lib/types";

/**
 * Dati placeholder — stessi UUID e contenuti di supabase/seed.sql, così il
 * passaggio a Supabase sarà una sostituzione di sorgente, non di forma.
 * Persistenza: nessuna (in memoria, si azzera al refresh).
 */

const U = {
  alessia: "00000000-0000-4000-8000-000000000001",
  marco: "00000000-0000-4000-8000-000000000002",
  giulia: "00000000-0000-4000-8000-000000000003",
  luca: "00000000-0000-4000-8000-000000000004",
} as const;

const P = {
  blackFriday: "00000000-0000-4000-8000-000000000101",
  rebranding: "00000000-0000-4000-8000-000000000102",
} as const;

/** Utente corrente della demo (admin, così tutta la UI è visibile). */
export const CURRENT_USER_ID: string = U.alessia;

export const MOCK_PROFILES: Profile[] = [
  {
    id: U.alessia,
    full_name: "Alessia Fabbri",
    email: "alessia@lacertosus.local",
    role: "admin",
    is_active: true,
  },
  {
    id: U.marco,
    full_name: "Marco Bianchi",
    email: "marco@lacertosus.local",
    role: "member",
    is_active: true,
  },
  {
    id: U.giulia,
    full_name: "Giulia Romano",
    email: "giulia@lacertosus.local",
    role: "member",
    is_active: true,
  },
  {
    id: U.luca,
    full_name: "Luca Verdi",
    email: "luca@lacertosus.local",
    role: "member",
    is_active: false,
  },
];

export const MOCK_PROJECTS: Project[] = [
  {
    id: P.blackFriday,
    name: "Black Friday 2026",
    description: "Campagna Q4: landing, ADV, email e coordinamento e-commerce.",
    is_archived: false,
    created_by: U.alessia,
  },
  {
    id: P.rebranding,
    name: "Rebranding schede prodotto",
    description:
      "Refresh di copy e fotografia per le schede dei power rack e delle rig.",
    is_archived: false,
    created_by: U.marco,
  },
];

const t = (offsetMin: number) =>
  new Date(Date.now() - offsetMin * 60_000).toISOString();

export const MOCK_TASKS: Task[] = [
  {
    id: "00000000-0000-4000-8000-000000000201",
    title: "Brief influencer Q4",
    description: "Selezione atleti e brief per la campagna Black Friday.",
    status: "backlog",
    priority: "normal",
    owner_id: U.giulia,
    created_by: U.giulia,
    project_id: P.blackFriday,
    due_date: null,
    position: 1,
    repeat: "none",
    completed_at: null,
    created_at: t(60 * 24 * 6),
  },
  {
    id: "00000000-0000-4000-8000-000000000202",
    title: "Audit SEO categorie accessori",
    description: null,
    status: "backlog",
    priority: "low",
    owner_id: U.marco,
    created_by: U.marco,
    project_id: null,
    due_date: null,
    position: 2,
    repeat: "none",
    completed_at: null,
    created_at: t(60 * 24 * 5),
  },
  {
    id: "00000000-0000-4000-8000-000000000203",
    title: "Calendario editoriale ottobre",
    description: "Piano contenuti social e blog per ottobre.",
    status: "todo",
    priority: "normal",
    owner_id: U.giulia,
    created_by: U.giulia,
    project_id: P.blackFriday,
    due_date: addDaysIso(7),
    position: 3,
    repeat: "monthly",
    completed_at: null,
    created_at: t(60 * 24 * 4),
  },
  {
    id: "00000000-0000-4000-8000-000000000204",
    title: "Foto still life OKTA RIG 3.5",
    description:
      "Still life su fondo bianco, dettaglio zigrinatura, tre angolazioni.",
    status: "todo",
    priority: "high",
    owner_id: U.marco,
    created_by: U.marco,
    project_id: P.rebranding,
    due_date: addDaysIso(3),
    position: 4,
    repeat: "none",
    completed_at: null,
    created_at: t(60 * 24 * 4),
  },
  {
    id: "00000000-0000-4000-8000-000000000205",
    title: "Newsletter di settembre",
    description: "Focus nuovi arrivi + guida all'allenamento in rack.",
    status: "in_progress",
    priority: "high",
    owner_id: U.marco,
    created_by: U.marco,
    project_id: P.blackFriday,
    due_date: addDaysIso(1),
    position: 5,
    repeat: "weekly",
    completed_at: null,
    created_at: t(60 * 24 * 3),
  },
  {
    id: "00000000-0000-4000-8000-000000000206",
    title: "Aggiornare schede prodotto power rack PRO",
    description:
      "Nuove misure, tabella compatibilità accessori, video di montaggio.",
    status: "alert",
    problem_reason: "Mancano le misure aggiornate dal fornitore.",
    problem_since: t(60 * 24 * 3),
    priority: "normal",
    owner_id: U.giulia,
    created_by: U.alessia,
    project_id: P.rebranding,
    due_date: addDaysIso(-2),
    position: 6,
    repeat: "none",
    completed_at: null,
    created_at: t(60 * 24 * 3),
  },
  {
    id: "00000000-0000-4000-8000-000000000207",
    title: "Landing Black Friday — copy",
    description: "Prima stesura hero + sezioni offerta. In attesa di revisione.",
    status: "in_review",
    priority: "high",
    owner_id: U.alessia,
    created_by: U.alessia,
    project_id: P.blackFriday,
    due_date: addDaysIso(2),
    position: 7,
    repeat: "none",
    completed_at: null,
    created_at: t(60 * 24 * 2),
  },
  {
    id: "00000000-0000-4000-8000-000000000208",
    title: "Banner homepage autunno",
    description: null,
    status: "in_review",
    priority: "normal",
    owner_id: U.marco,
    created_by: U.marco,
    project_id: P.rebranding,
    due_date: addDaysIso(0),
    position: 8,
    repeat: "none",
    completed_at: null,
    created_at: t(60 * 24 * 2),
  },
  {
    id: "00000000-0000-4000-8000-000000000209",
    title: "Setup tracking GA4 campagne",
    description: "Eventi e conversioni per le campagne Q4.",
    status: "done",
    priority: "normal",
    owner_id: U.alessia,
    created_by: U.alessia,
    project_id: P.rebranding,
    due_date: null,
    position: 9,
    repeat: "none",
    completed_at: t(60 * 26),
    created_at: t(60 * 24 * 8),
  },
  {
    id: "00000000-0000-4000-8000-000000000210",
    title: "Migrazione listino B2B",
    description: null,
    status: "done",
    priority: "low",
    owner_id: U.giulia,
    created_by: U.giulia,
    project_id: null,
    due_date: null,
    position: 10,
    repeat: "none",
    completed_at: t(60 * 24 * 2),
    created_at: t(60 * 24 * 10),
  },
];

export const MOCK_PROJECT_COMMENTS: ProjectComment[] = [
  {
    id: "00000000-0000-4000-8000-000000000601",
    project_id: P.blackFriday,
    author_id: U.alessia,
    body: "Direzione confermata con la proprietà: si parte col configuratore in homepage per il Black Friday.",
    created_at: t(60 * 27),
    is_decision: true,
    reactions: { "👍": [U.marco, U.giulia] },
  },
  {
    id: "00000000-0000-4000-8000-000000000602",
    project_id: P.blackFriday,
    author_id: U.marco,
    body: "@Team caricate le vostre proposte di visual entro venerdì nella cartella condivisa.",
    created_at: t(60 * 4),
    reactions: { "✅": [U.giulia] },
  },
];

export const MOCK_TASK_LINKS = [
  {
    id: "00000000-0000-4000-8000-000000000501",
    task_id: "00000000-0000-4000-8000-000000000207",
    url: "https://www.figma.com/file/landing-black-friday",
    label: "Bozza Figma della landing",
  },
  {
    id: "00000000-0000-4000-8000-000000000502",
    task_id: "00000000-0000-4000-8000-000000000204",
    url: "https://picsum.photos/seed/oktarig/320/200",
    label: "Reference still life",
  },
  {
    id: "00000000-0000-4000-8000-000000000503",
    task_id: "00000000-0000-4000-8000-000000000207",
    url: "https://docs.google.com/document/d/brief-bf-2026",
    label: "Brief campagna",
  },
];

export const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: "00000000-0000-4000-8000-000000000401",
    to_user_id: U.alessia,
    from_user_id: U.marco,
    message:
      "La newsletter è quasi pronta: mi serve il tuo ok sul soggetto entro stasera.",
    task_id: "00000000-0000-4000-8000-000000000205",
    created_at: t(45),
    read_at: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000402",
    to_user_id: U.alessia,
    from_user_id: U.giulia,
    message: "Caricate le foto del rack PRO: puoi verificare le didascalie?",
    task_id: "00000000-0000-4000-8000-000000000206",
    created_at: t(60 * 4),
    read_at: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000403",
    to_user_id: U.alessia,
    from_user_id: U.marco,
    message: "Il fornitore dei banner ha confermato la consegna per venerdì.",
    task_id: null,
    created_at: t(60 * 26),
    read_at: t(60 * 20),
  },
];

export const MOCK_COMMENTS: TaskComment[] = [
  {
    id: "00000000-0000-4000-8000-000000000301",
    task_id: "00000000-0000-4000-8000-000000000207",
    author_id: U.marco,
    body: "Il tono del hero mi sembra troppo tecnico: proverei una variante più diretta.",
    created_at: t(60 * 5),
  },
  {
    id: "00000000-0000-4000-8000-000000000302",
    task_id: "00000000-0000-4000-8000-000000000207",
    author_id: U.alessia,
    body: "Concordo, preparo la variante B entro domani.",
    created_at: t(60 * 3),
  },
  {
    id: "00000000-0000-4000-8000-000000000303",
    task_id: "00000000-0000-4000-8000-000000000205",
    author_id: U.giulia,
    body: "Ricordati il blocco UGC con le foto dei clienti in palestra.",
    created_at: t(60 * 28),
  },
  {
    id: "00000000-0000-4000-8000-000000000304",
    task_id: "00000000-0000-4000-8000-000000000208",
    author_id: U.giulia,
    body: "Il verde del banner stona con la palette autunno: vedi moodboard.",
    created_at: t(60 * 50),
  },
];
