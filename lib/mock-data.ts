import { addDaysIso } from "@/lib/format";
import type {
  AppNotification,
  Profile,
  Project,
  ProjectComment,
  Task,
  TaskComment,
  WorkspaceTemplate,
} from "@/lib/types";

/**
 * Dati placeholder — squadra reale dell'ufficio (30/07/2026). Con Supabase
 * il passaggio sarà una sostituzione di sorgente, non di forma.
 * Persistenza: nessuna (in memoria, si azzera al refresh).
 */

const U = {
  francesco: "00000000-0000-4000-8000-000000000001",
  sara: "00000000-0000-4000-8000-000000000002",
  lorenzo: "00000000-0000-4000-8000-000000000003",
  klea: "00000000-0000-4000-8000-000000000004",
  riccardo: "00000000-0000-4000-8000-000000000005",
  enrico: "00000000-0000-4000-8000-000000000006",
  matteo: "00000000-0000-4000-8000-000000000007",
} as const;

const P = {
  blackFriday: "00000000-0000-4000-8000-000000000101",
  rebranding: "00000000-0000-4000-8000-000000000102",
} as const;

/** Utente corrente della demo: Francesco (responsabile · webmaster). */
export const CURRENT_USER_ID: string = U.francesco;

export const MOCK_PROFILES: Profile[] = [
  {
    id: U.francesco,
    full_name: "Francesco Salafia",
    email: "webmaster@lacertosus.com",
    role: "admin",
    title: "Responsabile · Webmaster",
    is_active: true,
  },
  {
    id: U.sara,
    full_name: "Sara Tagliaferri",
    email: "sara@lacertosus.com",
    role: "admin",
    title: "Responsabile",
    is_active: true,
  },
  {
    id: U.lorenzo,
    full_name: "Lorenzo Cavicchioli",
    email: "lorenzo@lacertosus.com",
    role: "member",
    is_active: true,
  },
  {
    id: U.klea,
    full_name: "Klea Qyra",
    email: "klea@lacertosus.com",
    role: "member",
    is_active: true,
  },
  {
    id: U.riccardo,
    full_name: "Riccardo Videomaker",
    email: "riccardo@lacertosus.com",
    role: "member",
    is_active: true,
  },
  {
    id: U.enrico,
    full_name: "Enrico Amedei",
    email: "enrico@lacertosus.com",
    role: "member",
    is_active: true,
  },
  {
    id: U.matteo,
    full_name: "Matteo Morelli",
    email: "matteo@lacertosus.com",
    role: "member",
    is_active: true,
  },
];

export const MOCK_PROJECTS: Project[] = [
  {
    id: P.blackFriday,
    name: "Black Friday 2026",
    description: "Campagna Q4: landing, ADV, email e coordinamento e-commerce.",
    is_archived: false,
    created_by: U.sara,
  },
  {
    id: P.rebranding,
    name: "Rebranding schede prodotto",
    description:
      "Refresh di copy e fotografia per le schede dei power rack e delle rig.",
    is_archived: false,
    created_by: U.lorenzo,
  },
];

/**
 * Attività standard del mese: partenza realistica per i responsabili,
 * modificabile da Impostazioni → Workspace (persistita in locale).
 */
