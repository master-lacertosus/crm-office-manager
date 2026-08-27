"use client";

import { Star } from "lucide-react";

import { useAppStore } from "@/lib/store";
import { CasellaSelezione } from "@/components/casella-selezione";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AvatarInitials } from "@/components/avatar-initials";
import { DueChip } from "@/components/due-chip";
import { PriorityBadge } from "@/components/priority-badge";
import { SearchLink } from "@/components/search-link";
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

  const owner = profiles.find((p) => p.id === task.owner_id);
  const project = projects.find((p) => p.id === task.project_id);

  return (
    <SearchLink
      params={{ task: task.id }}
      className="group/task flex h-11 items-center gap-3 rounded-lg px-2.5 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      <CasellaSelezione taskId={task.id} />
      <StatusPip status={task.status} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
        {task.title}
      </span>
      {task.priority === "high" ? (
        <PriorityBadge className="hidden @[16rem]:inline-flex" />
      ) : null}
      {project ? (
        <Badge className="hidden min-w-0 shrink text-ellipsis @[22rem]:inline-flex">
          {project.name}
        </Badge>
      ) : null}
      <DueChip iso={task.due_date} status={task.status} />
      {showOwner && owner ? (
        <span className="hidden shrink-0 @[17rem]:inline-flex">
          <AvatarInitials
            name={owner.full_name}
            src={owner.avatar_url}
            size="sm"
          />
        </span>
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
    </SearchLink>
  );
}
