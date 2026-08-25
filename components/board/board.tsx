"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { LayoutGroup, motion, useMotionValue } from "motion/react";
import {
  Check,
  ChevronsLeftRight,
  ChevronsRightLeft,
  Plus,
  X,
} from "lucide-react";

import { updateSearch } from "@/lib/shallow-nav";
import { puoModificareTask } from "@/lib/permessi";
import { MAX_CUSTOM_STATUSES, useAppStore } from "@/lib/store";
import {
  CUSTOM_STATUS_PRESETS,
  type StatusMeta,
  type Task,
} from "@/lib/types";
import { usePreferenzaSincronizzata } from "@/lib/use-preferenza";
import { cn } from "@/lib/utils";
import { StatusPip } from "@/components/status-pip";
import { CardVisual, TaskCard } from "@/components/board/task-card";
import { useToast } from "@/components/toaster";
import { Button } from "@/components/ui/button";

/**
 * Board a corsie: ogni fase è una lane con fondo proprio (chiarezza),
 * fasi core + «Problema» + fino a 3 fasi custom aggiungibili in coda.
 * Drag-and-drop artigianale invariato; «/» va al filtro responsabile.
 * Ogni fase è comprimibile in una strip verticale (persistito per
 * utente): utile per le fasi vuote e per gli schermi stretti. Una strip
 * resta bersaglio valido del drag (il task entra in cima alla fase).
 */

interface DragState {
  task: Task;
  width: number;
  target: string;
  insertIndex: number;
}

const DRAG_THRESHOLD = 6;

const COLLAPSE_KEY = "board-collapsed-phases";

/** Fasi compresse: nel browser per applicarle subito, su Supabase per
 *  ritrovarle da un altro computer (`user_preferences.collapsed_statuses`). */