export const MOCK_TEMPLATES: WorkspaceTemplate[] = [
  {
    id: "tpl-newsletter-promo",
    name: "Newsletter Promo",
    description:
      "Checklist:\n- soggetto e preheader\n- offerta del mese\n- blocco novità\n- CTA e link tracciati\n- test invio",
    project_id: null,
    owner_id: U.enrico,
    priority: "high",
    repeat: "monthly",
    due_day: 5,
    links: [
      {
        url: "https://docs.google.com/document/d/linee-guida-newsletter",
        label: "Linee guida",
      },
    ],
  },
  {
    id: "tpl-articolo-blog",
    name: "Pubblicazione articolo blog",
    description:
      "Checklist:\n- scelta argomento e keyword\n- bozza e revisione\n- immagini ottimizzate\n- SEO on-page\n- pubblicazione e condivisione",
    project_id: null,
    owner_id: U.francesco,
    priority: "normal",
    repeat: "biweekly",
    due_day: 8,
    links: [],
  },
  {
    id: "tpl-newsletter-commerciale",
    name: "Newsletter reparto Commerciale",
    description:
      "Checklist:\n- input dal commerciale (offerte B2B)\n- listino aggiornato\n- revisione responsabile\n- invio segmento aziende",
    project_id: null,
    owner_id: U.enrico,
    priority: "normal",
    repeat: "monthly",
    due_day: 15,
    links: [],
  },
  {
    id: "tpl-rubrica-arena",
    name: "Rubrica Lacertosus Arena",
    description:
      "Checklist:\n- selezione atleta/box del mese\n- intervista e materiale foto\n- montaggio contenuti social\n- pubblicazione rubrica",
    project_id: null,
    owner_id: U.klea,
    priority: "normal",
    repeat: "monthly",
    due_day: 20,
    links: [],
  },
  {
    id: "tpl-video-youtuber",
    name: "Video YouTuber",
    description:
      "Checklist:\n- accordo con il creator\n- brief prodotto e talking points\n- revisione bozza video\n- pubblicazione e repost",
    project_id: null,
    owner_id: U.riccardo,
    priority: "normal",
    repeat: "monthly",
    due_day: 25,
    links: [],
  },
  {
    id: "tpl-shooting",
    name: "Shooting prodotto",
    description:
      "Checklist:\n- lista referenze prodotto\n- still life fondo bianco\n- dettagli (zigrinatura, saldature)\n- 3 angolazioni per variante\n- consegna in cartella condivisa",
    project_id: null,
    owner_id: U.riccardo,
    priority: "normal",
    repeat: "none",
    due_day: null,
    links: [
      {
        url: "https://drive.google.com/drive/folders/reference-shooting",
        label: "Cartella reference",
      },
    ],
  },
  {
    id: "tpl-lancio",
    name: "Lancio prodotto",
    description:
      "Checklist:\n- scheda prodotto online\n- foto e video caricati\n- newsletter dedicata\n- post social programmati\n- ADV attive",
    project_id: null,
    owner_id: U.sara,
    priority: "high",
    repeat: "none",
    due_day: null,
    links: [],
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
    owner_id: U.klea,
    created_by: U.klea,
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
    owner_id: U.francesco,
    created_by: U.francesco,
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
    owner_id: U.matteo,
    created_by: U.matteo,
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
    owner_id: U.riccardo,
    created_by: U.riccardo,
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
    owner_id: U.enrico,
    created_by: U.enrico,
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
    owner_id: U.lorenzo,
    created_by: U.sara,
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
    owner_id: U.sara,
    created_by: U.sara,
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
    owner_id: U.riccardo,
    created_by: U.riccardo,
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
    owner_id: U.francesco,
    created_by: U.francesco,
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
    owner_id: U.lorenzo,
    created_by: U.lorenzo,
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
    author_id: U.sara,
    body: "Direzione confermata con la proprietà: si parte col configuratore in homepage per il Black Friday.",
    created_at: t(60 * 27),
    is_decision: true,
    reactions: { "👍": [U.francesco, U.riccardo] },
  },
  {
    id: "00000000-0000-4000-8000-000000000602",
    project_id: P.blackFriday,
    author_id: U.riccardo,
    body: "@Team caricate le vostre proposte di visual entro venerdì nella cartella condivisa.",
    created_at: t(60 * 4),
    reactions: { "✅": [U.klea] },
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
    to_user_id: U.francesco,
    from_user_id: U.enrico,
    message:
      "La newsletter è quasi pronta: mi serve il tuo ok sul soggetto entro stasera.",
    task_id: "00000000-0000-4000-8000-000000000205",
    created_at: t(45),
    read_at: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000402",
    to_user_id: U.francesco,
    from_user_id: U.lorenzo,
    message: "Caricate le foto del rack PRO: puoi verificare le didascalie?",
    task_id: "00000000-0000-4000-8000-000000000206",
    created_at: t(60 * 4),
    read_at: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000403",
    to_user_id: U.francesco,
    from_user_id: U.riccardo,
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
    author_id: U.matteo,
    body: "Il tono del hero mi sembra troppo tecnico: proverei una variante più diretta.",
    created_at: t(60 * 5),
  },
  {
    id: "00000000-0000-4000-8000-000000000302",
    task_id: "00000000-0000-4000-8000-000000000207",
    author_id: U.sara,
    body: "Concordo, preparo la variante B entro domani.",
    created_at: t(60 * 3),
  },
  {
    id: "00000000-0000-4000-8000-000000000303",
    task_id: "00000000-0000-4000-8000-000000000205",
    author_id: U.klea,
    body: "Ricordati il blocco UGC con le foto dei clienti in palestra.",
    created_at: t(60 * 28),
  },
  {
    id: "00000000-0000-4000-8000-000000000304",
    task_id: "00000000-0000-4000-8000-000000000208",
    author_id: U.klea,
    body: "Il verde del banner stona con la palette autunno: vedi moodboard.",
    created_at: t(60 * 50),
  },
];
