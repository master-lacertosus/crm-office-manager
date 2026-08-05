"use client";

import Link from "next/link";
import { PartyPopper, TriangleAlert } from "lucide-react";

import { diffIsoDays, formatDue, todayIso } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { AvatarInitials } from "@/components/avatar-initials";
import { DueChip } from "@/components/due-chip";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";

/**
 * Registro problemi: tutti i task in fase «Problema», i più vecchi in
 * testa, con motivo, tempo-in-fase e chi deve sbloccare. L'ordine del
 * giorno naturale dello standup.
 */
export function ProblemsContent() {
  const { tasks, profiles, projects } = useAppStore();
  const today = todayIso();

  const problems = tasks
    .filter((t) => t.status === "alert")
    .sort((a, b) =>
      (a.problem_since ?? "").localeCompare(b.problem_since ?? ""),
    );

  return (
    <div className="flex-1 space-y-3 px-4 py-4 sm:px-6">
      {problems.length === 0 ? (
        <EmptyState
          icon={PartyPopper}
          title="Nessun problema aperto"
          hint="Quando un task viene segnalato come bloccato, appare qui."
        />
      ) : (
        problems.map((task) => {
          const owner = profiles.find((p) => p.id === task.owner_id);
          const project = projects.find((p) => p.id === task.project_id);
          const days = task.problem_since
            ? Math.max(0, diffIsoDays(task.problem_since.slice(0, 10), today))
            : 0;
          const escalated = days >= 2;
          return (
            <Link
              key={task.id}
              href={`/tasks?task=${task.id}`}
              scroll={false}
              className={cn(
                "card-soft block border-destructive/30 p-4 outline-none transition-transform duration-150 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
                escalated && "border-destructive/60",
              )}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <TriangleAlert
                  aria-hidden
                  className="size-4 shrink-0 text-destructive"
                />
                <p className="min-w-0 flex-1 truncate text-[15px] font-bold text-ink">
                  {task.title}
                </p>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-bold",
                    escalated
                      ? "bg-destructive text-white"
                      : "bg-danger-soft text-danger-text",
                  )}
                >
                  {days === 0 ? "bloccato oggi" : `bloccato da ${days} g`}
                  {escalated ? " · escalato" : ""}
                </span>
              </div>
              <p className="mt-2 text-[13px]/[19px] text-ink-secondary">
                {task.problem_reason ?? "Motivo non indicato."}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border-soft pt-3">
                {owner ? (
                  <span className="flex items-center gap-1.5">
                    <AvatarInitials
                      name={owner.full_name}
                      src={owner.avatar_url}
                      size="sm"
                    />
                    <span className="text-[12px] text-ink-secondary">
                      Sblocca: <b>{owner.full_name.split(" ")[0]}</b>
                    </span>
                  </span>
                ) : null}
                {project ? <Badge>{project.name}</Badge> : null}
                <DueChip iso={task.due_date} status={task.status} />
                {task.problem_since ? (
                  <span className="ml-auto font-mono text-[11px] text-ink-muted">
                    dal {formatDue(task.problem_since.slice(0, 10))}
                  </span>
                ) : null}
              </div>
            </Link>
          );
        })
      )}
    </div>
  );
}
