"use client";

import { cn } from "@/lib/utils";
import { CORE_STATUS_META, useAppStoreOptional } from "@/lib/store";
import type { StatusMeta, TaskStatus } from "@/lib/types";

/**
 * La tacca di stato — firma visiva del sistema. Ghiera che si riempie con
 * l'avanzare del lavoro; «Problema» è un triangolo, le fasi custom un
 * rombo nel loro colore. La forma cambia sempre: il colore non è mai
 * l'unico canale. Fuori dal provider (styleguide) risolve solo le core.
 */

export type { TaskStatus };

/** Compat per le viste core-only (styleguide). */
export const TASK_STATUSES: Record<
  TaskStatus,
  { label: string; textClass: string; softClass: string }
> = {
  backlog: { label: "Backlog", textClass: "text-status-backlog-text", softClass: "bg-status-backlog-soft" },
  todo: { label: "Da fare", textClass: "text-status-todo-text", softClass: "bg-status-todo-soft" },
  in_progress: { label: "In corso", textClass: "text-status-progress-text", softClass: "bg-status-progress-soft" },
  in_review: { label: "In revisione", textClass: "text-status-review-text", softClass: "bg-status-review-soft" },
  alert: { label: "Problema", textClass: "text-[#B91C1C]", softClass: "bg-[#FEE2E2]" },
  done: { label: "Fatto", textClass: "text-status-done-text", softClass: "bg-status-done-soft" },
};

/** Risolve i metadati di una fase (core, alert o custom). */
export function useStatusMeta(key: string): StatusMeta {
  const store = useAppStoreOptional();
  const custom = store?.customStatuses.find((c) => c.key === key);
  if (custom) return { ...custom, kind: "custom" };
  const core = CORE_STATUS_META[key] ?? CORE_STATUS_META.todo;
  return { key, ...core };
}

export function StatusPip({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const meta = useStatusMeta(status);
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
          stroke={meta.color}
          strokeDasharray="2.6 2.3"
          strokeLinecap="round"
        />
      )}
      {status === "todo" && <circle {...common} stroke={meta.color} />}
      {status === "in_progress" && (
        <>
          <circle {...common} stroke={meta.color} />
          <path
            d="M 8 1.75 A 6.25 6.25 0 0 1 8 14.25 Z"
            fill={meta.color}
          />
        </>
      )}
      {status === "in_review" && (
        <>
          <circle {...common} stroke="#D97706" />
          <circle cx={8} cy={8} r={2.75} fill="#D97706" />
        </>
      )}
      {status === "alert" && (
        <>
          <path
            d="M8 2.4 L14.2 13.1 H1.8 Z"
            fill={meta.color}
            stroke={meta.color}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <rect x="7.3" y="6.1" width="1.4" height="3.6" rx="0.7" fill="#fff" />
          <circle cx="8" cy="11.4" r="0.95" fill="#fff" />
        </>
      )}
      {status === "done" && (
        <>
          <circle cx={8} cy={8} r={7} fill={meta.color} />
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
      {meta.kind === "custom" && (
        <rect
          x="3.6"
          y="3.6"
          width="8.8"
          height="8.8"
          rx="2.2"
          fill={meta.color}
          transform="rotate(45 8 8)"
        />
      )}
    </svg>
  );
}

/** Tacca + etichetta, la coppia usata in board, liste e pannello. */
export function StatusLabel({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const meta = useStatusMeta(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[13px]/[18px] font-semibold",
        className,
      )}
      style={{ color: meta.text }}
    >
      <StatusPip status={status} />
      {meta.label}
    </span>
  );
}
