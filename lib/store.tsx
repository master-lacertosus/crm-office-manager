"use client";

import * as React from "react";

import {
  nextMonthlyIso,
  shiftIsoDays,
  shiftIsoMonths,
  todayIso,
} from "@/lib/format";
import { extractMentionIds } from "@/lib/mentions";
import { puoModificareTask } from "@/lib/permessi";
import { CUSTOM_STATUS_PRESETS } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  deleteChecklistItem,
  deleteCollaborator,
  deleteClosure,
  deleteCustomStatus,
  deleteLeaveRequest,
  deleteSavedView,
  deleteTaskRequest,
  deleteTemplate,
  deleteTaskLink,
  deleteTaskRow,
  decideLeaveRequest,
  decideTaskRequest,
  fetchChecklists,
  fetchClosures,
  fetchCollaborators,
  fetchLeaveRequests,
  fetchNotifications,
  fetchSavedViews,
  fetchTaskRequests,
  fetchTemplates,
  fetchUserTaskState,
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
  insertCollaborator,
  insertCustomStatus,
  insertLeaveRequest,
  insertSavedView,
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
  setUserTaskState,
  toggleReactionRow,
  updateProfileAccess,
  updateProfileRow,
  updateTaskRow,
  uploadAvatar,
  upsertTemplate,
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
  Role,
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
 * Store dell'applicazione: stato client e scritture su Supabase.
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

