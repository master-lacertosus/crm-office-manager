import type { Metadata } from "next";
import { Suspense } from "react";

import { NewProjectButton } from "@/components/new-project-button";
import { ProjectsContent } from "@/components/projects-content";
import { Topbar } from "@/components/shell/topbar";

export const metadata: Metadata = { title: "Progetti" };

export default function ProjectsPage() {
  return (
    <>
      <Topbar
        title="Progetti"
        actions={
          <Suspense>
            <NewProjectButton />
          </Suspense>
        }
      />
      <Suspense>
        <ProjectsContent />
      </Suspense>
    </>
  );
}
