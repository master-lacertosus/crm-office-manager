"use client";

import Link from "next/link";
import { ArrowRight, Folder } from "lucide-react";

import { useAppStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { AvatarInitials } from "@/components/avatar-initials";
import { DueChip } from "@/components/due-chip";
import { EmptyState } from "@/components/empty-state";
import { CHART_STATUS_COLORS } from "@/lib/analytics";

/**
 * Progetti come schede operative: avanzamento, composizione per fase,
 * squadra coinvolta e prossima scadenza — non più semplici titoli.
 */
export function ProjectsContent() {
  const { projects, tasks, profiles, statuses } = useAppStore();
  const visible = projects.filter((p) => !p.is_archived);

  return (
    <div className="flex-1 px-4 py-4 sm:px-6">
      {visible.length === 0 ? (
        <EmptyState
          icon={Folder}
          title="Nessun progetto"
          hint="I progetti raggruppano i task di una campagna o di un'area."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {visible.map((project) => {
            const projectTasks = tasks.filter(
              (t) => t.project_id === project.id,
            );
            const open = projectTasks.filter((t) => t.status !== "done");
            const done = projectTasks.length - open.length;
            const percent =
              projectTasks.length === 0
                ? 0
                : Math.round((done / projectTasks.length) * 100);
            const nextDue: Task | undefined = [...open]
              .filter((t) => t.due_date)
              .sort((a, b) =>
                (a.due_date as string).localeCompare(b.due_date as string),
              )[0];
            const team = [
              ...new Set(open.map((t) => t.owner_id)),
            ]
              .map((id) => profiles.find((p) => p.id === id))
              .filter(Boolean)
              .slice(0, 4);

            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group card-soft flex flex-col p-5 outline-none transition-transform duration-150 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-[16px]/6 font-bold text-ink">
                    {project.name}
                  </h2>
                  <ArrowRight
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600"
                  />
                </div>
                {project.description ? (
                  <p className="mt-1 line-clamp-2 text-[13px]/[19px] text-ink-secondary">
                    {project.description}
                  </p>
                ) : null}

                {/* avanzamento */}
                <div className="mt-4">
                  <div className="flex items-baseline justify-between">
                    <p className="text-[11px] font-bold tracking-[0.05em] text-ink-muted uppercase">
                      Avanzamento
                    </p>
                    <p className="font-mono text-[13px] font-semibold text-ink">
                      {percent}%
                    </p>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#EDF1F7]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-[width] duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* composizione per fase */}
                {projectTasks.length > 0 ? (
                  <div className="mt-3 flex h-[8px] gap-[2px] overflow-hidden rounded-full">
                    {statuses.map((meta) => {
                      const count = projectTasks.filter(
                        (t) => t.status === meta.key,
                      ).length;
                      if (count === 0) return null;
                      return (
                        <span
                          key={meta.key}
                          title={`${meta.label}: ${count}`}
                          style={{
                            flexGrow: count,
                            background:
                              CHART_STATUS_COLORS[meta.key] ?? meta.color,
                          }}
                        />
                      );
                    })}
                  </div>
                ) : null}

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-border-soft pt-3">
                  <span className="flex -space-x-1.5">
                    {team.map((p) => (
                      <AvatarInitials
                        key={p!.id}
                        name={p!.full_name}
                        size="sm"
                        className="ring-2 ring-white"
                      />
                    ))}
                  </span>
                  <span className="font-mono text-xs text-ink-muted">
                    {open.length} aperti · {projectTasks.length}
                  </span>
                  {nextDue ? (
                    <DueChip iso={nextDue.due_date} status={nextDue.status} />
                  ) : (
                    <span className="text-xs text-ink-faint">
                      nessuna scadenza
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
