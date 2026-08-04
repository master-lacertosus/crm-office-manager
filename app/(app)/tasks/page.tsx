import type { Metadata } from "next";
import { Suspense } from "react";

import { ArchiveView } from "@/components/archive-view";
import { Board } from "@/components/board/board";
import { BoardFilters } from "@/components/board/filters";
import { NewTaskButton } from "@/components/new-task-button";
import { RecurringPlanner } from "@/components/recurring-planner";
import { SavedViews } from "@/components/saved-views";
import { Topbar } from "@/components/shell/topbar";
import { TaskList } from "@/components/task-list";
import { TasksViewToggle } from "@/components/tasks-view-toggle";

export const metadata: Metadata = { title: "Task" };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;

  return (
    <>
      <Topbar
        title="Task"
        actions={
          <Suspense>
            {/* Su lg+ toggle e filtri stanno nell'header; sotto passano
                alla sotto-barra scrollabile qui sotto (una sola istanza
                visibile per volta, id distinti per non collidere). */}
            <div className="hidden items-center gap-2 xl:flex">
              <TasksViewToggle />
              <BoardFilters idPrefix="bar" />
            </div>
            <RecurringPlanner />
            <NewTaskButton />
          </Suspense>
        }
      />
      {/* Sotto-barra mobile/tablet: scorre in orizzontale, non sfora la pagina. */}
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto border-b border-white/60 px-4 py-2 sm:px-6 xl:hidden">
        <Suspense>
          <TasksViewToggle />
          <BoardFilters idPrefix="sub" />
        </Suspense>
      </div>
      <Suspense>
        <SavedViews />
      </Suspense>
      <Suspense>
        {view === "archive" ? (
          <ArchiveView />
        ) : view === "list" ? (
          <TaskList />
        ) : (
          <Board />
        )}
      </Suspense>
    </>
  );
}
