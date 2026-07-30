"use client";

import { useSearchParams } from "next/navigation";

import { useAppStore } from "@/lib/store";
import { STATUS_ORDER, type Task, type TaskStatus } from "@/lib/types";
import { StatusPip, TASK_STATUSES } from "@/components/status-pip";
import { TaskCard } from "@/components/board/task-card";

function Column({ status, tasks }: { status: TaskStatus; tasks: Task[] }) {
  const meta = TASK_STATUSES[status];
  return (
    <section
      aria-label={meta.label}
      className="flex w-[280px] shrink-0 snap-start flex-col lg:w-auto lg:flex-1 lg:basis-0"
    >
      <header className="flex items-center gap-2 px-1 pb-2.5">
        <StatusPip status={status} />
        <h2 className="text-[11px] font-semibold tracking-[0.06em] text-ink-secondary uppercase">
          {meta.label}
        </h2>
        <span className="font-mono text-xs text-ink-muted">{tasks.length}</span>
      </header>
      <div className="flex flex-1 flex-col gap-2">
        {tasks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-[13px] text-ink-faint">
            Nessun task
          </p>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </section>
  );
}

/**
 * La board: 5 colonne fisse (docs/design-system.md), scroll orizzontale
 * con snap sotto lg. Lo spostamento di stato passa dal pannello del task
 * (percorso tastiera); il drag-and-drop arriverà nella milestone M4.
 */
export function Board({ projectId }: { projectId?: string }) {
  const { tasks } = useAppStore();
  const searchParams = useSearchParams();

  const ownerFilter = searchParams.get("owner");
  const projectFilter = projectId ?? searchParams.get("project");

  const visible = tasks.filter((task) => {
    if (ownerFilter && task.owner_id !== ownerFilter) return false;
    if (projectFilter && task.project_id !== projectFilter) return false;
    return true;
  });

  return (
    <div className="flex flex-1 snap-x snap-mandatory gap-4 overflow-x-auto px-4 py-4 sm:px-6">
      {STATUS_ORDER.map((status) => (
        <Column
          key={status}
          status={status}
          tasks={visible
            .filter((task) => task.status === status)
            .sort((a, b) => a.position - b.position)}
        />
      ))}
    </div>
  );
}
