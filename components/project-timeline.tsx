"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { addDaysIso, diffIsoDays, formatDue, shiftIsoDays, todayIso } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StatusPip } from "@/components/status-pip";

const DAY_W = 28;
const PAST_DAYS = 10;
const FUTURE_DAYS = 25;


interface DragState {
  taskId: string;
  daysDelta: number;
  newDue: string;
}

/**
 * Timeline di progetto (mini-Gantt): barra da creazione a scadenza,
 * trascinala in orizzontale per spostare la scadenza (snap sul giorno).
 */
export function ProjectTimeline({ projectId }: { projectId: string }) {
  const { tasks, rescheduleTask, statuses } = useAppStore();
  const metaByKey = new Map(statuses.map((m) => [m.key, m]));
  const router = useRouter();
  const today = todayIso();
  const start = addDaysIso(-PAST_DAYS);
  const totalDays = PAST_DAYS + FUTURE_DAYS + 1;

  const rows = tasks
    .filter((t) => t.project_id === projectId && t.due_date)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  const unscheduled = tasks.filter(
    (t) => t.project_id === projectId && !t.due_date && t.status !== "done",
  );

  const suppressClickRef = React.useRef(false);
  const [drag, setDrag] = React.useState<DragState | null>(null);
  const dragRef = React.useRef<DragState | null>(null);
  React.useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  const onBarPointerDown = (e: React.PointerEvent, task: Task) => {
    if (e.button !== 0 || e.pointerType === "touch" || !task.due_date) return;
    const startX = e.clientX;
    const due = task.due_date;
    let started = false;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (!started && Math.abs(dx) < 5) return;
      if (!started) {
        started = true;
        suppressClickRef.current = true;
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
      }
      const daysDelta = Math.round(dx / DAY_W);
      setDrag({ taskId: task.id, daysDelta, newDue: shiftIsoDays(due, daysDelta) });
    };

    const finish = (commit: boolean) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      const current = dragRef.current;
      if (commit && started && current && current.daysDelta !== 0) {
        rescheduleTask(current.taskId, current.newDue);
      }
      setDrag(null);
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    };

    const onUp = () => finish(true);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") finish(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);
  };

  const days = Array.from({ length: totalDays }, (_, i) => shiftIsoDays(start, i));
  const todayX = diffIsoDays(start, today) * DAY_W;

  return (
    <div className="flex-1 space-y-4 px-4 py-4 sm:px-6">
      <div className="card-soft overflow-x-auto">
        <div style={{ minWidth: 180 + totalDays * DAY_W }}>
          {/* intestazione giorni */}
          <div className="flex border-b border-border-soft">
            <div className="w-[180px] shrink-0 px-3 py-2 text-[10px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
              Task
            </div>
            <div className="relative flex">
              {days.map((iso, i) => {
                const weekend = new Date(iso).getDay() % 6 === 0;
                return (
                  <div
                    key={iso}
                    style={{ width: DAY_W }}
                    className={cn(
                      "border-l border-border-soft py-2 text-center font-mono text-[9px]",
                      iso === today
                        ? "font-semibold text-brand-700"
                        : weekend
                          ? "text-ink-faint"
                          : "text-ink-muted",
                    )}
                  >
                    {i % 2 === 0 ? iso.slice(8) : ""}
                  </div>
                );
              })}
            </div>
          </div>

          {/* righe */}
          {rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-ink-muted">
              Nessun task con scadenza in questo progetto.
            </p>
          ) : (
            rows.map((task) => {
              const due = task.due_date as string;
              const isDragging = drag?.taskId === task.id;
              const shownDue = isDragging ? (drag?.newDue ?? due) : due;
              const startIdx = Math.max(
                0,
                diffIsoDays(start, task.created_at.slice(0, 10)),
              );
              const endIdx = Math.min(
                totalDays - 1,
                Math.max(startIdx, diffIsoDays(start, shownDue)),
              );
              const visible = diffIsoDays(start, shownDue) >= 0;
              return (
                <div
                  key={task.id}
                  className="flex border-b border-border-soft last:border-b-0"
                >
                  <div className="flex w-[180px] shrink-0 items-center gap-2 px-3 py-2">
                    <StatusPip status={task.status} className="size-3.5" />
                    <p
                      className={cn(
                        "truncate text-[12px] font-medium text-ink",
                        task.status === "done" && "text-ink-muted line-through",
                      )}
                    >
                      {task.title}
                    </p>
                  </div>
                  <div
                    className="relative"
                    style={{ width: totalDays * DAY_W, height: 40 }}
                  >
                    {/* linea di oggi */}
                    <span
                      aria-hidden
                      className="absolute top-0 bottom-0 w-px bg-brand-500/60"
                      style={{ left: todayX }}
                    />
                    {visible ? (
                      <button
                        onPointerDown={(e) => onBarPointerDown(e, task)}
                        onClickCapture={(e) => {
                          if (suppressClickRef.current) {
                            e.preventDefault();
                            e.stopPropagation();
                          }
                        }}
                        onClick={() =>
                          router.push(`/projects/${projectId}?view=timeline&task=${task.id}`, { scroll: false })
                        }
                        title={`${task.title} — scadenza ${formatDue(shownDue)}`}
                        className={cn(
                          "absolute top-1.5 flex h-7 cursor-grab items-center rounded-lg border-l-[3px] px-2 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring",
                          isDragging && "shadow-sm",
                          task.status === "done" && "opacity-60",
                        )}
                        style={{
                          left: startIdx * DAY_W + 2,
                          width: Math.max(DAY_W, (endIdx - startIdx + 1) * DAY_W - 4),
                          background: metaByKey.get(task.status)?.soft ?? "#F1F5F9",
                          borderLeftColor:
                            metaByKey.get(task.status)?.color ?? "#64748B",
                        }}
                      >
                        <span
                          className={cn(
                            "truncate text-[11px] font-medium",
                            task.status !== "done" && shownDue < today
                              ? "text-danger-text"
                              : "text-ink",
                          )}
                        >
                          {formatDue(shownDue)}
                        </span>
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {drag ? (
        <p className="font-mono text-xs text-brand-700">
          Nuova scadenza: {formatDue(drag.newDue)}
          {drag.daysDelta !== 0
            ? ` (${drag.daysDelta > 0 ? "+" : ""}${drag.daysDelta} g)`
            : ""}
        </p>
      ) : (
        <p className="text-[13px] text-ink-muted">
          Trascina una barra per spostare la scadenza · la linea arancio è
          oggi · click apre il task.
        </p>
      )}

      {unscheduled.length > 0 ? (
        <div className="card-soft rounded-2xl p-3">
          <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
            Senza scadenza · {unscheduled.length}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            {unscheduled.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1.5">
                <StatusPip status={t.status} className="size-3.5" />
                <span className="text-[12px] text-ink-secondary">{t.title}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
