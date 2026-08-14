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
  /** Foto del profilo — fase placeholder: data URL ridimensionata salvata
   *  in locale; con Supabase: URL di Storage (colonna già a schema). */
  avatar_url?: string | null;
  is_active: boolean;
  /** Quando il proprietario ha completato il primo accesso guidato.
   *  `null` = mai: l'app gli propone la procedura. */
  onboarded_at?: string | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  is_archived: boolean;
  created_by: string;
}

/** Voce di checklist del task: spunte vere, avanzamento sulla card. */
export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
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
  /** Task creati insieme da un template «pacchetto» condividono il batch. */
  batch_id?: string | null;
  checklist?: ChecklistItem[];
  /** Uscito dalla board (auto-archivio dei Fatto): resta nei report. */
  archived_at?: string | null;
  completed_at: string | null;
  created_at: string;
}

/** Evento di cronologia del task — registro append-only: alimenta la
 *  timeline nel dettaglio e i report per intervallo di date. */
export interface TaskEvent {
  id: string;
  task_id: string;
  actor_id: string;
  type:
    | "created"
    | "status_changed"
    | "due_changed"
    | "owner_changed"
    | "priority_changed"
    | "archived"
    | "restored";
  /** Valore precedente/nuovo (chiave di stato, ISO, id utente…). */
  from?: string | null;
  to?: string | null;
  created_at: string;
}

/** Voce di un template «pacchetto»: un task del set, con scadenza
 *  relativa alla data àncora scelta al momento della creazione. */
export interface TemplatePackItem {
  title: string;
  owner_id: string | null;
  /** Giorni rispetto alla data àncora (negativi = prima). */
  offset_days: number;
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
  /** Checklist materializzata come spunte sul task creato. */
  checklist?: string[];
  /** Pacchetto: crea più task collegati (batch) invece di uno solo. */
  pack?: TemplatePackItem[];
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

/** Natura dell'avviso: alimenta i tab della campanella. */
export type NotificationKind = "mention" | "sollecito" | "sistema";

/** Avviso interno: un responsabile lo invia a un singolo membro. */
export interface AppNotification {
  id: string;
  to_user_id: string;
  /** `null` = generato dal sistema (promemoria automatici). Attribuirlo a una
   *  persona sarebbe una piccola bugia che poi si legge in interfaccia. */
  from_user_id: string | null;
  message: string;
  task_id: string | null;
  kind?: NotificationKind;
  created_at: string;
  read_at: string | null;
}

/** Tipo di assenza richiedibile: ferie (giorni) o permesso (ore/giornata). */
export type LeaveType = "ferie" | "permesso";

export type LeaveStatus = "pending" | "approved" | "rejected";

/** Etichette e colori delle assenze (tinte dai token semantici: ferie
 *  verde, permesso blu — il warning resta allo stato «in attesa»). */
export const LEAVE_META: Record<
  LeaveType,
  { label: string; labelOne: string; color: string; soft: string; text: string }
> = {
  ferie: {
    label: "Ferie",
    labelOne: "Ferie",
    color: "#16A365",
    soft: "#E7F6EF",
    text: "#0E7A4A",
  },
  permesso: {
    label: "Permessi",
    labelOne: "Permesso",
    color: "#3B82F6",
    soft: "#EBF2FE",
    text: "#1D4ED8",
  },
};

/**
 * Richiesta di ferie/permesso: chiunque la invia, i responsabili decidono
 * con motivazione; richiedente e responsabili ricevono l'esito. Le
 * approvate compongono il calendario dell'ufficio.
 */
export interface LeaveRequest {
  id: string;
  requester_id: string;
  type: LeaveType;
  /** Intervallo ISO incluso (start = end per il giorno singolo). */
  start_date: string;
  end_date: string;
  /** Solo permesso: fascia oraria libera (es. «9:00–13:00»). */
  time_range?: string | null;
  /** Motivo/contesto del richiedente (facoltativo). */
  note: string | null;
  status: LeaveStatus;
  created_at: string;
  /** Decisione (solo responsabili), con motivazione visibile a entrambi. */
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
}

/** Chiusura aziendale (festività, ponti, inventario): vale per tutti. */
export interface CompanyClosure {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  created_by: string;
}

/** Stato di una richiesta: in attesa → approvata (diventa task) o rifiutata. */
export type RequestStatus = "pending" | "approved" | "rejected";

/**
 * Richiesta di task: chiunque può proporla, i responsabili la approvano
 * (scegliendo assegnatario/scadenza/progetto: nasce il task collegato)
 * o la rifiutano con un motivo. Il richiedente ne segue lo stato.
 */
export interface TaskRequest {
  id: string;
  title: string;
  description: string | null;
  requester_id: string;
  created_at: string;
  status: RequestStatus;
  /** «Serve entro» indicato dal richiedente: pre-compila la scadenza
   *  in approvazione. Facoltativo (assente nei dati salvati più vecchi). */
  requested_due?: string | null;
  /** Urgenza proposta dal richiedente; passa al task all'approvazione. */
  priority?: TaskPriority;
  /** Decisione (solo responsabili). */
  decided_by: string | null;
  decided_at: string | null;
  rejection_reason: string | null;
  /** Esito dell'approvazione. */
  owner_id: string | null;
  due_date: string | null;
  project_id: string | null;
  /** Task creato all'approvazione. */
  task_id: string | null;
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
