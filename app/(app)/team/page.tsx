import type { Metadata } from "next";
import { Suspense } from "react";

import { TeamContent } from "@/components/team-content";
import { TeamViewToggle, WorkloadView } from "@/components/workload-view";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  return (
    <>
      <Topbar
        title="Team"
        actions={
          <>
            <Suspense>
              <TeamViewToggle />
            </Suspense>
            <Button disabled title="Si attiverà con il collegamento a Supabase">
              Invita
            </Button>
          </>
        }
      />
      {view === "carico" ? (
        <Suspense>
          <WorkloadView />
        </Suspense>
      ) : (
        <TeamContent />
      )}
    </>
  );
}
