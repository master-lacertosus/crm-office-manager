"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, History, Plus } from "lucide-react";

import { applicaFiltri, leggiFiltri } from "@/lib/filtri";
import { dueUrgency, giornoLocale, todayIso } from "@/lib/format";
import { updateSearch } from "@/lib/shallow-nav";
import { useAppStore } from "@/lib/store";
import { confrontaPerScadenza } from "@/lib/ordine";
import type { Task, TaskEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PriorityBadge } from "@/components/priority-badge";
import { SearchLink } from "@/components/search-link";
import { Button } from "@/components/ui/button";

const MONTH_FMT = new Intl.DateTimeFormat("it-IT", { month: "long" });
const DAY_TITLE_FMT = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];


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

/**
 * Calendario mensile — revisione premium: chip con barretta di stato,
 * «oggi» a cerchio pieno, weekend tinteggiato, «+» rapido su ogni giorno
 * (crea un task già datato). Le scadenze si spostano trascinando.
 */
/**
 * Che cosa conta come «attivita' svolta».
 *
 * Prima era il solo `status_changed`, e una giornata passata a riassegnare
 * lavoro e spostare consegne risultava vuota. Restano fuori `archived` e
 * `restored`: sono manutenzione dell'archivio, non lavoro fatto.
 */
const TIPI_ATTIVITA = new Set<TaskEvent["type"]>([
  "created",
  "status_changed",
  "due_changed",
  "owner_changed",
]);

