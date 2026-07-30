import { addDaysIso, todayIso } from "@/lib/format";
import type { Profile, Project, Task, TaskStatus } from "@/lib/types";
import { STATUS_ORDER } from "@/lib/types";

/**
 * Motore analitico dei report: pure funzioni sui dati dello store, quindi
 * ogni grafico reagisce in tempo reale alle modifiche (drag sulla board
 * incluso). La serie storica dei completamenti è sintetica e deterministica
 * per i giorni passati (fase placeholder), ma il punto di OGGI è calcolato
 * dai dati veri: completare un task oggi muove il grafico.
 */

export type StatusCounts = Record<TaskStatus, number>;

export interface PersonLoad {
  profile: Profile;
  counts: StatusCounts;
  total: number;
  open: number;
}

export interface ProjectLoad {
  key: string;
  label: string;
  total: number;
  open: number;
}

export interface TrendPoint {
  iso: string;
  value: number;
}

export interface Analytics {
  open: number;
  overdue: number;
  inReview: number;
  done7: number;
  done7Delta: number;
  statusTotals: StatusCounts;
  people: PersonLoad[];
  maxPersonTotal: number;
  projects: ProjectLoad[];
  trend: TrendPoint[];
  mostUrgent: Task | null;
  busiest: PersonLoad | null;
}

const emptyCounts = (): StatusCounts => ({
  backlog: 0,
  todo: 0,
  in_progress: 0,
  in_review: 0,
  done: 0,
});

/** Completamenti/giorno dei 13 giorni passati (fissi, fase placeholder). */
const PAST_SERIES = [1, 2, 0, 3, 1, 2, 4, 2, 1, 3, 2, 0, 1];

export function buildAnalytics(
  tasks: Task[],
  profiles: Profile[],
  projects: Project[],
): Analytics {
  const today = todayIso();

  const open = tasks.filter((t) => t.status !== "done");
  const overdue = open.filter((t) => t.due_date && t.due_date < today);
  const inReview = open.filter((t) => t.status === "in_review");

  const doneOn = (iso: string) =>
    tasks.filter(
      (t) =>
        t.status === "done" &&
        t.completed_at &&
        t.completed_at.slice(0, 10) === iso,
    ).length;

  const trend: TrendPoint[] = [];
  for (let i = 13; i >= 1; i--) {
    trend.push({ iso: addDaysIso(-i), value: PAST_SERIES[13 - i] });
  }
  trend.push({ iso: today, value: doneOn(today) });

  const last7 = trend.slice(-7).reduce((sum, p) => sum + p.value, 0);
  const prev7 = trend.slice(0, 7).reduce((sum, p) => sum + p.value, 0);

  const statusTotals = emptyCounts();
  for (const task of tasks) statusTotals[task.status] += 1;

  const people: PersonLoad[] = profiles
    .filter((p) => p.is_active)
    .map((profile) => {
      const counts = emptyCounts();
      for (const task of tasks) {
        if (task.owner_id === profile.id) counts[task.status] += 1;
      }
      const total = STATUS_ORDER.reduce((sum, s) => sum + counts[s], 0);
      return { profile, counts, total, open: total - counts.done };
    })
    .sort((a, b) => b.total - a.total);

  const projectLoads: ProjectLoad[] = [
    ...projects
      .filter((p) => !p.is_archived)
      .map((project) => {
        const inProject = tasks.filter((t) => t.project_id === project.id);
        return {
          key: project.id,
          label: project.name,
          total: inProject.length,
          open: inProject.filter((t) => t.status !== "done").length,
        };
      }),
    (() => {
      const none = tasks.filter((t) => !t.project_id);
      return {
        key: "none",
        label: "Senza progetto",
        total: none.length,
        open: none.filter((t) => t.status !== "done").length,
      };
    })(),
  ].sort((a, b) => b.total - a.total);

  const mostUrgent =
    [...overdue].sort((a, b) =>
      (a.due_date ?? "").localeCompare(b.due_date ?? ""),
    )[0] ?? null;

  const busiest =
    [...people].sort((a, b) => b.open - a.open).find((p) => p.open > 0) ?? null;

  return {
    open: open.length,
    overdue: overdue.length,
    inReview: inReview.length,
    done7: last7,
    done7Delta: last7 - prev7,
    statusTotals,
    people,
    maxPersonTotal: Math.max(1, ...people.map((p) => p.total)),
    projects: projectLoads,
    trend,
    mostUrgent,
    busiest,
  };
}

/**
 * Palette di stato per i grafici — revisione "Vetro", color-coded e
 * validata con lo script dataviz (CVD peggiore: ΔE protan 11.0, tritan
 * 15.9). Il backlog resta grigio tratteggiato (codifica secondaria);
 * legenda con tacche sagomate, gap 2px, etichette dirette.
 */
export const CHART_STATUS_COLORS: Record<TaskStatus, string> = {
  backlog: "#A9AFB8",
  todo: "#0284C7",
  in_progress: "#6D28D9",
  in_review: "#D97706",
  done: "#047857",
};

/** Tratteggio del backlog (eco della tacca tratteggiata). */
export const BACKLOG_HATCH =
  "repeating-linear-gradient(45deg, #71767F 0 2px, #A9AFB8 2px 7px)";
