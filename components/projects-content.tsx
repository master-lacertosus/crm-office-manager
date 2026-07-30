"use client";

import Link from "next/link";
import { Folder } from "lucide-react";

import { useAppStore } from "@/lib/store";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";

export function ProjectsContent() {
  const { projects, tasks } = useAppStore();
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((project) => {
            const projectTasks = tasks.filter(
              (t) => t.project_id === project.id,
            );
            const openCount = projectTasks.filter(
              (t) => t.status !== "done",
            ).length;
            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="glass rounded-xl p-4 outline-none transition-transform duration-150 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-[15px]/[22px] font-semibold text-ink">
                    {project.name}
                  </h2>
                  {project.is_archived ? <Badge>Archiviato</Badge> : null}
                </div>
                {project.description ? (
                  <p className="mt-1 line-clamp-2 text-[13px]/[19px] text-ink-secondary">
                    {project.description}
                  </p>
                ) : null}
                <p className="mt-3 font-mono text-xs text-ink-muted">
                  {openCount} aperti · {projectTasks.length} totali
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