function useCollapsedPhases() {
  const [collapsed, setCollapsed] = React.useState<string[]>([]);

  usePreferenzaSincronizzata<string[]>(
    COLLAPSE_KEY,
    "collapsed_statuses",
    collapsed,
    setCollapsed,
    // Si accetta solo un elenco di stringhe: un valore corrotto o di una
    // versione precedente non deve rompere la board.
    (grezzo) =>
      Array.isArray(grezzo)
        ? grezzo.filter((k): k is string => typeof k === "string")
        : null,
  );

  const toggle = React.useCallback((key: string) => {
    setCollapsed((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }, []);
  return { collapsed, toggle };
}

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
  const toast = useToast();

  const ownerFilter = searchParams.get("owner");
  const projectFilter = projectId ?? searchParams.get("project");

  const byStatus = React.useMemo(() => {
    const visible = tasks.filter((task) => {
      if (task.archived_at) return false;
      if (ownerFilter && task.owner_id !== ownerFilter) return false;
      if (projectFilter && task.project_id !== projectFilter) return false;
      return true;
    });
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
  }, [tasks, ownerFilter, projectFilter, statuses]);

  const { collapsed, toggle: toggleCollapsed } = useCollapsedPhases();
  const collapsedRef = React.useRef(collapsed);
  React.useEffect(() => {
    collapsedRef.current = collapsed;
  }, [collapsed]);

  const columnRefs = React.useRef(new Map<string, HTMLElement>());
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const suppressClickRef = React.useRef(false);
  const [drag, setDrag] = React.useState<DragState | null>(null);
  const dragRef = React.useRef<DragState | null>(null);
  React.useEffect(() => {
    dragRef.current = drag;
  }, [drag]);
  /** Posizione del ghost: motion value scritti dal pointermove — il
   *  transform viaggia fuori da React, trascinare non re-renderizza. */
  const ghostX = useMotionValue(0);
  const ghostY = useMotionValue(0);
  /** Chiusura d'emergenza: se la board smonta a drag in corso, i listener
   *  globali e il loop di auto-scroll vengono comunque rilasciati. */
  const finishRef = React.useRef<(() => void) | null>(null);
  React.useEffect(() => () => finishRef.current?.(), []);

  /* «/» → filtro responsabile */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (e.key === "/" && !["input", "textarea", "select"].includes(tag)) {
        e.preventDefault();
        // Due istanze dei filtri (header su xl, sotto-barra sotto):
        // focalizza quella effettivamente visibile.
        ["bar-owner", "sub-owner"]
          .map((id) => document.getElementById(id))
          .find((el) => el && el.offsetParent !== null)
          ?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hitTest = React.useCallback(
    (clientX: number, clientY: number, dragged: Task) => {
      let target: string | null = null;
      for (const [status, el] of columnRefs.current) {
        const rect = el.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right) {
          target = status;
          break;
        }
      }
      // Sopra un vuoto (gap, lane «Nuova fase», oltre i bordi): la lane
      // valida più vicina, così il rilascio al bordo non si perde.
      if (!target) {
        target = dragged.status;
        let best = Infinity;
        for (const [status, el] of columnRefs.current) {
          const r = el.getBoundingClientRect();
          const d = Math.abs(clientX - (r.left + r.right) / 2);
          if (d < best) {
            best = d;
            target = status;
          }
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
    // Le schede altrui non si trascinano: lo spostamento sarebbe respinto
    // dal database, e la card tornerebbe indietro da sola.
    if (!puoModificareTask(task, currentUser)) return;
    const wrapper = e.currentTarget as HTMLElement;
    const rect = wrapper.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY };
    const pointer = { x: e.clientX, y: e.clientY };
    let started = false;
    let raf = 0;

    /* Auto-scroll ai bordi durante il drag: su schermi stretti le lane di
       destinazione (es. «Fatto») possono essere fuori vista — tenendo la
       card vicino al bordo la board scorre da sola. Verticale: la pagina.
       Velocità in px/s (indipendente dal frame rate). */
    const EDGE = 64;
    const SPEED = 900;
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    let lastTs = 0;
    const autoScroll = (ts: number) => {
      const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 0.016;
      lastTs = ts;
      let scrolled = false;
      const scroller = scrollRef.current;
      if (scroller && scroller.scrollWidth > scroller.clientWidth) {
        const r = scroller.getBoundingClientRect();
        let vx = 0;
        vx -= SPEED * dt * clamp01((r.left + EDGE - pointer.x) / EDGE);
        vx += SPEED * dt * clamp01((pointer.x - (r.right - EDGE)) / EDGE);
        if (vx !== 0) {
          const before = scroller.scrollLeft;
          scroller.scrollLeft = before + vx;
          if (scroller.scrollLeft !== before) scrolled = true;
        }
      }
      let vy = 0;
      vy -= SPEED * dt * clamp01((64 + EDGE - pointer.y) / EDGE); // 64 = topbar
      vy += SPEED * dt * clamp01((pointer.y - (window.innerHeight - EDGE)) / EDGE);
      if (vy !== 0) {
        const before = window.scrollY;
        window.scrollBy(0, vy);
        if (window.scrollY !== before) scrolled = true;
      }
      // le colonne scivolano sotto il puntatore fermo: ricalcola il target
      if (scrolled) syncLane(pointer.x, pointer.y);
      raf = requestAnimationFrame(autoScroll);
    };

    const offsetX = start.x - rect.left;
    const offsetY = start.y - rect.top;

    /** Aggiorna lane e punto di inserimento solo quando cambiano davvero. */
    const syncLane = (clientX: number, clientY: number) => {
      const { target, insertIndex } = hitTest(clientX, clientY, task);
      setDrag((d) =>
        d && d.target === target && d.insertIndex === insertIndex
          ? d
          : { task, width: rect.width, target, insertIndex },
      );
    };

    const onMove = (ev: PointerEvent) => {
      pointer.x = ev.clientX;
      pointer.y = ev.clientY;
      if (
        !started &&
        Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_THRESHOLD
      ) {
        return;
      }

      if (!started) {
        started = true;
        suppressClickRef.current = true;
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
        // lo scroll-snap combatterebbe con l'auto-scroll: sospeso nel drag
        if (scrollRef.current) scrollRef.current.style.scrollSnapType = "none";
        raf = requestAnimationFrame(autoScroll);
      }
      // Prima la lettura (hit test), poi la scrittura del transform — che
      // Motion applica fuori da React, coalescata al frame: trascinare non
      // re-renderizza finché non cambia la destinazione.
      syncLane(ev.clientX, ev.clientY);
      ghostX.set(ev.clientX - offsetX);
      ghostY.set(ev.clientY - offsetY);
    };

    const finish = (commit: boolean) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
      cancelAnimationFrame(raf);
      if (scrollRef.current) scrollRef.current.style.scrollSnapType = "";
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
        const revert = moveTask(current.task.id, current.target, position);
        if (revert) {
          const label =
            statuses.find((s) => s.key === current.target)?.label ??
            current.target;
          toast(`«${current.task.title}» → ${label}`, {
            action: { label: "Annulla", onClick: revert },
          });
        }
      }
      setDrag(null);
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
      finishRef.current = null;
    };

    const onUp = () => finish(true);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") finish(false);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);
    finishRef.current = () => finish(false);
  };

  /* Tastiera: frecce selezionano, Invio apre, Shift+←/→ sposta di fase. */
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const statusesRef = React.useRef(statuses);
  React.useEffect(() => {
    statusesRef.current = statuses;
  }, [statuses]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const arrows = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
      if (!arrows.includes(e.key) && e.key !== "Enter" && e.key !== "Escape")
        return;
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (["input", "textarea", "select"].includes(tag)) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (dragRef.current) return;

      const order = statusesRef.current.map((s) => s.key);
      const byLane = byStatusRef.current;
      // Le fasi compresse non mostrano card: la navigazione le salta.
      const hidden = new Set(collapsedRef.current);
      const findPos = (id: string | null) => {
        if (!id) return null;
        for (let li = 0; li < order.length; li++) {
          if (hidden.has(order[li])) continue;
          const idx = (byLane.get(order[li]) ?? []).findIndex(
            (t) => t.id === id,
          );
          if (idx >= 0) return { lane: li, idx };
        }
        return null;
      };

      if (e.key === "Escape") {
        setSelectedId(null);
        return;
      }

      const pos = findPos(selectedId);

      if (e.key === "Enter") {
        if (!selectedId || !pos) return;
        e.preventDefault();
        updateSearch({ task: selectedId });
        return;
      }

      e.preventDefault();

      // nessuna selezione: parte dalla prima card visibile
      if (!pos) {
        for (const key of order) {
          if (hidden.has(key)) continue;
          const first = (byLane.get(key) ?? [])[0];
          if (first) {
            setSelectedId(first.id);
            return;
          }
        }
        return;
      }

      const lane = byLane.get(order[pos.lane]) ?? [];
      const task = lane[pos.idx];

      // Shift+←/→: sposta il task nella fase adiacente (con Annulla)
      if (e.shiftKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        if (!task) return;
        // Stessa regola del trascinamento: le schede altrui non si spostano.
        if (!puoModificareTask(task, currentUser)) return;
        const dir = e.key === "ArrowLeft" ? -1 : 1;
        let targetLane = pos.lane + dir;
        while (
          targetLane >= 0 &&
          targetLane < order.length &&
          hidden.has(order[targetLane])
        ) {
          targetLane += dir;
        }
        if (targetLane < 0 || targetLane >= order.length) return;
        const target = order[targetLane];
        const targetTasks = (byLane.get(target) ?? []).filter(
          (t) => t.id !== task.id,
        );
        const last = targetTasks[targetTasks.length - 1];
        const revert = moveTask(
          task.id,
          target,
          last ? last.position + 1 : task.position,
        );
        if (revert) {
          const label =
            statusesRef.current.find((s) => s.key === target)?.label ?? target;
          toast(`«${task.title}» → ${label}`, {
            action: { label: "Annulla", onClick: revert },
          });
        }
        return;
      }

      // frecce semplici: sposta la selezione
      let next: Task | undefined;
      if (e.key === "ArrowUp") next = lane[Math.max(0, pos.idx - 1)];
      else if (e.key === "ArrowDown")
        next = lane[Math.min(lane.length - 1, pos.idx + 1)];
      else {
        const dir = e.key === "ArrowLeft" ? -1 : 1;
        for (
          let li = pos.lane + dir;
          li >= 0 && li < order.length;
          li += dir
        ) {
          if (hidden.has(order[li])) continue;
          const cand = byLane.get(order[li]) ?? [];
          if (cand.length > 0) {
            next = cand[Math.min(pos.idx, cand.length - 1)];
            break;
          }
        }
      }
      if (next) setSelectedId(next.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, moveTask, toast, currentUser]);

  /* La card selezionata resta in vista */
  React.useEffect(() => {
    if (!selectedId) return;
    document
      .querySelector(`[data-card-id="${selectedId}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedId]);

  const canAddPhase =
    currentUser.role === "admin" && customStatuses.length < MAX_CUSTOM_STATUSES;

  return (
    <LayoutGroup>
      <div
        ref={scrollRef}
        className="relative flex flex-1 snap-x snap-mandatory gap-3 overflow-x-auto px-4 py-4 sm:px-6"
      >
        {statuses.map((meta) => (
          <Column
            key={meta.key}
            meta={meta}
            tasks={byStatus.get(meta.key) ?? []}
            drag={drag}
            selectedId={selectedId}
            collapsed={collapsed.includes(meta.key)}
            onToggle={() => toggleCollapsed(meta.key)}
            registerRef={(el) => {
              if (el) columnRefs.current.set(meta.key, el);
              else columnRefs.current.delete(meta.key);
            }}
            onCardPointerDown={onCardPointerDown}
            suppressClickRef={suppressClickRef}
          />
        ))}

        {canAddPhase ? <AddPhaseLane onAdd={addCustomStatus} /> : null}

        {/* ghost del drag: x/y sono motion value scritti dal pointermove */}
        {drag ? (
          <motion.div
            className="pointer-events-none fixed top-0 left-0 z-50"
            style={{ x: ghostX, y: ghostY, width: drag.width }}
            initial={{ rotate: 0, scale: 1 }}
            animate={{ rotate: 1.5, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
          >
            <CardVisual task={drag.task} className="shadow-sm" />
          </motion.div>
        ) : null}
      </div>
    </LayoutGroup>
  );
}

function Column({
  meta,
  tasks,
  drag,
  selectedId,
  collapsed,
  onToggle,
  registerRef,
  onCardPointerDown,
  suppressClickRef,
}: {
  meta: StatusMeta;
  tasks: Task[];
  drag: DragState | null;
  selectedId: string | null;
  collapsed: boolean;
  onToggle: () => void;
  registerRef: (el: HTMLElement | null) => void;
  onCardPointerDown: (e: React.PointerEvent, task: Task) => void;
  suppressClickRef: React.RefObject<boolean>;
}) {
  const isTarget = drag?.target === meta.key;

  /* Fase compressa: strip verticale. Resta registrata per l'hit-test del
     drag (rilasciarci sopra sposta il task in cima alla fase) e si riapre
     con un click ovunque. */
  if (collapsed) {
    return (
      <section
        ref={registerRef}
        aria-label={meta.label}
        className={cn(
          "flex w-11 shrink-0 snap-start flex-col rounded-2xl p-1 shadow-[inset_0_1px_0_rgb(255_255_255/0.65)] transition-[background,box-shadow]",
          meta.kind === "alert" ? "bg-[#FEF2F2]/80" : "bg-[#EDF1F7]/70",
          isTarget &&
            "bg-brand-50 ring-1 ring-brand-300/70 shadow-[inset_0_1px_0_rgb(255_255_255/0.65),0_10px_34px_-10px_rgb(255_107_0/0.4)]",
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={false}
          aria-label={`Espandi fase ${meta.label}`}
          title={`Espandi «${meta.label}»`}
          className="flex flex-1 flex-col items-center gap-2.5 rounded-xl pt-2.5 pb-2 outline-none transition-colors hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <StatusPip status={meta.key} className="size-3.5" />
          <span
            className={cn(
              "font-mono text-xs",
              tasks.length === 0 ? "text-ink-faint" : "text-ink-muted",
            )}
          >
            {tasks.length}
          </span>
          <span
            className="text-[11px] font-bold tracking-[0.05em] uppercase [writing-mode:vertical-rl]"
            style={{ color: meta.text }}
          >
            {meta.label}
          </span>
          <ChevronsLeftRight
            aria-hidden
            className="mt-auto size-3.5 text-ink-faint"
          />
        </button>
      </section>
    );
  }

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
        <TaskCard
          task={task}
          suppressClickRef={suppressClickRef}
          selected={task.id === selectedId}
        />
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
        "flex w-[290px] shrink-0 snap-start flex-col rounded-2xl p-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.65)] transition-[background,box-shadow]",
        meta.kind === "alert" ? "bg-[#FEF2F2]/80" : "bg-[#EDF1F7]/70",
        isTarget &&
          "bg-brand-50 ring-1 ring-brand-300/70 shadow-[inset_0_1px_0_rgb(255_255_255/0.65),0_10px_34px_-10px_rgb(255_107_0/0.4)]",
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
        <button
          type="button"
          onClick={onToggle}
          aria-expanded
          aria-label={`Comprimi fase ${meta.label}`}
          title={`Comprimi «${meta.label}»`}
          className="ml-auto rounded-md p-1 text-ink-faint outline-none transition-colors hover:bg-white/60 hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronsRightLeft aria-hidden className="size-3.5" />
        </button>
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
