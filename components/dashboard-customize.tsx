"use client";

import * as React from "react";
import {
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  BLOCK_META,
  FULL_SPAN,
  SIZE_COLS,
  SIZE_ORDER,
  SIZE_SPAN,
  type DashboardBlockId,
  type DashboardBlockSize,
  type DashboardBlockState,
} from "@/lib/dashboard-layout";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Drag & drop dei blocchi: puntatore libero sulla griglia, il blocco  */
/* sotto il cursore è il bersaglio; al rilascio l'ordine cambia e la   */
/* FLIP di Motion accompagna tutti al posto nuovo.                     */
/* ------------------------------------------------------------------ */

export interface DashboardDnd {
  draggingId: DashboardBlockId | null;
  overId: DashboardBlockId | null;
  registerItem: (
    id: DashboardBlockId,
  ) => (el: HTMLDivElement | null) => void;
  begin: (id: DashboardBlockId) => void;
  update: (id: DashboardBlockId, point: { x: number; y: number }) => void;
  end: (id: DashboardBlockId) => void;
}

export function useDashboardDnd(
  onDrop: (id: DashboardBlockId, overId: DashboardBlockId) => void,
): DashboardDnd {
  const items = React.useRef(new Map<DashboardBlockId, HTMLDivElement>());
  const [draggingId, setDraggingId] = React.useState<DashboardBlockId | null>(
    null,
  );
  const [overId, setOverId] = React.useState<DashboardBlockId | null>(null);
  const overRef = React.useRef<DashboardBlockId | null>(null);
  const onDropRef = React.useRef(onDrop);
  React.useEffect(() => {
    onDropRef.current = onDrop;
  });

  const registerItem = React.useCallback(
    (id: DashboardBlockId) => (el: HTMLDivElement | null) => {
      if (el) items.current.set(id, el);
      else items.current.delete(id);
    },
    [],
  );

  const begin = React.useCallback((id: DashboardBlockId) => {
    overRef.current = null;
    setOverId(null);
    setDraggingId(id);
  }, []);

  const update = React.useCallback(
    (id: DashboardBlockId, point: { x: number; y: number }) => {
      // info.point è in coordinate di pagina; i rect sono di viewport.
      const px = point.x - window.scrollX;
      const py = point.y - window.scrollY;
      let found: DashboardBlockId | null = null;
      for (const [candidate, el] of items.current) {
        if (candidate === id) continue;
        const r = el.getBoundingClientRect();
        if (
          px >= r.left - 4 &&
          px <= r.right + 4 &&
          py >= r.top - 4 &&
          py <= r.bottom + 4
        ) {
          found = candidate;
          break;
        }
      }
      if (overRef.current !== found) {
        overRef.current = found;
        setOverId(found);
      }
    },
    [],
  );

  const end = React.useCallback((id: DashboardBlockId) => {
    const target = overRef.current;
    overRef.current = null;
    setOverId(null);
    setDraggingId(null);
    if (target && target !== id) onDropRef.current(id, target);
  }, []);

  return { draggingId, overId, registerItem, begin, update, end };
}

/* ------------------------------------------------------------------ */
/* Guscio di un blocco: col-span dal preset, chrome di editing         */
/* (cornice, toolbar, maniglia, bordo di resize a scatto).             */
/* ------------------------------------------------------------------ */

const TOOL_BTN =
  "flex size-6 items-center justify-center rounded-full text-ink-secondary outline-none transition-colors hover:bg-surface-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";

