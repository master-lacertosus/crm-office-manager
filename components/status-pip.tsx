import { cn } from "@/lib/utils";

/**
 * La tacca di stato — firma visiva del sistema (docs/design-system.md §0).
 * Una ghiera che si riempie con l'avanzare del lavoro: la forma cambia a
 * ogni stato, quindi il colore non è mai l'unico canale informativo.
 * Etichette provvisorie in italiano (decisioni D4/D6 in docs/architecture.md).
 */

export type TaskStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "done";

export const TASK_STATUSES: Record<
  TaskStatus,
  { label: string; textClass: string }
> = {
  backlog: { label: "Backlog", textClass: "text-ink-muted" },
  todo: { label: "Da fare", textClass: "text-ink" },
  in_progress: { label: "In corso", textClass: "text-ink" },
  in_review: { label: "In revisione", textClass: "text-brand-700" },
  done: { label: "Fatto", textClass: "text-success-text" },
};

export function StatusPip({
  status,
  className,
}: {
  status: TaskStatus;
  className?: string;
}) {
  const common = {
    cx: 8,
    cy: 8,
    r: 6.25,
    fill: "none",
    strokeWidth: 1.5,
  } as const;

  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={cn("size-4 shrink-0", className)}
    >
      {status === "backlog" && (
        <circle
          {...common}
          stroke="var(--status-backlog)"
          strokeDasharray="2.6 2.3"
          strokeLinecap="round"
        />
      )}
      {status === "todo" && (
        <circle {...common} stroke="var(--status-todo)" />
      )}
      {status === "in_progress" && (
        <>
          <circle {...common} stroke="var(--status-progress)" />
          {/* metà destra piena: il lavoro è a metà ghiera */}
          <path
            d="M 8 1.75 A 6.25 6.25 0 0 1 8 14.25 Z"
            fill="var(--status-progress)"
          />
        </>
      )}
      {status === "in_review" && (
        <>
          <circle {...common} stroke="var(--status-review)" />
          <circle cx={8} cy={8} r={2.75} fill="var(--status-review)" />
        </>
      )}
      {status === "done" && (
        <>
          <circle cx={8} cy={8} r={7} fill="var(--status-done)" />
          <path
            d="M 4.9 8.2 L 7.1 10.4 L 11.2 5.9"
            fill="none"
            stroke="#ffffff"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}

/** Tacca + etichetta, la coppia usata in board, liste e pannello. */
export function StatusLabel({
  status,
  className,
}: {
  status: TaskStatus;
  className?: string;
}) {
  const meta = TASK_STATUSES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[13px]/[18px] font-medium",
        meta.textClass,
        className,
      )}
    >
      <StatusPip status={status} />
      {meta.label}
    </span>
  );
}
