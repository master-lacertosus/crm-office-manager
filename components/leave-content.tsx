"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Inbox,
  Plus,
  Send,
  TreePalm,
  X,
} from "lucide-react";

import { diffIsoDays, timeAgo, todayIso } from "@/lib/format";
import {
  closureOnDay,
  formatRange,
  leavesOnDay,
  rangeCovers,
  rangesOverlap,
  workingDaysCount,
} from "@/lib/leave";
import { updateSearch } from "@/lib/shallow-nav";
import { useAppStore } from "@/lib/store";
import {
  LEAVE_META,
  lavoraNelWeekend,
  type LeaveRequest,
  type LeaveType,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { AvatarInitials } from "@/components/avatar-initials";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented, SegmentedButton } from "@/components/ui/segmented";

/**
 * Ferie & Permessi: richiesta con approvazione dei responsabili e
 * calendario dell'ufficio (assenze approvate + chiusure aziendali).
 * Il form si apre col deep-link ?request=1 (topbar e palette).
 */

const MONTH_FMT = new Intl.DateTimeFormat("it-IT", { month: "long" });
const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

/** Fondo a righe delle chiusure: leggibile anche senza colore. */
const CLOSURE_STRIPES =
  "repeating-linear-gradient(135deg, #F1F4F8 0 6px, #E6EBF2 6px 12px)";

interface Cell {
  iso: string;
  day: number;
  inMonth: boolean;
}

// Stessa griglia lun-dom del calendario scadenze (calendar-view.tsx).
function buildCells(year: number, month: number): Cell[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
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

/** Azione della topbar: apre il form (shallow, senza round-trip). */
export function RequestLeaveButton() {
  return (
    <Button onClick={() => updateSearch({ request: "1" })}>
      <TreePalm data-icon="inline-start" />
      <span className="hidden sm:inline">Richiedi ferie/permesso</span>
      <span className="sm:hidden">Richiedi</span>
    </Button>
  );
}

function LeaveStatusChip({ status }: { status: LeaveRequest["status"] }) {
  const map = {
    pending: { label: "In attesa", cls: "bg-warning-soft text-warning-text" },
    approved: { label: "Approvata", cls: "bg-success-soft text-success-text" },
    rejected: { label: "Rifiutata", cls: "bg-danger-soft text-danger-text" },
  }[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        map.cls,
      )}
    >
      {map.label}
    </span>
  );
}

function TypeBadge({ type }: { type: LeaveType }) {
  const meta = LEAVE_META[type];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      style={{ background: meta.soft, color: meta.text }}
    >
      {meta.labelOne}
    </span>
  );
}

/** «12–16 ago · 9:00–13:00 (4 gg)» — riga descrittiva unica ovunque. */
function leaveDetail(l: LeaveRequest, days: number): string {
  const range = formatRange(l.start_date, l.end_date);
  if (l.type === "permesso" && l.time_range) return `${range} · ${l.time_range}`;
  return `${range} (${days} gg lavorativ${days === 1 ? "o" : "i"})`;
}

/* ------------------------------------------------------------------ */
/* Form di richiesta                                                    */
/* ------------------------------------------------------------------ */

