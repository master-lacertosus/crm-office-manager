"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { LayoutGroup, motion } from "motion/react";

import { useAppStore } from "@/lib/store";
import { STATUS_ORDER, type Task, type TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StatusPip, TASK_STATUSES } from "@/components/status-pip";
import { CardVisual, TaskCard } from "@/components/board/task-card";

/**
 * Board con drag-and-drop artigianale (pointer events, zero dipendenze):
 * ghost che segue il puntatore con rotazione di 1.5° (docs/design-system §5),
 * indicatore arancio di inserimento, colonna bersaglio evidenziata, reflow
 * animato via Motion layout. Il drag è attivo per mouse e penna; da touch e
 * tastiera lo stato si cambia dal pannello del task (percorso accessibile).
 * Scorciatoia: «/» porta al filtro responsabile.
 */

interface DragState {
  task: Task;
  width: number;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  target: TaskStatus;
  insertIndex: number;
}

const DRAG_THRESHOLD = 6;

export function Board({ projectId }: { projectId?: string }) {
  const { tasks, moveTask } = useAppStore();
  const searchParams = useSearchParams();

  const ownerFilter = searchParams.get("owner");
  const projectFilter = projectId ?? searchParams.get("project");

  const visible = tasks.filter((task) => {
    if (ownerFilter && task.owner_id !== ownerFilter) return false;
    if (projectFilter && task.project_id !== projectFilter) return false;
    return true;
  });

  const byStatus = React.useMemo(() => {
    const map = new Map<TaskStatus, Task[]>();
    for (const status of STATUS_ORDER) {
      map.set(
        status,
        visible
          .filter((t) => t.status === status)
          .sort((a, b) => a.position - b.position),
      );
    }
    return map;
  }, [visible]);

  const columnRefs = React.useRef(new Map<TaskStatus, HTMLElement>());
  const suppressClickRef = React.useRef(false);
  const [drag, setDrag] = React.useState<DragState | null>(null);
  const dragRef = React.useRef<DragState | null>(null);
  React.useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  /* «/» → filtro responsabile */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (e.key === "/" && !["input", "textarea", "select"].includes(tag)) {
        e.preventDefault();
        document.getElementById("filter-owner")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hitTest = React.useCallback(
    (clientX: number, clientY: number, dragged: Task) => {
      let target: TaskStatus = dragged.status;
      for (const [status, el] of columnRefs.current) {
        const rect = el.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right) {
          target = status;
          break;
        }
      }
      const columnEl = columnRefs.current.get(target);
      let insertIndex = 0;
      if (columnEl) {
        const cards = Array.from(
          columnEl.querySelectorAll<HTMLElement>("[data-card-id]"),
        ).filter((el) => el.dataset.cardId !== dragged.id);
        insertIndex = cards.length;
        for (let i = 0; i < cards.length; i++) {
          const r = cards[i].getBoundingClientRect();
          if (clientY < r.top + r.height / 2) {
            insertIndex = i;
            break;
          }
        }
      }
      return { target, insertIndex };
    },
    [],
  );

  const onCardPointerDown = (e: React.PointerEvent, task: Task) => {
    if (e.button !== 0 || e.pointerType === "touch") return;
    const wrapper = e.currentTarget as HTMLElement;
    const rect = wrapper.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY };
    let started = false;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (!started && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

      if (!started) {
        started = true;
        suppressClickRef.current = true;
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
      }
      const { target, insertIndex } = hitTest(ev.clientX, ev.clientY, task);
      setDrag({
        task,
        width: rect.width,
        x: ev.clientX,
        y: ev.clientY,
        offsetX: start.x - rect.left,
        offsetY: start.y - rect.top,
        target,
        insertIndex,
      });
    };

    const finish = (commit: boolean) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      const current = dragRef.current;
      if (commit && started && current) {
        const targetTasks = (byStatusRef.current.get(current.target) ?? []).filter(
          (t) => t.id !== current.task.id,
        );
        let position: number;
        if (targetTasks.length === 0) {
          position = current.task.position;
        } else if (current.insertIndex <= 0) {
          position = targetTasks[0].position - 1;
        } else if (current.insertIndex >= targetTasks.length) {
          position = targetTasks[targetTasks.length - 1].position + 1;
        } else {
          position =
            (targetTasks[current.insertIndex - 1].position +
              targetTasks[current.insertIndex].position) /
            2;
        }
        moveTask(current.task.id, current.target, position);
      }
      setDrag(null);
      // il click parte dopo il pointerup: si libera al tick successivo
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

  /* snapshot per il calcolo della posizione al rilascio */
  const byStatusRef = React.useRef(byStatus);
  React.useEffect(() => {
    byStatusRef.current = byStatus;
  }, [byStatus]);

  return (
    <LayoutGroup>
      <div className="relative flex flex-1 snap-x snap-mandatory gap-4 overflow-x-auto px-4 py-4 sm:px-6">
        {STATUS_ORDER.map((status) => (
          <Column
            key={status}
            status={status}
            tasks={byStatus.get(status) ?? []}
            drag={drag}
            registerRef={(el) => {
              if (el) columnRefs.current.set(status, el);
              else columnRefs.current.delete(status);
            }}
            onCardPointerDown={onCardPointerDown}
            suppressClickRef={suppressClickRef}
          />
        ))}

        {/* ghost del drag: segue il puntatore, ruotato di 1.5° */}
        {drag ? (
          <div
            className="pointer-events-none fixed z-50"
            style={{
              left: drag.x - drag.offsetX,
              top: drag.y - drag.offsetY,
              width: drag.width,
            }}
          >
            <motion.div
              initial={{ rotate: 0, scale: 1 }}
              animate={{ rotate: 1.5, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
            >
              <CardVisual task={drag.task} className="shadow-sm" />
            </motion.div>
          </div>
        ) : null}
      </div>
    </LayoutGroup>
  );
}

function Column({
  status,
  tasks,
  drag,
  registerRef,
  onCardPointerDown,
  suppressClickRef,
}: {
  status: TaskStatus;
  tasks: Task[];
  drag: DragState | null;
  registerRef: (el: HTMLElement | null) => void;
  onCardPointerDown: (e: React.PointerEvent, task: Task) => void;
  suppressClickRef: React.RefObject<boolean>;
}) {
  const meta = TASK_STATUSES[status];
  const isTarget = drag?.target === status;
  const display = drag ? tasks.filter((t) => t.id !== drag.task.id) : tasks;

  const items: React.ReactNode[] = [];
  display.forEach((task, index) => {
    if (isTarget && drag && drag.insertIndex === index) {
      items.push(<InsertLine key="insert" />);
    }
    items.push(
      <motion.div
        key={task.id}
        layout
        layoutId={task.id}
        data-card-id={task.id}
        onPointerDown={(e) => onCardPointerDown(e, task)}
        className="cursor-grab touch-pan-x touch-pan-y"
        transition={{ layout: { duration: 0.18, ease: [0.2, 0, 0, 1] } }}
      >
        <TaskCard task={task} suppressClickRef={suppressClickRef} />
      </motion.div>,
    );
  });
  if (isTarget && drag && drag.insertIndex >= display.length) {
    items.push(<InsertLine key="insert" />);
  }

  return (
    <section
      ref={registerRef}
      aria-label={meta.label}
      className="flex w-[280px] shrink-0 snap-start flex-col lg:w-auto lg:flex-1 lg:basis-0"
    >
      <header className="flex items-center gap-2 px-1 pb-2.5">
        <StatusPip status={status} />
        <h2 className="text-[11px] font-semibold tracking-[0.06em] text-ink-secondary uppercase">
          {meta.label}
        </h2>
        <span className="font-mono text-xs text-ink-muted">{tasks.length}</span>
      </header>
      <div
        className={cn(
          "flex flex-1 flex-col gap-2 rounded-xl p-1 transition-colors",
          isTarget && "bg-brand-50/60 outline-1 outline-brand-300/70",
        )}
      >
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-[13px] text-ink-faint">
            Nessun task
          </p>
        ) : (
          items
        )}
      </div>
    </section>
  );
}

function InsertLine() {
  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-1 h-0.5 rounded-full bg-brand-500"
    />
  );
}
