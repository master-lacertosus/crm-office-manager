import type { Metadata } from "next";
import { Suspense } from "react";

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
  const isList = view === "list";

  return (
    <>
      <Topbar
        title="Task"
        actions={
          <Suspense>
            <TasksViewToggle />
            <BoardFilters />
            <RecurringPlanner />
            <NewTaskButton />
          </Suspense>
        }
      />
      <Suspense>
        <SavedViews />
      </Suspense>
      <Suspense>{isList ? <TaskList /> : <Board />}</Suspense>
    </>
  );
}
