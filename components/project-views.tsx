"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

import { Board } from "@/components/board/board";
import { BoardFilters } from "@/components/board/filters";
import { Segmented, SegmentedLink } from "@/components/ui/segmented";

/* Timeline e Bacheca viaggiano in chunk propri (prefetch all'hover). */
const ProjectTimeline = dynamic(
  () => import("@/components/project-timeline").then((m) => m.ProjectTimeline),
  { ssr: false },
);
const ProjectBacheca = dynamic(
  () => import("@/components/project-bacheca").then((m) => m.ProjectBacheca),
  { ssr: false },
);

type ProjectView = "board" | "timeline" | "bacheca";

const VIEWS: { key: ProjectView; label: string; preload?: () => void }[] = [
  { key: "board", label: "Board" },
  {
    key: "timeline",
    label: "Timeline",
    preload: () => void import("@/components/project-timeline"),
  },
  {
    key: "bacheca",
    label: "Bacheca",
    preload: () => void import("@/components/project-bacheca"),
  },
];

/** Vista corrente della pagina progetto (?view=). */
function useProjectView(): ProjectView {
  const view = useSearchParams().get("view");
  return view === "timeline" || view === "bacheca" ? view : "board";
}

/** Toggle Board/Timeline/Bacheca + filtri board: shallow e istantaneo,
 *  parametri preservati (stessa regola dei toggle di Task e Team). */
export function ProjectViewControls({ idPrefix }: { idPrefix: string }) {
  const view = useProjectView();
  return (
    <>
      <Segmented>
        {VIEWS.map(({ key, label, preload }) => (
          <SegmentedLink
            key={key}
            active={view === key}
            params={{ view: key === "board" ? null : key }}
            onPointerEnter={preload}
          >
            {label}
          </SegmentedLink>
        ))}
      </Segmented>
      {view === "board" ? (
        <BoardFilters lockProject idPrefix={idPrefix} />
      ) : null}
    </>
  );
}

/** Contenuto della pagina progetto pilotato da ?view=. */
export function ProjectViews({ projectId }: { projectId: string }) {
  const view = useProjectView();
  if (view === "timeline") return <ProjectTimeline projectId={projectId} />;
  if (view === "bacheca") return <ProjectBacheca projectId={projectId} />;
  return <Board projectId={projectId} />;
}
