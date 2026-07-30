"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { Repeat } from "lucide-react";

import { useAppStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { dueUrgency } from "@/lib/format";
import { AvatarInitials } from "@/components/avatar-initials";
import { DueChip } from "@/components/due-chip";
import { PriorityBadge } from "@/components/priority-badge";
import { useStatusMeta } from "@/components/status-pip";
import { Badge } from "@/components/ui/badge";

/** Contenuto visuale puro della card: usato dalla card reale e dal ghost del drag. */
export function CardVisual({
  task,
  className,
}: {
  task: Task;
  className?: string;
}) {
  const { profiles, projects } = useAppStore();
  const statusMeta = useStatusMeta(task.status);
  const owner = profiles.find((p) => p.id === task.owner_id);
  const project = projects.find((p) => p.id === task.project_id);

  const urgency =
    task.due_date && task.status !== "done"
      ? dueUrgency(task.due_date).level
      : null;

  return (
    <div
      className={cn(
        "card-soft relative rounded-2xl p-3 pl-4",
        urgency === "overdue" && "border-destructive/35",
        urgency === "today" && "border-brand-300",
        urgency !== "overdue" &&
          urgency !== "today" &&
          task.priority === "high" &&
          "border-[#F59E0B]/60",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-2.5 left-1.5 w-[3px] rounded-full"
        style={{ background: statusMeta.color }}
      />
      <p className="text-sm/5 font-medium text-ink">{task.title}</p>
      {(project || task.priority === "high") && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {project ? <Badge>{project.name}</Badge> : null}
          {task.priority === "high" ? <PriorityBadge /> : null}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <DueChip iso={task.due_date} status={task.status} />
          {task.repeat !== "none" ? (
            <Repeat
              aria-label="Ricorrente"
              className="size-3 shrink-0 text-ink-muted"
              strokeWidth={2}
            />
          ) : null}
        </span>
        {owner ? <AvatarInitials name={owner.full_name} size="sm" /> : null}
      </div>
    </div>
  );
}

/** Card della board: click (o Invio) apre il pannello laterale. */
export function TaskCard({
  task,
  suppressClickRef,
}: {
  task: Task;
  suppressClickRef?: React.RefObject<boolean>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const params = new URLSearchParams(searchParams);
  params.set("task", task.id);

  return (
    <Link
      href={`${pathname}?${params.toString()}`}
      scroll={false}
      draggable={false}
      onClickCapture={(e) => {
        if (suppressClickRef?.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      className="block rounded-xl outline-none transition-transform duration-150 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      <CardVisual task={task} />
    </Link>
  );
}
