"use client";

import * as React from "react";

import {
  diffIsoDays,
  nextMonthlyIso,
  shiftIsoDays,
  shiftIsoMonths,
  todayIso,
} from "@/lib/format";
import { extractMentionIds } from "@/lib/mentions";
import { CUSTOM_STATUS_PRESETS } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  deleteChecklistItem,
  deleteClosure,
  deleteCustomStatus,
  deleteLeaveRequest,
  deleteTaskRequest,
  deleteTaskLink,
  deleteTaskRow,
  decideLeaveRequest,
  decideTaskRequest,
  fetchChecklists,
  fetchClosures,
  fetchLeaveRequests,
  fetchNotifications,
  fetchTaskRequests,
  fetchProjectComments,
  fetchTaskComments,
  fetchTaskEvents,
  fetchTaskLinks,
  fetchCustomStatuses,
  fetchProfiles,
  fetchProjects,
  fetchTasks,
  insertChecklistItem,
  insertClosure,
  insertCustomStatus,
  insertLeaveRequest,
  insertTaskRequest,
  insertNotifications,
  insertProject,
  insertProjectComment,
  insertTaskComment,
  insertTaskEvents,
  insertTaskLink,
  insertTask,
  markNotificationsRead,
  removeAvatarByUrl,
  setChecklistItemDone,
  setDecision,
  toggleReactionRow,
  updateProfileRow,
  updateTaskRow,
  uploadAvatar,
} from "@/lib/supabase/queries";
import { formatRange, workingDaysCount } from "@/lib/leave";
import type {
  AppNotification,
  CompanyClosure,
  CustomStatus,
  LeaveRequest,
  LeaveType,
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

/** Una richiesta ferie merita il promemoria? In attesa da più di 3 giorni,
 *  oppure partenza ormai vicina (≤3 g): decidere tardi è un no di fatto. */
const leaveEscalationDue = (
  l: LeaveRequest,
  now: number,
  today: string,
): boolean =>
  l.status === "pending" &&
  (now - new Date(l.created_at).getTime() > REQUEST_ESCALATION_MS ||
    (l.start_date >= today && diffIsoDays(today, l.start_date) <= 3));

const seedEscalatedLeaves = (
  leaves: LeaveRequest[],
  now: number,
  today: string,
): string[] =>
  leaves.filter((l) => leaveEscalationDue(l, now, today)).map((l) => l.id);

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
  /** Profilo dell'utente collegato. Durante il caricamento è una sentinella
   *  con `id` vuoto: controllare `loading` prima di fidarsene. */
  currentUser: Profile;
  /** Vero finché la prima lettura da Supabase non è conclusa. */
  loading: boolean;
  /** Messaggio dell'errore di caricamento, se c'è stato. */
  loadError: string | null;
  /** Messaggio dell'ultima scrittura fallita: la modifica è già stata
   *  annullata quando questo campo si valorizza. */
  syncError: string | null;
  /** Nasconde l'avviso di scrittura fallita dopo che l'utente l'ha letto. */
  clearSyncError: () => void;
  /** Vero quando il profilo non è mai stato configurato dal suo proprietario
   *  (`onboarded_at` nullo) e i dati sono già stati caricati. */
  needsOnboarding: boolean;
  /** Conclude il primo accesso: salva nome, qualifica ed eventuale foto, e
   *  marca il profilo come configurato. Lancia se la scrittura fallisce —
   *  qui l'utente sta aspettando, quindi l'errore va mostrato, non ingoiato. */
  completeOnboarding: (input: {
    full_name: string;
    title: string | null;
    avatarFile: File | null;
  }) => Promise<void>;
  profiles: Profile[];
  projects: Project[];
  /** Crea un progetto su Supabase e lo aggiunge alla lista. */
  createProject: (input: {
    name: string;
    description?: string | null;
  }) => Promise<Project>;
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
  /** Imposta o rimuove (null) la foto del profilo (data URL ridotta). */
  setAvatar: (profileId: string, dataUrl: string | null) => void;
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
  /** Ferie e permessi: richieste con approvazione dei responsabili. */
  leaves: LeaveRequest[];
  createLeave: (input: {
    type: LeaveType;
    start_date: string;
    end_date: string;
    time_range?: string | null;
    note?: string;
  }) => Promise<LeaveRequest>;
  /** Ritira una propria richiesta in attesa; restituisce l'annulla. */
  withdrawLeave: (id: string) => (() => void) | null;
  /** Decisione (solo admin) con motivazione: avvisa richiedente e gli
   *  altri responsabili. Il motivo è obbligatorio per il rifiuto. */
  decideLeave: (
    id: string,
    decision: "approved" | "rejected",
    note: string,
  ) => Promise<void>;
  /** Chiusure aziendali (solo admin): compaiono sul calendario di tutti. */
  closures: CompanyClosure[];
  addClosure: (input: {
    title: string;
    start_date: string;
    end_date: string;
  }) => void;
  removeClosure: (id: string) => (() => void) | null;
}

/** Identità di ripiego finché la sessione non ha risposto. Non è un utente
 *  reale: `id` vuoto non corrisponde a nessuna riga, quindi nessuna query
 *  parte per sbaglio a suo nome e nessun dato gli viene attribuito. */
const PROFILO_IN_CARICAMENTO: Profile = {
  id: "",
  full_name: "…",
  email: "",
  role: "member",
  is_active: false,
  avatar_url: null,
};

