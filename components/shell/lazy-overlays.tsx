"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

import { TaskPanelHost } from "@/components/task-panel";

/**
 * Overlay globali. Il pannello task resta import statico: sta sul
 * percorso di ogni click su card e dei deep link ?task= — non deve mai
 * aspettare un chunk. Gli overlay ambientali (palette ⌘K, Capo, tour)
 * viaggiano invece in un unico chunk lazy, subito dopo l'idratazione ma
 * fuori dal JS critico delle pagine; ssr:false — niente HTML iniziale.
 */
const AmbientOverlays = dynamic(
  () =>
    import("@/components/shell/ambient-overlays").then(
      (m) => m.AmbientOverlays,
    ),
  { ssr: false },
);

export function LazyOverlays() {
  return (
    <>
      <Suspense>
        <TaskPanelHost />
      </Suspense>
      <AmbientOverlays />
    </>
  );
}
