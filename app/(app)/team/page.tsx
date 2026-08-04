import type { Metadata } from "next";
import { Suspense } from "react";

import { TeamViews, TeamViewToggle } from "@/components/team-views";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Team" };

/** La vista (?view=) è letta lato client in TeamViews: la route resta
 *  statica (prefetch completo) e il toggle è istantaneo. */
export default function TeamPage() {
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
      <Suspense>
        <TeamViews />
      </Suspense>
    </>
  );
}
