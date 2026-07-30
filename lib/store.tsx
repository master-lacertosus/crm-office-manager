"use client";

import * as React from "react";

import {
  CURRENT_USER_ID,
  MOCK_COMMENTS,
  MOCK_PROFILES,
  MOCK_PROJECTS,
  MOCK_TASKS,
} from "@/lib/mock-data";
import type { Profile, Project, Task, TaskComment } from "@/lib/types";

/**
 * Store placeholder in memoria: fa da contratto per lo strato dati vero.
 * Le mutazioni simulano ~250ms di latenza per esercitare gli stati di
 * loading richiesti da CLAUDE.md. Al collegamento con Supabase queste
 * funzioni diventeranno query/mutazioni reali a parità di firma.
 */

const LATENCY_MS = 250;
const wait = () => new Promise((r) => setTimeout(r, LATENCY_MS));

type NewTask = Pick<Task, "title" | "owner_id"> &
  Partial<Pick<Task, "description" | "status" | "priority" | "project_id" | "due_date">>;

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
  addComment: (taskId: string, body: string) => Promise<void>;
  updateProfileName: (id: string, fullName: string) => Promise<void>;
}

const StoreContext = React.createContext<AppStore | null>(null);

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = React.useState<Profile[]>(MOCK_PROFILES);
  const [projects] = React.useState<Project[]>(MOCK_PROJECTS);
  const [tasks, setTasks] = React.useState<Task[]>(MOCK_TASKS);
  const [comments, setComments] = React.useState<TaskComment[]>(MOCK_COMMENTS);

  const currentUser =
    profiles.find((p) => p.id === CURRENT_USER_ID) ?? profiles[0];

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
        completed_at: null,
        created_at: new Date().toISOString(),
      };
      setTasks((prev) => [...prev, task]);
      return task;
    },

    async updateTask(id, patch) {
      await wait();
      setTasks((prev) =>
        prev.map((task) => {
          if (task.id !== id) return task;
          const next = { ...task, ...patch };
          // Stessa regola del trigger tasks_set_completed_at
          if (patch.status) {
            if (patch.status === "done" && task.status !== "done") {
              next.completed_at = new Date().toISOString();
            } else if (patch.status !== "done") {
              next.completed_at = null;
            }
          }
          return next;
        }),
      );
    },

    async addComment(taskId, body) {
      await wait();
      setComments((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          task_id: taskId,
          author_id: currentUser.id,
          body: body.trim(),
          created_at: new Date().toISOString(),
        },
      ]);
    },

    async updateProfileName(id, fullName) {
      await wait();
      setProfiles((prev) =>
        prev.map((p) => (p.id === id ? { ...p, full_name: fullName.trim() } : p)),
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
