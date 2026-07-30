"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Star } from "lucide-react";

import { dueTone, formatDue } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AvatarInitials } from "@/components/avatar-initials";
import { StatusPip } from "@/components/status-pip";
import { Badge } from "@/components/ui/badge";

/** Riga di task per le liste della dashboard: click apre il pannello. */
export function TaskRow({
  task,
  showOwner = false,
  focusable = false,
}: {
  task: Task;
  showOwner?: boolean;
  /** Mostra la stella per aggiungere/togliere dal Focus di oggi (max 3). */
  focusable?: boolean;
}) {
  const { profiles, projects, focusIds, toggleFocus } = useAppStore();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const owner = profiles.find((p) => p.id === task.owner_id);
  const project = projects.find((p) => p.id === task.project_id);
  const tone = task.due_date ? dueTone(task.due_date) : null;

  const params = new URLSearchParams(searchParams);
  params.set("task", task.id);

  return (
    <Link
      href={`${pathname}?${params.toString()}`}
      scroll={false}
      className="flex h-11 items-center gap-3 rounded-lg px-2.5 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      <StatusPip status={task.status} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
        {task.title}
      </span>
      {project ? (
        <Badge className="hidden sm:inline-flex">{project.name}</Badge>
      ) : null}
      {task.due_date ? (
        <span
          className={cn(
            "font-mono text-xs",
            tone === "overdue" && task.status !== "done"
              ? "font-medium text-danger-text"
              : tone === "today"
                ? "font-medium text-brand-700"
                : "text-ink-muted",
          )}
        >
          {formatDue(task.due_date)}
        </span>
      ) : null}
      {showOwner && owner ? (
        <AvatarInitials name={owner.full_name} size="sm" />
      ) : null}
      {focusable ? (
        <button
          type="button"
          aria-label={
            focusIds.includes(task.id)
              ? "Togli dal focus di oggi"
              : "Aggiungi al focus di oggi"
          }
          aria-pressed={focusIds.includes(task.id)}
          disabled={!focusIds.includes(task.id) && focusIds.length >= 3}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFocus(task.id);
          }}
          className="rounded-sm p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-35"
        >
          <Star
            className={cn(
              "size-4 transition-colors",
              focusIds.includes(task.id)
                ? "fill-brand-500 text-brand-500"
                : "text-ink-faint hover:text-brand-600",
            )}
          />
        </button>
      ) : null}
    </Link>
  );
}
