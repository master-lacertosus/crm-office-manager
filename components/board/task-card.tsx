"use client";

import { ListChecks, Repeat, Split } from "lucide-react";

import { useAppStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CasellaSelezione } from "@/components/casella-selezione";
import { dueUrgency } from "@/lib/format";
import { AvatarInitials } from "@/components/avatar-initials";
import { DueChip } from "@/components/due-chip";
import { SearchLink } from "@/components/search-link";
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
        urgency === "overdue" &&
          "border-destructive/35 shadow-[0_6px_18px_-6px_rgb(217_45_32/0.25)]",
        urgency === "today" && "border-brand-300",
        urgency !== "overdue" &&
          urgency !== "today" &&
          task.priority === "high" &&
          "border-[#F59E0B]/60 shadow-[0_6px_18px_-6px_rgb(245_158_11/0.3)]",
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
          <LavoroPadreChip task={task} />
          <ChecklistChip task={task} />
          {task.repeat !== "none" ? (
            <Repeat
              aria-label="Ricorrente"
              className="size-3 shrink-0 text-ink-muted"
              strokeWidth={2}
            />
          ) : null}
        </span>
        {owner ? (
          <AvatarInitials
            name={owner.full_name}
            src={owner.avatar_url}
            size="sm"
          />
        ) : null}
      </div>
    </div>
  );
}

/** Avanzamento checklist («2/4»), verde quando completa. */
/** Etichetta del lavoro padre: un pezzo sulla board deve dire di cosa fa
 *  parte, altrimenti «Montaggio» da solo non significa niente. */
function LavoroPadreChip({ task }: { task: Task }) {
  const { tasks } = useAppStore();
  if (!task.parent_id) return null;
  const padre = tasks.find((t) => t.id === task.parent_id);
  if (!padre) return null;
  return (
    <span
      title={`Pezzo di «${padre.title}»`}
      className="inline-flex min-w-0 max-w-[9rem] items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-ink-muted"
    >
      <Split aria-hidden className="size-2.5 shrink-0" />
      <span className="truncate">{padre.title}</span>
    </span>
  );
}

export function ChecklistChip({ task }: { task: Task }) {
  const items = task.checklist ?? [];
  if (items.length === 0) return null;
  const done = items.filter((i) => i.done).length;
  const complete = done === items.length;
  return (
    <span
      title={`Checklist: ${done} su ${items.length}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 font-mono text-xs",
        complete ? "text-success" : "text-ink-muted",
      )}
    >
      <ListChecks aria-hidden className="size-3" strokeWidth={2} />
      {done}/{items.length}
    </span>
  );
}

/** Card della board: click (o Invio) apre il pannello laterale. */
export function TaskCard({
  task,
  suppressClickRef,
  selected = false,
}: {
  task: Task;
  suppressClickRef?: React.RefObject<boolean>;
  /** Selezione da tastiera (frecce sulla board). */
  selected?: boolean;
}) {
  return (
    <SearchLink
      params={{ task: task.id }}
      draggable={false}
      onClickCapture={(e) => {
        if (suppressClickRef?.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      className={cn(
        "group/task relative block rounded-xl outline-none transition-transform duration-150 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        selected &&
          "ring-2 ring-brand-500 ring-offset-2 ring-offset-canvas",
      )}
    >
      {/* In alto a sinistra, sopra la scheda: non ruba spazio al contenuto
          e sta dove l'occhio cerca una casella. */}
      <CasellaSelezione
        taskId={task.id}
        className="absolute top-2 left-2 z-10"
      />
      <CardVisual task={task} />
    </SearchLink>
  );
}
