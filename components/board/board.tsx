"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { LayoutGroup, motion } from "motion/react";
import { Check, Plus, X } from "lucide-react";

import { MAX_CUSTOM_STATUSES, useAppStore } from "@/lib/store";
import {
  CUSTOM_STATUS_PRESETS,
  type StatusMeta,
  type Task,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { StatusPip } from "@/components/status-pip";
import { CardVisual, TaskCard } from "@/components/board/task-card";
import { Button } from "@/components/ui/button";

/**
 * Board a corsie: ogni fase è una lane con fondo proprio (chiarezza),
 * fasi core + «Problema» + fino a 3 fasi custom aggiungibili in coda.
 * Drag-and-drop artigianale invariato; «/» va al filtro responsabile.
 */

interface DragState {
  task: Task;
  width: number;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  target: string;
  insertIndex: number;
}

const DRAG_THRESHOLD = 6;

export function Board({ projectId }: { projectId?: string }) {
  const {
    tasks,
    moveTask,
    statuses,
    customStatuses,
    addCustomStatus,
    currentUser,
  } = useAppStore();
  const searchParams = useSearchParams();

  const ownerFilter = searchParams.get("owner");
  const projectFilter = projectId ?? searchParams.get("project");

  const visible = tasks.filter((task) => {
    if (ownerFilter && task.owner_id !== ownerFilter) return false;
    if (projectFilter && task.project_id !== projectFilter) return false;
    return true;
  });

  const byStatus = React.useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const meta of statuses) {
      map.set(
        meta.key,
        visible
          .filter((t) => t.status === meta.key)
          .sort((a, b) => a.position - b.position),
      );
    }
    return map;
  }, [visible, statuses]);

  const columnRefs = React.useRef(new Map<string, HTMLElement>());
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
      let target: string = dragged.status;
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

  const byStatusRef = React.useRef(byStatus);
  React.useEffect(() => {
    byStatusRef.current = byStatus;
  }, [byStatus]);

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
        const targetTasks = (
          byStatusRef.current.get(current.target) ?? []
        ).filter((t) => t.id !== current.task.id);
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

  const canAddPhase =
    currentUser.role === "admin" && customStatuses.length < MAX_CUSTOM_STATUSES;

  return (
    <LayoutGroup>
      <div className="relative flex flex-1 snap-x snap-mandatory gap-3 overflow-x-auto px-4 py-4 sm:px-6">
        {statuses.map((meta) => (
          <Column
            key={meta.key}
            meta={meta}
            tasks={byStatus.get(meta.key) ?? []}
            drag={drag}
            registerRef={(el) => {
              if (el) columnRefs.current.set(meta.key, el);
              else columnRefs.current.delete(meta.key);
            }}
            onCardPointerDown={onCardPointerDown}
            suppressClickRef={suppressClickRef}
          />
        ))}

        {canAddPhase ? <AddPhaseLane onAdd={addCustomStatus} /> : null}

        {/* ghost del drag */}
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
  meta,
  tasks,
  drag,
  registerRef,
  onCardPointerDown,
  suppressClickRef,
}: {
  meta: StatusMeta;
  tasks: Task[];
  drag: DragState | null;
  registerRef: (el: HTMLElement | null) => void;
  onCardPointerDown: (e: React.PointerEvent, task: Task) => void;
  suppressClickRef: React.RefObject<boolean>;
}) {
  const isTarget = drag?.target === meta.key;
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
      className={cn(
        "flex w-[290px] shrink-0 snap-start flex-col rounded-2xl p-2 transition-colors",
        meta.kind === "alert" ? "bg-[#FEF2F2]/80" : "bg-[#EDF1F7]/70",
        isTarget && "bg-brand-50 ring-1 ring-brand-300/70",
        "lg:w-auto lg:flex-1 lg:basis-0",
      )}
    >
      <header className="flex items-center gap-2 px-1.5 pt-1 pb-2.5">
        <span
          className="inline-flex items-center gap-1.5 rounded-lg py-1 pr-2.5 pl-2"
          style={{ background: meta.soft }}
        >
          <StatusPip status={meta.key} className="size-3.5" />
          <h2
            className="text-[11px] font-bold tracking-[0.05em] uppercase"
            style={{ color: meta.text }}
          >
            {meta.label}
          </h2>
        </span>
        <span className="font-mono text-xs text-ink-muted">{tasks.length}</span>
      </header>
      <div className="flex flex-1 flex-col gap-2">
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-white/40 px-3 py-6 text-center text-[13px] text-ink-faint">
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

/** Coda della board: aggiunta di una fase custom (solo admin, max 3). */
function AddPhaseLane({
  onAdd,
}: {
  onAdd: (label: string, presetIndex: number) => boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [label, setLabel] = React.useState("");
  const [preset, setPreset] = React.useState(0);

  const submit = () => {
    if (label.trim().length === 0) return;
    if (onAdd(label, preset)) {
      setLabel("");
      setPreset(0);
      setOpen(false);
    }
  };

  return (
    <section className="flex w-[220px] shrink-0 snap-start flex-col rounded-2xl border border-dashed border-border p-2">
      {open ? (
        <div className="space-y-2.5 p-1.5">
          <p className="text-[11px] font-bold tracking-[0.05em] text-ink-secondary uppercase">
            Nuova fase
          </p>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="Es. In stampa"
            autoFocus
            className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex items-center gap-1.5">
            {CUSTOM_STATUS_PRESETS.map((p, i) => (
              <button
                key={p.name}
                type="button"
                onClick={() => setPreset(i)}
                aria-label={`Colore ${p.name}`}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
                style={{ background: p.color }}
              >
                {preset === i ? (
                  <Check className="size-3.5 text-white" />
                ) : null}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" onClick={submit} disabled={!label.trim()}>
              Aggiungi
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setOpen(false)}
              aria-label="Annulla"
            >
              <X />
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl py-8 text-ink-muted outline-none transition-colors hover:bg-accent hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="size-4" />
          <span className="text-[12px] font-semibold">Nuova fase</span>
        </button>
      )}
    </section>
  );
}