/* Le soglie di escalation e i loro marcatori non stanno piu qui: sono
   passati nella funzione run_escalations() del database (migrazione M5),
   dove girano su pianificazione invece che a ogni render di chi ha una
   scheda aperta. */

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
  /**
   * Aggiunge o toglie un collaboratore.
   *
   * Il responsabile resta uno solo: questi affiancano. Chi entra riceve un
   * avviso, perché essere coinvolti in un lavoro senza saperlo non serve a
   * nulla. Lancia se il database rifiuta — per esempio se si prova ad
   * aggiungere il responsabile stesso.
   */
  toggleCollaborator: (taskId: string, userId: string) => Promise<void>;
  /**
   * Elimina un task per sempre, con tutto ciò che vi è appeso: commenti,
   * cronologia, checklist, allegati, avvisi.
   *
   * Non ha annulla, e non è una dimenticanza: le righe collegate se ne vanno
   * in cascata e ricostruirle sarebbe una finzione. Per far sparire un task
   * dalla board senza perderne la storia esiste l'archivio.
   *
   * Lancia se la RLS nega: la policy la concede a chi l'ha creato, a chi ne è
   * responsabile e agli amministratori.
   */
  deleteTask: (taskId: string) => Promise<void>;
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
  /** Imposta o rimuove (null) la foto del profilo. */
  setAvatar: (profileId: string, dataUrl: string | null) => void;
  /** Promuove o retrocede un collega. Lancia con il messaggio del database
   *  se la mossa è vietata — per esempio togliere l'ultimo amministratore. */
  setProfileRole: (profileId: string, role: Role) => Promise<void>;
  /** Disattiva o riattiva un collega. Lancia se ha ancora task aperti:
   *  l'invariante sta nel database, non in un controllo dell'interfaccia. */
  setProfileActive: (profileId: string, isActive: boolean) => Promise<void>;
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
  /* Marcatori «già segnalato» delle escalation.

     Erano due: un ref come guardia sincrona dentro la sessione e uno stato
     persistito in localStorage, perché senza quest'ultimo ogni ricarica
     rigenerava le stesse notifiche.

     Lo stato persistito è sparito con localStorage e NON è stato sostituito.
     Non è una dimenticanza: le notifiche di escalation non finiscono nel
     database — la policy pretende `from_user_id = auth.uid()` e queste sono
     attribuite al richiedente. Sono quindi vive solo nella sessione, e con
     loro i marcatori: ricaricando spariscono entrambi, quindi non si creano
     doppioni, si riparte da zero. Coerente, anche se non ideale.

     La sistemazione vera è spostare le escalation sul server (una funzione
     pianificata), dove appartengono: generarle nel browser di chi ha per
     caso una scheda aperta è comunque il posto sbagliato. */

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
          templateList,
          viewList,
          statoPersonale,
          collaboratori,
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
          fetchTemplates(supabase),
          fetchSavedViews(supabase),
          fetchUserTaskState(supabase),
          fetchCollaborators(supabase),
        ]);

        if (annullato) return;
        setProfiles(profileList);
        setProjects(projectList);
        // Le voci di checklist stanno in tabella a parte ma il tipo `Task` le
        // porta dentro di sé: si ricompongono qui, una volta sola.
        setTasks(
          taskList.map((t) => ({
            ...t,
            ...(checklists[t.id] ? { checklist: checklists[t.id] } : {}),
            ...(collaboratori[t.id]
              ? { collaborators: collaboratori[t.id] }
              : {}),
          })),
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
        setTemplates(templateList);
        setSavedViews(viewList);
        setFocusIds(statoPersonale.focusIds);
        setSnoozes(statoPersonale.snoozes);
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
    templates,
    pronto,
    async (nuovi) => {
      const supabase = createClient();
      for (const t of nuovi) await upsertTemplate(supabase, t, currentUserId);
    },
    async (ids) => {
      const supabase = createClient();
      for (const id of ids) await deleteTemplate(supabase, id);
    },
    setSyncError,
  );

  useSincronizza(
    savedViews,
    pronto,
    async (nuove) => {
      const supabase = createClient();
      for (const v of nuove) await insertSavedView(supabase, currentUserId, v);
    },
    async (ids) => {
      const supabase = createClient();
      for (const id of ids) await deleteSavedView(supabase, id);
    },
    setSyncError,
  );

  useSincronizza(
    notifications,
    pronto,
    async (nuovi) => {
      /* Solo gli avvisi mandati da una persona: la policy pretende
         `from_user_id = auth.uid()`. Quelli senza mittente li scrive il
         lavoro pianificato del database (M5), non il browser. */
      const miei = nuovi.filter(
        (n): n is typeof n & { from_user_id: string } =>
          n.from_user_id === currentUserId,
      );
      if (miei.length > 0) await insertNotifications(createClient(), miei);
    },
    async () => {},
    setSyncError,
  );

  /* ------------------------------------------------------------------ */
  /* La persistenza in localStorage e sparita: ogni entita sta su         */
  /* Supabase. Teneva una copia dell intero workspace in office-state e   */
  /* la reidratava all avvio — con i dati veri sarebbe una seconda        */
  /* sorgente di verita, destinata a divergere al primo accesso da un     */
  /* altro computer.                                                      */
  /* ------------------------------------------------------------------ */

  /* Auto-archivio: i Fatto completati da più di 14 giorni escono dalla
     board (restano in archivio e nei report). */
  React.useEffect(() => {
    // La guardia era sul caricamento da localStorage; ora è sul caricamento
    // da Supabase. Senza, all'avvio la lista task è vuota e l'archiviazione
    // girerebbe a vuoto — o peggio, su dati non ancora arrivati.
    if (!pronto) return;
    const io = {
      id: currentUserId,
      role: profiles.find((p) => p.id === currentUserId)?.role ?? 'member',
    };
    const cutoff = Date.now() - 14 * 86_400_000;
    const stale = tasks.filter(
      (t) =>
        t.status === "done" &&
        !t.archived_at &&
        t.completed_at &&
        new Date(t.completed_at).getTime() < cutoff &&
        // Solo ciò che questa persona può davvero scrivere: archiviare il
        // task di un altro verrebbe respinto dal database, e l'unico effetto
        // sarebbe un avviso di errore a ogni avvio.
        puoModificareTask(t, io),
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
        ...stale.map((t) => makeEvent(t.id, currentUserId, "archived")),
      ]);
      /* Gli eventi li scrive il confronto per id; l'archiviazione dei task è
         una modifica e va scritta qui, altrimenti tornerebbero in board a
         ogni ricarica. */
      scriviCon(
        async () => {
          const supabase = createClient();
          for (const t of stale) {
            await updateTaskRow(supabase, t.id, { archived_at: nowIso });
          }
        },
        () =>
          setTasks((prev) =>
            prev.map((t) => (ids.has(t.id) ? { ...t, archived_at: null } : t)),
          ),
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, pronto]);

  /* Viste salvate, template e foto profilo non passano più dal browser:
     stanno su Supabase e seguono la persona invece del computer. Le tre
     coppie di effetti che li leggevano e riscrivevano in localStorage sono
     sparite con la migrazione. */

  /* Le foto restano in una mappa a parte perché `profiles.avatar_url` è la
     verità ma l'anteprima locale deve poter precedere il caricamento. Si
     popola da `profiles`, non più da localStorage. */
  const avatars = React.useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const p of profiles) if (p.avatar_url) out[p.id] = p.avatar_url;
    return out;
  }, [profiles]);

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

  /* ------------------------------------------------------------------ */
  /* Le escalation sono passate al database (migrazione M5).             */
  /*                                                                     */
  /* Erano tre effetti che, a ogni render, cercavano problemi fermi e    */
  /* richieste dimenticate e creavano gli avvisi. Tre difetti:           */
  /* nessuno veniva avvisato se nessuno teneva l app aperta; la policy   */
  /* rifiutava quegli avvisi perche attribuiti al richiedente e non a    */
  /* chi scriveva; due persone con l app aperta producevano due avvisi   */
  /* per lo stesso fatto.                                                */
  /*                                                                     */
  /* Ora e un lavoro pianificato che gira ogni ora lato server, con una  */
  /* chiave di deduplicazione che rende impossibili i doppioni.          */
  /* ------------------------------------------------------------------ */

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
       della lista — con i mock giaPresente sempre, ora la lista nasce vuota e
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

    async toggleCollaborator(taskId, userId) {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      const attuali = task.collaborators ?? [];
      const giaPresente = attuali.includes(userId);

      const supabase = createClient();
      /* Si aspetta l'esito prima di aggiornare: la guardia rifiuta il
         responsabile stesso, e mostrarlo fra i collaboratori per poi vederlo
         sparire sarebbe peggio che non mostrarlo mai. */
      if (giaPresente) {
        await deleteCollaborator(supabase, taskId, userId);
      } else {
        await insertCollaborator(supabase, taskId, userId, currentUser.id);
      }

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                collaborators: giaPresente
                  ? attuali.filter((u) => u !== userId)
                  : [...attuali, userId],
              }
            : t,
        ),
      );

      // Essere coinvolti in un lavoro senza saperlo non serve a nulla.
      if (!giaPresente && userId !== currentUser.id) {
        setNotifications((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            to_user_id: userId,
            from_user_id: currentUser.id,
            message: `👥 Ti hanno aggiunto come collaboratore su «${task.title}»`,
            task_id: taskId,
            kind: "sistema" as const,
            created_at: new Date().toISOString(),
            read_at: null,
          },
        ]);
      }
    },

    async deleteTask(taskId) {
      const prima = tasks.find((t) => t.id === taskId);
      if (!prima) return;

      /* Si aspetta l'esito invece di rimuovere e sperare: una cancellazione
         negata che sparisse comunque dall'interfaccia farebbe credere di aver
         eliminato qualcosa che al prossimo caricamento riappare. */
      await deleteTaskRow(createClient(), taskId);

      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      /* Le righe collegate se ne vanno in cascata sul database; qui si
         ripulisce lo stato locale, altrimenti resterebbero commenti e
         cronologia che puntano a un task che non c'è più. */
      setComments((prev) => prev.filter((c) => c.task_id !== taskId));
      setEvents((prev) => prev.filter((e) => e.task_id !== taskId));
      setTaskLinks((prev) => prev.filter((l) => l.task_id !== taskId));
      setNotifications((prev) => prev.filter((n) => n.task_id !== taskId));
      setFocusIds((prev) => prev.filter((id) => id !== taskId));
      setSnoozes((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
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

    /* Focus e posticipi non sono collezioni di righe con un id ma una lista
       e una mappa: il confronto per id non li copre, e si scrivono qui. Una
       riga per coppia utente-task, con upsert perché non interessa sapere se
       esisteva già. */

    snoozeTask(taskId, untilIso) {
      const prima = snoozes[taskId];
      setSnoozes((prev) => ({ ...prev, [taskId]: untilIso }));
      scriviCon(
        () =>
          setUserTaskState(createClient(), currentUserId, taskId, {
            snoozed_until: untilIso,
          }),
        () =>
          setSnoozes((prev) => {
            const next = { ...prev };
            if (prima) next[taskId] = prima;
            else delete next[taskId];
            return next;
          }),
      );
    },

    unsnoozeTask(taskId) {
      const prima = snoozes[taskId];
      setSnoozes((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      scriviCon(
        () =>
          setUserTaskState(createClient(), currentUserId, taskId, {
            snoozed_until: null,
          }),
        () =>
          setSnoozes((prev) =>
            prima ? { ...prev, [taskId]: prima } : prev,
          ),
      );
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
      const prima = templates.find((t) => t.id === id);
      if (!prima) return;
      const dopo = { ...prima, ...patch };
      setTemplates((prev) => prev.map((t) => (t.id === id ? dopo : t)));
      /* Modifica a una riga esistente: il confronto per id non la vede.
         `upsertTemplate` riscrive anche le voci del pacchetto. */
      scriviCon(
        () => upsertTemplate(createClient(), dopo, currentUserId),
        () => setTemplates((prev) => prev.map((t) => (t.id === id ? prima : t))),
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
        /* Senza questa scrittura le fasi restavano solo in memoria: sparivano
           al ricaricamento e gli altri non le vedevano mai. Tutte le altre
           creazioni passavano di qui, questa no. */
        const nati = new Set(created.map((t) => t.id));
        scriviCon(
          async () => {
            const supabase = createClient();
            for (const t of created) await insertTask(supabase, t);
          },
          () => setTasks((prev) => prev.filter((t) => !nati.has(t.id))),
        );
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
      scriviCon(
        async () => {
          const supabase = createClient();
          await insertTask(supabase, task);
          // Le spunte stanno in tabella a parte: vanno scritte una per una.
          const voci = task.checklist ?? [];
          for (let i = 0; i < voci.length; i++) {
            await insertChecklistItem(supabase, task.id, voci[i], i);
          }
        },
        () => setTasks((prev) => prev.filter((t) => t.id !== task.id)),
      );
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
      const era = focusIds.includes(taskId);
      // Il tetto di tre è una regola di prodotto: se è pieno non succede
      // nulla, e non deve nemmeno partire una scrittura.
      if (!era && focusIds.length >= 3) return;
      setFocusIds((prev) =>
        era ? prev.filter((id) => id !== taskId) : [...prev, taskId],
      );
      scriviCon(
        () =>
          setUserTaskState(createClient(), currentUserId, taskId, {
            is_focus: !era,
          }),
        () =>
          setFocusIds((prev) =>
            era ? [...prev, taskId] : prev.filter((id) => id !== taskId),
          ),
      );
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

    /* La firma resta invariata per i chiamanti, ma il significato è
       cambiato: non si salva più una data URL nel browser, si scrive
       `profiles.avatar_url`. Il caricamento del file su Storage avviene nel
       componente che ha il File in mano — qui arriva già un URL. */
    /* Ruolo e stato attivo non usano la scrittura ottimistica come il resto.
       Qui il database può rifiutare per ragioni che l'utente deve leggere —
       «è l'ultimo admin attivo», «ha task aperti da riassegnare» — e un
       ripristino silenzioso farebbe sparire la modifica senza spiegare
       perché. Si attende l'esito e si lascia salire l'errore. */

    async setProfileRole(profileId, role) {
      const supabase = createClient();
      await updateProfileAccess(supabase, profileId, { role });
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, role } : p)),
      );
    },

    async setProfileActive(profileId, isActive) {
      const supabase = createClient();
      await updateProfileAccess(supabase, profileId, { is_active: isActive });
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, is_active: isActive } : p)),
      );
    },

    setAvatar(profileId, url) {
      const prima = profiles.find((p) => p.id === profileId)?.avatar_url ?? null;
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, avatar_url: url } : p)),
      );
      scriviCon(
        async () => {
          const supabase = createClient();
          await updateProfileRow(supabase, profileId, { avatar_url: url });
          // La precedente si rimuove solo dopo: fallire prima lascerebbe il
          // profilo senza immagine e senza rimedio.
          if (prima !== url) void removeAvatarByUrl(supabase, prima);
        },
        () =>
          setProfiles((prev) =>
            prev.map((p) =>
              p.id === profileId ? { ...p, avatar_url: prima } : p,
            ),
          ),
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
      try {
        const supabase = createClient();
        await insertTask(supabase, task);
        await decideTaskRequest(supabase, id, {
          status: "approved",
          owner_id: task.owner_id,
          due_date: task.due_date,
          project_id: task.project_id,
          task_id: task.id,
        });
      } catch (e) {
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
        setRequests((prev) => prev.map((r) => (r.id === id ? req : r)));
        setSyncError(
          e instanceof Error ? e.message : "Approvazione non registrata.",
        );
        return null;
      }

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
      /* Come per le ferie: si aspetta l'esito prima di annunciarlo.
         Il vincolo `request_rejection_needs_reason` esige una motivazione, e
         un rifiuto senza spiegazione viene respinto: in quel caso l'avviso
         «richiesta rifiutata» non deve partire. */
      try {
        await decideTaskRequest(createClient(), id, {
          status: "rejected",
          rejection_reason: trimmed,
        });
      } catch (e) {
        setRequests((prev) => prev.map((r) => (r.id === id ? req : r)));
        setSyncError(
          e instanceof Error ? e.message : "Rifiuto non registrato.",
        );
        return;
      }

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
      /* Si ASPETTA l'esito, invece di procedere e sperare.
         La guardia `leave_requests_guard` verifica anche che chi decide non
         sia il richiedente. Quando rifiuta, la decisione non è avvenuta — e
         gli avvisi che la annunciano non devono partire. Prima uscivano lo
         stesso: i colleghi ricevevano «X ha approvato» per un'approvazione
         mai accaduta, e quegli avvisi restavano anche dopo l'annullamento. */
      try {
        await decideLeaveRequest(createClient(), id, decision, trimmed);
      } catch (e) {
        setLeaves((prev) => prev.map((l) => (l.id === id ? leave : l)));
        setSyncError(
          e instanceof Error ? e.message : "Decisione non registrata.",
        );
        return;
      }

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
