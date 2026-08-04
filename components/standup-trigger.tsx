"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Presentation } from "lucide-react";

import { Button } from "@/components/ui/button";

// Vista da proiettore aperta di rado: chunk separato, montato solo dalla
// prima apertura — il download parte all'hover o al click, non a ogni
// visita della dashboard.
const StandupMode = dynamic(
  () => import("@/components/standup-mode").then((m) => m.StandupMode),
  { ssr: false },
);

const preloadStandup = () => void import("@/components/standup-mode");

/**
 * Azione di pagina: apre la Modalità standup (vista da proiettare nel daily).
 * Vive nella topbar accanto a «Nuovo task»; onora il deep-link ?standup=1.
 */
export function StandupTrigger() {
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(
    searchParams.get("standup") === "1",
  );
  const [everOpened, setEverOpened] = React.useState(open);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onPointerEnter={preloadStandup}
        onClick={() => {
          setEverOpened(true);
          setOpen(true);
        }}
      >
        <Presentation data-icon="inline-start" />
        <span className="hidden sm:inline">Modalità standup</span>
        <span className="sm:hidden">Standup</span>
      </Button>
      {everOpened ? (
        <StandupMode open={open} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
