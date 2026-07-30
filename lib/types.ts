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
  | "done";

export type TaskPriority = "low" | "normal" | "high";

/** Ricorrenza "furba": al completamento il task si ricrea con la scadenza
 *  spostata avanti. Niente motore di ricorrenza completo (per scelta). */
export type TaskRepeat = "none" | "weekly" | "monthly";

export type Role = "admin" | "member";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
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
  status: TaskStatus;
  priority: TaskPriority;
  owner_id: string;
  created_by: string;
  project_id: string | null;
  /** ISO date (YYYY-MM-DD), senza orario. */
  due_date: string | null;
  position: number;
  repeat: TaskRepeat;
  completed_at: string | null;
  created_at: string;
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
}

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

export const STATUS_ORDER: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
];
