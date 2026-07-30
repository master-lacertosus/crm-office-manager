"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { dueUrgency, todayIso } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const MONTH_FMT = new Intl.DateTimeFormat("it-IT", {
  month: "long",
  year: "numeric",
});
const WEEKDAYS = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];

const STATUS_DOT: Record<Task["status"], string> = {
  backlog: "var(--status-backlog)",
  todo: "var(--status-todo)",
  in_progress: "var(--status-progress)",
  in_review: "var(--status-review)",
  done: "var(--status-done)",
};

interface Cell {
  iso: string;
  day: number;
  inMonth: boolean;
}

function buildCells(year: number, month: number): Cell[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // settimana che inizia lunedì
  const cells: Cell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 - offset + i);
    cells.push({
      iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      day: d.getDate(),
      inMonth: d.getMonth() === month,
    });
  }
  return cells;
}

interface DragState {
  task: Task;
  x: number;
  y: number;
  target: string | null; // iso del giorno, "none" per la striscia senza data
}

/** Calendario mensile: le scadenze si spostano trascinando i task sui giorni. */
export function CalendarView() {
  const { tasks, rescheduleTask } = useAppStore();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const now = new Date();
  const [cursor, setCursor] = React.useState({
    y: now.getFullYear(),
    m: now.getMonth(),
  });
  const today = todayIso();
  const cells = buildCells(cursor.y, cursor.m);

  const byDay = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.due_date) continue;
    const list = byDay.get(task.due_date) ?? [];
    list.push(task);
    byDay.set(task.due_date, list);
  }
  const unscheduled = tasks.filter((t) => !t.due_date && t.status !== "done");

  const gridRef = React.useRef<HTMLDivElement>(null);
  const stripRef = React.useRef<HTMLDivElement>(null);
  const suppressClickRef = React.useRef(false);
  const [drag, setDrag] = React.useState<DragState | null>(null);
  const dragRef = React.useRef<DragState | null>(null);
  React.useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  const onChipPointerDown = (e: React.PointerEvent, task: Task) => {
    if (e.button !== 0 || e.pointerType === "touch") return;
    const start = { x: e.clientX, y: e.clientY };
    let started = false;

    const hitTest = (x: number, y: number): string | null => {
      if (stripRef.current) {
        const r = stripRef.current.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          return "none";
        }
      }
      const dayEls =
        gridRef.current?.querySelectorAll<HTMLElement>("[data-day]") ?? [];
      for (const el of dayEls) {
        const r = el.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          return el.dataset.day ?? null;
        }
      }
      return null;
    };

    const onMove = (ev: PointerEvent) => {
      if (
        !started &&
        Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 6
      ) {
        return;
      }
      if (!started) {
        started = true;
        suppressClickRef.current = true;
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
      }
      setDrag({
        task,
        x: ev.clientX,
        y: ev.clientY,
        target: hitTest(ev.clientX, ev.clientY),
      });
    };

    const finish = (commit: boolean) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      const current = dragRef.current;
      if (commit && started && current?.target) {
        rescheduleTask(
          current.task.id,
          current.target === "none" ? null : current.target,
        );
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

  const chipHref = (task: Task) => {
    const params = new URLSearchParams(searchParams);
    params.set("task", task.id);
    return `${pathname}?${params.toString()}`;
  };

  const Chip = ({ task }: { task: Task }) => (
    <Link
      href={chipHref(task)}
      scroll={false}
      draggable={false}
      onPointerDown={(e) => onChipPointerDown(e, task)}
      onClickCapture={(e) => {
        if (suppressClickRef.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      className={cn(
        "flex cursor-grab items-center gap-1.5 rounded-md bg-white/75 px-1.5 py-1 outline-none backdrop-blur-sm transition-transform hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-ring",
        task.status === "done" && "opacity-55",
        task.status !== "done" &&
          task.due_date &&
          dueUrgency(task.due_date).level === "overdue" &&
          "ring-1 ring-destructive/50",
        drag?.task.id === task.id && "opacity-30",
      )}
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: STATUS_DOT[task.status] }}
      />
      <span
        className={cn(
          "truncate text-[11px]/[14px] font-medium text-ink",
          task.status === "done" && "line-through",
        )}
      >
        {task.title}
      </span>
    </Link>
  );

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-4 sm:px-6">
      {/* Navigazione mese */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Mese precedente"
          onClick={() =>
            setCursor(({ y, m }) =>
              m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 },
            )
          }
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Mese successivo"
          onClick={() =>
            setCursor(({ y, m }) =>
              m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 },
            )
          }
        >
          <ChevronRight />
        </Button>
        <h2 className="text-[17px]/6 font-semibold tracking-[-0.008em] text-ink first-letter:uppercase">
          {MONTH_FMT.format(new Date(cursor.y, cursor.m, 1))}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => setCursor({ y: now.getFullYear(), m: now.getMonth() })}
        >
          Oggi
        </Button>
      </div>

      {/* Griglia mensile */}
      <div className="card-soft overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border-soft">
          {WEEKDAYS.map((d) => (
            <p
              key={d}
              className="px-2 py-2 text-center text-[10px] font-semibold tracking-[0.06em] text-ink-muted uppercase"
            >
              {d}
            </p>
          ))}
        </div>
        <div ref={gridRef} className="grid grid-cols-7">
          {cells.map((cell, i) => {
            const dayTasks = (byDay.get(cell.iso) ?? []).sort(
              (a, b) => a.position - b.position,
            );
            const isToday = cell.iso === today;
            const isTarget = drag?.target === cell.iso;
            const weekend = i % 7 >= 5;
            return (
              <div
                key={cell.iso}
                data-day={cell.iso}
                className={cn(
                  "min-h-24 space-y-1 border-b border-border-soft p-1.5 transition-colors",
                  i % 7 !== 0 && "border-l",
                  i >= 35 && "border-b-0",
                  !cell.inMonth && "bg-black/[0.015]",
                  weekend && cell.inMonth && "bg-black/[0.01]",
                  isTarget && "bg-brand-50/80",
                )}
              >
                <p
                  className={cn(
                    "inline-flex size-5 items-center justify-center rounded-full font-mono text-[11px]",
                    isToday
                      ? "btn-glow font-semibold text-primary-foreground"
                      : cell.inMonth
                        ? "text-ink-secondary"
                        : "text-ink-faint",
                  )}
                >
                  {cell.day}
                </p>
                {dayTasks.slice(0, 3).map((task) => (
                  <Chip key={task.id} task={task} />
                ))}
                {dayTasks.length > 3 ? (
                  <p
                    className="px-1 font-mono text-[10px] text-ink-muted"
                    title={dayTasks
                      .slice(3)
                      .map((t) => t.title)
                      .join(" · ")}
                  >
                    +{dayTasks.length - 3}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Senza scadenza: bersaglio per togliere la data */}
      <div
        ref={stripRef}
        className={cn(
          "card-soft rounded-2xl p-3 transition-colors",
          drag?.target === "none" && "bg-brand-50/80",
        )}
      >
        <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
          Senza scadenza · {unscheduled.length}
        </p>
        {unscheduled.length === 0 ? (
          <p className="mt-1.5 text-[13px] text-ink-muted">
            Tutto pianificato. Trascina qui un task per togliergli la data.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {unscheduled.map((task) => (
              <div key={task.id} className="max-w-56">
                <Chip task={task} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ghost del drag */}
      {drag ? (
        <div
          className="pointer-events-none fixed z-50 max-w-52"
          style={{ left: drag.x + 10, top: drag.y + 6 }}
        >
          <div className="glass-strong flex items-center gap-1.5 rounded-md px-2 py-1.5 shadow-sm">
            <span
              aria-hidden
              className="size-1.5 shrink-0 rounded-full"
              style={{ background: STATUS_DOT[drag.task.status] }}
            />
            <span className="truncate text-[11px] font-medium text-ink">
              {drag.task.title}
            </span>
          </div>
        </div>
      ) : null}

      <p className="text-[13px] text-ink-muted">
        Trascina un task su un giorno per spostarne la scadenza (da tastiera:
        campo «Scadenza» nel pannello del task).
      </p>
    </div>
  );
}