export function CalendarView() {
  const { tasks: tuttiITask, events, rescheduleTask, statuses, currentUser } =
    useAppStore();
  const searchParams = useSearchParams();

  /* Lo stesso filtro di Board ed Elenco, letto dallo stesso `?owner=`: il
     calendario era l'unica vista che mostrava sempre tutti, e per sapere
     cosa aveva in mano un collega bisognava tornare indietro. Il
     predefinito segue il ruolo, quindi un dipendente apre il proprio mese
     e un responsabile quello del team. */
  const tasks = React.useMemo(
    () =>
      applicaFiltri(
        tuttiITask,
        leggiFiltri(new URLSearchParams(searchParams), currentUser),
      ),
    [tuttiITask, searchParams, currentUser],
  );
  const metaByKey = new Map(statuses.map((m) => [m.key, m]));
  const statusColor = (key: string) =>
    metaByKey.get(key)?.color ?? "#64748B";
  /** L'etichetta di una fase, per il riepilogo dell'attività svolta. */
  const statusLabelOf = (key: string | null | undefined) =>
    metaByKey.get(key ?? "")?.label ?? key ?? "—";

  const now = new Date();
  const [cursor, setCursor] = React.useState({
    y: now.getFullYear(),
    m: now.getMonth(),
  });
  const today = todayIso();
  const cells = buildCells(cursor.y, cursor.m);

  const byDay = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.due_date || task.archived_at) continue;
    const list = byDay.get(task.due_date) ?? [];
    list.push(task);
    byDay.set(task.due_date, list);
  }
  const unscheduled = tasks.filter(
    (t) => !t.due_date && t.status !== "done" && !t.archived_at,
  );

  /*
   * Cosa e' successo, giorno per giorno.
   *
   * Il calendario diceva cosa SCADE. La domanda di Riccardo era un'altra:
   * cosa e' stato FATTO. Sono due informazioni diverse e servono
   * entrambe — una guarda avanti, l'altra indietro.
   *
   * Si registrano da soli i movimenti, che sono gia' eventi veri: nessuno
   * deve ricordarsi di segnare niente, ed e' il motivo per cui una CTA
   * «segna nel calendario» sarebbe rimasta inutilizzata — chi lavora non si
   * ferma a compilare. I commenti no: sono conversazione, e riversarli qui
   * dentro trasformerebbe il mese in un registro illeggibile.
   *
   * ACCESO di partenza, e la scelta vive nell'indirizzo come ogni altro
   * filtro di vista. Prima era spento a ogni apertura e non si ricordava
   * niente: la funzione c'era, ma per vederla bisognava sapere che
   * esisteva, trovare un pulsante di testo grigio in fondo a destra, e
   * rifare il gesto a ogni visita. Ora un calendario «con l'attivita'» si
   * manda anche a un collega, e lui vede la stessa cosa.
   */
  const mostraAttivita = searchParams.get("attivita") !== "0";

  const attivitaPerGiorno = React.useMemo(() => {
    const mappa = new Map<string, TaskEvent[]>();
    if (!mostraAttivita) return mappa;
    /* Gli eventi seguono gli STESSI filtri dei task. Prima no: la griglia
       nascondeva i lavori di un collega filtrato via, ma li contava
       nell'attivita' — due insiemi diversi nella stessa cella, e un
       dettaglio che diceva «un task» perche' quel task non era piu' nella
       lista da cercare. */
    const visibili = new Set(tasks.map((t) => t.id));
    for (const ev of events) {
      if (!TIPI_ATTIVITA.has(ev.type)) continue;
      if (!visibili.has(ev.task_id)) continue;
      /* Giorno LOCALE, non UTC: un lavoro chiuso a Roma dopo le 22 finiva
         nella casella del giorno prima. */
      const giorno = giornoLocale(ev.created_at);
      const lista = mappa.get(giorno) ?? [];
      lista.push(ev);
      mappa.set(giorno, lista);
    }
    return mappa;
  }, [events, mostraAttivita, tasks]);

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

  const quickAdd = (iso: string) => {
    updateSearch({ task: "new", due: iso });
  };

  const Chip = ({ task }: { task: Task }) => {
    const overdue =
      task.status !== "done" &&
      task.due_date !== null &&
      dueUrgency(task.due_date).level === "overdue";
    return (
      <SearchLink
        params={{ task: task.id }}
        draggable={false}
        onPointerDown={(e) => onChipPointerDown(e, task)}
        onClickCapture={(e) => {
          if (suppressClickRef.current) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        className={cn(
          "flex cursor-grab items-center gap-1.5 rounded-lg border border-border bg-card py-1 pr-2 pl-1.5 shadow-xs outline-none transition-transform hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-ring",
          overdue && "border-destructive/40 bg-danger-soft",
          task.status === "done" && "opacity-55",
          drag?.task.id === task.id && "opacity-30",
        )}
      >
        <span
          aria-hidden
          className="h-3.5 w-[3px] shrink-0 rounded-full"
          style={{ background: statusColor(task.status) }}
        />
        {task.priority === "high" ? (
          <PriorityBadge iconOnly className="size-3.5 rounded-[4px]" />
        ) : null}
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[12px]/[16px] font-semibold",
            overdue ? "text-danger-text" : "text-ink",
            task.status === "done" && "text-ink-muted line-through",
          )}
        >
          {task.title}
        </span>
      </SearchLink>
    );
  };

  const monthName = MONTH_FMT.format(new Date(cursor.y, cursor.m, 1));

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-4 sm:px-6">
      {/* Intestazione mese */}
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold tracking-[-0.015em] text-ink">
          <span className="capitalize">{monthName}</span>{" "}
          <span className="font-semibold text-ink-muted">{cursor.y}</span>
        </h2>
        <div className="ml-auto flex items-center gap-1.5">
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
            size="sm"
            onClick={() =>
              setCursor({ y: now.getFullYear(), m: now.getMonth() })
            }
          >
            Oggi
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
        </div>
      </div>

      {/* Griglia mensile */}
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() =>
            updateSearch(
              { attivita: mostraAttivita ? "0" : null },
              { replace: true },
            )
          }
          aria-pressed={mostraAttivita}
          title="Mostra cosa è stato fatto, oltre a cosa scade"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
            mostraAttivita
              ? "bg-brand-50 text-brand-700"
              : "text-ink-secondary hover:bg-accent hover:text-ink",
          )}
        >
          <History aria-hidden className="size-3.5" />
          {mostraAttivita ? "Attivita' svolta" : "Mostra l'attivita' svolta"}
        </button>
      </div>
      <div className="card-soft overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border-soft bg-[#fafbfd]">
          {WEEKDAYS.map((d, i) => (
            <p
              key={d}
              className={cn(
                "py-2.5 text-center text-[11px] font-bold tracking-[0.08em] uppercase",
                i >= 5 ? "text-ink-faint" : "text-ink-muted",
              )}
            >
              {d}
            </p>
          ))}
        </div>
        <div ref={gridRef} className="grid grid-cols-7">
          {cells.map((cell, i) => {
            const dayTasks = (byDay.get(cell.iso) ?? []).sort(
              confrontaPerScadenza,
            );
            const isToday = cell.iso === today;
            const isTarget = drag?.target === cell.iso;
            const weekend = i % 7 >= 5;
            return (
              <div
                key={cell.iso}
                data-day={cell.iso}
                className={cn(
                  "group min-h-28 space-y-1.5 border-b border-border-soft p-2 transition-colors",
                  i % 7 !== 0 && "border-l",
                  i >= 35 && "border-b-0",
                  !cell.inMonth && "bg-[#fafbfd]",
                  weekend && cell.inMonth && "bg-[#fbfcfe]",
                  isToday && "bg-brand-50/45",
                  isTarget && "bg-brand-50",
                )}
              >
                <div className="flex items-center justify-between">
                  <p
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full text-[12px] font-bold",
                      isToday
                        ? "btn-glow text-white"
                        : cell.inMonth
                          ? "text-ink-secondary"
                          : "text-ink-faint",
                    )}
                  >
                    {cell.day}
                  </p>
                  <button
                    type="button"
                    onClick={() => quickAdd(cell.iso)}
                    aria-label={`Nuovo task ${DAY_TITLE_FMT.format(new Date(cell.iso))}`}
                    className="flex size-5 items-center justify-center rounded-md text-brand-600 opacity-0 outline-none transition-opacity group-hover:opacity-100 hover:bg-brand-50 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                {dayTasks.slice(0, 3).map((task) => (
                  <Chip key={task.id} task={task} />
                ))}
                {dayTasks.length > 3 ? (
                  <p
                    className="px-1 text-[11px] font-semibold text-ink-muted"
                    title={dayTasks
                      .slice(3)
                      .map((t) => t.title)
                      .join(" · ")}
                  >
                    +{dayTasks.length - 3} altri
                  </p>
                ) : null}

                {/* Cosa e' stato fatto quel giorno. Sta in fondo alla
                    cella e in tono minore: e' un consuntivo, non un
                    impegno, e non deve competere con le scadenze. */}
                {(() => {
                  const svolte = attivitaPerGiorno.get(cell.iso);
                  if (!svolte || svolte.length === 0) return null;
                  const conclusi = svolte.filter((e) => e.to === "done").length;
                  const altri = svolte.length - conclusi;
                  /* Il dettaglio stava tutto dentro un `title`, cioè solo
                     al passaggio del mouse e mai su un telefono: chi non ha
                     un puntatore leggeva «3 movimenti» e finiva lì. Ora la
                     prima riga si legge scritta, e il resto si conta. */
                  const prima = svolte[0];
                  const titoloPrima = tasks.find(
                    (x) => x.id === prima.task_id,
                  )?.title;
                  /* Che cosa è successo, a parole. «Packaging: In corso →
                     Fatto» dice in una riga quello che «3 movimenti» non
                     diceva affatto. */
                  const cosa =
                    prima.type === "status_changed"
                      ? `${statusLabelOf(prima.from)} → ${statusLabelOf(prima.to)}`
                      : prima.type === "created"
                        ? "creato"
                        : prima.type === "due_changed"
                          ? "scadenza spostata"
                          : "cambio responsabile";
                  return (
                    <div className="mt-1 border-t border-border-soft pt-1">
                      <p className="flex items-center gap-1 text-[11px] text-ink-muted">
                        <History aria-hidden className="size-3 shrink-0" />
                        {conclusi > 0 ? (
                          <span className="font-semibold text-success-text">
                            {conclusi} chius{conclusi === 1 ? "o" : "i"}
                          </span>
                        ) : null}
                        {conclusi > 0 && altri > 0 ? " · " : null}
                        {altri > 0
                          ? `${altri} movimento${altri === 1 ? "" : "i"}`
                          : null}
                      </p>
                      {titoloPrima ? (
                        <p className="mt-0.5 truncate text-[11px] text-ink-faint">
                          <span className="text-ink-muted">{titoloPrima}</span>
                          {": "}
                          {cosa}
                          {svolte.length > 1 ? ` +${svolte.length - 1}` : ""}
                        </p>
                      ) : null}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>

      {/* Senza scadenza: bersaglio per togliere la data */}
      <div
        ref={stripRef}
        className={cn(
          "card-soft rounded-2xl p-3.5 transition-colors",
          drag?.target === "none" && "bg-brand-50",
        )}
      >
        <p className="text-[11px] font-bold tracking-[0.06em] text-ink-muted uppercase">
          Senza scadenza
          <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full border border-border px-1.5 font-mono text-[11px] font-normal">
            {unscheduled.length}
          </span>
        </p>
        {unscheduled.length === 0 ? (
          <p className="mt-2 text-[13px] text-ink-muted">
            Tutto pianificato. Trascina qui un task per togliergli la data.
          </p>
        ) : (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {unscheduled.map((task) => (
              <div key={task.id} className="max-w-60">
                <Chip task={task} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ghost del drag */}
      {drag ? (
        <div
          className="pointer-events-none fixed z-50 max-w-56"
          style={{ left: drag.x + 10, top: drag.y + 6 }}
        >
          <div className="glass-strong flex items-center gap-1.5 rounded-lg px-2 py-1.5 shadow-sm">
            <span
              aria-hidden
              className="h-3.5 w-[3px] shrink-0 rounded-full"
              style={{ background: statusColor(drag.task.status) }}
            />
            <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink">
              {drag.task.title}
            </span>
          </div>
        </div>
      ) : null}

      <p className="text-[13px] text-ink-muted">
        Trascina un task su un giorno per spostarne la scadenza · «+» crea un
        task già datato · da tastiera resta il campo «Scadenza» nel pannello.
      </p>
    </div>
  );
}
