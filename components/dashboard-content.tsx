"use client";

import { CalendarClock, CircleCheck, Inbox } from "lucide-react";

import { buildAnalytics } from "@/lib/analytics";
import { addDaysIso, todayIso } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { Sparkline } from "@/components/charts/sparkline";
import { StatTile } from "@/components/charts/stat-tile";
import { EmptyState } from "@/components/empty-state";
import { TaskRow } from "@/components/task-row";

function byDue(a: Task, b: Task): number {
  if (!a.due_date && !b.due_date) return a.position - b.position;
  if (!a.due_date) return 1;
  if (!b.due_date) return -1;
  return a.due_date.localeCompare(b.due_date);
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <header className="flex items-center gap-2 pb-2">
        <h2 className="text-[11px] font-semibold tracking-[0.06em] text-ink-secondary uppercase">
          {title}
        </h2>
        <span className="font-mono text-xs text-ink-muted">{count}</span>
      </header>
      {children}
    </section>
  );
}

export function DashboardContent() {
  const { tasks, profiles, projects, currentUser } = useAppStore();
  const today = todayIso();
  const weekEnd = addDaysIso(7);
  const analytics = buildAnalytics(tasks, profiles, projects);

  const open = tasks.filter((t) => t.status !== "done");
  const overdue = open
    .filter((t) => t.due_date && t.due_date < today)
    .sort(byDue);
  const thisWeek = open
    .filter((t) => t.due_date && t.due_date >= today && t.due_date <= weekEnd)
    .sort(byDue);
  const mine = open
    .filter((t) => t.owner_id === currentUser.id)
    .sort(byDue);

  return (
    <div className="flex-1 space-y-4 px-4 py-4 sm:px-6">
      <p className="text-sm text-ink-secondary">
        Ciao {currentUser.full_name.split(" ")[0]} — ecco il quadro di oggi.
      </p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Task aperti" value={analytics.open} />
        <StatTile label="In ritardo" value={analytics.overdue} tone="danger" />
        <StatTile label="In revisione" value={analytics.inReview} tone="brand" />
        <StatTile
          label="Completati · 7 giorni"
          value={analytics.done7}
          delta={analytics.done7Delta}
        >
          <Sparkline
            values={analytics.trend.map((p) => p.value)}
            ariaLabel="Andamento completamenti, ultime due settimane"
          />
        </StatTile>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="In ritardo" count={overdue.length}>
          {overdue.length === 0 ? (
            <EmptyState
              icon={CircleCheck}
              title="Niente in ritardo"
              hint="Ottimo ritmo."
              className="py-6"
            />
          ) : (
            <div className="-mx-1 flex flex-col">
              {overdue.map((t) => (
                <TaskRow key={t.id} task={t} showOwner />
              ))}
            </div>
          )}
        </Section>

        <Section title="In scadenza questa settimana" count={thisWeek.length}>
          {thisWeek.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Nessuna scadenza in settimana"
              hint="Pianifica dalla board."
              className="py-6"
            />
          ) : (
            <div className="-mx-1 flex flex-col">
              {thisWeek.map((t) => (
                <TaskRow key={t.id} task={t} showOwner />
              ))}
            </div>
          )}
        </Section>
      </div>

      <Section title="I miei task aperti" count={mine.length}>
        {mine.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Nessun task assegnato a te"
            hint="Creane uno con «Nuovo task»."
            className="py-6"
          />
        ) : (
          <div className="-mx-1 flex flex-col">
            {mine.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
