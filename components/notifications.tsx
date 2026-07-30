"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Bell, BellRing } from "lucide-react";

import { timeAgo } from "@/lib/format";
import { pop } from "@/lib/motion";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { AvatarInitials } from "@/components/avatar-initials";
import { Button } from "@/components/ui/button";

/**
 * Campanella degli avvisi interni: badge con i non letti, pannello glass
 * con mittente, messaggio, tempo relativo e salto al task collegato.
 */
export function NotificationsBell() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    profiles,
    markNotificationRead,
    markAllNotificationsRead,
  } = useAppStore();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label={
          unreadCount > 0
            ? `Avvisi: ${unreadCount} non letti`
            : "Avvisi"
        }
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative"
      >
        {unreadCount > 0 ? <BellRing /> : <Bell />}
        {unreadCount > 0 ? (
          <span
            aria-hidden
            className="btn-glow absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full font-mono text-[10px] font-semibold text-primary-foreground"
          >
            {unreadCount}
          </span>
        ) : null}
      </Button>

      <AnimatePresence>
        {open ? (
          <motion.div
            variants={pop}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-label="Avvisi"
            className="glass-strong absolute right-0 z-50 mt-2 w-[340px] origin-top-right rounded-xl p-1.5"
          >
            <header className="flex items-center justify-between px-2.5 pt-1.5 pb-2">
              <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
                Avvisi
              </p>
              {unreadCount > 0 ? (
                <button
                  onClick={markAllNotificationsRead}
                  className="rounded-sm text-xs text-brand-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Segna tutti letti
                </button>
              ) : null}
            </header>

            {notifications.length === 0 ? (
              <p className="px-2.5 pb-3 text-[13px] text-ink-muted">
                Nessun avviso. Quando un collega ti segnala qualcosa, lo trovi
                qui.
              </p>
            ) : (
              <ul className="max-h-[340px] space-y-0.5 overflow-y-auto">
                {notifications.map((n) => {
                  const sender = profiles.find((p) => p.id === n.from_user_id);
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => {
                          markNotificationRead(n.id);
                          if (n.task_id) {
                            setOpen(false);
                            router.push(`/tasks?task=${n.task_id}`, {
                              scroll: false,
                            });
                          }
                        }}
                        className={cn(
                          "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none transition-colors hover:bg-accent/70 focus-visible:ring-2 focus-visible:ring-ring",
                          !n.read_at && "bg-brand-50/70",
                        )}
                      >
                        <AvatarInitials
                          name={sender?.full_name ?? "?"}
                          size="sm"
                          className="mt-0.5"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="text-[13px] font-medium text-ink">
                              {sender?.full_name ?? "—"}
                            </span>
                            <span className="shrink-0 font-mono text-[10px] text-ink-muted">
                              {timeAgo(n.created_at)}
                            </span>
                          </span>
                          <span className="mt-0.5 block text-[13px]/[18px] text-ink-secondary">
                            {n.message}
                          </span>
                          {n.task_id ? (
                            <span className="mt-1 block text-xs font-medium text-brand-700">
                              Apri il task →
                            </span>
                          ) : null}
                        </span>
                        {!n.read_at ? (
                          <span
                            aria-hidden
                            className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500"
                          />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
