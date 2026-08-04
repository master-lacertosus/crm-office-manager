"use client";

import * as React from "react";

import {
  nextMonthlyIso,
  shiftIsoDays,
  shiftIsoMonths,
  todayIso,
} from "@/lib/format";
import { extractMentionIds } from "@/lib/mentions";
import { CUSTOM_STATUS_PRESETS } from "@/lib/types";
import {
  CURRENT_USER_ID,
  MOCK_COMMENTS,
  MOCK_EVENTS,
  MOCK_NOTIFICATIONS,
  MOCK_PROFILES,
  MOCK_PROJECTS,
  MOCK_PROJECT_COMMENTS,
  MOCK_REQUESTS,
  MOCK_TASKS,
  MOCK_TASK_LINKS,
  MOCK_TEMPLATES,
} from "@/lib/mock-data";
import type {
  AppNotification,
  CustomStatus,
  NotificationKind,
  Profile,
  Project,
  ProjectComment,
  StatusMeta,
  Task,
  TaskComment,
  TaskEvent,
  TaskLink,
  TaskRequest,
  WorkspaceTemplate,
} from "@/lib/types";

/** Vista salvata dei task (querystring di filtri+vista), persistita in locale. */
export interface SavedView {
  id: string;
  name: string;
  params: string;
}

export type CommentScope = "task" | "project";

/** Metadati delle fasi core (specchiano i token CSS --status-*). */
export const CORE_STATUS_META: Record<
  string,
  { label: string; color: string; soft: string; text: string; kind: "core" | "alert" }
> = {
  backlog: { label: "Backlog", color: "#8A94A3", soft: "#F1F4F8", text: "#64748B", kind: "core" },
  todo: { label: "Da fare", color: "#3B82F6", soft: "#EBF2FE", text: "#1D4ED8", kind: "core" },
  in_progress: { label: "In corso", color: "#6D5DFB", soft: "#EEECFE", text: "#5240E8", kind: "core" },
  in_review: { label: "In revisione", color: "#FF6B00", soft: "#FFF1E8", text: "#B34503", kind: "core" },
  alert: { label: "Problema", color: "#DC2626", soft: "#FEE2E2", text: "#B91C1C", kind: "alert" },
  done: { label: "Fatto", color: "#16A365", soft: "#E7F6EF", text: "#0E7A4A", kind: "core" },
};

export const MAX_CUSTOM_STATUSES = 3;

/**
 * Store placeholder in memoria: fa da contratto per lo strato dati vero.
 * Le mutazioni sono istantanee ma mantengono firme async: gli stati di
 * loading richiesti da CLAUDE.md restano implementati nei form e, al
 * collegamento con Supabase, queste funzioni diventeranno query/mutazioni
 * reali a parità di firma — senza latenza artificiale sui click.
 */

type NewTask = Pick<Task, "title" | "owner_id"> &
  Partial<
    Pick<
      Task,
      | "description"
      | "status"
      | "priority"
      | "project_id"
      | "due_date"
      | "repeat"
      | "template_id"
    >
  >;

/** Ricorrenza furba: alla chiusura, il task si ricrea con la scadenza avanti
 *  (e la checklist azzerata, pronta per la nuova uscita). */
function nextOccurrence(task: Task): Task | null {
  if (task.repeat === "none" || !task.due_date) return null;
  return {
    ...task,
    id: crypto.randomUUID(),
    status: "todo",
    due_date:
      task.repeat === "monthly"
        ? shiftIsoMonths(task.due_date, 1)
        : shiftIsoDays(task.due_date, task.repeat === "weekly" ? 7 : 14),
    position: Date.now(),
    checklist: task.checklist?.map((item) => ({ ...item, done: false })),
    problem_reason: null,
    problem_since: null,
    archived_at: null,
    completed_at: null,
    created_at: new Date().toISOString(),
  };
}

const makeEvent = (
  taskId: string,
  actorId: string,
  type: TaskEvent["type"],
  from?: string | null,
  to?: string | null,
): TaskEvent => ({
  id: crypto.randomUUID(),
  task_id: taskId,
  actor_id: actorId,
  type,
  from: from ?? null,
  to: to ?? null,
  created_at: new Date().toISOString(),
});

/** Chiave dell'episodio di blocco: task + inizio problema. Risolto e
 *  ri-segnalato = episodio nuovo → l'avviso agli admin riparte. */
const problemEpisodeKey = (t: Task) => `${t.id}:${t.problem_since}`;

/** Soglie di escalation (promemoria one-shot ai responsabili). */
const PROBLEM_ESCALATION_MS = 48 * 3600_000;
const REQUEST_ESCALATION_MS = 3 * 86_400_000;

/** Collassa gli avvisi di sistema identici (stesso destinatario, task e
 *  testo) accumulati dal vecchio bug dei marcatori non persistiti: resta
 *  l'originale più vecchio. Menzioni e solleciti (azioni umane, ripetibili
 *  di proposito) non vengono mai toccati. */
