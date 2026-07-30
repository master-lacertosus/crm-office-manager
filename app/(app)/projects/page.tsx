import type { Metadata } from "next";
import { Suspense } from "react";

import { ProjectsContent } from "@/components/projects-content";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Progetti" };

export default function ProjectsPage() {
  return (
    <>
      <Topbar
        title="Progetti"
        actions={
          <Button disabled title="Si attiverà con il collegamento a Supabase">
            Nuovo progetto
          </Button>
        }
      />
      <Suspense>
        <ProjectsContent />
      </Suspense>
    </>
  );
}
