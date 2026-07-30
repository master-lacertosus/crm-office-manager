"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight, Repeat } from "lucide-react";

import { useAppStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { AvatarInitials } from "@/components/avatar-initials";
import { DueChip } from "@/components/due-chip";
import { StatusPip } from "@/components/status-pip";
import { Badge } from "@/components/ui/badge";

function Row({ task }: { task: Task }) {
  const { profiles, projects } = useAppStore();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const owner = profiles.find((p) => p.id === task.owner_id);
  const project = projects.find((p) => p.id === task.project_id);

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
        <DueChip iso={task.due_date} status={task.status} />
      ) : (
        <span className="font-mono text-xs text-ink-faint">—</span>
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
  const { tasks, statuses } = useAppStore();
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
      {statuses.map((meta) => {
        const rows = visible
          .filter((t) => t.status === meta.key)
          .sort((a, b) => {
            if (!a.due_date && !b.due_date) return a.position - b.position;
            if (!a.due_date) return 1;
            if (!b.due_date) return -1;
            return a.due_date.localeCompare(b.due_date);
          });
        if (rows.length === 0) return null;
        return (
          <section key={meta.key} aria-label={meta.label}>
            <header className="mb-2 flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-lg py-1 pr-2.5 pl-2"
                style={{ background: meta.soft }}
              >
                <StatusPip status={meta.key} className="size-3.5" />
                <h2
                  className="text-[11px] font-bold tracking-[0.05em] uppercase"
                  style={{ color: meta.text }}
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