function LeaveForm() {
  const { createLeave, leaves, closures, profiles, currentUser } =
    useAppStore();
  const toast = useToast();
  const today = todayIso();
  const [type, setType] = React.useState<LeaveType>("ferie");
  const [start, setStart] = React.useState(today);
  const [end, setEnd] = React.useState(today);
  const [timeRange, setTimeRange] = React.useState("");
  const [note, setNote] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const close = () => updateSearch({ request: null }, { replace: true });

  // Il permesso è di un giorno solo; le ferie hanno l'intervallo.
  const effEnd = type === "permesso" ? start : end < start ? start : end;
  const days = workingDaysCount(
    start,
    effEnd,
    closures,
    lavoraNelWeekend(currentUser.role),
  );

  // Sovrapposizione con proprie richieste vive (in attesa o approvate).
  const overlap = leaves.find(
    (l) =>
      l.requester_id === currentUser.id &&
      l.status !== "rejected" &&
      rangesOverlap(start, effEnd, l.start_date, l.end_date),
  );

  // Chi altro è già fuori in quei giorni: informazione, non blocco.
  const othersAway = [
    ...new Set(
      leaves
        .filter(
          (l) =>
            l.requester_id !== currentUser.id &&
            l.status === "approved" &&
            rangesOverlap(start, effEnd, l.start_date, l.end_date),
        )
        .map(
          (l) =>
            profiles.find((p) => p.id === l.requester_id)?.full_name.split(
              " ",
            )[0] ?? "?",
        ),
    ),
  ];

  const canSend = !overlap && days > 0 && !sending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    setSending(true);
    await createLeave({
      type,
      start_date: start,
      end_date: effEnd,
      time_range: type === "permesso" && timeRange.trim() ? timeRange.trim() : null,
      note,
    });
    setSending(false);
    setNote("");
    setTimeRange("");
    toast("Richiesta inviata: i responsabili sono stati avvisati.");
    close();
  };

  return (
    <form onSubmit={submit} className="card-soft space-y-3 p-4">
      <div className="flex items-center gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.05em] text-ink-secondary uppercase">
          <TreePalm aria-hidden className="size-3.5 text-brand-600" />
          Nuova richiesta
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={close}
          aria-label="Chiudi il form"
          className="ml-auto"
        >
          <X />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Segmented aria-label="Tipo di assenza">
          <SegmentedButton active={type === "ferie"} onClick={() => setType("ferie")}>
            Ferie
          </SegmentedButton>
          <SegmentedButton
            active={type === "permesso"}
            onClick={() => setType("permesso")}
          >
            Permesso
          </SegmentedButton>
        </Segmented>

        <label className="flex items-center gap-1.5 text-[13px] text-ink-secondary">
          {type === "ferie" ? "Dal" : "Giorno"}
          <Input
            type="date"
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              if (end < e.target.value) setEnd(e.target.value);
            }}
            aria-label={type === "ferie" ? "Primo giorno" : "Giorno del permesso"}
            className="h-9 w-36 shrink-0"
            required
          />
        </label>
        {type === "ferie" ? (
          <label className="flex items-center gap-1.5 text-[13px] text-ink-secondary">
            Al
            <Input
              type="date"
              value={effEnd}
              min={start}
              onChange={(e) => setEnd(e.target.value)}
              aria-label="Ultimo giorno"
              className="h-9 w-36 shrink-0"
              required
            />
          </label>
        ) : (
          <label className="flex items-center gap-1.5 text-[13px] text-ink-secondary">
            <Clock aria-hidden className="size-3.5 text-ink-muted" />
            <Input
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              placeholder="es. 9:00–13:00"
              aria-label="Fascia oraria (facoltativa)"
              className="h-9 w-32 shrink-0"
              maxLength={20}
            />
          </label>
        )}
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Nota per chi approva (facoltativa): motivo, coperture, accordi…"
        aria-label="Nota per chi approva"
        rows={2}
        maxLength={300}
        className="w-full resize-y rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none placeholder:text-ink-faint focus-visible:ring-2 focus-visible:ring-ring"
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-[13px] text-ink-secondary" role="status">
          {overlap ? (
            <span className="font-medium text-danger-text">
              Si sovrappone a una tua richiesta ({formatRange(overlap.start_date, overlap.end_date)},{" "}
              {overlap.status === "pending" ? "in attesa" : "approvata"}).
            </span>
          ) : days === 0 ? (
            <span className="font-medium text-warning-text">
              Solo weekend o giorni di chiusura: non serve richiesta.
            </span>
          ) : (
            <>
              <span className="font-mono font-semibold text-ink">{days}</span>{" "}
              giorn{days === 1 ? "o" : "i"} lavorativ{days === 1 ? "o" : "i"}{" "}
              <span className="text-ink-muted">(weekend e chiusure esclusi)</span>
              {othersAway.length > 0 ? (
                <span className="text-ink-muted">
                  {" "}
                  · in quei giorni fuori anche {othersAway.join(", ")}
                </span>
              ) : null}
            </>
          )}
        </p>
        <span className="ml-auto">
          <Button type="submit" disabled={!canSend}>
            <Send data-icon="inline-start" />
            {sending ? "Invio…" : "Invia richiesta"}
          </Button>
        </span>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Calendario dell'ufficio                                              */
