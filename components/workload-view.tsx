"use client";

import Link from "next/link";

import { addDaysIso, dueUrgency, todayIso } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AvatarInitials } from "@/components/avatar-initials";
import { DueChip } from "@/components/due-chip";
import { PriorityBadge } from "@/components/priority-badge";
import { StatusPip } from "@/components/status-pip";

/**
 * Vista carico di lavoro: una colonna per persona con i task aperti in
 * ordine di scadenza. Si vede chi è saturo PRIMA di assegnare.
 */
export function WorkloadView() {
  const { tasks, profiles } = useAppStore();
  const today = todayIso();
  const weekEnd = addDaysIso(7);

  /* I lavori divisi in pezzi non pesano sulle spalle di chi li coordina:
     a pesare sono i pezzi, ognuno sulla persona che lo esegue. */
  const contenitori = new Set(
    tasks.filter((t) => t.parent_id).map((t) => t.parent_id),
  );
  const open = tasks.filter(
    (t) => t.status !== "done" && !t.archived_at && !contenitori.has(t.id),
  );

  const people = profiles
    .filter((p) => p.is_active)
    .map((profile) => {
      const mine = open
        .filter((t) => t.owner_id === profile.id)
        .sort((a, b) => {
          if (!a.due_date && !b.due_date) return a.position - b.position;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return a.due_date.localeCompare(b.due_date);
        });
      return {
        profile,
        tasks: mine,
        overdue: mine.filter((t) => t.due_date && t.due_date < today).length,
        thisWeek: mine.filter(
          (t) => t.due_date && t.due_date >= today && t.due_date <= weekEnd,
        ).length,
      };
    })
    .sort((a, b) => b.tasks.length - a.tasks.length);

  const maxLoad = Math.max(1, ...people.map((p) => p.tasks.length));

  return (
    <div className="flex flex-1 gap-3 overflow-x-auto px-4 py-4 sm:px-6">
      {people.map(({ profile, tasks: mine, overdue, thisWeek }) => (
        <section
          key={profile.id}
          aria-label={`Carico di ${profile.full_name}`}
          className="flex w-[260px] shrink-0 snap-start flex-col rounded-2xl bg-[#EDF1F7]/70 p-2"
        >
          <header className="space-y-2 px-1.5 pt-1 pb-2.5">
            <div className="flex items-center gap-2">
              <AvatarInitials
                name={profile.full_name}
                src={profile.avatar_url}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-ink">
                  {profile.full_name}
                </p>
                <p className="truncate text-[11px] text-ink-muted">
                  {profile.title ??
                    (profile.role === "admin" ? "Admin" : "Team")}
                </p>
              </div>
              <span className="font-mono text-xs text-ink-muted">
                {mine.length}
              </span>
            </div>
            {/* barra di carico relativa al più carico */}
            <div
              aria-hidden
              className="h-1.5 overflow-hidden rounded-full bg-velo/70"
            >
              <div
                className={cn(
                  "h-full rounded-full",
                  overdue > 0 ? "bg-destructive" : "bg-brand-500",
                )}
                style={{
                  width: `${Math.round((mine.length / maxLoad) * 100)}%`,
                }}
              />
            </div>
            <p className="flex flex-wrap gap-x-2 text-[11px] text-ink-muted">
              <span>{mine.length} aperti</span>
              {overdue > 0 ? (
                <span className="font-semibold text-danger-text">
                  {overdue} in ritardo
                </span>
              ) : null}
              {thisWeek > 0 ? <span>{thisWeek} questa settimana</span> : null}
            </p>
          </header>

          <div className="flex flex-1 flex-col gap-1.5">
            {mine.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-velo/40 px-3 py-5 text-center text-[12px] text-ink-faint">
                Nessun task aperto
              </p>
            ) : (
              mine.map((task) => <MiniCard key={task.id} task={task} />)
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function MiniCard({ task }: { task: Task }) {
  const urgency =
    task.due_date && task.status !== "done"
      ? dueUrgency(task.due_date).level
      : null;
  return (
    <Link
      href={`/tasks?task=${task.id}`}
      scroll={false}
      className={cn(
        "card-soft block rounded-xl p-2.5 outline-none transition-transform duration-150 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring",
        urgency === "overdue" && "border-destructive/35",
      )}
    >
      <p className="flex items-start gap-1.5 text-[13px]/[17px] font-medium text-ink">
        <StatusPip status={task.status} className="mt-0.5 size-3 shrink-0" />
        <span className="min-w-0 flex-1">{task.title}</span>
        {task.priority === "high" ? (
          <PriorityBadge iconOnly className="mt-px" />
        ) : null}
      </p>
      {task.due_date ? (
        <p className="mt-1.5 pl-[18px]">
          <DueChip iso={task.due_date} status={task.status} />
        </p>
      ) : null}
    </Link>
  );
}
