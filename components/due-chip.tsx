"use client";

import { AlarmClockMinus, Clock } from "lucide-react";

import { dueUrgency, formatDue } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Chip di scadenza — il linguaggio UNICO dell'urgenza in tutta l'app:
 * rosso = in ritardo, arancio = scade oggi, ambra = imminente (≤2 giorni),
 * neutro = data semplice. I task fatti mostrano solo la data.
 */
export function DueChip({
  iso,
  status,
  className,
}: {
  iso: string | null;
  status: string;
  className?: string;
}) {
  if (!iso) return null;

  if (status === "done") {
    return (
      <span className={cn("font-mono text-xs text-ink-muted", className)}>
        {formatDue(iso)}
      </span>
    );
  }

  const { level, days } = dueUrgency(iso);

  if (level === "later") {
    return (
      <span
        title={`Scadenza: ${formatDue(iso)}`}
        className={cn("font-mono text-xs text-ink-muted", className)}
      >
        {formatDue(iso)}
      </span>
    );
  }

  const meta = {
    overdue: {
      icon: AlarmClockMinus,
      text: days === 1 ? "1 g di ritardo" : `${days} g di ritardo`,
      classes: "bg-danger-soft text-danger-text",
    },
    today: {
      icon: Clock,
      text: "scade oggi",
      classes: "bg-status-review-soft text-status-review-text",
    },
    soon: {
      icon: Clock,
      text: days === 1 ? "domani" : `tra ${days} giorni`,
      classes: "bg-warning-soft text-warning-text",
    },
  }[level];
  const Icon = meta.icon;

  return (
    <span
      title={`Scadenza: ${formatDue(iso)}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        meta.classes,
        className,
      )}
    >
      <Icon aria-hidden className="size-3" />
      {meta.text}
    </span>
  );
}

/** True se il task merita enfasi visiva extra (bordo, anello…). */
export function isUrgent(iso: string | null, status: string): boolean {
  if (!iso || status === "done") return false;
  const { level } = dueUrgency(iso);
  return level === "overdue" || level === "today";
}
