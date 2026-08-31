import type { Metadata } from "next";
import { Suspense } from "react";

import { BoardFilters } from "@/components/board/filters";
import { CalendarViews, CalendarViewToggle } from "@/components/calendar-views";
import { NewTaskButton } from "@/components/new-task-button";
import { Topbar } from "@/components/shell/topbar";

export const metadata: Metadata = { title: "Calendario" };

export default function CalendarPage() {
  return (
    <>
      <Topbar
        title="Calendario"
        actions={
          <>
            <Suspense>
              <CalendarViewToggle />
            </Suspense>
            {/* Lo stesso filtro di Board ed Elenco, con lo stesso `?owner=`:
                il calendario era l'unica vista senza, e per sapere cosa
                aveva in mano un collega bisognava tornare indietro. */}
            <Suspense>
              <BoardFilters idPrefix="cal" />
            </Suspense>
            <Suspense>
              <NewTaskButton />
            </Suspense>
          </>
        }
      />
      {/* Il filtro non entra nella barra sotto i 1280px: qui sotto, come
          nelle altre pagine, resta raggiungibile senza comprimere il
          titolo. */}
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto border-b border-velo/60 px-4 py-2 sm:px-6 xl:hidden">
        <Suspense>
          <BoardFilters idPrefix="cal-m" />
        </Suspense>
      </div>
      <Suspense>
        <CalendarViews />
      </Suspense>
    </>
  );
}