/* ------------------------------------------------------------------ */

function PersonPill({ leave }: { leave: LeaveRequest }) {
  const { profiles } = useAppStore();
  const person = profiles.find((p) => p.id === leave.requester_id);
  const meta = LEAVE_META[leave.type];
  const pending = leave.status === "pending";
  const name = person?.full_name ?? "?";
  return (
    <span
      title={`${name} · ${meta.labelOne} ${formatRange(leave.start_date, leave.end_date)}${leave.time_range ? ` (${leave.time_range})` : ""}${pending ? " — in attesa di approvazione" : ""}`}
      className={cn(
        "flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-[10.5px]/[14px] font-semibold",
        pending && "border border-dashed bg-white",
      )}
      style={
        pending
          ? { borderColor: meta.color, color: meta.text }
          : { background: meta.soft, color: meta.text }
      }
    >
      <AvatarInitials
        name={name}
        src={person?.avatar_url}
        size="sm"
        className="size-4 text-[8px]"
      />
      <span className="truncate">{name.split(" ")[0]}</span>
    </span>
  );
}

function OfficeCalendar() {
  const { leaves, closures, profiles } = useAppStore();
  const now = new Date();
  const [cursor, setCursor] = React.useState({
    y: now.getFullYear(),
    m: now.getMonth(),
  });
  const today = todayIso();
  const cells = buildCells(cursor.y, cursor.m);
  const monthName = MONTH_FMT.format(new Date(cursor.y, cursor.m, 1));

  // Riepilogo di oggi: chi è fuori + prossima chiusura in arrivo.
  const outToday = leavesOnDay(leaves, today).map(
    (l) =>
      profiles.find((p) => p.id === l.requester_id)?.full_name.split(" ")[0] ??
      "?",
  );
  const closureToday = closureOnDay(closures, today);
  const nextClosure = closures
    .filter((c) => c.end_date >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];

  return (
    <section aria-label="Calendario dell'ufficio" className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold tracking-[-0.015em] text-ink">
          <span className="capitalize">{monthName}</span>{" "}
          <span className="font-semibold text-ink-muted">{cursor.y}</span>
        </h2>
        <p className="text-[13px] text-ink-muted">
          {closureToday ? (
            <>
              Oggi ufficio chiuso: <b className="text-ink-secondary">{closureToday.title}</b>
            </>
          ) : outToday.length > 0 ? (
            <>
              Oggi fuori:{" "}
              <b className="text-ink-secondary">{outToday.join(", ")}</b>
            </>
          ) : (
            "Oggi squadra al completo"
          )}
          {nextClosure && !closureToday ? (
            <>
              {" "}
              · prossima chiusura:{" "}
              <b className="text-ink-secondary">{nextClosure.title}</b> (
              {formatRange(nextClosure.start_date, nextClosure.end_date)})
            </>
          ) : null}
        </p>
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
            onClick={() => setCursor({ y: now.getFullYear(), m: now.getMonth() })}
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
        <div className="grid grid-cols-7">
          {cells.map((cell, i) => {
            const closure = closureOnDay(closures, cell.iso);
            const dayLeaves = leaves
              .filter(
                (l) =>
                  l.status !== "rejected" &&
                  rangeCovers(l.start_date, l.end_date, cell.iso),
              )
              .sort((a, b) =>
                a.status === b.status ? 0 : a.status === "approved" ? -1 : 1,
              );
            const isToday = cell.iso === today;
            const weekend = i % 7 >= 5;
            const showClosureLabel =
              closure &&
              (cell.iso === closure.start_date || i % 7 === 0);
            return (
              <div
                key={cell.iso}
                className={cn(
                  "min-h-24 space-y-1 border-b border-border-soft p-1.5 transition-colors",
                  i % 7 !== 0 && "border-l",
                  i >= 35 && "border-b-0",
                  !cell.inMonth && "bg-[#fafbfd]",
                  weekend && cell.inMonth && !closure && "bg-[#fbfcfe]",
                  isToday && "bg-brand-50/45",
                )}
                style={closure ? { background: CLOSURE_STRIPES } : undefined}
              >
                <div className="flex items-center justify-between gap-1">
                  <p
                    className={cn(
                      "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                      isToday
                        ? "btn-glow text-white"
                        : cell.inMonth
                          ? "text-ink-secondary"
                          : "text-ink-faint",
                    )}
                  >
                    {cell.day}
                  </p>
                  {showClosureLabel ? (
                    <p
                      title={closure.title}
                      className="flex min-w-0 items-center gap-1 text-[10px] font-bold text-ink-muted"
                    >
                      <Building2 aria-hidden className="size-3 shrink-0" />
                      <span className="truncate">{closure.title}</span>
                    </p>
                  ) : null}
                </div>
                {dayLeaves.slice(0, 3).map((l) => (
                  <PersonPill key={l.id} leave={l} />
                ))}
                {dayLeaves.length > 3 ? (
                  <p
                    className="px-1 text-[10.5px] font-semibold text-ink-muted"
                    title={dayLeaves
                      .slice(3)
                      .map(
                        (l) =>
                          profiles.find((p) => p.id === l.requester_id)
                            ?.full_name ?? "?",
                      )
                      .join(" · ")}
                  >
                    +{dayLeaves.length - 3} altri
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legenda: forme diverse oltre ai colori (dashed = in attesa) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-3 rounded-sm"
            style={{ background: LEAVE_META.ferie.color }}
          />
          Ferie
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-3 rounded-sm"
            style={{ background: LEAVE_META.permesso.color }}
          />
          Permesso
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-3 rounded-sm border border-dashed border-ink-muted bg-white"
          />
          In attesa di approvazione
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-3 rounded-sm"
            style={{ background: CLOSURE_STRIPES }}
          />
          Chiusura aziendale
        </span>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Coda di approvazione (admin)                                         */
/* ------------------------------------------------------------------ */

function PendingLeaveCard({ leave }: { leave: LeaveRequest }) {
  const { profiles, closures, leaves, decideLeave, currentUser } =
    useAppStore();
  const toast = useToast();
  const requester = profiles.find((p) => p.id === leave.requester_id);
  const propria = leave.requester_id === currentUser.id;
  const [deciding, setDeciding] = React.useState<"approve" | "reject" | null>(
    null,
  );
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const today = todayIso();
  /* Il ruolo che conta e' quello di chi ha chiesto l'assenza: un
     responsabile che approva il sabato di un freelance deve leggere
     "1 giorno", non "0". */
  const days = workingDaysCount(
    leave.start_date,
    leave.end_date,
    closures,
    lavoraNelWeekend(requester?.role ?? "member"),
  );
  const startsIn = diffIsoDays(today, leave.start_date);
  const urgent = startsIn <= 3;

  // Sovrapposizioni con altre assenze approvate: contesto per decidere.
  const conflicts = [
    ...new Set(
      leaves
        .filter(
          (l) =>
            l.id !== leave.id &&
            l.status === "approved" &&
            l.requester_id !== leave.requester_id &&
            rangesOverlap(
              leave.start_date,
              leave.end_date,
              l.start_date,
              l.end_date,
            ),
        )
        .map(
          (l) =>
            profiles.find((p) => p.id === l.requester_id)?.full_name.split(
              " ",
            )[0] ?? "?",
        ),
    ),
  ];

  const confirm = async () => {
    if (busy || !deciding) return;
    if (deciding === "reject" && !note.trim()) return;
    setBusy(true);
    await decideLeave(
      leave.id,
      deciding === "approve" ? "approved" : "rejected",
      note,
    );
    setBusy(false);
    toast(
      deciding === "approve"
        ? "Richiesta approvata: richiedente e responsabili avvisati."
        : "Richiesta rifiutata: il richiedente ha ricevuto la motivazione.",
    );
  };

  return (
    <div className={cn("card-soft space-y-3 p-4", urgent && "border-warning/50")}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <AvatarInitials
          name={requester?.full_name ?? "?"}
          src={requester?.avatar_url}
          size="sm"
        />
        <span className="text-[13px] font-medium text-ink">
          {requester?.full_name ?? "—"}
        </span>
        <TypeBadge type={leave.type} />
        <span className="font-mono text-[12px] font-semibold text-ink">
          {leaveDetail(leave, days)}
        </span>
        <span
          className={cn(
            "font-mono text-[11px]",
            urgent ? "font-semibold text-warning-text" : "text-ink-muted",
          )}
        >
          {startsIn > 0
            ? `parte tra ${startsIn} g`
            : startsIn === 0
              ? "parte oggi"
              : "data passata"}
          {" · "}
          {timeAgo(leave.created_at)}
        </span>
      </div>

      {leave.note ? (
        <p className="text-[13px]/[19px] text-ink-secondary">«{leave.note}»</p>
      ) : null}
      {conflicts.length > 0 ? (
        <p className="text-[12px] font-medium text-warning-text">
          In quei giorni già fuori: {conflicts.join(", ")}
        </p>
      ) : null}

      {deciding ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border-soft pt-3">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirm();
              }
              if (e.key === "Escape") setDeciding(null);
            }}
            placeholder={
              deciding === "approve"
                ? "Nota per il richiedente (facoltativa)"
                : "Motivo del rifiuto (obbligatorio, lo vede il richiedente)"
            }
            aria-label={
              deciding === "approve" ? "Nota di approvazione" : "Motivo del rifiuto"
            }
            className="h-9 min-w-52 flex-1"
            autoFocus
            maxLength={200}
          />
          <Button
            variant={deciding === "approve" ? "default" : "destructive"}
            size="sm"
            onClick={confirm}
            disabled={busy || (deciding === "reject" && !note.trim())}
          >
            {busy
              ? "Invio…"
              : deciding === "approve"
                ? "Conferma approvazione"
                : "Conferma rifiuto"}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setDeciding(null)}
            aria-label="Annulla decisione"
          >
            <X />
          </Button>
        </div>
      ) : propria ? (
        /* La richiesta resta visibile — è in coda e va saputo — ma senza
           pulsanti: la guardia del database rifiuta chi decide sulla propria
           assenza, e offrire un'azione destinata a fallire è peggio che non
           offrirla. */
        <p className="border-t border-border-soft pt-3 text-[13px] text-ink-muted">
          È la tua richiesta: deve approvarla un altro responsabile.
        </p>
      ) : (
        <div className="flex items-center gap-1.5 border-t border-border-soft pt-3">
          <Button size="sm" onClick={() => setDeciding("approve")}>
            <Check data-icon="inline-start" />
            Approva
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeciding("reject")}
          >
            Rifiuta
          </Button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Righe elenco (mie richieste / storico)                               */
/* ------------------------------------------------------------------ */

function LeaveRow({
  leave,
  showRequester,
}: {
  leave: LeaveRequest;
  showRequester?: boolean;
}) {
  const { profiles, closures, currentUser, withdrawLeave } = useAppStore();
  const toast = useToast();
  const requester = profiles.find((p) => p.id === leave.requester_id);
  const decider = profiles.find((p) => p.id === leave.decided_by);
  const days = workingDaysCount(
    leave.start_date,
    leave.end_date,
    closures,
    lavoraNelWeekend(requester?.role ?? "member"),
  );
  const canWithdraw =
    leave.status === "pending" && leave.requester_id === currentUser.id;

  const withdraw = () => {
    const undo = withdrawLeave(leave.id);
    if (undo) {
      toast("Richiesta ritirata", {
        action: { label: "Annulla", onClick: undo },
      });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-accent/60">
      {showRequester ? (
        <AvatarInitials
          name={requester?.full_name ?? "?"}
          src={requester?.avatar_url}
          size="sm"
        />
      ) : null}
      <TypeBadge type={leave.type} />
      <span className="min-w-0 flex-1 basis-44">
        <span className="block truncate text-sm font-medium text-ink">
          {showRequester ? `${requester?.full_name.split(" ")[0]} · ` : ""}
          {leaveDetail(leave, days)}
        </span>
        <span className="block truncate text-[11px] text-ink-muted">
          {timeAgo(leave.created_at)}
          {leave.decision_note
            ? ` — «${leave.decision_note}»${decider ? ` (${decider.full_name.split(" ")[0]})` : ""}`
            : leave.status !== "pending" && decider
              ? ` — deciso da ${decider.full_name.split(" ")[0]}`
              : ""}
        </span>
      </span>
      <LeaveStatusChip status={leave.status} />
      {canWithdraw ? (
        <button
          type="button"
          onClick={withdraw}
          aria-label="Ritira la richiesta"
          title="Ritira la richiesta"
          className="rounded-md p-1 text-ink-faint outline-none transition-colors hover:bg-danger-soft hover:text-danger-text focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chiusure aziendali (admin)                                           */
/* ------------------------------------------------------------------ */

function ClosuresManager() {
  const { closures, addClosure, removeClosure } = useAppStore();
  const toast = useToast();
  const [title, setTitle] = React.useState("");
  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !start) return;
    const effEnd = end && end >= start ? end : start;
    addClosure({ title, start_date: start, end_date: effEnd });
    setTitle("");
    setStart("");
    setEnd("");
    toast("Chiusura aggiunta: tutto l'ufficio è stato avvisato.");
  };

  const remove = (id: string, name: string) => {
    const undo = removeClosure(id);
    if (undo) {
      toast(`Chiusura «${name}» rimossa`, {
        action: { label: "Annulla", onClick: undo },
      });
    }
  };

  const upcoming = [...closures].sort((a, b) =>
    a.start_date.localeCompare(b.start_date),
  );

  return (
    <div className="space-y-2.5">
      {upcoming.length === 0 ? (
        <p className="py-2 text-[13px] text-ink-muted">
          Nessuna chiusura in programma.
        </p>
      ) : (
        <ul className="-mx-1 flex flex-col">
          {upcoming.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-accent/60"
            >
              <Building2 aria-hidden className="size-4 shrink-0 text-ink-muted" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                {c.title}
              </span>
              <span className="font-mono text-[12px] text-ink-muted">
                {formatRange(c.start_date, c.end_date)}
              </span>
              <button
                type="button"
                onClick={() => remove(c.id, c.title)}
                aria-label={`Rimuovi la chiusura «${c.title}»`}
                className="rounded-md p-1 text-ink-faint outline-none transition-colors hover:bg-danger-soft hover:text-danger-text focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={submit}
        className="flex flex-wrap items-center gap-2 border-t border-border-soft pt-3"
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="es. Ponte del 2 giugno"
          aria-label="Titolo della chiusura"
          className="h-9 min-w-44 flex-1"
          maxLength={60}
        />
        <Input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          aria-label="Primo giorno di chiusura"
          className="h-9 w-36 shrink-0"
        />
        <Input
          type="date"
          value={end}
          min={start || undefined}
          onChange={(e) => setEnd(e.target.value)}
          aria-label="Ultimo giorno (vuoto = giorno singolo)"
          className="h-9 w-36 shrink-0"
        />
        <Button type="submit" variant="outline" size="sm" disabled={!title.trim() || !start}>
          <Plus data-icon="inline-start" />
          Aggiungi
        </Button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pagina                                                               */
/* ------------------------------------------------------------------ */

function Section({
  title,
  count,
  hint,
  children,
}: {
  title: string;
  count?: number;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-soft min-w-0 p-4">
      <header className="flex flex-wrap items-baseline gap-2 pb-2.5">
        <h2 className="text-[11px] font-semibold tracking-[0.05em] text-ink-secondary uppercase">
          {title}
        </h2>
        {count !== undefined ? (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full border border-border px-1.5 font-mono text-[11px] text-ink-muted">
            {count}
          </span>
        ) : null}
        {hint ? (
          <span className="ml-auto text-[12px] text-ink-muted">{hint}</span>
        ) : null}
      </header>
      {children}
    </section>
  );
}

export function LeaveContent() {
  const { leaves, closures, currentUser } = useAppStore();
  const searchParams = useSearchParams();
  const formOpen = searchParams.get("request") === "1";
  const isAdmin = currentUser.role === "admin";
  const year = todayIso().slice(0, 4);

  const pending = leaves
    .filter((l) => l.status === "pending")
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const mine = leaves
    .filter((l) => l.requester_id === currentUser.id)
    .sort((a, b) => b.start_date.localeCompare(a.start_date));
  const decided = leaves
    .filter((l) => l.status !== "pending")
    .sort((a, b) => (b.decided_at ?? "").localeCompare(a.decided_at ?? ""));

  // Saldo informale: giorni di ferie approvati nell'anno corrente.
  const mineApprovedDays = mine
    .filter(
      (l) =>
        l.type === "ferie" &&
        l.status === "approved" &&
        l.start_date.slice(0, 4) === year,
    )
    .reduce(
      (sum, l) =>
        sum +
        workingDaysCount(
          l.start_date,
          l.end_date,
          closures,
          lavoraNelWeekend(currentUser.role),
        ),
      0,
    );

  return (
    <div className="flex-1 space-y-4 px-4 py-4 sm:px-6">
      {formOpen ? <LeaveForm /> : null}

      <OfficeCalendar />

      {isAdmin ? (
        <Section title="Da approvare" count={pending.length}>
          {pending.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Nessuna richiesta in attesa"
              hint="Quando un collega chiede ferie o un permesso, appare qui."
              className="py-6"
            />
          ) : (
            <div className="space-y-3">
              {pending.map((l) => (
                <PendingLeaveCard key={l.id} leave={l} />
              ))}
            </div>
          )}
        </Section>
      ) : null}

      <div className={cn("grid gap-4", isAdmin && "lg:grid-cols-2")}>
        <Section
          title="Le mie richieste"
          count={mine.length}
          hint={`Ferie ${year}: ${mineApprovedDays} gg approvati`}
        >
          {mine.length === 0 ? (
            <EmptyState
              icon={TreePalm}
              title="Non hai ancora richiesto assenze"
              hint="Usa «Richiedi ferie/permesso» in alto: i responsabili ricevono l'avviso e decidono."
              className="py-6"
            />
          ) : (
            <div className="-mx-1 flex flex-col">
              {mine.map((l) => (
                <LeaveRow key={l.id} leave={l} />
              ))}
            </div>
          )}
        </Section>

        {isAdmin ? (
          <div className="space-y-4">
            <Section title="Decise di recente" count={decided.length}>
              {decided.length === 0 ? (
                <EmptyState
                  icon={Check}
                  title="Ancora nessuna decisione"
                  className="py-6"
                />
              ) : (
                <div className="-mx-1 flex flex-col">
                  {decided.slice(0, 8).map((l) => (
                    <LeaveRow key={l.id} leave={l} showRequester />
                  ))}
                </div>
              )}
            </Section>

            <Section title="Chiusure aziendali" count={closures.length}>
              <ClosuresManager />
            </Section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
