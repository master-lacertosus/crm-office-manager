"use client";

import * as React from "react";

import { shiftIsoDays, shiftIsoMonths } from "@/lib/format";
import { extractMentionIds } from "@/lib/mentions";
import {
  CURRENT_USER_ID,
  MOCK_COMMENTS,
  MOCK_NOTIFICATIONS,
  MOCK_PROFILES,
  MOCK_PROJECTS,
  MOCK_TASKS,
  MOCK_TASK_LINKS,
} from "@/lib/mock-data";
import type {
  AppNotification,
  Profile,
  Project,
  Task,
  TaskComment,
  TaskLink,
} from "@/lib/types";

/**
 * Store placeholder in memoria: fa da contratto per lo strato dati vero.
 * Le mutazioni simulano ~250ms di latenza per esercitare gli stati di
 * loading richiesti da CLAUDE.md. Al collegamento con Supabase queste
 * funzioni diventeranno query/mutazioni reali a parità di firma.
 */

const LATENCY_MS = 250;
const wait = () => new Promise((r) => setTimeout(r, LATENCY_MS));

type NewTask = Pick<Task, "title" | "owner_id"> &
  Partial<
    Pick<
      Task,
      "description" | "status" | "priority" | "project_id" | "due_date" | "repeat"
    >
  >;

/** Ricorrenza furba: alla chiusura, il task si ricrea con la scadenza avanti. */
function nextOccurrence(task: Task): Task | null {
  if (task.repeat === "none" || !task.due_date) return null;
  return {
    ...task,
    id: crypto.randomUUID(),
    status: "todo",
    due_date:
      task.repeat === "weekly"
        ? shiftIsoDays(task.due_date, 7)
        : shiftIsoMonths(task.due_date, 1),
    position: Date.now(),
    completed_at: null,
    created_at: new Date().toISOString(),
  };
}

interface AppStore {
  currentUser: Profile;
  profiles: Profile[];
  projects: Project[];
  tasks: Task[];
  comments: TaskComment[];
  createTask: (input: NewTask) => Promise<Task>;
  updateTask: (
    id: string,
    patch: Partial<Omit<Task, "id" | "created_by" | "created_at">>,
  ) => Promise<void>;
  /** Spostamento da board (drag): sincrono, l'interazione deve essere istantanea. */
  moveTask: (id: string, status: Task["status"], position: number) => void;
  /** Cambio scadenza da calendario/timeline (drag): sincrono. */
  rescheduleTask: (id: string, dueDate: string | null) => void;
  taskLinks: TaskLink[];
  addTaskLink: (taskId: string, url: string, label: string) => Promise<void>;
  removeTaskLink: (id: string) => void;
  /** Focus di oggi: fino a 3 task scelti dall'utente corrente. */
  focusIds: string[];
  toggleFocus: (taskId: string) => void;
  addComment: (taskId: string, body: string) => Promise<void>;
  updateProfileName: (id: string, fullName: string) => Promise<void>;
  notifications: AppNotification[];
  unreadCount: number;
  sendNotification: (
    toUserId: string,
    message: string,
    taskId?: string | null,
  ) => Promise<void>;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
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

  const currentUser =
    profiles.find((p) => p.id === CURRENT_USER_ID) ?? profiles[0];

  const myNotifications = notifications
    .filter((n) => n.to_user_id === currentUser.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const store: AppStore = {
    currentUser,
    profiles,
    projects,
    tasks,
    comments,

    async createTask(input) {
      await wait();
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
        completed_at: null,
        created_at: new Date().toISOString(),
      };
      setTasks((prev) => [...prev, task]);
      return task;
    },

    async updateTask(id, patch) {
      await wait();
      setTasks((prev) => {
        const spawned: Task[] = [];
        const mapped = prev.map((task) => {
          if (task.id !== id) return task;
          const next = { ...task, ...patch };
          // Stessa regola del trigger tasks_set_completed_at
          if (patch.status) {
            if (patch.status === "done" && task.status !== "done") {
              next.completed_at = new Date().toISOString();
              const following = nextOccurrence(next);
              if (following) spawned.push(following);
            } else if (patch.status !== "done") {
              next.completed_at = null;
            }
          }
          return next;
        });
        return spawned.length > 0 ? [...mapped, ...spawned] : mapped;
      });
    },

    moveTask(id, status, position) {
      setTasks((prev) => {
        const spawned: Task[] = [];
        const mapped = prev.map((task) => {
          if (task.id !== id) return task;
          const next = {
            ...task,
            status,
            position,
            // Stessa regola del trigger tasks_set_completed_at
            completed_at:
              status === "done"
                ? task.status !== "done"
                  ? new Date().toISOString()
                  : task.completed_at
                : null,
          };
          if (status === "done" && task.status !== "done") {
            const following = nextOccurrence(next);
            if (following) spawned.push(following);
          }
          return next;
        });
        return spawned.length > 0 ? [...mapped, ...spawned] : mapped;
      });
    },

    rescheduleTask(id, dueDate) {
      setTasks((prev) =>
        prev.map((task) =>
          task.id === id ? { ...task, due_date: dueDate } : task,
        ),
      );
    },

    taskLinks,

    async addTaskLink(taskId, url, label) {
      await wait();
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

    focusIds,

    toggleFocus(taskId) {
      setFocusIds((prev) => {
        if (prev.includes(taskId)) return prev.filter((id) => id !== taskId);
        if (prev.length >= 3) return prev;
        return [...prev, taskId];
      });
    },

    async addComment(taskId, body) {
      await wait();
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
            created_at: new Date().toISOString(),
            read_at: null,
          })),
        ]);
      }
    },

    async updateProfileName(id, fullName) {
      await wait();
      setProfiles((prev) =>
        prev.map((p) => (p.id === id ? { ...p, full_name: fullName.trim() } : p)),
      );
    },

    notifications: myNotifications,
    unreadCount: myNotifications.filter((n) => !n.read_at).length,

    async sendNotification(toUserId, message, taskId = null) {
      await wait();
      setNotifications((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          to_user_id: toUserId,
          from_user_id: currentUser.id,
          message: message.trim(),
          task_id: taskId,
          created_at: new Date().toISOString(),
          read_at: null,
        },
      ]);
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
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useAppStore(): AppStore {
  const ctx = React.useContext(StoreContext);
  if (!ctx) {
    throw new Error("useAppStore va usato dentro AppStoreProvider");
  }
  return ctx;
}
