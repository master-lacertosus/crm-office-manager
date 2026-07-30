import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";

import { MOCK_PROJECTS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { Board } from "@/components/board/board";
import { BoardFilters } from "@/components/board/filters";
import { NewTaskButton } from "@/components/new-task-button";
import { ProjectBacheca } from "@/components/project-bacheca";
import { ProjectTimeline } from "@/components/project-timeline";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Progetto" };

function ViewToggle({
  projectId,
  view,
}: {
  projectId: string;
  view: "board" | "timeline" | "bacheca";
}) {
  const base =
    "rounded-md px-2.5 py-1 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring";
  const tab = (target: string, label: string, active: boolean) => (
    <Link
      href={`/projects/${projectId}${target ? `?view=${target}` : ""}`}
      className={cn(
        base,
        active ? "bg-brand-50 text-brand-700" : "text-ink-secondary hover:text-ink",
      )}
    >
      {label}
    </Link>
  );
  return (
    <div className="flex gap-0.5 rounded-xl border border-border bg-white p-0.5 shadow-xs">
      {tab("", "Board", view === "board")}
      {tab("timeline", "Timeline", view === "timeline")}
      {tab("bacheca", "Bacheca", view === "bacheca")}
    </div>
  );
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { projectId } = await params;
  const { view } = await searchParams;
  const project = MOCK_PROJECTS.find((p) => p.id === projectId);
  const activeView =
    view === "timeline" ? "timeline" : view === "bacheca" ? "bacheca" : "board";

  if (!project) {
    return (
      <>
        <Topbar title="Progetto non trovato" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
          <p className="text-sm text-ink-secondary">
            Questo progetto non esiste o è stato rimosso.
          </p>
          <Button asChild variant="outline">
            <Link href="/projects">
              <ArrowLeft data-icon="inline-start" />
              Torna ai progetti
            </Link>
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title={project.name}
        actions={
          <Suspense>
            <ViewToggle projectId={project.id} view={activeView} />
            {activeView === "board" ? <BoardFilters lockProject /> : null}
            <NewTaskButton />
          </Suspense>
        }
      />
      {project.description ? (
        <p className="border-b border-border-soft px-4 py-2.5 text-[13px] text-ink-secondary sm:px-6">
          {project.description}
        </p>
      ) : null}
      <Suspense>
        {activeView === "timeline" ? (
          <ProjectTimeline projectId={project.id} />
        ) : activeView === "bacheca" ? (
          <ProjectBacheca projectId={project.id} />
        ) : (
          <Board projectId={project.id} />
        )}
      </Suspense>
    </>
  );
}
