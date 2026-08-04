"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Scale, Users } from "lucide-react";

import { TeamContent } from "@/components/team-content";
import { Segmented, SegmentedLink } from "@/components/ui/segmented";

/* La vista Carico viaggia in un chunk suo (prefetch all'hover del toggle). */
const WorkloadView = dynamic(
  () => import("@/components/workload-view").then((m) => m.WorkloadView),
  { ssr: false },
);

const preloadWorkload = () => void import("@/components/workload-view");

/** Vista corrente della pagina Team (?view=): unica fonte per toggle e corpo. */
function useTeamView(): "persone" | "carico" {
  return useSearchParams().get("view") === "carico" ? "carico" : "persone";
}

/** Toggle Persone/Carico: shallow e istantaneo. */
export function TeamViewToggle() {
  const view = useTeamView();
  return (
    <Segmented>
      <SegmentedLink active={view === "persone"} params={{ view: null }}>
        <Users aria-hidden className="size-3.5" />
        Persone
      </SegmentedLink>
      <SegmentedLink
        active={view === "carico"}
        params={{ view: "carico" }}
        onPointerEnter={preloadWorkload}
      >
        <Scale aria-hidden className="size-3.5" />
        Carico
      </SegmentedLink>
    </Segmented>
  );
}

/** Corpo della pagina Team pilotato da ?view=: letto lato client, così il
 *  toggle è shallow e la route resta statica. */
export function TeamViews() {
  return useTeamView() === "carico" ? <WorkloadView /> : <TeamContent />;
}
