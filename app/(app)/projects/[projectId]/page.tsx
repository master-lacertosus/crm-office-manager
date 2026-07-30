import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";

import { MOCK_PROJECTS } from "@/lib/mock-data";
import { Board } from "@/components/board/board";
import { BoardFilters } from "@/components/board/filters";
import { NewTaskButton } from "@/components/new-task-button";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Progetto" };

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = MOCK_PROJECTS.find((p) => p.id === projectId);

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
            <BoardFilters lockProject />
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
        <Board projectId={project.id} />
      </Suspense>
    </>
  );
}