function dedupeSystemNotifications(
  list: AppNotification[],
): AppNotification[] {
  const seen = new Set<string>();
  return list.filter((n) => {
    if ((n.kind ?? "sistema") !== "sistema") return true;
    const key = `${n.to_user_id}|${n.task_id ?? ""}|${n.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Prima apertura senza marcatori salvati: considera già segnalato ciò che
 *  è oltre soglia — lo era di sicuro (i doppioni in campanella lo provano). */
const seedEscalatedProblems = (tasks: Task[], now: number): string[] =>
  tasks
    .filter(
      (t) =>
        t.status === "alert" &&
        t.problem_since &&
        now - new Date(t.problem_since).getTime() > PROBLEM_ESCALATION_MS,
    )
    .map(problemEpisodeKey);

const seedEscalatedRequests = (requests: TaskRequest[], now: number): string[] =>
  requests
    .filter(
      (r) =>
        r.status === "pending" &&
        now - new Date(r.created_at).getTime() > REQUEST_ESCALATION_MS,
    )
    .map((r) => r.id);

/** Eventi di cronologia derivati da una modifica (campi tracciati). */
function diffTaskEvents(before: Task, after: Task, actorId: string): TaskEvent[] {
  const out: TaskEvent[] = [];
  if (before.status !== after.status) {
    out.push(makeEvent(before.id, actorId, "status_changed", before.status, after.status));
  }
  if ((before.due_date ?? null) !== (after.due_date ?? null)) {
    out.push(makeEvent(before.id, actorId, "due_changed", before.due_date, after.due_date));
  }
  if (before.owner_id !== after.owner_id) {
    out.push(makeEvent(before.id, actorId, "owner_changed", before.owner_id, after.owner_id));
  }
  if (before.priority !== after.priority) {
    out.push(makeEvent(before.id, actorId, "priority_changed", before.priority, after.priority));
  }
  return out;
}

interface AppStore {
  currentUser: Profile;
  /** Demo: cambia l'utente corrente («Vedi come…»). */
  switchUser: (profileId: string) => void;
  profiles: Profile[];
  projects: Project[];
  tasks: Task[];
  comments: TaskComment[];
  createTask: (input: NewTask) => Promise<Task>;
  /** Restituisce l'annulla (undo) se la modifica è significativa. */
  updateTask: (
    id: string,
    patch: Partial<Omit<Task, "id" | "created_by" | "created_at">>,
  ) => Promise<(() => void) | null>;
  /** Spostamento da board (drag): sincrono; restituisce l'annulla se
   *  la fase è cambiata (l'undo rimuove anche la ricorrenza generata). */
  moveTask: (
    id: string,
    status: Task["status"],
    position: number,
  ) => (() => void) | null;
  /** Cambio scadenza da calendario/timeline (drag): sincrono. */
  rescheduleTask: (id: string, dueDate: string | null) => void;
  /** Cronologia (registro eventi append-only: timeline + report). */
  events: TaskEvent[];
  /** Checklist: spunte immediate, senza passare dal form. */
  toggleChecklistItem: (taskId: string, itemId: string) => void;
  addChecklistItem: (taskId: string, text: string) => void;
  removeChecklistItem: (taskId: string, itemId: string) => void;
  /** Riporta in board un task auto-archiviato. */
  restoreTask: (taskId: string) => void;
  taskLinks: TaskLink[];
  addTaskLink: (taskId: string, url: string, label: string) => Promise<void>;
  removeTaskLink: (id: string) => void;
  /** Focus di oggi: fino a 3 task scelti dall'utente corrente. */
  focusIds: string[];
  toggleFocus: (taskId: string) => void;
  /** Fasi del flusso: core + Problema + custom, nell'ordine della board. */
  statuses: StatusMeta[];
  customStatuses: CustomStatus[];
  addCustomStatus: (label: string, presetIndex: number) => boolean;
  /** Restituisce l'annulla: ripristina la fase e i task che ci stavano. */
  removeCustomStatus: (key: string) => (() => void) | null;
  /** Bacheca di progetto. */
  projectComments: ProjectComment[];
  addProjectComment: (projectId: string, body: string) => Promise<void>;
  /** Reazioni rapide e decisioni sui commenti (task o bacheca). */
  toggleReaction: (scope: CommentScope, commentId: string, emoji: string) => void;
  toggleDecision: (scope: CommentScope, commentId: string) => void;
  /** Snooze personale: il task sparisce dalle TUE viste fino alla data. */
  snoozes: Record<string, string>;
  snoozeTask: (taskId: string, untilIso: string) => void;
  unsnoozeTask: (taskId: string) => void;
  /** Flusso problemi. */
  reportProblem: (taskId: string, reason: string) => Promise<void>;
  resolveProblem: (taskId: string) => void;
  /** Attività ricorrenti configurabili (persistite in locale). */
  templates: WorkspaceTemplate[];
  addTemplate: (input: Omit<WorkspaceTemplate, "id" | "links">) => void;
  updateTemplate: (
    id: string,
    patch: Partial<Omit<WorkspaceTemplate, "id">>,
  ) => void;
  /** Restituisce l'annulla (il template torna al suo posto). */
  removeTemplate: (id: string) => (() => void) | null;
  /** Crea i task dal template (uno, o l'intero pacchetto se pack).
   *  La scadenza passata fa da àncora per gli offset del pacchetto. */
  createTaskFromTemplate: (
    templateId: string,
    overrides?: { due_date?: string | null; owner_id?: string },
  ) => Promise<Task[] | null>;
  /** Backup di configurazione: import di template, fasi custom e viste. */
  importConfig: (config: {
    templates?: WorkspaceTemplate[];
    customStatuses?: CustomStatus[];
    savedViews?: SavedView[];
  }) => void;
  /** Viste salvate (filtri della pagina Task), persistite in locale. */
  savedViews: SavedView[];
  addSavedView: (name: string, params: string) => void;
  removeSavedView: (id: string) => void;
  addComment: (taskId: string, body: string) => Promise<void>;
  updateProfileName: (id: string, fullName: string) => Promise<void>;
  /** Aggiorna nome e/o qualifica del profilo (Impostazioni › Profilo). */
  updateProfile: (
    id: string,
    patch: { full_name?: string; title?: string | null },
  ) => Promise<void>;
  notifications: AppNotification[];
  unreadCount: number;
  sendNotification: (
    toUserId: string,
    message: string,
    taskId?: string | null,
    kind?: NotificationKind,
  ) => Promise<void>;
  /** Segna letti tutti gli avvisi di un task (gruppo della campanella). */
  markTaskNotificationsRead: (taskId: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  /** Richieste di task: chiunque propone, i responsabili decidono. */
  requests: TaskRequest[];
  createRequest: (input: {
    title: string;
    description?: string;
    project_id?: string | null;
    requested_due?: string | null;
    priority?: Task["priority"];
  }) => Promise<TaskRequest>;
  /** Ritira una propria richiesta ancora in attesa; restituisce l'annulla. */
  withdrawRequest: (id: string) => (() => void) | null;
  /** Approva (solo admin): crea il task collegato e avvisa richiedente
   *  e assegnatario. Restituisce il task, o null se già decisa. */
  approveRequest: (
    id: string,
    opts: { owner_id: string; due_date?: string | null; project_id?: string | null },
  ) => Promise<Task | null>;
  /** Rifiuta (solo admin) con motivo; il richiedente riceve l'avviso. */
  rejectRequest: (id: string, reason: string) => Promise<void>;
}

const StoreContext = React.createContext<AppStore | null>(null);

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = React.useState<Profile[]>(MOCK_PROFILES);
  const [projects] = React.useState<Project[]>(MOCK_PROJECTS);
  const [tasks, setTasks] = React.useState<Task[]>(MOCK_TASKS);
  const [comments, setComments] = React.useState<TaskComment[]>(MOCK_COMMENTS);
  const [notifications, setNotifications] =
    React.useState<AppNotification[]>(MOCK_NOTIFICATIONS);
  const [taskLinks, setTaskLinks] =
    React.useState<TaskLink[]>(MOCK_TASK_LINKS);
  const [focusIds, setFocusIds] = React.useState<string[]>([]);
  const [customStatuses, setCustomStatuses] = React.useState<CustomStatus[]>([]);
  const [currentUserId, setCurrentUserId] =
    React.useState<string>(CURRENT_USER_ID);
  const [projectComments, setProjectComments] = React.useState<
    ProjectComment[]
  >(MOCK_PROJECT_COMMENTS);
  const [snoozes, setSnoozes] = React.useState<Record<string, string>>({});
  const [savedViews, setSavedViews] = React.useState<SavedView[]>([]);
  const [templates, setTemplates] =
    React.useState<WorkspaceTemplate[]>(MOCK_TEMPLATES);
  const [events, setEvents] = React.useState<TaskEvent[]>(MOCK_EVENTS);
  const [requests, setRequests] =
    React.useState<TaskRequest[]>(MOCK_REQUESTS);
  /* Marcatori «già segnalato» delle escalation: il ref fa da guardia
     sincrona dentro la sessione, lo stato è lo specchio PERSISTITO — senza,
     ogni ricarica ri-generava le stesse notifiche all'infinito. */
  const [escalatedProblems, setEscalatedProblems] = React.useState<string[]>([]);
  const [escalatedRequests, setEscalatedRequests] = React.useState<string[]>([]);
  const escalatedRef = React.useRef(new Set<string>());
  const requestsEscalatedRef = React.useRef(new Set<string>());

  /* ------------------------------------------------------------------ */
  /* Persistenza locale dell'intero workspace (fase placeholder).        */
  /* «Si deve memorizzare tutto»: task, cronologia, commenti e avvisi    */
  /* sopravvivono al refresh; con Supabase questo strato sparisce.       */
  /* Bump di STATE_VERSION = reset pulito ai seed (schema cambiato).     */
  /* ------------------------------------------------------------------ */
  const STATE_KEY = "office-state";
  // v2 (31/07): timestamp dei seed ancorati (fix idratazione #418) —
  // il bump azzera i dati demo persistiti, come concordato.
  const STATE_VERSION = 2;
  const stateLoadedRef = React.useRef(false);
  React.useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(STATE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          if (data?.version === STATE_VERSION) {
            if (data.tasks) setTasks(data.tasks);
            if (data.events) setEvents(data.events);
            if (data.comments) setComments(data.comments);
            if (data.notifications) {
              // Bonifica one-shot dei doppioni storici del vecchio bug.
              setNotifications(dedupeSystemNotifications(data.notifications));
            }
            if (data.taskLinks) setTaskLinks(data.taskLinks);
            if (data.projectComments) setProjectComments(data.projectComments);
            if (data.snoozes) setSnoozes(data.snoozes);
            if (data.focusIds) setFocusIds(data.focusIds);
            if (data.customStatuses) setCustomStatuses(data.customStatuses);
            if (data.requests) setRequests(data.requests);
            // Marcatori di escalation: caricati, o dedotti alla prima
            // apertura post-fix (campo assente nello stato salvato).
            const now = Date.now();
            const problems: string[] = Array.isArray(data.escalatedProblems)
              ? data.escalatedProblems
              : seedEscalatedProblems(data.tasks ?? [], now);
            const staleReqs: string[] = Array.isArray(data.escalatedRequests)
              ? data.escalatedRequests
              : seedEscalatedRequests(data.requests ?? [], now);
            escalatedRef.current = new Set(problems);
            requestsEscalatedRef.current = new Set(staleReqs);
            setEscalatedProblems(problems);
            setEscalatedRequests(staleReqs);
          }
        }
      } catch {
        /* storage illeggibile: si riparte dai seed */
      }
      stateLoadedRef.current = true;
    });
  }, []);
  React.useEffect(() => {
    if (!stateLoadedRef.current) return;
    const persist = () => {
      try {
        localStorage.setItem(
          STATE_KEY,
          JSON.stringify({
            version: STATE_VERSION,
            savedAt: new Date().toISOString(),
            tasks,
            events,
            comments,
            notifications,
            taskLinks,
            projectComments,
            snoozes,
            focusIds,
            customStatuses,
            requests,
            escalatedProblems,
            escalatedRequests,
          }),
        );
      } catch {
        /* quota piena o storage assente: pazienza */
      }
    };
    // Persiste al primo momento di quiete del browser (tetto 400ms):
    // ogni mutazione annulla e riprogramma, così le raffiche producono
    // una sola serializzazione e mai dentro un frame di interazione.
    if (typeof requestIdleCallback === "undefined") {
      const id = setTimeout(persist, 400);
      return () => clearTimeout(id);
    }
    const id = requestIdleCallback(persist, { timeout: 400 });
    return () => cancelIdleCallback(id);
  }, [
    tasks,
    events,
    comments,
    notifications,
    taskLinks,
    projectComments,
    snoozes,
    focusIds,
    customStatuses,
    requests,
    escalatedProblems,
    escalatedRequests,
  ]);

  /* Auto-archivio: i Fatto completati da più di 14 giorni escono dalla
     board (restano in archivio e nei report). */
  React.useEffect(() => {
    if (!stateLoadedRef.current) return;
    const cutoff = Date.now() - 14 * 86_400_000;
    const stale = tasks.filter(
      (t) =>
        t.status === "done" &&
        !t.archived_at &&
        t.completed_at &&
        new Date(t.completed_at).getTime() < cutoff,
    );
    if (stale.length === 0) return;
    queueMicrotask(() => {
      const ids = new Set(stale.map((t) => t.id));
      const nowIso = new Date().toISOString();
      setTasks((prev) =>
        prev.map((t) => (ids.has(t.id) ? { ...t, archived_at: nowIso } : t)),
      );
      setEvents((prev) => [
        ...prev,
        ...stale.map((t) => makeEvent(t.id, t.owner_id, "archived")),
      ]);
    });
  }, [tasks]);

  /* Viste salvate e template: carica e persisti in localStorage. Il flag
     "loaded" evita che il primo salvataggio (stato iniziale) sovrascriva
     quanto memorizzato prima che la lettura sia avvenuta. */
  const viewsLoadedRef = React.useRef(false);
  React.useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem("saved-views");
        if (raw) setSavedViews(JSON.parse(raw));
      } catch {
        /* ignora */
      }
      viewsLoadedRef.current = true;
    });
  }, []);
  React.useEffect(() => {
    if (!viewsLoadedRef.current) return;
    try {
      localStorage.setItem("saved-views", JSON.stringify(savedViews));
    } catch {
      /* ignora */
    }
  }, [savedViews]);

  const templatesLoadedRef = React.useRef(false);
  React.useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem("workspace-templates");
        if (raw) setTemplates(JSON.parse(raw));
      } catch {
        /* ignora */
      }
      templatesLoadedRef.current = true;
    });
  }, []);
  React.useEffect(() => {
    if (!templatesLoadedRef.current) return;
    try {
      localStorage.setItem("workspace-templates", JSON.stringify(templates));
    } catch {
      /* ignora */
    }
  }, [templates]);

  /* Risveglio degli snooze scaduti: il task torna con un avviso */
  React.useEffect(() => {
    const today = todayIso();
    const expired = Object.entries(snoozes).filter(([, until]) => until <= today);
    if (expired.length === 0) return;
    queueMicrotask(() => {
      setSnoozes((prev) => {
        const next = { ...prev };
        for (const [id] of expired) delete next[id];
        return next;
      });
      setNotifications((prev) => [
        ...prev,
        ...expired.map(([taskId]) => ({
          id: crypto.randomUUID(),
          to_user_id: CURRENT_USER_ID,
          from_user_id: CURRENT_USER_ID,
          message: `«${tasks.find((t) => t.id === taskId)?.title ?? "Task"}» è tornato dal posticipo.`,
          task_id: taskId,
          kind: "sistema" as const,
          created_at: new Date().toISOString(),
          read_at: null,
        })),
      ]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snoozes]);

  /* Richieste dimenticate: in attesa da più di 3 giorni → promemoria
     one-shot ai responsabili (stesso pattern dell'escalation problemi). */
  React.useEffect(() => {
    const now = Date.now();
    const overdue = requests.filter(
      (r) =>
        r.status === "pending" &&
        now - new Date(r.created_at).getTime() > REQUEST_ESCALATION_MS,
    );
    if (overdue.length === 0) return;
    queueMicrotask(() => {
      // Il «già segnalato» si valuta QUI: la microtask gira dopo quella di
      // idratazione, quindi i marcatori persistiti sono già caricati.
      const stale = overdue.filter(
        (r) => !requestsEscalatedRef.current.has(r.id),
      );
      if (stale.length === 0) return;
      for (const r of stale) requestsEscalatedRef.current.add(r.id);
      setEscalatedRequests((prev) => [...prev, ...stale.map((r) => r.id)]);
      const admins = MOCK_PROFILES.filter(
        (p) => p.is_active && p.role === "admin",
      );
      setNotifications((prev) => [
        ...prev,
        ...stale.flatMap((req) => {
          const days = Math.floor(
            (now - new Date(req.created_at).getTime()) / 86_400_000,
          );
          return admins.map((admin) => ({
            id: crypto.randomUUID(),
            to_user_id: admin.id,
            from_user_id: req.requester_id,
            message: `⏳ Richiesta in attesa da ${days} g: «${req.title}»`,
            task_id: null,
            kind: "sistema" as const,
            created_at: new Date().toISOString(),
            read_at: null,
          }));
        }),
      ]);
    });
  }, [requests]);

  /* Escalation: problemi fermi da più di 48h → avviso one-shot agli admin
     per EPISODIO di blocco (task + problem_since): sbloccato e ri-segnalato
     riparte, ricaricare la pagina no. */
  React.useEffect(() => {
    const now = Date.now();
    const overdue = tasks.filter(
      (t) =>
        t.status === "alert" &&
        t.problem_since &&
        now - new Date(t.problem_since).getTime() > PROBLEM_ESCALATION_MS,
    );
    if (overdue.length === 0) return;
    queueMicrotask(() => {
      // Il «già segnalato» si valuta QUI: la microtask gira dopo quella di
      // idratazione, quindi i marcatori persistiti sono già caricati.
      const stale = overdue.filter(
        (t) => !escalatedRef.current.has(problemEpisodeKey(t)),
      );
      if (stale.length === 0) return;
      for (const t of stale) escalatedRef.current.add(problemEpisodeKey(t));
      setEscalatedProblems((prev) => [
        ...prev,
        ...stale.map(problemEpisodeKey),
      ]);
      const admins = MOCK_PROFILES.filter((p) => p.is_active && p.role === "admin");
      setNotifications((prev) => [
        ...prev,
        ...stale.flatMap((task) => {
          const days = Math.floor(
            (now - new Date(task.problem_since as string).getTime()) / 86_400_000,
          );
          return admins.map((admin) => ({
            id: crypto.randomUUID(),
            to_user_id: admin.id,
            from_user_id: task.owner_id,
            message: `⛔ Problema fermo da ${days} g: «${task.title}»${task.problem_reason ? ` — ${task.problem_reason}` : ""}`,
            task_id: task.id,
            kind: "sistema" as const,
            created_at: new Date().toISOString(),
            read_at: null,
          }));
        }),
      ]);
    });
  }, [tasks]);

  /* Un solo valore di context, ricreato solo quando cambia davvero lo
     stato (mai per un render del provider, es. un cambio di preferenze
     più in alto): derivati calcolati all'interno, dipendenze = i soli
     atomi di stato, verificate dal lint dei hook. */
  const store = React.useMemo<AppStore>(() => {
    const statuses: StatusMeta[] = [
      ...(["backlog", "todo", "in_progress"] as const).map((key) => ({
        key,
        ...CORE_STATUS_META[key],
      })),
      ...customStatuses.map((c) => ({ ...c, kind: "custom" as const })),
      ...(["in_review", "alert", "done"] as const).map((key) => ({
        key,
        ...CORE_STATUS_META[key],
      })),
    ];
    const currentUser =
      profiles.find((p) => p.id === currentUserId) ?? profiles[0];
    const myNotifications = notifications
      .filter((n) => n.to_user_id === currentUser.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    let unreadCount = 0;
    for (const n of myNotifications) if (!n.read_at) unreadCount += 1;

    return {
    currentUser,

    switchUser(profileId) {
      setCurrentUserId(profileId);
    },
    profiles,
    projects,
    tasks,
    comments,

    async createTask(input) {
      const task: Task = {
        id: crypto.randomUUID(),
        title: input.title.trim(),
        description: input.description ?? null,
        status: input.status ?? "todo",
        priority: input.priority ?? "normal",
        owner_id: input.owner_id,
        created_by: currentUser.id,
        project_id: input.project_id ?? null,
        due_date: input.due_date ?? null,
        position: Date.now(),
        repeat: input.repeat ?? "none",
        template_id: input.template_id ?? null,
        completed_at: null,
        created_at: new Date().toISOString(),
      };
      setTasks((prev) => [...prev, task]);
      setEvents((prev) => [
        ...prev,
        makeEvent(task.id, currentUser.id, "created"),
      ]);
      return task;
    },

    async updateTask(id, patch) {
      const before = tasks.find((t) => t.id === id);
      if (!before) return null;
      const next: Task = { ...before, ...patch };
      const spawned: Task[] = [];
      // Stessa regola del trigger tasks_set_completed_at
      if (patch.status) {
        if (patch.status === "done" && before.status !== "done") {
          next.completed_at = new Date().toISOString();
          const following = nextOccurrence(next);
          if (following) spawned.push(following);
        } else if (patch.status !== "done") {
          next.completed_at = null;
        }
        // Ingresso/uscita dalla fase Problema
        if (patch.status === "alert" && before.status !== "alert") {
          next.problem_since = next.problem_since ?? new Date().toISOString();
        } else if (patch.status !== "alert") {
          next.problem_reason = null;
          next.problem_since = null;
        }
      }
      const evs = diffTaskEvents(before, next, currentUser.id);
      if (spawned.length > 0) {
        evs.push(makeEvent(spawned[0].id, currentUser.id, "created"));
      }
      setTasks((prev) => [
        ...prev.map((t) => (t.id === id ? next : t)),
        ...spawned,
      ]);
      if (evs.length > 0) setEvents((prev) => [...prev, ...evs]);

      if (before.status === next.status) return null;
      const spawnedIds = new Set(spawned.map((s) => s.id));
      const evIds = new Set(evs.map((e) => e.id));
      return () => {
        setTasks((prev) =>
          prev
            .filter((t) => !spawnedIds.has(t.id))
            .map((t) => (t.id === id ? before : t)),
        );
        setEvents((prev) => prev.filter((e) => !evIds.has(e.id)));
      };
    },

    moveTask(id, status, position) {
      const before = tasks.find((t) => t.id === id);
      if (!before) return null;
      const next: Task = {
        ...before,
        status,
        position,
        // Stessa regola del trigger tasks_set_completed_at
        completed_at:
          status === "done"
            ? before.status !== "done"
              ? new Date().toISOString()
              : before.completed_at
            : null,
      };
      const spawned: Task[] = [];
      if (status === "done" && before.status !== "done") {
        const following = nextOccurrence(next);
        if (following) spawned.push(following);
      }
      if (status === "alert" && before.status !== "alert") {
        next.problem_since = next.problem_since ?? new Date().toISOString();
      } else if (status !== "alert") {
        next.problem_reason = null;
        next.problem_since = null;
      }
      const evs = diffTaskEvents(before, next, currentUser.id);
      if (spawned.length > 0) {
        evs.push(makeEvent(spawned[0].id, currentUser.id, "created"));
      }
      setTasks((prev) => [
        ...prev.map((t) => (t.id === id ? next : t)),
        ...spawned,
      ]);
      if (evs.length > 0) setEvents((prev) => [...prev, ...evs]);

      if (before.status === status) return null;
      const spawnedIds = new Set(spawned.map((s) => s.id));
      const evIds = new Set(evs.map((e) => e.id));
      return () => {
        setTasks((prev) =>
          prev
            .filter((t) => !spawnedIds.has(t.id))
            .map((t) => (t.id === id ? before : t)),
        );
        setEvents((prev) => prev.filter((e) => !evIds.has(e.id)));
      };
    },

    events,

    toggleChecklistItem(taskId, itemId) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                checklist: t.checklist?.map((item) =>
                  item.id === itemId ? { ...item, done: !item.done } : item,
                ),
              }
            : t,
        ),
      );
    },

    addChecklistItem(taskId, text) {
      const trimmed = text.trim();
      if (!trimmed) return;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                checklist: [
                  ...(t.checklist ?? []),
                  { id: crypto.randomUUID(), text: trimmed, done: false },
                ],
              }
            : t,
        ),
      );
    },

    removeChecklistItem(taskId, itemId) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                checklist: t.checklist?.filter((item) => item.id !== itemId),
              }
            : t,
        ),
      );
    },

    restoreTask(taskId) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, archived_at: null } : t)),
      );
      setEvents((prev) => [
        ...prev,
        makeEvent(taskId, currentUser.id, "restored"),
      ]);
    },

    rescheduleTask(id, dueDate) {
      const before = tasks.find((t) => t.id === id);
      setTasks((prev) =>
        prev.map((task) =>
          task.id === id ? { ...task, due_date: dueDate } : task,
        ),
      );
      if (before && (before.due_date ?? null) !== (dueDate ?? null)) {
        setEvents((prev) => [
          ...prev,
          makeEvent(id, currentUser.id, "due_changed", before.due_date, dueDate),
        ]);
      }
    },

    taskLinks,

    async addTaskLink(taskId, url, label) {
      setTaskLinks((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          task_id: taskId,
          url: url.trim(),
          label: label.trim() ? label.trim() : null,
        },
      ]);
    },

    removeTaskLink(id) {
      setTaskLinks((prev) => prev.filter((l) => l.id !== id));
    },

    statuses,
    customStatuses,

    addCustomStatus(label, presetIndex) {
      if (customStatuses.length >= MAX_CUSTOM_STATUSES) return false;
      const preset =
        CUSTOM_STATUS_PRESETS[presetIndex] ?? CUSTOM_STATUS_PRESETS[0];
      const base = label
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      const key = `custom_${base || "fase"}_${customStatuses.length + 1}`;
      setCustomStatuses((prev) => [
        ...prev,
        {
          key,
          label: label.trim(),
          color: preset.color,
          soft: preset.soft,
          text: preset.text,
        },
      ]);
      return true;
    },

    removeCustomStatus(key) {
      const removed = customStatuses.find((c) => c.key === key);
      if (!removed) return null;
      const index = customStatuses.findIndex((c) => c.key === key);
      const movedIds = tasks.filter((t) => t.status === key).map((t) => t.id);
      setCustomStatuses((prev) => prev.filter((c) => c.key !== key));
      // i task nella fase rimossa tornano in "Da fare"
      setTasks((prev) =>
        prev.map((t) => (t.status === key ? { ...t, status: "todo" } : t)),
      );
      return () => {
        setCustomStatuses((prev) => {
          const next = [...prev];
          next.splice(Math.min(index, next.length), 0, removed);
          return next;
        });
        setTasks((prev) =>
          prev.map((t) =>
            movedIds.includes(t.id) ? { ...t, status: key } : t,
          ),
        );
      };
    },

    projectComments,

    async addProjectComment(projectId, body) {
      const trimmed = body.trim();
      setProjectComments((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          project_id: projectId,
          author_id: currentUser.id,
          body: trimmed,
          created_at: new Date().toISOString(),
        },
      ]);
      const mentioned = extractMentionIds(trimmed, profiles, currentUser.id);
      if (mentioned.length > 0) {
        const project = projects.find((p) => p.id === projectId);
        const excerpt =
          trimmed.length > 70 ? `${trimmed.slice(0, 70)}…` : trimmed;
        setNotifications((prev) => [
          ...prev,
          ...mentioned.map((toId) => ({
            id: crypto.randomUUID(),
            to_user_id: toId,
            from_user_id: currentUser.id,
            message: `Ti ha menzionato nella bacheca di «${project?.name ?? "un progetto"}»: “${excerpt}”`,
            task_id: null,
            kind: "mention" as const,
            created_at: new Date().toISOString(),
            read_at: null,
          })),
        ]);
      }
    },

    toggleReaction(scope, commentId, emoji) {
      const apply = <T extends { id: string; reactions?: Record<string, string[]> }>(
        list: T[],
      ): T[] =>
        list.map((c) => {
          if (c.id !== commentId) return c;
          const reactions = { ...(c.reactions ?? {}) };
          const users = reactions[emoji] ?? [];
          reactions[emoji] = users.includes(currentUser.id)
            ? users.filter((u) => u !== currentUser.id)
            : [...users, currentUser.id];
          if (reactions[emoji].length === 0) delete reactions[emoji];
          return { ...c, reactions };
        });
      if (scope === "task") setComments((prev) => apply(prev));
      else setProjectComments((prev) => apply(prev));
    },

    toggleDecision(scope, commentId) {
      const apply = <T extends { id: string; is_decision?: boolean }>(
        list: T[],
      ): T[] =>
        list.map((c) =>
          c.id === commentId ? { ...c, is_decision: !c.is_decision } : c,
        );
      if (scope === "task") setComments((prev) => apply(prev));
      else setProjectComments((prev) => apply(prev));
    },

    snoozes,

    snoozeTask(taskId, untilIso) {
      setSnoozes((prev) => ({ ...prev, [taskId]: untilIso }));
    },

    unsnoozeTask(taskId) {
      setSnoozes((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    },

    async reportProblem(taskId, reason) {
      const trimmed = reason.trim();
      const beforeStatus = tasks.find((t) => t.id === taskId)?.status;
      let title = "";
      let ownerId = "";
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          title = t.title;
          ownerId = t.owner_id;
          return {
            ...t,
            status: "alert",
            problem_reason: trimmed || null,
            problem_since: t.problem_since ?? new Date().toISOString(),
            completed_at: null,
          };
        }),
      );
      const recipients = new Set(
        profiles
          .filter((p) => p.is_active && p.role === "admin")
          .map((p) => p.id),
      );
      if (beforeStatus && beforeStatus !== "alert") {
        setEvents((prev) => [
          ...prev,
          makeEvent(taskId, currentUser.id, "status_changed", beforeStatus, "alert"),
        ]);
      }
      if (ownerId) recipients.add(ownerId);
      recipients.delete(currentUser.id);
      setNotifications((prev) => [
        ...prev,
        ...[...recipients].map((toId) => ({
          id: crypto.randomUUID(),
          to_user_id: toId,
          from_user_id: currentUser.id,
          message: `⚠️ Problema segnalato su «${title}»${trimmed ? `: ${trimmed}` : ""}`,
          task_id: taskId,
          kind: "sistema" as const,
          created_at: new Date().toISOString(),
          read_at: null,
        })),
      ]);
    },

    resolveProblem(taskId) {
      const beforeStatus = tasks.find((t) => t.id === taskId)?.status;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: "in_progress",
                problem_reason: null,
                problem_since: null,
              }
            : t,
        ),
      );
      if (beforeStatus && beforeStatus !== "in_progress") {
        setEvents((prev) => [
          ...prev,
          makeEvent(taskId, currentUser.id, "status_changed", beforeStatus, "in_progress"),
        ]);
      }
    },

    templates,

    addTemplate(input) {
      setTemplates((prev) => [
        ...prev,
        { ...input, id: crypto.randomUUID(), links: [] },
      ]);
    },

    updateTemplate(id, patch) {
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      );
    },

    removeTemplate(id) {
      const removed = templates.find((t) => t.id === id);
      if (!removed) return null;
      const index = templates.findIndex((t) => t.id === id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      return () => {
        setTemplates((prev) => {
          const next = [...prev];
          next.splice(Math.min(index, next.length), 0, removed);
          return next;
        });
      };
    },

    async createTaskFromTemplate(templateId, overrides) {
      const tpl = templates.find((t) => t.id === templateId);
      if (!tpl) return null;
      const anchor =
        overrides?.due_date !== undefined
          ? overrides.due_date
          : tpl.due_day !== null
            ? nextMonthlyIso(tpl.due_day)
            : null;
      const nowIso = new Date().toISOString();

      // Pacchetto: un set di task collegati (stesso batch), con scadenze
      // relative alla data àncora scelta.
      if (tpl.pack && tpl.pack.length > 0) {
        const batchId = crypto.randomUUID();
        const created: Task[] = tpl.pack.map((item, i) => ({
          id: crypto.randomUUID(),
          title: item.title,
          description: tpl.description || null,
          status: "todo",
          priority: tpl.priority,
          owner_id: item.owner_id ?? overrides?.owner_id ?? currentUser.id,
          created_by: currentUser.id,
          project_id: tpl.project_id,
          due_date: anchor ? shiftIsoDays(anchor, item.offset_days) : null,
          position: Date.now() + i,
          repeat: "none",
          template_id: tpl.id,
          batch_id: batchId,
          completed_at: null,
          created_at: nowIso,
        }));
        setTasks((prev) => [...prev, ...created]);
        setEvents((prev) => [
          ...prev,
          ...created.map((t) => makeEvent(t.id, currentUser.id, "created")),
        ]);
        return created;
      }

      const task: Task = {
        id: crypto.randomUUID(),
        title: tpl.name,
        description: tpl.description || null,
        status: "todo",
        priority: tpl.priority,
        owner_id: overrides?.owner_id ?? tpl.owner_id ?? currentUser.id,
        created_by: currentUser.id,
        project_id: tpl.project_id,
        due_date: anchor,
        position: Date.now(),
        repeat: tpl.repeat,
        template_id: tpl.id,
        checklist: tpl.checklist?.map((text) => ({
          id: crypto.randomUUID(),
          text,
          done: false,
        })),
        completed_at: null,
        created_at: nowIso,
      };
      setTasks((prev) => [...prev, task]);
      setEvents((prev) => [
        ...prev,
        makeEvent(task.id, currentUser.id, "created"),
      ]);
      if (tpl.links.length > 0) {
        setTaskLinks((prev) => [
          ...prev,
          ...tpl.links.map((l) => ({
            id: crypto.randomUUID(),
            task_id: task.id,
            url: l.url,
            label: l.label,
          })),
        ]);
      }
      return [task];
    },

    importConfig(config) {
      if (config.templates) setTemplates(config.templates);
      if (config.customStatuses) setCustomStatuses(config.customStatuses);
      if (config.savedViews) setSavedViews(config.savedViews);
    },

    savedViews,

    addSavedView(name, params) {
      setSavedViews((prev) => [
        ...prev,
        { id: crypto.randomUUID(), name: name.trim(), params },
      ]);
    },

    removeSavedView(id) {
      setSavedViews((prev) => prev.filter((v) => v.id !== id));
    },

    focusIds,

    toggleFocus(taskId) {
      setFocusIds((prev) => {
        if (prev.includes(taskId)) return prev.filter((id) => id !== taskId);
        if (prev.length >= 3) return prev;
        return [...prev, taskId];
      });
    },

    async addComment(taskId, body) {
      const trimmed = body.trim();
      setComments((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          task_id: taskId,
          author_id: currentUser.id,
          body: trimmed,
          created_at: new Date().toISOString(),
        },
      ]);
      // Le menzioni (@Nome, @Admin) diventano avvisi reali al destinatario
      const mentioned = extractMentionIds(trimmed, profiles, currentUser.id);
      if (mentioned.length > 0) {
        const task = tasks.find((t) => t.id === taskId);
        const excerpt =
          trimmed.length > 70 ? `${trimmed.slice(0, 70)}…` : trimmed;
        setNotifications((prev) => [
          ...prev,
          ...mentioned.map((toId) => ({
            id: crypto.randomUUID(),
            to_user_id: toId,
            from_user_id: currentUser.id,
            message: `Ti ha menzionato su «${task?.title ?? "un task"}»: “${excerpt}”`,
            task_id: taskId,
            kind: "mention" as const,
            created_at: new Date().toISOString(),
            read_at: null,
          })),
        ]);
      }
    },

    async updateProfileName(id, fullName) {
      setProfiles((prev) =>
        prev.map((p) => (p.id === id ? { ...p, full_name: fullName.trim() } : p)),
      );
    },

    async updateProfile(id, patch) {
      setProfiles((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          const next = { ...p };
          if (patch.full_name !== undefined) {
            next.full_name = patch.full_name.trim();
          }
          if (patch.title !== undefined) {
            const t = patch.title?.trim();
            next.title = t ? t : undefined;
          }
          return next;
        }),
      );
    },

    notifications: myNotifications,
    unreadCount,

    async sendNotification(toUserId, message, taskId = null, kind = "sistema") {
      setNotifications((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          to_user_id: toUserId,
          from_user_id: currentUser.id,
          message: message.trim(),
          task_id: taskId,
          kind,
          created_at: new Date().toISOString(),
          read_at: null,
        },
      ]);
    },

    markTaskNotificationsRead(taskId) {
      setNotifications((prev) =>
        prev.map((n) =>
          n.to_user_id === currentUser.id && n.task_id === taskId && !n.read_at
            ? { ...n, read_at: new Date().toISOString() }
            : n,
        ),
      );
    },

    markNotificationRead(id) {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id && !n.read_at
            ? { ...n, read_at: new Date().toISOString() }
            : n,
        ),
      );
    },

    markAllNotificationsRead() {
      setNotifications((prev) =>
        prev.map((n) =>
          n.to_user_id === currentUser.id && !n.read_at
            ? { ...n, read_at: new Date().toISOString() }
            : n,
        ),
      );
    },

    requests,

    async createRequest(input) {
      const request: TaskRequest = {
        id: crypto.randomUUID(),
        title: input.title.trim(),
        description: input.description?.trim() || null,
        requester_id: currentUser.id,
        created_at: new Date().toISOString(),
        status: "pending",
        requested_due: input.requested_due ?? null,
        priority: input.priority ?? "normal",
        decided_by: null,
        decided_at: null,
        rejection_reason: null,
        owner_id: null,
        due_date: null,
        project_id: input.project_id ?? null,
        task_id: null,
      };
      setRequests((prev) => [...prev, request]);
      // Avvisa i responsabili (non chi ha inviato, se è admin anche lui)
      const admins = profiles.filter(
        (p) => p.is_active && p.role === "admin" && p.id !== currentUser.id,
      );
      setNotifications((prev) => [
        ...prev,
        ...admins.map((admin) => ({
          id: crypto.randomUUID(),
          to_user_id: admin.id,
          from_user_id: currentUser.id,
          message: `📥 Nuova richiesta di task: «${request.title}»`,
          task_id: null,
          kind: "sistema" as const,
          created_at: new Date().toISOString(),
          read_at: null,
        })),
      ]);
      return request;
    },

    async approveRequest(id, opts) {
      const req = requests.find((r) => r.id === id);
      if (!req || req.status !== "pending") return null;
      const nowIso = new Date().toISOString();
      const task: Task = {
        id: crypto.randomUUID(),
        title: req.title,
        description: req.description,
        status: "todo",
        priority: req.priority ?? "normal",
        owner_id: opts.owner_id,
        created_by: currentUser.id,
        project_id: opts.project_id ?? req.project_id ?? null,
        due_date: opts.due_date ?? null,
        position: Date.now(),
        repeat: "none",
        completed_at: null,
        created_at: nowIso,
      };
      setTasks((prev) => [...prev, task]);
      setEvents((prev) => [
        ...prev,
        makeEvent(task.id, currentUser.id, "created"),
      ]);
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: "approved" as const,
                decided_by: currentUser.id,
                decided_at: nowIso,
                owner_id: task.owner_id,
                due_date: task.due_date,
                project_id: task.project_id,
                task_id: task.id,
              }
            : r,
        ),
      );
      // Avvisi: al richiedente e all'assegnatario (senza doppioni né auto-avvisi)
      const ownerName =
        profiles.find((p) => p.id === task.owner_id)?.full_name.split(" ")[0] ??
        "un collega";
      const toNotify = new Map<string, string>();
      if (req.requester_id !== currentUser.id) {
        toNotify.set(
          req.requester_id,
          `✅ Richiesta approvata: «${req.title}» è ora un task assegnato a ${ownerName}.`,
        );
      }
      if (task.owner_id !== currentUser.id && task.owner_id !== req.requester_id) {
        toNotify.set(
          task.owner_id,
          `Ti è stato assegnato un task dalla richiesta di ${
            profiles.find((p) => p.id === req.requester_id)?.full_name.split(" ")[0] ?? "un collega"
          }: «${req.title}»`,
        );
      }
      if (toNotify.size > 0) {
        setNotifications((prev) => [
          ...prev,
          ...[...toNotify].map(([toId, message]) => ({
            id: crypto.randomUUID(),
            to_user_id: toId,
            from_user_id: currentUser.id,
            message,
            task_id: task.id,
            kind: "sistema" as const,
            created_at: nowIso,
            read_at: null,
          })),
        ]);
      }
      return task;
    },

    withdrawRequest(id) {
      const req = requests.find((r) => r.id === id);
      if (
        !req ||
        req.status !== "pending" ||
        req.requester_id !== currentUser.id
      ) {
        return null;
      }
      const index = requests.findIndex((r) => r.id === id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
      return () => {
        setRequests((prev) => {
          const next = [...prev];
          next.splice(Math.min(index, next.length), 0, req);
          return next;
        });
      };
    },

    async rejectRequest(id, reason) {
      const req = requests.find((r) => r.id === id);
      if (!req || req.status !== "pending") return;
      const trimmed = reason.trim();
      const nowIso = new Date().toISOString();
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: "rejected" as const,
                decided_by: currentUser.id,
                decided_at: nowIso,
                rejection_reason: trimmed || null,
              }
            : r,
        ),
      );
      if (req.requester_id !== currentUser.id) {
        setNotifications((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            to_user_id: req.requester_id,
            from_user_id: currentUser.id,
            message: `❌ Richiesta rifiutata: «${req.title}»${trimmed ? ` — ${trimmed}` : ""}`,
            task_id: null,
            kind: "sistema" as const,
            created_at: nowIso,
            read_at: null,
          },
        ]);
      }
    },
    };
  }, [
    comments,
    currentUserId,
    customStatuses,
    events,
    focusIds,
    notifications,
    profiles,
    projectComments,
    projects,
    requests,
    savedViews,
    snoozes,
    taskLinks,
    tasks,
    templates,
  ]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useAppStore(): AppStore {
  const ctx = React.useContext(StoreContext);
  if (!ctx) {
    throw new Error("useAppStore va usato dentro AppStoreProvider");
  }
  return ctx;
}

/** Variante tollerante: null fuori dal provider (es. styleguide). */
export function useAppStoreOptional(): AppStore | null {
  return React.useContext(StoreContext);
}
