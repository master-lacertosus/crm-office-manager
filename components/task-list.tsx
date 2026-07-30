"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight, Repeat } from "lucide-react";

import { dueTone, formatDue } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import { STATUS_ORDER, type Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AvatarInitials } from "@/components/avatar-initials";
import { StatusPip, TASK_STATUSES } from "@/components/status-pip";
import { Badge } from "@/components/ui/badge";

function Row({ task }: { task: Task }) {
  const { profiles, projects } = useAppStore();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const owner = profiles.find((p) => p.id === task.owner_id);
  const project = projects.find((p) => p.id === task.project_id);
  const tone = task.due_date ? dueTone(task.due_date) : null;

  const params = new URLSearchParams(searchParams);
  params.set("task", task.id);

  return (
    <Link
      href={`${pathname}?${params.toString()}`}
      scroll={false}
      className="flex h-12 items-center gap-3 border-t border-border-soft px-3 outline-none transition-colors first:border-t-0 hover:bg-accent/70 focus-visible:ring-2 focus-visible:ring-ring sm:px-4"
    >
      <StatusPip status={task.status} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
        {task.title}
        {task.repeat !== "none" ? (
          <Repeat
            aria-label="Ricorrente"
            className="ml-1.5 inline size-3 text-ink-faint"
          />
        ) : null}
      </span>
      {task.priority === "high" ? (
        <Badge variant="warning" className="hidden sm:inline-flex">
          Alta
        </Badge>
      ) : null}
      {project ? (
        <Badge className="hidden md:inline-flex">{project.name}</Badge>
      ) : null}
      {task.due_date ? (
        <span
          className={cn(
            "w-14 text-right font-mono text-xs",
            tone === "overdue" && task.status !== "done"
              ? "font-medium text-danger-text"
              : tone === "today"
                ? "font-medium text-brand-600"
                : "text-ink-muted",
          )}
        >
          {formatDue(task.due_date)}
        </span>
      ) : (
        <span className="w-14 text-right font-mono text-xs text-ink-faint">
          —
        </span>
      )}
      <span className="hidden w-32 items-center gap-1.5 truncate lg:flex">
        {owner ? (
          <>
            <AvatarInitials name={owner.full_name} size="sm" />
            <span className="truncate text-xs text-ink-secondary">
              {owner.full_name.split(" ")[0]}
            </span>
          </>
        ) : null}
      </span>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-faint" />
    </Link>
  );
}

/**
 * Vista Elenco: densa e scansionabile, raggruppata per stato (l'ordine del
 * flusso), righe cliccabili verso il dettaglio. I filtri owner/progetto
 * dell'URL valgono anche qui.
 */
export function TaskList() {
  const { tasks } = useAppStore();
  const searchParams = useSearchParams();
  const ownerFilter = searchParams.get("owner");
  const projectFilter = searchParams.get("project");

  const visible = tasks.filter((task) => {
    if (ownerFilter && task.owner_id !== ownerFilter) return false;
    if (projectFilter && task.project_id !== projectFilter) return false;
    return true;
  });

  return (
    <div className="flex-1 space-y-4 px-4 py-4 sm:px-6">
      {STATUS_ORDER.map((status) => {
        const rows = visible
          .filter((t) => t.status === status)
          .sort((a, b) => {
            if (!a.due_date && !b.due_date) return a.position - b.position;
            if (!a.due_date) return 1;
            if (!b.due_date) return -1;
            return a.due_date.localeCompare(b.due_date);
          });
        const meta = TASK_STATUSES[status];
        if (rows.length === 0) return null;
        return (
          <section key={status} aria-label={meta.label}>
            <header className="mb-2 flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg py-1 pr-2.5 pl-2",
                  meta.softClass,
                )}
              >
                <StatusPip status={status} className="size-3.5" />
                <h2
                  className={cn(
                    "text-[11px] font-semibold tracking-[0.05em] uppercase",
                    meta.textClass,
                  )}
                >
                  {meta.label}
                </h2>
              </span>
              <span className="font-mono text-xs text-ink-muted">
                {rows.length}
              </span>
            </header>
            <div className="card-soft overflow-hidden">
              {rows.map((task) => (
                <Row key={task.id} task={task} />
              ))}
            </div>
          </section>
        );
      })}
      {visible.length === 0 ? (
        <p className="card-soft px-4 py-10 text-center text-[13px] text-ink-muted">
          Nessun task con questi filtri.
        </p>
      ) : null}
    </div>
  );
}
