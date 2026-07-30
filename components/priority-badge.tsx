"use client";

import { ArrowUp } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Priorità Alta — evidenza sistematica: badge ambra pieno con freccia.
 * `iconOnly` per i contesti compatti (chip calendario, righe standup).
 * Ink su ambra #F59E0B: contrasto ~9:1.
 */
export function PriorityBadge({
  iconOnly = false,
  className,
}: {
  iconOnly?: boolean;
  className?: string;
}) {
  if (iconOnly) {
    return (
      <span
        title="Priorità alta"
        aria-label="Priorità alta"
        className={cn(
          "inline-flex size-4 shrink-0 items-center justify-center rounded-[5px] bg-[#F59E0B]",
          className,
        )}
      >
        <ArrowUp className="size-3 text-[#161B26]" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-0.5 rounded-md bg-[#F59E0B] pr-1.5 pl-1 text-[11px] font-bold text-[#161B26]",
        className,
      )}
    >
      <ArrowUp className="size-3" strokeWidth={3} />
      Alta
    </span>
  );
}
