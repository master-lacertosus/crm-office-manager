import type { Metadata } from "next";
import { Suspense } from "react";

import { CalendarView } from "@/components/calendar-view";
import { NewTaskButton } from "@/components/new-task-button";
import { Topbar } from "@/components/shell/topbar";

export const metadata: Metadata = { title: "Calendario" };

export default function CalendarPage() {
  return (
    <>
      <Topbar
        title="Calendario"
        actions={
          <Suspense>
            <NewTaskButton />
          </Suspense>
        }
      />
      <Suspense>
        <CalendarView />
      </Suspense>
    </>
  );
}
