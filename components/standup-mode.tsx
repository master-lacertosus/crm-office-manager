"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckCheck, X } from "lucide-react";

import { buildAnalytics } from "@/lib/analytics";
import { addDaysIso, dueUrgency, formatDue, todayIso } from "@/lib/format";
import { personLeaveOnDay } from "@/lib/leave";
import { useAppStore } from "@/lib/store";
import { LEAVE_META } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AvatarInitials } from "@/components/avatar-initials";
import { DueChip } from "@/components/due-chip";
import { PriorityBadge } from "@/components/priority-badge";
import { StatusPip } from "@/components/status-pip";
import { Button } from "@/components/ui/button";

const DATE_FMT = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

function SummaryChip({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold",
        className,
      )}
    >
      <span className="font-mono text-[13px]">{value}</span>
      {label}
    </span>
  );
}

/**
 * Modalità standup — vista pulita da proiettare nel daily: riepilogo di
 * squadra in alto, una card per persona (ordinata per urgenza) con task
 * aperti, etichette di scadenza sistematiche e chiusure della settimana.
 */
export function StandupMode({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { profiles, tasks, projects, leaves } = useAppStore();
  const reduced = useReducedMotion();
  const weekAgo = addDaysIso(-6);
  const today = todayIso();

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [open, onClose]);

  const team = buildAnalytics(tasks, profiles, projects);

  const people = profiles
    .filter((p) => p.is_active)
    .map((profile) => {
      const mine = tasks.filter((t) => t.owner_id === profile.id);
      const openTasks = mine
        .filter((t) => t.status !== "done")
        .sort((a, b) => {
          if (!a.due_date && !b.due_date) return a.position - b.position;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return a.due_date.localeCompare(b.due_date);
        });
      return {
        profile,
        openTasks,
        overdue: openTasks.filter(
          (t) => t.due_date && dueUrgency(t.due_date).level === "overdue",
        ).length,
        review: openTasks.filter((t) => t.status === "in_review").length,
        done7: mine.filter(
          (t) =>
            t.status === "done" &&
            t.completed_at &&
            t.completed_at.slice(0, 10) >= weekAgo,
        ).length,
      };
    })
    .sort(
      (a, b) =>
        b.overdue - a.overdue || b.openTasks.length - a.openTasks.length,
    );

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="dialog"
          aria-modal="true"
          aria-label="Modalità standup"
          className="fixed inset-0 z-[80] overflow-y-auto bg-canvas"
        >
          <div aria-hidden className="aura-layer" />

          {/* Barra superiore */}
          <header className="sticky top-0 z-10 border-b border-border-soft bg-canvas/90 backdrop-blur-md">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4">
              <div className="min-w-0">
                <h2 className="text-[26px]/8 font-bold tracking-[-0.015em] text-ink">
                  Standup del team
                </h2>
                <p className="text-[13px] text-ink-muted first-letter:uppercase">
                  {DATE_FMT.format(new Date())} · dati live
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                <SummaryChip
                  label="aperti"
                  value={team.open}
                  className="bg-status-todo-soft text-status-todo-text"
                />
                <SummaryChip
                  label="in ritardo"
                  value={team.overdue}
                  className="bg-danger-soft text-danger-text"
                />
                <SummaryChip
                  label="in revisione"
                  value={team.inReview}
                  className="bg-status-review-soft text-status-review-text"
                />
                <SummaryChip
                  label="chiusi · 7g"
                  value={team.done7}
                  className="bg-status-done-soft text-status-done-text"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onClose}
                  aria-label="Chiudi standup (Esc)"
                  autoFocus
                  className="ml-1"
                >
                  <X />
                </Button>
              </div>
            </div>
          </header>

          {/* Card persona */}
          <div className="mx-auto max-w-6xl px-6 py-6">
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {people.map(({ profile, openTasks, overdue, review, done7 }, i) => (
                <motion.section
                  key={profile.id}
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.22,
                    delay: i * 0.05,
                    ease: [0.2, 0, 0, 1],
                  }}
                  aria-label={profile.full_name}
                  className="card-soft flex flex-col p-5"
                >
                  <header className="flex items-center gap-3">
                    <AvatarInitials
                      name={profile.full_name}
                      src={profile.avatar_url}
                      size="lg"
                      className="bg-brand-100 text-brand-700"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[16px]/6 font-bold text-ink">
                        {profile.full_name}
                      </h3>
                      <p className="text-[12px] text-ink-muted">
                        {openTasks.length === 0
                          ? "In pari"
                          : `${openTasks.length} task apert${openTasks.length === 1 ? "o" : "i"}`}
                      </p>
                    </div>
                    {(() => {
                      // L'assenza di oggi è la prima cosa da dire al daily.
                      const away = personLeaveOnDay(leaves, profile.id, today);
                      if (away) {
                        const meta = LEAVE_META[away.type];
                        return (
                          <span
                            className="rounded-full px-2 py-1 text-[11px] font-bold whitespace-nowrap"
                            style={{ background: meta.soft, color: meta.text }}
                          >
                            {away.type === "ferie"
                              ? away.end_date === today
                                ? "In ferie · ultimo giorno"
                                : `In ferie fino al ${formatDue(away.end_date)}`
                              : away.time_range
                                ? `Permesso ${away.time_range}`
                                : "Permesso oggi"}
                          </span>
                        );
                      }
                      return overdue > 0 ? (
                        <span className="rounded-full bg-danger-soft px-2 py-1 text-[11px] font-bold text-danger-text">
                          {overdue} in ritardo
                        </span>
                      ) : review > 0 ? (
                        <span className="rounded-full bg-status-review-soft px-2 py-1 text-[11px] font-bold text-status-review-text">
                          {review} in revisione
                        </span>
                      ) : null;
                    })()}
                  </header>

                  <div className="my-4 h-px bg-border-soft" />

                  <ul className="flex-1 space-y-2.5">
                    {openTasks.length === 0 ? (
                      <li className="flex items-center gap-2 text-[13px] text-ink-muted">
                        <CheckCheck className="size-4 text-success" />
                        Nessun task aperto.
                      </li>
                    ) : (
                      openTasks.slice(0, 5).map((task) => (
                        <li key={task.id} className="flex items-center gap-2.5">
                          <StatusPip status={task.status} className="size-3.5" />
                          <span className="min-w-0 flex-1 truncate text-[14px]/5 font-medium text-ink">
                            {task.title}
                          </span>
                          {task.priority === "high" ? (
                            <PriorityBadge iconOnly />
                          ) : null}
                          <DueChip iso={task.due_date} status={task.status} />
                        </li>
                      ))
                    )}
                    {openTasks.length > 5 ? (
                      <li className="pl-6 text-[12px] font-semibold text-ink-muted">
                        +{openTasks.length - 5} altri
                      </li>
                    ) : null}
                  </ul>

                  <footer className="mt-4 border-t border-border-soft pt-3">
                    <p className="text-[12px] text-ink-muted">
                      <span className="font-mono font-semibold text-status-done-text">
                        {done7}
                      </span>{" "}
                      chius{done7 === 1 ? "o" : "i"} negli ultimi 7 giorni
                    </p>
                  </footer>
                </motion.section>
              ))}
            </div>

            <p className="mt-8 text-center text-[12px] text-ink-muted">
              Esc per uscire · persone ordinate per urgenza · dati live
            </p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
