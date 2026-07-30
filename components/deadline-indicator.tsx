"use client";

import Link from "next/link";
import { AlarmClockMinus, Clock } from "lucide-react";

import { dueUrgency } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Promemoria personale in topbar, presente su OGNI pagina: quante delle
 * TUE task sono in ritardo o scadono oggi. Sparisce quando sei in pari.
 */
export function DeadlineIndicator() {
  const { tasks, currentUser } = useAppStore();

  let overdue = 0;
  let today = 0;
  for (const t of tasks) {
    if (t.owner_id !== currentUser.id || t.status === "done" || !t.due_date) {
      continue;
    }
    const { level } = dueUrgency(t.due_date);
    if (level === "overdue") overdue += 1;
    else if (level === "today") today += 1;
  }
  const total = overdue + today;
  if (total === 0) return null;

  const parts = [
    overdue > 0 ? `${overdue} in ritardo` : null,
    today > 0 ? `${today} scad${today === 1 ? "e" : "ono"} oggi` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const Icon = overdue > 0 ? AlarmClockMinus : Clock;

  return (
    <Link
      href={`/tasks?owner=${currentUser.id}&view=list`}
      title={`Le tue scadenze: ${parts}`}
      aria-label={`Le tue scadenze: ${parts}`}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-bold outline-none transition-transform hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        overdue > 0
          ? "bg-danger-soft text-danger-text"
          : "bg-status-review-soft text-status-review-text",
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {total}
    </Link>
  );
}