/* --------------------------------------------------------------------------
   Bonifica del browser.

   I dati finti non stavano solo nel codice: lo store li ha salvati in
   localStorage per mesi, e li reidratava all'avvio. Toglierli dai sorgenti
   non basta — vanno tolti anche dai browser che li hanno già.

   Una marcatura di generazione risolve in un colpo: quando non corrisponde,
   le chiavi del workspace vengono svuotate una volta sola. Alzare il numero
   in futuro ripulisce di nuovo, senza che nessuno debba svuotare la cache a
   mano.

   Le preferenze d'aspetto e il layout della dashboard NON sono qui: sono
   scelte personali per-browser, non contengono dati inventati e non c'è
   motivo di buttarle.
   -------------------------------------------------------------------------- */
const STORAGE_GENERATION = "3";
const STORAGE_GENERATION_KEY = "office-storage-generation";
const WORKSPACE_STORAGE_KEYS = [
  "office-state",
  "profile-avatars",
  "saved-views",
  "workspace-templates",
];

/**
 * Sincronizza una collezione con il database confrontando gli id.
 *
 * Le collezioni append-only dell'app — cronologia, commenti, allegati,
 * avvisi — hanno una quarantina di punti che le modificano, sparsi in tutto
 * lo store. Attaccare una scrittura a ognuno significherebbe quaranta
 * occasioni di dimenticarne una, e ogni dimenticanza sarebbe un dato perso
 * senza errore.
 *
 * Qui si osserva il risultato invece del gesto: a ogni cambiamento si
 * confrontano gli id presenti con quelli già noti al server, si inserisce
 * ciò che è comparso e si elimina ciò che è sparito. I punti di mutazione
 * restano com'erano.
 *
 * Il limite da conoscere: le MODIFICHE a una riga esistente non si vedono,
 * perché l'id non cambia. Reazioni, decisioni, spunte e letture si scrivono
 * quindi esplicitamente dove avvengono.
 */
