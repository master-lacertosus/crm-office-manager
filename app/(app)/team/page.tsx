import type { Metadata } from "next";
import { Suspense } from "react";

import { InviteButton } from "@/components/invite-button";
import { TeamViews, TeamViewToggle } from "@/components/team-views";
import { Topbar } from "@/components/shell/topbar";

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
            <Suspense>
              <InviteButton />
            </Suspense>
          </>
        }
      />
      <Suspense>
        <TeamViews />
      </Suspense>
    </>
  );
}
