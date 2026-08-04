"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Presentation } from "lucide-react";

import { StandupMode } from "@/components/standup-mode";
import { Button } from "@/components/ui/button";

/**
 * Azione di pagina: apre la Modalità standup (vista da proiettare nel daily).
 * Vive nella topbar accanto a «Nuovo task»; onora il deep-link ?standup=1.
 */
export function StandupTrigger() {
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(
    searchParams.get("standup") === "1",
  );

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Presentation data-icon="inline-start" />
        <span className="hidden sm:inline">Modalità standup</span>
        <span className="sm:hidden">Standup</span>
      </Button>
      <StandupMode open={open} onClose={() => setOpen(false)} />
    </>
  );
}
