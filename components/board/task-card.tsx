"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { dueTone, formatDue } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AvatarInitials } from "@/components/avatar-initials";
import { Badge } from "@/components/ui/badge";

function DueDate({ task }: { task: Task }) {
  if (!task.due_date) return null;
  const tone = task.status === "done" ? "future" : dueTone(task.due_date);
  return (
    <span
      className={cn(
        "font-mono text-xs",
        tone === "overdue" && "font-medium text-danger-text",
        tone === "today" && "font-medium text-brand-700",
        tone === "future" && "text-ink-muted",
      )}
    >
      {tone === "overdue" ? "in ritardo · " : ""}
      {formatDue(task.due_date)}
    </span>
  );
}

/** Contenuto visuale puro della card: usato dalla card reale e dal ghost del drag. */
export function CardVisual({
  task,
  className,
}: {
  task: Task;
  className?: string;
}) {
  const { profiles, projects } = useAppStore();
  const owner = profiles.find((p) => p.id === task.owner_id);
  const project = projects.find((p) => p.id === task.project_id);

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-3 shadow-xs",
        className,
      )}
    >
      <p className="text-sm/5 font-medium text-ink">{task.title}</p>
      {(project || task.priority === "high") && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {project ? <Badge>{project.name}</Badge> : null}
          {task.priority === "high" ? (
            <Badge variant="warning">Alta</Badge>
          ) : null}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <DueDate task={task} />
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
      className="block rounded-xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas [&>div]:transition-colors [&>div]:hover:border-input"
    >
      <CardVisual task={task} />
    </Link>
  );
}
