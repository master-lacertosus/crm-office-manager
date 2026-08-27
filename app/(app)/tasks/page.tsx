import type { Metadata } from "next";
import { Suspense } from "react";

import { BoardFilters } from "@/components/board/filters";
import { NewTaskButton } from "@/components/new-task-button";
import { RecurringPlanner } from "@/components/recurring-planner";
import { SavedViews } from "@/components/saved-views";
import { VistaDiPartenza } from "@/components/vista-di-partenza";
import { ZenRiquadro } from "@/components/zen-riquadro";
import { TasksViews, TasksViewToggle } from "@/components/tasks-views";
import { Topbar } from "@/components/shell/topbar";

export const metadata: Metadata = { title: "Task" };

/** La vista (?view=) è letta lato client in TasksViews: la route resta
 *  statica (prefetch completo) e il toggle è istantaneo. */
export default function TasksPage() {
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
      <ZenRiquadro />
      <VistaDiPartenza />
      <Suspense>
        <SavedViews />
      </Suspense>
      <Suspense>
        <TasksViews />
      </Suspense>
    </>
  );
}
