import type { Metadata } from "next";
import { Suspense } from "react";

import { Board } from "@/components/board/board";
import { BoardFilters } from "@/components/board/filters";
import { NewTaskButton } from "@/components/new-task-button";
import { Topbar } from "@/components/shell/topbar";

export const metadata: Metadata = { title: "Task" };

export default function TasksPage() {
  return (
    <>
      <Topbar
        title="Task"
        actions={
          <Suspense>
            <BoardFilters />
            <NewTaskButton />
          </Suspense>
        }
      />
      <Suspense>
        <Board />
      </Suspense>
    </>
  );
}
