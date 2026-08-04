import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";

import { MOCK_PROJECTS } from "@/lib/mock-data";
import { NewTaskButton } from "@/components/new-task-button";
import {
  ProjectViewControls,
  ProjectViews,
} from "@/components/project-views";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Progetto" };

/** I progetti demo sono noti a build time: la route diventa statica e i
 *  link dalla lista progetti si prefetchano per intero. */
export function generateStaticParams() {
  return MOCK_PROJECTS.map((p) => ({ projectId: p.id }));
}

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
            <div className="hidden items-center gap-2 xl:flex">
              <ProjectViewControls idPrefix="bar" />
            </div>
            <NewTaskButton />
          </Suspense>
        }
      />
      {/* Sotto-barra mobile/tablet: scorre in orizzontale, non sfora la pagina. */}
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto border-b border-white/60 px-4 py-2 sm:px-6 xl:hidden">
        <Suspense>
          <ProjectViewControls idPrefix="sub" />
        </Suspense>
      </div>
      {project.description ? (
        <p className="border-b border-border-soft px-4 py-2.5 text-[13px] text-ink-secondary sm:px-6">
          {project.description}
        </p>
      ) : null}
      <Suspense>
        <ProjectViews projectId={project.id} />
      </Suspense>
    </>
  );
}
