import type { Metadata } from "next";

import { TeamContent } from "@/components/team-content";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Team" };

export default function TeamPage() {
  return (
    <>
      <Topbar
        title="Team"
        actions={
          <Button disabled title="Si attiverà con il collegamento a Supabase">
            Invita
          </Button>
        }
      />
      <TeamContent />
    </>
  );
}
