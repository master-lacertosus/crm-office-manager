"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";

import { dueTone, formatDue, todayIso } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { AvatarInitials } from "@/components/avatar-initials";
import { StatusPip } from "@/components/status-pip";
import { Button } from "@/components/ui/button";

const DATE_FMT = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/**
 * Modalità standup: vista a schermo intero per il daily del team —
 * una colonna per persona, tipografia grande, ritardi evidenziati.
 */
export function StandupMode({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { profiles, tasks } = useAppStore();
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

  const people = profiles
    .filter((p) => p.is_active)
    .map((profile) => {
      const open = tasks
        .filter((t) => t.owner_id === profile.id && t.status !== "done")
        .sort((a, b) => {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return a.due_date.localeCompare(b.due_date);
        });
      return {
        profile,
        open,
        overdue: open.filter((t) => t.due_date && t.due_date < today).length,
        review: open.filter((t) => t.status === "in_review").length,
      };
    })
    .sort((a, b) => b.open.length - a.open.length);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-label="Modalità standup"
          className="glass-strong fixed inset-0 z-[80] overflow-y-auto"
        >
          <div className="mx-auto max-w-6xl px-6 py-8">
            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[13px] text-ink-muted first-letter:uppercase">
                  {DATE_FMT.format(new Date())}
                </p>
                <h2 className="mt-1 text-[34px]/10 font-semibold tracking-[-0.016em] text-ink">
                  Standup <span className="gradient-text">del team</span>
                </h2>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={onClose}
                aria-label="Chiudi standup"
                autoFocus
              >
                <X />
              </Button>
            </header>

            <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {people.map(({ profile, open, overdue, review }) => (
                <section
                  key={profile.id}
                  aria-label={profile.full_name}
                  className="card-soft rounded-3xl p-5"
                >
                  <header className="flex items-center gap-3">
                    <AvatarInitials name={profile.full_name} size="lg" />
                    <div>
                      <h3 className="text-[17px]/6 font-semibold text-ink">
                        {profile.full_name.split(" ")[0]}
                      </h3>
                      <p className="font-mono text-xs text-ink-muted">
                        {open.length} aperti
                        {overdue > 0 ? (
                          <span className="text-danger-text">
                            {" "}
                            · {overdue} in ritardo
                          </span>
                        ) : null}
                        {review > 0 ? (
                          <span className="text-status-review-text">
                            {" "}
                            · {review} in revisione
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </header>

                  <ul className="mt-4 space-y-2.5">
                    {open.length === 0 ? (
                      <li className="text-sm text-ink-muted">
                        Nessun task aperto.
                      </li>
                    ) : (
                      open.slice(0, 5).map((task) => {
                        const late =
                          task.due_date && dueTone(task.due_date) === "overdue";
                        return (
                          <li
                            key={task.id}
                            className="flex items-center gap-2.5"
                          >
                            <StatusPip status={task.status} />
                            <span
                              className={cn(
                                "min-w-0 flex-1 truncate text-[15px]/5",
                                late
                                  ? "font-medium text-danger-text"
                                  : "text-ink",
                              )}
                            >
                              {task.title}
                            </span>
                            {task.due_date ? (
                              <span
                                className={cn(
                                  "font-mono text-xs",
                                  late
                                    ? "font-medium text-danger-text"
                                    : "text-ink-muted",
                                )}
                              >
                                {formatDue(task.due_date)}
                              </span>
                            ) : null}
                          </li>
                        );
                      })
                    )}
                    {open.length > 5 ? (
                      <li className="font-mono text-xs text-ink-muted">
                        +{open.length - 5} altri
                      </li>
                    ) : null}
                  </ul>
                </section>
              ))}
            </div>

            <p className="mt-8 font-mono text-xs text-ink-muted">
              Esc per uscire · i dati sono live
            </p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
