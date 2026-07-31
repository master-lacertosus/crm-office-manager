/**
 * Tipi di dominio — specchiano lo schema in docs/DATABASE_SCHEMA.md.
 * Fase placeholder: i dati vengono da lib/mock-data.ts; al collegamento
 * con Supabase questi tipi restano, cambia solo la sorgente.
 */

export type TaskStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "alert"
  | "done";

/** Fase personalizzata del flusso (aggiunta dagli admin, max 3). */
export interface CustomStatus {
  key: string;
  label: string;
  /** colore pieno, soft e testo — da preset pre-approvati */
  color: string;
  soft: string;
  text: string;
}

/** Metadati risolti di una fase (core, alert o custom). */
export interface StatusMeta {
  key: string;
  label: string;
  color: string;
  soft: string;
  text: string;
  kind: "core" | "alert" | "custom";
}

export type TaskPriority = "low" | "normal" | "high";

/** Ricorrenza "furba": al completamento il task si ricrea con la scadenza
 *  spostata avanti. Niente motore di ricorrenza completo (per scelta). */
export type TaskRepeat = "none" | "weekly" | "biweekly" | "monthly";

/** Etichette e salto di scadenza per ogni ricorrenza. */
export const REPEAT_META: Record<
  Exclude<TaskRepeat, "none">,
  { label: string; phrase: string; days: number | "month" }
> = {
  weekly: { label: "Settimanale", phrase: "una settimana", days: 7 },
  biweekly: { label: "Ogni 2 settimane", phrase: "due settimane", days: 14 },
  monthly: { label: "Mensile", phrase: "un mese", days: "month" },
};

export type Role = "admin" | "member";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  /** Qualifica mostrata accanto al nome (es. «Responsabile · Webmaster»). */
  title?: string;
  is_active: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  is_archived: boolean;
  created_by: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  owner_id: string;
  created_by: string;
  project_id: string | null;
  /** Fase: una delle core (TaskStatus) o la chiave di una fase custom. */
  status: string;
  /** Motivo del blocco quando status === "alert". */
  problem_reason?: string | null;
  /** In fase Problema da (ISO datetime): tempo-in-fase ed escalation. */
  problem_since?: string | null;
  /** ISO date (YYYY-MM-DD), senza orario. */
  due_date: string | null;
  position: number;
  repeat: TaskRepeat;
  /** Template ricorrente da cui è nato (per la pianificazione mensile). */
  template_id?: string | null;
  completed_at: string | null;
  created_at: string;
}

/**
 * Attività standard del mese, configurata dai responsabili: richiamabile
 * dal pianificatore ricorrenti o come base nel form di creazione task.
 */
export interface WorkspaceTemplate {
  id: string;
  /** Nome dell'attività: diventa il titolo del task creato. */
  name: string;
  description: string;
  project_id: string | null;
  /** Responsabile predefinito (null = chi crea il task). */
  owner_id: string | null;
  priority: TaskPriority;
  repeat: TaskRepeat;
  /** Giorno del mese proposto come scadenza (1–28), per la pianificazione. */
  due_day: number | null;
  links: { url: string; label: string }[];
}

/** Allegato-link (fase senza Supabase Storage: si allegano URL). */
export interface TaskLink {
  id: string;
  task_id: string;
  url: string;
  label: string | null;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
  /** Marcato come decisione (finisce nel registro del progetto). */
  is_decision?: boolean;
  /** Reazioni rapide: emoji → id degli utenti. */
  reactions?: Record<string, string[]>;
}

/** Messaggio della bacheca di progetto (stessa forma dei commenti task). */
export interface ProjectComment {
  id: string;
  project_id: string;
  author_id: string;
  body: string;
  created_at: string;
  is_decision?: boolean;
  reactions?: Record<string, string[]>;
}

/** Emoji ammesse per le reazioni rapide. */
export const REACTION_EMOJIS = ["👍", "✅", "⚠️"] as const;

/** Avviso interno: un responsabile lo invia a un singolo membro. */
export interface AppNotification {
  id: string;
  to_user_id: string;
  from_user_id: string;
  message: string;
  task_id: string | null;
  created_at: string;
  read_at: string | null;
}

/** Ordine delle fasi core; le custom si inseriscono prima di in_review. */
export const STATUS_ORDER: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "alert",
  "done",
];

/** Preset colore per le fasi custom (già verificati su superficie chiara). */
export const CUSTOM_STATUS_PRESETS: {
  name: string;
  color: string;
  soft: string;
  text: string;
}[] = [
  { name: "Teal", color: "#0D9488", soft: "#CCFBF1", text: "#0F766E" },
  { name: "Rosa", color: "#DB2777", soft: "#FCE7F3", text: "#BE185D" },
  { name: "Indaco", color: "#4F46E5", soft: "#E0E7FF", text: "#4338CA" },
  { name: "Ciano", color: "#0891B2", soft: "#CFFAFE", text: "#0E7490" },
  { name: "Lime", color: "#65A30D", soft: "#ECFCCB", text: "#4D7C0F" },
  { name: "Grigio", color: "#64748B", soft: "#F1F5F9", text: "#475569" },
];
