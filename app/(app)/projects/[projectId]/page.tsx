import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { fetchProject } from "@/lib/supabase/queries";
import { NewTaskButton } from "@/components/new-task-button";
import {
  ProjectViewControls,
  ProjectViews,
} from "@/components/project-views";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Progetto" };

/* Niente `generateStaticParams`: i progetti ora nascono dagli utenti e non
   sono noti a build time. La rotta diventa dinamica — ed è comunque quello
   che serve, perché il contenuto dipende da chi guarda (la RLS decide). */

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  /* Lettura lato server con la sessione dell'utente: se la policy non
     concede il progetto, torna null e si mostra «non trovato» — senza
     rivelare che esiste ma non gli spetta. */
  const project = await fetchProject(supabase, projectId);

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