function useSincronizza<T extends { id: string }>(
  righe: T[],
  pronto: boolean,
  inserisci: (nuove: T[]) => Promise<void>,
  elimina: (ids: string[]) => Promise<void>,
  segnalaErrore: (messaggio: string) => void,
) {
  const noteRef = React.useRef<Set<string> | null>(null);

  React.useEffect(() => {
    if (!pronto) return;

    // Prima passata: quello che c'è arriva dal server, non va reinserito.
    if (noteRef.current === null) {
      noteRef.current = new Set(righe.map((r) => r.id));
      return;
    }

    const attuali = new Set(righe.map((r) => r.id));
    const nuove = righe.filter((r) => !noteRef.current!.has(r.id));
    const rimosse = [...noteRef.current].filter((id) => !attuali.has(id));
    if (nuove.length === 0 && rimosse.length === 0) return;

    /* Si aggiorna PRIMA di scrivere: se la scrittura è lenta e nel frattempo
       arriva un altro cambiamento, senza questo la stessa riga verrebbe
       inserita due volte. */
    noteRef.current = attuali;

    void (async () => {
      try {
        if (nuove.length > 0) await inserisci(nuove);
        if (rimosse.length > 0) await elimina(rimosse);
      } catch (e) {
        segnalaErrore(
          e instanceof Error ? e.message : "Salvataggio non riuscito.",
        );
      }
    })();
    // `inserisci` ed `elimina` sono ricreate a ogni render dai chiamanti:
    // includerle farebbe girare l'effetto in continuo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [righe, pronto]);
}

const StoreContext = React.createContext<AppStore | null>(null);

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  /* Workspace vuoto: i dati finti sono spariti con l'incremento 1. Profili e
     progetti arrivano da Supabase (sotto); le altre entità restano in memoria
     e verranno collegate una per una negli incrementi successivi. Nessuna
     nasce più con dei seed, così non esiste mai lo stato misto vero/finto. */
  const [profiles, setProfiles] = React.useState<Profile[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [comments, setComments] = React.useState<TaskComment[]>([]);
  const [notifications, setNotifications] = React.useState<AppNotification[]>([]);
  const [taskLinks, setTaskLinks] = React.useState<TaskLink[]>([]);
  const [focusIds, setFocusIds] = React.useState<string[]>([]);
  const [customStatuses, setCustomStatuses] = React.useState<CustomStatus[]>([]);
  /* Identità reale: nasce vuota e si popola dalla sessione. Finché è vuota
     l'app mostra lo stato di caricamento invece di un utente inventato. */
  const [currentUserId, setCurrentUserId] = React.useState<string>("");
  const [projectComments, setProjectComments] = React.useState<ProjectComment[]>([]);
  const [snoozes, setSnoozes] = React.useState<Record<string, string>>({});
  const [savedViews, setSavedViews] = React.useState<SavedView[]>([]);
  const [templates, setTemplates] = React.useState<WorkspaceTemplate[]>([]);
  const [events, setEvents] = React.useState<TaskEvent[]>([]);
  const [requests, setRequests] = React.useState<TaskRequest[]>([]);
  const [leaves, setLeaves] = React.useState<LeaveRequest[]>([]);
  const [closures, setClosures] = React.useState<CompanyClosure[]>([]);
  /* Marcatori «già segnalato» delle escalation: il ref fa da guardia
     sincrona dentro la sessione, lo stato è lo specchio PERSISTITO — senza,
     ogni ricarica ri-generava le stesse notifiche all'infinito. */
  const [escalatedProblems, setEscalatedProblems] = React.useState<string[]>([]);
  const [escalatedRequests, setEscalatedRequests] = React.useState<string[]>([]);
  const [escalatedLeaves, setEscalatedLeaves] = React.useState<string[]>([]);
  const escalatedRef = React.useRef(new Set<string>());
  const requestsEscalatedRef = React.useRef(new Set<string>());
  const leavesEscalatedRef = React.useRef(new Set<string>());

  /* Bonifica prima di ogni idratazione. Dichiarato per primo di proposito:
     gli effetti girano nell'ordine dei sorgenti, quindi qui le chiavi sono
     già sparite quando gli effetti sotto provano a rileggerle. */
  React.useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_GENERATION_KEY) === STORAGE_GENERATION) {
        return;
      }
      for (const chiave of WORKSPACE_STORAGE_KEYS) {
        localStorage.removeItem(chiave);
      }
      localStorage.setItem(STORAGE_GENERATION_KEY, STORAGE_GENERATION);
    } catch {
      /* storage non disponibile (navigazione privata, quota): pazienza,
         non è un motivo per impedire l'avvio dell'app */
    }
  }, []);

  /* ------------------------------------------------------------------ */
  /* Caricamento da Supabase (incremento 1: identità, profili, progetti). */
  /* ------------------------------------------------------------------ */
  const [loading, setLoading] = React.useState(isSupabaseConfigured);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [syncError, setSyncError] = React.useState<string | null>(null);

  /* Scrittura in sottofondo con annullamento.

     L'interfaccia si aggiorna subito — trascinare una scheda deve essere
     istantaneo, non attendere la rete — e la scrittura parte dopo. Se il
     database rifiuta (una policy, la connessione, un vincolo), si ripristina
     lo stato precedente e si espone l'errore: senza il ripristino l'utente
     resterebbe convinto di aver salvato qualcosa che non esiste.

     La RLS è l'ultima parola: se una policy nega, qui si vede: l'app non
     decide i permessi, li subisce. */
  const scriviCon = React.useCallback(
    (operazione: () => Promise<void>, ripristina: () => void) => {
      if (!isSupabaseConfigured) return;
      void operazione().catch((e: unknown) => {
        ripristina();
        setSyncError(
          e instanceof Error ? e.message : "Salvataggio non riuscito.",
        );
      });
    },
    [],
  );

  React.useEffect(() => {
    if (!isSupabaseConfigured) return;
    let annullato = false;

    (async () => {
      try {
        const supabase = createClient();
        /* `getClaims()` legge il token già in cookie senza interrogare il
           server: l'id utente è il claim `sub`. Il proxy ha appena rinnovato
           la sessione, quindi qui è sempre fresca. */
        const { data: claims } = await supabase.auth.getClaims();
        const userId = claims?.claims?.sub as string | undefined;

        const [
          profileList,
          projectList,
          taskList,
          customList,
          checklists,
          linkList,
          eventList,
          commentList,
          projectCommentList,
          notificationList,
          requestList,
          leaveList,
          closureList,
        ] = await Promise.all([
          fetchProfiles(supabase),
          fetchProjects(supabase),
          fetchTasks(supabase),
          fetchCustomStatuses(supabase),
          fetchChecklists(supabase),
          fetchTaskLinks(supabase),
          fetchTaskEvents(supabase),
          fetchTaskComments(supabase),
          fetchProjectComments(supabase),
          fetchNotifications(supabase),
          fetchTaskRequests(supabase),
          fetchLeaveRequests(supabase),
          fetchClosures(supabase),
        ]);

        if (annullato) return;
        setProfiles(profileList);
        setProjects(projectList);
        // Le voci di checklist stanno in tabella a parte ma il tipo `Task` le
        // porta dentro di sé: si ricompongono qui, una volta sola.
        setTasks(
          taskList.map((t) =>
            checklists[t.id] ? { ...t, checklist: checklists[t.id] } : t,
          ),
        );
        setCustomStatuses(customList);
        setTaskLinks(linkList);
        setEvents(eventList);
        setComments(commentList);
        setProjectComments(projectCommentList);
        setNotifications(notificationList);
        setRequests(requestList);
        setLeaves(leaveList);
        setClosures(closureList);
        if (userId) setCurrentUserId(userId);
      } catch (e) {
        if (!annullato) {
          setLoadError(
            e instanceof Error ? e.message : "Caricamento dei dati non riuscito.",
          );
        }
      } finally {
        if (!annullato) setLoading(false);
      }
    })();

    // Il provider può smontare mentre le query sono in volo (navigazione,
    // logout): senza questa guardia si scriverebbe su un componente morto.
    return () => {
      annullato = true;
    };
  }, []);

  /* --- Sincronizzazione delle collezioni append-only ------------------ */
  const pronto = isSupabaseConfigured && !loading && Boolean(currentUserId);

  useSincronizza(
    events,
    pronto,
    (nuovi) => insertTaskEvents(createClient(), nuovi),
    // La cronologia è append-only: non ha policy di cancellazione, e un
    // registro che si può correggere non è un registro.
    async () => {},
    setSyncError,
  );

  useSincronizza(
    comments,
    pronto,
    async (nuovi) => {
      const supabase = createClient();
      for (const c of nuovi) await insertTaskComment(supabase, c);
    },
    async () => {},
    setSyncError,
  );

  useSincronizza(
    projectComments,
    pronto,
    async (nuovi) => {
      const supabase = createClient();
      for (const c of nuovi) await insertProjectComment(supabase, c);
    },
    async () => {},
    setSyncError,
  );

  useSincronizza(
    taskLinks,
    pronto,
    async (nuovi) => {
      const supabase = createClient();
      for (const l of nuovi) await insertTaskLink(supabase, l, currentUserId);
    },
    async (ids) => {
      const supabase = createClient();
      for (const id of ids) await deleteTaskLink(supabase, id);
    },
    setSyncError,
  );

  /* Richieste, ferie e chiusure: creazione e ritiro passano dal confronto
     per id, come le altre collezioni. Le DECISIONI invece sono modifiche a
     righe esistenti e si scrivono dove avvengono, più sotto. */
  useSincronizza(
    requests,
    pronto,
    async (nuove) => {
      const supabase = createClient();
      for (const r of nuove) await insertTaskRequest(supabase, r);
    },
    async (ids) => {
      const supabase = createClient();
      for (const id of ids) await deleteTaskRequest(supabase, id);
    },
    setSyncError,
  );

  useSincronizza(
    leaves,
    pronto,
    async (nuove) => {
      const supabase = createClient();
      for (const l of nuove) await insertLeaveRequest(supabase, l);
    },
    async (ids) => {
      const supabase = createClient();
      for (const id of ids) await deleteLeaveRequest(supabase, id);
    },
    setSyncError,
  );

  useSincronizza(
    closures,
    pronto,
    async (nuove) => {
      const supabase = createClient();
      for (const c of nuove) await insertClosure(supabase, c);
    },
    async (ids) => {
      const supabase = createClient();
      for (const id of ids) await deleteClosure(supabase, id);
    },
    setSyncError,
  );

  useSincronizza(
    notifications,
    pronto,
    async (nuovi) => {
      /* Si scrivono solo gli avvisi che l'utente corrente sta mandando: la
         policy pretende `from_user_id = auth.uid()`. Le escalation
         automatiche li attribuiscono al richiedente, quindi verrebbero
         rifiutate — e comunque non hanno senso generate dal browser di chi
         ha per caso una scheda aperta. Restano locali finché richieste e
         ferie non passano al database, dove quelle notifiche appartengono. */
      const miei = nuovi.filter((n) => n.from_user_id === currentUserId);
      if (miei.length > 0) await insertNotifications(createClient(), miei);
    },
    async () => {},
    setSyncError,
  );

  /* ------------------------------------------------------------------ */
  /* Persistenza locale delle entità non ancora collegate.               */
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
            if (data.leaves) setLeaves(data.leaves);
            if (data.closures) setClosures(data.closures);
            // Marcatori di escalation: caricati, o dedotti alla prima
            // apertura post-fix (campo assente nello stato salvato).
            const now = Date.now();
            const problems: string[] = Array.isArray(data.escalatedProblems)
              ? data.escalatedProblems
              : seedEscalatedProblems(data.tasks ?? [], now);
            const staleReqs: string[] = Array.isArray(data.escalatedRequests)
              ? data.escalatedRequests
              : seedEscalatedRequests(data.requests ?? [], now);
            const staleLeaves: string[] = Array.isArray(data.escalatedLeaves)
              ? data.escalatedLeaves
              : seedEscalatedLeaves(data.leaves ?? [], now, todayIso());
            escalatedRef.current = new Set(problems);
            requestsEscalatedRef.current = new Set(staleReqs);
            leavesEscalatedRef.current = new Set(staleLeaves);
            setEscalatedProblems(problems);
            setEscalatedRequests(staleReqs);
            setEscalatedLeaves(staleLeaves);
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
            leaves,
            closures,
            escalatedProblems,
            escalatedRequests,
            escalatedLeaves,
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
    leaves,
    closures,
    escalatedProblems,
    escalatedRequests,
    escalatedLeaves,
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

  /* Foto profilo (id → data URL). Chiave separata da office-state: quel
     payload si riserializza a ogni mutazione dei task e non deve portarsi
     dietro le immagini; queste si riscrivono solo quando cambiano. */
  const [avatars, setAvatars] = React.useState<Record<string, string>>({});
  const avatarsLoadedRef = React.useRef(false);
  React.useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem("profile-avatars");
        if (raw) setAvatars(JSON.parse(raw));
      } catch {
        /* ignora */
      }
      avatarsLoadedRef.current = true;
    });
  }, []);
  React.useEffect(() => {
    if (!avatarsLoadedRef.current) return;
    try {
      localStorage.setItem("profile-avatars", JSON.stringify(avatars));
    } catch {
      /* quota piena: la foto resta per la sessione, senza persistere */
    }
  }, [avatars]);

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
          to_user_id: currentUserId,
          from_user_id: currentUserId,
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
      // I profili possono non essere ancora arrivati da Supabase. Senza
      // questa guardia la lista amministratori sarebbe vuota, nessuno
      // riceverebbe l'avviso, ma il marcatore «gia segnalato» verrebbe
      // scritto lo stesso: l'escalation si perderebbe per sempre.
      if (profiles.length === 0) return;
      for (const r of stale) requestsEscalatedRef.current.add(r.id);
      setEscalatedRequests((prev) => [...prev, ...stale.map((r) => r.id)]);
      const admins = profiles.filter(
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

  /* Ferie in attesa: promemoria one-shot ai responsabili quando la
     richiesta langue (>3 g) o quando la partenza è ormai vicina (≤3 g) —
     una decisione tardiva è un no di fatto. */
  React.useEffect(() => {
    const now = Date.now();
    const today = todayIso();
    const due = leaves.filter((l) => leaveEscalationDue(l, now, today));
    if (due.length === 0) return;
    queueMicrotask(() => {
      // Il «già segnalato» si valuta QUI: la microtask gira dopo quella di
      // idratazione, quindi i marcatori persistiti sono già caricati.
      const stale = due.filter((l) => !leavesEscalatedRef.current.has(l.id));
      if (stale.length === 0) return;
      // I profili possono non essere ancora arrivati da Supabase. Senza
      // questa guardia la lista amministratori sarebbe vuota, nessuno
      // riceverebbe l'avviso, ma il marcatore «gia segnalato» verrebbe
      // scritto lo stesso: l'escalation si perderebbe per sempre.
      if (profiles.length === 0) return;
      for (const l of stale) leavesEscalatedRef.current.add(l.id);
      setEscalatedLeaves((prev) => [...prev, ...stale.map((l) => l.id)]);
      const admins = profiles.filter(
        (p) => p.is_active && p.role === "admin",
      );
      setNotifications((prev) => [
        ...prev,
        ...stale.flatMap((leave) => {
          const who =
            profiles.find((p) => p.id === leave.requester_id)?.full_name.split(
              " ",
            )[0] ?? "collega";
          const label = leave.type === "ferie" ? "Ferie" : "Permesso";
          const days = diffIsoDays(today, leave.start_date);
          const when =
            days > 0
              ? `parte tra ${days} g`
              : days === 0
                ? "parte oggi"
                : "data già passata";
          return admins.map((admin) => ({
            id: crypto.randomUUID(),
            to_user_id: admin.id,
            from_user_id: leave.requester_id,
            message: `⏳ ${label} di ${who} da decidere (${formatRange(leave.start_date, leave.end_date)} — ${when}).`,
            task_id: null,
            kind: "sistema" as const,
            created_at: new Date().toISOString(),
            read_at: null,
          }));
        }),
      ]);
    });
  }, [leaves]);

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
      // I profili possono non essere ancora arrivati da Supabase. Senza
      // questa guardia la lista amministratori sarebbe vuota, nessuno
      // riceverebbe l'avviso, ma il marcatore «gia segnalato» verrebbe
      // scritto lo stesso: l'escalation si perderebbe per sempre.
      if (profiles.length === 0) return;
      for (const t of stale) escalatedRef.current.add(problemEpisodeKey(t));
      setEscalatedProblems((prev) => [
        ...prev,
        ...stale.map(problemEpisodeKey),
      ]);
      const admins = profiles.filter((p) => p.is_active && p.role === "admin");
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
    // Le foto vivono in una mappa a parte: qui si fondono nei profili,
    // così ogni consumatore legge un solo campo (p.avatar_url).
    const profilesResolved = profiles.map((p) =>
      avatars[p.id] ? { ...p, avatar_url: avatars[p.id] } : p,
    );
    /* Sentinella per i momenti senza identità: primo render, caricamento in
       corso, Supabase non configurato. Prima si ripiegava sul primo profilo
       della lista — con i mock c'era sempre, ora la lista nasce vuota e
       `currentUser.id` andrebbe in errore al primo render. */
    const currentUser =
      profilesResolved.find((p) => p.id === currentUserId) ??
      PROFILO_IN_CARICAMENTO;
    const myNotifications = notifications
      .filter((n) => n.to_user_id === currentUser.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    let unreadCount = 0;
    for (const n of myNotifications) if (!n.read_at) unreadCount += 1;

    return {
    currentUser,

    loading,
    loadError,
    syncError,
    clearSyncError: () => setSyncError(null),

    /* Solo a caricamento concluso: durante l'attesa `currentUser` è la
       sentinella, che ovviamente non ha `onboarded_at` — proporre la
       procedura in quel momento la mostrerebbe a ogni ricarica, per un
       istante, anche a chi l'ha già fatta. */
    needsOnboarding:
      isSupabaseConfigured &&
      !loading &&
      Boolean(currentUser.id) &&
      !currentUser.onboarded_at,

    async completeOnboarding({ full_name, title, avatarFile }) {
      const supabase = createClient();
      const nome = full_name.trim();
      if (!nome) throw new Error("Il nome non può essere vuoto.");

      let avatarUrl = currentUser.avatar_url ?? null;
      if (avatarFile) {
        const precedente = avatarUrl;
        avatarUrl = await uploadAvatar(supabase, currentUser.id, avatarFile);
        // La vecchia foto si toglie solo a nuova caricata: fallire prima
        // lascerebbe il profilo senza immagine e senza rimedio.
        void removeAvatarByUrl(supabase, precedente);
      }

      const onboardedAt = new Date().toISOString();
      await updateProfileRow(supabase, currentUser.id, {
        full_name: nome,
        title: title?.trim() || null,
        avatar_url: avatarUrl,
        onboarded_at: onboardedAt,
      });

      setProfiles((prev) =>
        prev.map((p) =>
          p.id === currentUser.id
            ? {
                ...p,
                full_name: nome,
                title: title?.trim() || undefined,
                avatar_url: avatarUrl,
                onboarded_at: onboardedAt,
              }
            : p,
        ),
      );
    },

    profiles: profilesResolved,
    projects,

    async createProject(input) {
      const nome = input.name.trim();
      if (!nome) throw new Error("Il nome del progetto non può essere vuoto.");
      const supabase = createClient();
      const progetto = await insertProject(supabase, {
        name: nome,
        description: input.description?.trim() || null,
        createdBy: currentUser.id,
      });
      /* Niente aggiornamento ottimistico qui: l'id lo assegna il database e
         la lista è ordinata per nome, quindi si aspetta la riga vera invece
         di indovinarne una. Il progetto è un'operazione rara, non un drag. */
      setProjects((prev) =>
        [...prev, progetto].sort((a, b) => a.name.localeCompare(b.name)),
      );
      return progetto;
    },
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
      scriviCon(
        () => insertTask(createClient(), task),
        () => setTasks((prev) => prev.filter((t) => t.id !== task.id)),
      );
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

      /* `completed_at` e `problem_since` non si inviano: li impongono i
         trigger del database. Si mandano solo i campi che l'utente ha
         davvero cambiato — il resto lo calcola Postgres, una volta sola. */
      scriviCon(
        async () => {
          const supabase = createClient();
          await updateTaskRow(supabase, id, patch);
          // La ricorrenza genera un task nuovo: va inserito, non aggiornato.
          for (const s of spawned) await insertTask(supabase, s);
        },
        () =>
          setTasks((prev) =>
            prev
              .filter((t) => !spawned.some((s) => s.id === t.id))
              .map((t) => (t.id === id ? before : t)),
          ),
      );

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
        /* L'annulla deve raggiungere anche il database: ripristinare la sola
           interfaccia lascerebbe la modifica scritta, e alla ricarica
           tornerebbe fuori quello che l'utente credeva di aver annullato. */
        scriviCon(
          async () => {
            const supabase = createClient();
            await updateTaskRow(supabase, id, before);
            for (const spawnedId of spawnedIds) {
              await deleteTaskRow(supabase, spawnedId);
            }
          },
          () => setTasks((prev) => prev.map((t) => (t.id === id ? next : t))),
        );
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

      // Il trascinamento cambia fase e posizione: solo quelle due colonne.
      scriviCon(
        async () => {
          const supabase = createClient();
          await updateTaskRow(supabase, id, { status, position });
          for (const s of spawned) await insertTask(supabase, s);
        },
        () =>
          setTasks((prev) =>
            prev
              .filter((t) => !spawned.some((s) => s.id === t.id))
              .map((t) => (t.id === id ? before : t)),
          ),
      );

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
        /* L'annulla deve raggiungere anche il database: ripristinare la sola
           interfaccia lascerebbe la modifica scritta, e alla ricarica
           tornerebbe fuori quello che l'utente credeva di aver annullato. */
        scriviCon(
          async () => {
            const supabase = createClient();
            await updateTaskRow(supabase, id, before);
            for (const spawnedId of spawnedIds) {
              await deleteTaskRow(supabase, spawnedId);
            }
          },
          () => setTasks((prev) => prev.map((t) => (t.id === id ? next : t))),
        );
      };
    },

    events,

    /* Le voci di checklist vivono dentro `Task` per l'app e in tabella per
       il database: il confronto per id non le raggiunge, perché a cambiare è
       il contenuto di un task. Si scrivono qui, una per una. */

    toggleChecklistItem(taskId, itemId) {
      const voce = tasks
        .find((t) => t.id === taskId)
        ?.checklist?.find((i) => i.id === itemId);
      if (!voce) return;
      const applica = (done: boolean) =>
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  checklist: t.checklist?.map((item) =>
                    item.id === itemId ? { ...item, done } : item,
                  ),
                }
              : t,
          ),
        );
      applica(!voce.done);
      scriviCon(
        () => setChecklistItemDone(createClient(), itemId, !voce.done),
        () => applica(voce.done),
      );
    },

    addChecklistItem(taskId, text) {
      const trimmed = text.trim();
      if (!trimmed) return;
      const voce = { id: crypto.randomUUID(), text: trimmed, done: false };
      const posizione = Date.now();
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, checklist: [...(t.checklist ?? []), voce] }
            : t,
        ),
      );
      scriviCon(
        () => insertChecklistItem(createClient(), taskId, voce, posizione),
        () =>
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    checklist: t.checklist?.filter((i) => i.id !== voce.id),
                  }
                : t,
            ),
          ),
      );
    },

    removeChecklistItem(taskId, itemId) {
      const voce = tasks
        .find((t) => t.id === taskId)
        ?.checklist?.find((i) => i.id === itemId);
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
      if (!voce) return;
      scriviCon(
        () => deleteChecklistItem(createClient(), itemId),
        () =>
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? { ...t, checklist: [...(t.checklist ?? []), voce] }
                : t,
            ),
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
      /* La colonna `key` accetta al massimo 32 caratteri (vincolo
         task_statuses_key_format): con un'etichetta lunga la chiave
         sforerebbe e il database rifiuterebbe l'inserimento. Si tronca la
         parte variabile lasciando intatti prefisso e suffisso, che sono
         quelli che garantiscono l'unicità. */
      const suffisso = `_${customStatuses.length + 1}`;
      const spazio = 32 - "custom_".length - suffisso.length;
      const key = `custom_${(base || "fase").slice(0, spazio)}${suffisso}`;

      const nuova = {
        key,
        label: label.trim(),
        color: preset.color,
        soft: preset.soft,
        text: preset.text,
      };
      setCustomStatuses((prev) => [...prev, nuova]);
      scriviCon(
        () => insertCustomStatus(createClient(), nuova, customStatuses.length),
        () => setCustomStatuses((prev) => prev.filter((c) => c.key !== key)),
      );
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
      /* Lato database lo spostamento dei task avviene da solo: la chiave
         esterna è `on delete set default`, e il default è «todo». Qui si
         cancella la fase e basta. */
      scriviCon(
        () => deleteCustomStatus(createClient(), key),
        () => {
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
        },
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
        /* Ricreare la fase non basta: i task erano stati riportati in «Da
           fare» dalla chiave esterna, e vanno rimessi a mano dove stavano.
           L'ordine conta — prima la fase, poi i task, altrimenti la chiave
           esterna rifiuta. */
        scriviCon(
          async () => {
            const supabase = createClient();
            await insertCustomStatus(supabase, removed, index);
            for (const taskId of movedIds) {
              await updateTaskRow(supabase, taskId, { status: key });
            }
          },
          () => {
            setCustomStatuses((prev) => prev.filter((c) => c.key !== key));
            setTasks((prev) =>
              prev.map((t) =>
                movedIds.includes(t.id) ? { ...t, status: "todo" } : t,
              ),
            );
          },
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

      /* Il confronto per id non vede questa modifica: la riga è la stessa,
         cambia solo il contenuto. Va scritta esplicitamente. */
      const elenco = scope === "task" ? comments : projectComments;
      const prima = elenco.find((c) => c.id === commentId);
      const attiva = !(prima?.reactions?.[emoji] ?? []).includes(currentUser.id);
      scriviCon(
        () =>
          toggleReactionRow(
            createClient(),
            scope,
            commentId,
            currentUser.id,
            emoji,
            attiva,
          ),
        () => {
          if (scope === "task") setComments((prev) => apply(prev));
          else setProjectComments((prev) => apply(prev));
        },
      );
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

      const elenco = scope === "task" ? comments : projectComments;
      const nuovo = !elenco.find((c) => c.id === commentId)?.is_decision;
      scriviCon(
        () => setDecision(createClient(), scope, commentId, nuovo),
        () => {
          if (scope === "task") setComments((prev) => apply(prev));
          else setProjectComments((prev) => apply(prev));
        },
      );
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

    setAvatar(profileId, dataUrl) {
      setAvatars((prev) => {
        const next = { ...prev };
        if (dataUrl) next[profileId] = dataUrl;
        else delete next[profileId];
        return next;
      });
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

    /* «Letto» è una modifica alla riga, non una riga nuova: il confronto per
       id non la vede. Si scrive esplicitamente, in blocco — segnare venti
       avvisi letti non deve costare venti richieste. */

    markTaskNotificationsRead(taskId) {
      const ids = notifications
        .filter(
          (n) =>
            n.to_user_id === currentUser.id && n.task_id === taskId && !n.read_at,
        )
        .map((n) => n.id);
      if (ids.length === 0) return;
      setNotifications((prev) =>
        prev.map((n) =>
          ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n,
        ),
      );
      scriviCon(
        () => markNotificationsRead(createClient(), ids),
        () =>
          setNotifications((prev) =>
            prev.map((n) => (ids.includes(n.id) ? { ...n, read_at: null } : n)),
          ),
      );
    },

    markNotificationRead(id) {
      if (notifications.find((n) => n.id === id)?.read_at) return;
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read_at: new Date().toISOString() } : n,
        ),
      );
      scriviCon(
        () => markNotificationsRead(createClient(), [id]),
        () =>
          setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, read_at: null } : n)),
          ),
      );
    },

    markAllNotificationsRead() {
      const ids = notifications
        .filter((n) => n.to_user_id === currentUser.id && !n.read_at)
        .map((n) => n.id);
      if (ids.length === 0) return;
      setNotifications((prev) =>
        prev.map((n) =>
          ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n,
        ),
      );
      scriviCon(
        () => markNotificationsRead(createClient(), ids),
        () =>
          setNotifications((prev) =>
            prev.map((n) => (ids.includes(n.id) ? { ...n, read_at: null } : n)),
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
      /* Il task nasce come riga nuova e il confronto per id lo prende da
         solo; l'approvazione invece è una modifica alla richiesta e va
         scritta qui. L'ordine conta: prima il task, perché `task_id` è una
         chiave esterna e la richiesta non può puntare a ciò che non esiste. */
      scriviCon(
        async () => {
          const supabase = createClient();
          await insertTask(supabase, task);
          await decideTaskRequest(supabase, id, {
            status: "approved",
            owner_id: task.owner_id,
            due_date: task.due_date,
            project_id: task.project_id,
            task_id: task.id,
          });
        },
        () => {
          setTasks((prev) => prev.filter((t) => t.id !== task.id));
          setRequests((prev) => prev.map((r) => (r.id === id ? req : r)));
        },
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
      /* Il vincolo `request_rejection_needs_reason` esige una motivazione:
         un rifiuto senza spiegazione verrebbe respinto dal database, ed è
         giusto così. L'interfaccia la rende obbligatoria, questa è la rete
         di sicurezza. */
      scriviCon(
        () =>
          decideTaskRequest(createClient(), id, {
            status: "rejected",
            rejection_reason: trimmed,
          }),
        () => setRequests((prev) => prev.map((r) => (r.id === id ? req : r))),
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

    leaves,

    async createLeave(input) {
      const leave: LeaveRequest = {
        id: crypto.randomUUID(),
        requester_id: currentUser.id,
        type: input.type,
        start_date: input.start_date,
        end_date: input.end_date,
        time_range: input.time_range ?? null,
        note: input.note?.trim() || null,
        status: "pending",
        created_at: new Date().toISOString(),
        decided_by: null,
        decided_at: null,
        decision_note: null,
      };
      setLeaves((prev) => [...prev, leave]);
      const range = formatRange(leave.start_date, leave.end_date);
      const days = workingDaysCount(leave.start_date, leave.end_date, closures);
      const detail =
        leave.type === "permesso" && leave.time_range
          ? `${range} · ${leave.time_range}`
          : `${range} (${days} gg lavorativ${days === 1 ? "o" : "i"})`;
      const admins = profiles.filter(
        (p) => p.is_active && p.role === "admin" && p.id !== currentUser.id,
      );
      setNotifications((prev) => [
        ...prev,
        ...admins.map((admin) => ({
          id: crypto.randomUUID(),
          to_user_id: admin.id,
          from_user_id: currentUser.id,
          message: `🏖️ ${currentUser.full_name.split(" ")[0]} chiede ${leave.type === "ferie" ? "ferie" : "un permesso"}: ${detail}${leave.note ? ` — «${leave.note}»` : ""}`,
          task_id: null,
          kind: "sistema" as const,
          created_at: new Date().toISOString(),
          read_at: null,
        })),
      ]);
      return leave;
    },

    withdrawLeave(id) {
      const leave = leaves.find((l) => l.id === id);
      if (
        !leave ||
        leave.status !== "pending" ||
        leave.requester_id !== currentUser.id
      ) {
        return null;
      }
      const index = leaves.findIndex((l) => l.id === id);
      setLeaves((prev) => prev.filter((l) => l.id !== id));
      return () => {
        setLeaves((prev) => {
          const next = [...prev];
          next.splice(Math.min(index, next.length), 0, leave);
          return next;
        });
      };
    },

    async decideLeave(id, decision, note) {
      const leave = leaves.find((l) => l.id === id);
      if (!leave || leave.status !== "pending") return;
      const trimmed = note.trim();
      const nowIso = new Date().toISOString();
      setLeaves((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
                ...l,
                status: decision,
                decided_by: currentUser.id,
                decided_at: nowIso,
                decision_note: trimmed || null,
              }
            : l,
        ),
      );
      /* La guardia `leave_requests_guard` verifica anche che chi decide non
         sia il richiedente: se qualcuno provasse ad approvarsi le ferie da
         solo, il rifiuto arriva dal database e l'annulla riporta indietro. */
      scriviCon(
        () => decideLeaveRequest(createClient(), id, decision, trimmed),
        () => setLeaves((prev) => prev.map((l) => (l.id === id ? leave : l))),
      );
      const isFerie = leave.type === "ferie";
      const label = isFerie ? "Ferie" : "Permesso";
      const range = formatRange(leave.start_date, leave.end_date);
      const detail =
        leave.type === "permesso" && leave.time_range
          ? `${range} · ${leave.time_range}`
          : range;
      // Esito al richiedente, sempre con l'eventuale motivazione.
      const requesterMsg =
        decision === "approved"
          ? `✅ ${label} approvat${isFerie ? "e" : "o"}: ${detail}${trimmed ? ` — ${trimmed}` : ""}`
          : `❌ ${label} non approvat${isFerie ? "e" : "o"}: ${detail} — ${trimmed}`;
      // Gli altri responsabili restano allineati sulla decisione.
      const deciderName = currentUser.full_name.split(" ")[0];
      const requesterName =
        profiles.find((p) => p.id === leave.requester_id)?.full_name.split(
          " ",
        )[0] ?? "collega";
      const otherAdmins = profiles.filter(
        (p) =>
          p.is_active &&
          p.role === "admin" &&
          p.id !== currentUser.id &&
          p.id !== leave.requester_id,
      );
      setNotifications((prev) => [
        ...prev,
        ...(leave.requester_id !== currentUser.id
          ? [
              {
                id: crypto.randomUUID(),
                to_user_id: leave.requester_id,
                from_user_id: currentUser.id,
                message: requesterMsg,
                task_id: null,
                kind: "sistema" as const,
                created_at: nowIso,
                read_at: null,
              },
            ]
          : []),
        ...otherAdmins.map((admin) => ({
          id: crypto.randomUUID(),
          to_user_id: admin.id,
          from_user_id: currentUser.id,
          message: `${decision === "approved" ? "✅" : "❌"} ${deciderName} ha ${decision === "approved" ? "approvato" : "rifiutato"} ${isFerie ? "le ferie" : "il permesso"} di ${requesterName} (${detail})${trimmed ? ` — ${trimmed}` : ""}`,
          task_id: null,
          kind: "sistema" as const,
          created_at: nowIso,
          read_at: null,
        })),
      ]);
    },

    closures,

    addClosure(input) {
      const closure: CompanyClosure = {
        id: crypto.randomUUID(),
        title: input.title.trim(),
        start_date: input.start_date,
        end_date: input.end_date,
        created_by: currentUser.id,
      };
      setClosures((prev) =>
        [...prev, closure].sort((a, b) =>
          a.start_date.localeCompare(b.start_date),
        ),
      );
      // Una chiusura riguarda tutti: avviso a tutto l'ufficio.
      const others = profiles.filter(
        (p) => p.is_active && p.id !== currentUser.id,
      );
      setNotifications((prev) => [
        ...prev,
        ...others.map((p) => ({
          id: crypto.randomUUID(),
          to_user_id: p.id,
          from_user_id: currentUser.id,
          message: `🏢 Chiusura aziendale: «${closure.title}» ${formatRange(closure.start_date, closure.end_date)}`,
          task_id: null,
          kind: "sistema" as const,
          created_at: new Date().toISOString(),
          read_at: null,
        })),
      ]);
    },

    removeClosure(id) {
      const removed = closures.find((c) => c.id === id);
      if (!removed) return null;
      const index = closures.findIndex((c) => c.id === id);
      setClosures((prev) => prev.filter((c) => c.id !== id));
      return () => {
        setClosures((prev) => {
          const next = [...prev];
          next.splice(Math.min(index, next.length), 0, removed);
          return next;
        });
      };
    },
    };
  }, [
    avatars,
    closures,
    loading,
    loadError,
    syncError,
    scriviCon,
    comments,
    currentUserId,
    customStatuses,
    events,
    focusIds,
    leaves,
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
