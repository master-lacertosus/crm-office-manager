import { addDaysIso, diffIsoDays, shiftIsoDays, todayIso } from "@/lib/format";
import type { Profile, Project, Task } from "@/lib/types";
import { STATUS_ORDER } from "@/lib/types";

/**
 * Motore analitico dei report: pure funzioni sui dati dello store, quindi
 * ogni grafico reagisce in tempo reale alle modifiche (drag sulla board
 * incluso). Con lo storico persistito i completamenti sono REALI: la
 * serie del trend nasce da completed_at (archiviati inclusi), filtrabile
 * per intervallo di date.
 */

export type StatusCounts = Record<string, number>;

export interface DateRange {
  /** ISO date (YYYY-MM-DD), estremi inclusi. */
  from: string;
  to: string;
}

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
  /** Trailing 7 giorni (per la dashboard, indipendente dal range). */
  done7: number;
  done7Delta: number;
  /** Metriche del periodo selezionato. */
  doneInRange: number;
  doneInRangeDelta: number;
  createdInRange: number;
  /** Giorni medi creazione→completamento nel periodo (null se nessuno). */
  avgLeadDays: number | null;
  donePerPerson: { key: string; label: string; total: number; open: number }[];
  rangeDays: number;
  statusTotals: StatusCounts;
  people: PersonLoad[];
  maxPersonTotal: number;
  projects: ProjectLoad[];
  trend: TrendPoint[];
  mostUrgent: Task | null;
  busiest: PersonLoad | null;
}

const emptyCounts = (keys: string[]): StatusCounts =>
  Object.fromEntries(keys.map((k) => [k, 0]));

export function buildAnalytics(
  tasks: Task[],
  profiles: Profile[],
  projects: Project[],
  statusKeys: string[] = STATUS_ORDER,
  range?: DateRange,
): Analytics {
  const today = todayIso();
  const from = range?.from ?? addDaysIso(-29);
  const to = range?.to ?? today;
  const rangeDays = Math.max(1, diffIsoDays(from, to) + 1);

  /* Snapshot operativo: gli archiviati restano fuori (sono storia). */
  const operational = tasks.filter((t) => !t.archived_at);
  const open = operational.filter((t) => t.status !== "done");
  const overdue = open.filter((t) => t.due_date && t.due_date < today);
  const inReview = open.filter((t) => t.status === "in_review");

  /* Storia: i completamenti contano SEMPRE, anche da archiviati. */
  const completedDay = (t: Task) =>
    t.status === "done" && t.completed_at ? t.completed_at.slice(0, 10) : null;
  const doneBetween = (a: string, b: string) =>
    tasks.filter((t) => {
      const d = completedDay(t);
      return d !== null && d >= a && d <= b;
    });

  const doneRangeTasks = doneBetween(from, to);
  const doneInRange = doneRangeTasks.length;
  const prevFrom = shiftIsoDays(from, -rangeDays);
  const prevTo = shiftIsoDays(from, -1);
  const doneInRangeDelta = doneInRange - doneBetween(prevFrom, prevTo).length;

  const createdInRange = tasks.filter((t) => {
    const d = t.created_at.slice(0, 10);
    return d >= from && d <= to;
  }).length;

  const leads = doneRangeTasks.map((t) =>
    diffIsoDays(t.created_at.slice(0, 10), t.completed_at!.slice(0, 10)),
  );
  const avgLeadDays =
    leads.length > 0
      ? Math.round((leads.reduce((s, v) => s + v, 0) / leads.length) * 10) / 10
      : null;

  /* Trend: un punto per giorno del periodo (tetto di sicurezza a 366). */
  const byDay = new Map<string, number>();
  for (const t of tasks) {
    const d = completedDay(t);
    if (d) byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }
  const trend: TrendPoint[] = [];
  for (let i = 0; i < Math.min(rangeDays, 366); i++) {
    const iso = shiftIsoDays(from, i);
    if (iso > today) break;
    trend.push({ iso, value: byDay.get(iso) ?? 0 });
  }

  /* Trailing 7g per la dashboard (reale, non più sintetico). */
  const done7 = doneBetween(addDaysIso(-6), today).length;
  const done7Delta = done7 - doneBetween(addDaysIso(-13), addDaysIso(-7)).length;

  const statusTotals = emptyCounts(statusKeys);
  for (const task of operational) {
    if (statusTotals[task.status] !== undefined) statusTotals[task.status] += 1;
  }

  const people: PersonLoad[] = profiles
    .filter((p) => p.is_active)
    .map((profile) => {
      const counts = emptyCounts(statusKeys);
      for (const task of operational) {
        if (task.owner_id === profile.id && counts[task.status] !== undefined) {
          counts[task.status] += 1;
        }
      }
      const total = statusKeys.reduce((sum, s) => sum + counts[s], 0);
      return { profile, counts, total, open: total - (counts.done ?? 0) };
    })
    .sort((a, b) => b.total - a.total);

  const donePerPerson = profiles
    .filter((p) => p.is_active)
    .map((profile) => {
      const done = doneRangeTasks.filter(
        (t) => t.owner_id === profile.id,
      ).length;
      return {
        key: profile.id,
        label: profile.full_name.split(" ")[0],
        total: done,
        open: done,
      };
    })
    .sort((a, b) => b.total - a.total);

  const projectLoads: ProjectLoad[] = [
    ...projects
      .filter((p) => !p.is_archived)
      .map((project) => {
        const inProject = operational.filter(
          (t) => t.project_id === project.id,
        );
        return {
          key: project.id,
          label: project.name,
          total: inProject.length,
          open: inProject.filter((t) => t.status !== "done").length,
        };
      }),
    (() => {
      const none = operational.filter((t) => !t.project_id);
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
    done7,
    done7Delta,
    doneInRange,
    doneInRangeDelta,
    createdInRange,
    avgLeadDays,
    donePerPerson,
    rangeDays,
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
export const CHART_STATUS_COLORS: Record<string, string> = {
  backlog: "#A9AFB8",
  todo: "#0284C7",
  in_progress: "#6D28D9",
  in_review: "#D97706",
  alert: "#B91C1C",
  done: "#047857",
};

/** Tratteggio del backlog (eco della tacca tratteggiata). */
export const BACKLOG_HATCH =
  "repeating-linear-gradient(45deg, #71767F 0 2px, #A9AFB8 2px 7px)";
