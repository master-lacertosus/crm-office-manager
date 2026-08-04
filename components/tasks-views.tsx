"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Archive, Columns3, List } from "lucide-react";

import { cn } from "@/lib/utils";
import { Board } from "@/components/board/board";
import { Segmented, SegmentedLink } from "@/components/ui/segmented";

/* Le viste secondarie viaggiano in chunk propri: la Board (default) resta
   nel bundle della pagina, Elenco e Archivio arrivano al bisogno — con il
   prefetch che parte già all'hover del toggle. */
const TaskList = dynamic(
  () => import("@/components/task-list").then((m) => m.TaskList),
  { ssr: false },
);
const ArchiveView = dynamic(
  () => import("@/components/archive-view").then((m) => m.ArchiveView),
  { ssr: false },
);

type TasksView = "board" | "list" | "archive";

const VIEWS: {
  key: TasksView;
  label: string;
  icon: typeof Columns3;
  preload?: () => void;
}[] = [
  { key: "board", label: "Board", icon: Columns3 },
  {
    key: "list",
    label: "Elenco",
    icon: List,
    preload: () => void import("@/components/task-list"),
  },
  {
    key: "archive",
    label: "Archivio",
    icon: Archive,
    preload: () => void import("@/components/archive-view"),
  },
];

/** Vista corrente della pagina Task (?view=): unica fonte per toggle e corpo. */
function useTasksView(): TasksView {
  const view = useSearchParams().get("view");
  return view === "list" || view === "archive" ? view : "board";
}

/** Toggle Board/Elenco/Archivio: shallow e istantaneo, filtri preservati. */
export function TasksViewToggle() {
  const view = useTasksView();
  return (
    <Segmented>
      {VIEWS.map(({ key, label, icon: Icon, preload }) => (
        <SegmentedLink
          key={key}
          active={view === key}
          params={{ view: key === "board" ? null : key }}
          onPointerEnter={preload}
        >
          <Icon aria-hidden className="size-3.5" />
          <span className={cn(key === "archive" && "hidden lg:inline")}>
            {label}
          </span>
        </SegmentedLink>
      ))}
    </Segmented>
  );
}

/** Corpo della pagina Task pilotato da ?view=: letto lato client, così il
 *  toggle è shallow e la route resta statica e prefetchabile per intero. */
export function TasksViews() {
  const view = useTasksView();
  if (view === "archive") return <ArchiveView />;
  if (view === "list") return <TaskList />;
  return <Board />;
}