export function DashboardBlockShell({
  block,
  index,
  count,
  editing,
  dragging,
  isOver,
  registerItem,
  onDragBegin,
  onDragUpdate,
  onDragFinish,
  onMove,
  onSize,
  onToggleVisible,
  children,
}: {
  block: DashboardBlockState;
  index: number;
  count: number;
  editing: boolean;
  dragging: boolean;
  isOver: boolean;
  registerItem: (
    id: DashboardBlockId,
  ) => (el: HTMLDivElement | null) => void;
  onDragBegin: (id: DashboardBlockId) => void;
  onDragUpdate: (id: DashboardBlockId, point: { x: number; y: number }) => void;
  onDragFinish: (id: DashboardBlockId) => void;
  onMove: (id: DashboardBlockId, delta: -1 | 1) => void;
  onSize: (id: DashboardBlockId, size: DashboardBlockSize) => void;
  onToggleVisible: (id: DashboardBlockId) => void;
  children: React.ReactNode;
}) {
  const meta = BLOCK_META[block.id];
  const reduced = useReducedMotion();
  const controls = useDragControls();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [resizing, setResizing] = React.useState(false);
  const shellRef = React.useRef<HTMLDivElement | null>(null);
  const sizeRef = React.useRef(block.size);
  React.useEffect(() => {
    sizeRef.current = block.size;
  }, [block.size]);

  const setRefs = (el: HTMLDivElement | null) => {
    shellRef.current = el;
    registerItem(block.id)(el);
  };

  /** Resize trascinando il bordo destro: scatta sul preset più vicino.
   *  Il genitore diretto del guscio È la griglia a 12 colonne. */
  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    if (meta.fullWidth) return;
    e.preventDefault();
    const shell = shellRef.current;
    const grid = shell?.parentElement;
    if (!grid || !shell) return;
    const colWidth = grid.getBoundingClientRect().width / 12;
    const left = shell.getBoundingClientRect().left;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    setResizing(true);
    const onMoveEv = (ev: PointerEvent) => {
      const cols = (ev.clientX - left) / colWidth;
      const nearest = SIZE_ORDER.reduce((best, s) =>
        Math.abs(SIZE_COLS[s] - cols) < Math.abs(SIZE_COLS[best] - cols)
          ? s
          : best,
      );
      if (nearest !== sizeRef.current) onSize(block.id, nearest);
    };
    const onUp = () => {
      target.removeEventListener("pointermove", onMoveEv);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
      setResizing(false);
    };
    target.addEventListener("pointermove", onMoveEv);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  };

  /** Percorso tastiera del drag (richiesto dal design system §10). */
  const onHandleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      onMove(block.id, -1);
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      onMove(block.id, 1);
    }
  };

  return (
    <motion.div
      ref={setRefs}
      layout={reduced ? false : "position"}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
      drag={editing}
      dragListener={false}
      dragControls={controls}
      dragMomentum={false}
      dragElastic={0.12}
      dragSnapToOrigin
      dragTransition={{ bounceStiffness: 420, bounceDamping: 32 }}
      whileDrag={{ rotate: 1, scale: 1.01 }}
      onDragStart={() => onDragBegin(block.id)}
      onDrag={(_e, info) => onDragUpdate(block.id, info.point)}
      onDragEnd={() => onDragFinish(block.id)}
      style={{ x, y }}
      className={cn(
        "relative min-w-0",
        meta.fullWidth ? FULL_SPAN : SIZE_SPAN[block.size],
        editing && "select-none",
        dragging ? "z-30" : "z-0",
        editing && !block.visible && "opacity-55",
      )}
    >
      {editing ? (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -inset-[5px] rounded-[24px] border-2 transition-colors",
            isOver
              ? "border-brand-500 bg-brand-50/60"
              : dragging
                ? "border-brand-300"
                : "border-dashed border-brand-300/70",
          )}
        />
      ) : null}

      <div
        inert={editing || undefined}
        className={cn("h-full", dragging && "rounded-[20px] shadow-sm")}
      >
        {children}
      </div>

      {editing ? (
        <motion.div
          initial={{ opacity: 0, y: 4, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.14, ease: [0.2, 0, 0, 1] }}
          className="glass absolute -top-3 right-4 z-20 flex items-center gap-0.5 rounded-full px-1.5 py-1 shadow-sm"
        >
          {/* Su mobile/tablet (una colonna) contano ordine e visibilità */}
          <span className="flex items-center gap-0.5 lg:hidden">
            <button
              type="button"
              className={TOOL_BTN}
              disabled={index === 0}
              onClick={() => onMove(block.id, -1)}
              aria-label={`Sposta su «${meta.title}»`}
            >
              <ChevronUp className="size-3.5" />
            </button>
            <button
              type="button"
              className={TOOL_BTN}
              disabled={index === count - 1}
              onClick={() => onMove(block.id, 1)}
              aria-label={`Sposta giù «${meta.title}»`}
            >
              <ChevronDown className="size-3.5" />
            </button>
            <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
          </span>

          {!meta.fullWidth ? (
            <span
              role="group"
              aria-label={`Larghezza di «${meta.title}»`}
              className="hidden items-center gap-0.5 lg:flex"
            >
              {SIZE_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={block.size === s}
                  aria-label={`Larghezza ${s}`}
                  onClick={() => onSize(block.id, s)}
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-[10px] font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    block.size === s
                      ? "bg-brand-500 text-ink"
                      : "text-ink-muted hover:bg-surface-hover hover:text-ink",
                  )}
                >
                  {s}
                </button>
              ))}
              <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
            </span>
          ) : null}

          <button
            type="button"
            className={TOOL_BTN}
            aria-pressed={!block.visible}
            aria-label={
              block.visible
                ? `Nascondi «${meta.title}»`
                : `Mostra «${meta.title}»`
            }
            onClick={() => onToggleVisible(block.id)}
          >
            {block.visible ? (
              <Eye className="size-3.5" />
            ) : (
              <EyeOff className="size-3.5" />
            )}
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              controls.start(e);
            }}
            onKeyDown={onHandleKeyDown}
            style={{ touchAction: "none" }}
            aria-label={`Sposta «${meta.title}» — frecce per riordinare`}
            className={cn(
              TOOL_BTN,
              "hidden cursor-grab active:cursor-grabbing lg:flex",
            )}
          >
            <GripVertical className="size-3.5" />
          </button>
        </motion.div>
      ) : null}

      {editing && !meta.fullWidth ? (
        <div
          aria-hidden
          onPointerDown={startResize}
          style={{ touchAction: "none" }}
          className="absolute inset-y-0 -right-2 z-20 hidden w-3 cursor-ew-resize items-center justify-center lg:flex"
        >
          <div
            className={cn(
              "h-14 w-1 rounded-full transition-colors",
              resizing
                ? "bg-brand-500"
                : "bg-brand-300/50 hover:bg-brand-400",
            )}
          />
        </div>
      ) : null}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Barra flottante della modalità Personalizza.                        */
/* ------------------------------------------------------------------ */

export function DashboardEditBar({
  customized,
  onReset,
  onDone,
}: {
  customized: boolean;
  onReset: () => void;
  onDone: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, x: "-50%" }}
      animate={{ opacity: 1, y: 0, x: "-50%" }}
      exit={{ opacity: 0, y: 16, x: "-50%" }}
      transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
      className="glass fixed bottom-5 left-1/2 z-40 flex items-center gap-1.5 rounded-full py-1.5 pr-1.5 pl-4 shadow-md print:hidden"
    >
      <p className="hidden pr-1 text-xs text-ink-secondary md:block">
        Trascina per riordinare · S–XL per la larghezza · occhio per nascondere
      </p>
      <Button
        variant="ghost"
        size="sm"
        onClick={onReset}
        disabled={!customized}
      >
        <RotateCcw data-icon="inline-start" />
        Ripristina
      </Button>
      <Button variant="secondary" size="sm" onClick={onDone}>
        <Check data-icon="inline-start" />
        Fine
      </Button>
    </motion.div>
  );
}
