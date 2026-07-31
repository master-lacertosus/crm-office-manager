"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { AtSign, Bell, BellRing, CheckCheck } from "lucide-react";

import { timeAgo } from "@/lib/format";
import { pop } from "@/lib/motion";
import { useAppStore } from "@/lib/store";
import type { AppNotification } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AvatarInitials } from "@/components/avatar-initials";
import { Button } from "@/components/ui/button";

type Tab = "tutte" | "mention" | "sollecito";

const TABS: { key: Tab; label: string }[] = [
  { key: "tutte", label: "Tutte" },
  { key: "mention", label: "Menzioni" },
  { key: "sollecito", label: "Solleciti" },
];

interface Group {
  key: string;
  taskId: string | null;
  items: AppNotification[];
}

/**
 * Campanella degli avvisi: tab per natura (menzioni/solleciti), avvisi
 * dello stesso task raggruppati con segna-letto di gruppo.
 */
export function NotificationsBell() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    profiles,
    tasks,
    markNotificationRead,
    markAllNotificationsRead,
    markTaskNotificationsRead,
  } = useAppStore();
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<Tab>("tutte");
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

  const filtered = notifications.filter((n) =>
    tab === "tutte" ? true : (n.kind ?? "sistema") === tab,
  );

  /* Avvisi dello stesso task in un gruppo solo (ordinati sul più recente) */
  const groups: Group[] = [];
  const groupIndex = new Map<string, number>();
  for (const n of filtered) {
    if (n.task_id) {
      const idx = groupIndex.get(n.task_id);
      if (idx !== undefined) {
        groups[idx].items.push(n);
        continue;
      }
      groupIndex.set(n.task_id, groups.length);
      groups.push({ key: n.task_id, taskId: n.task_id, items: [n] });
    } else {
      groups.push({ key: n.id, taskId: null, items: [n] });
    }
  }

  const openTask = (n: AppNotification) => {
    markNotificationRead(n.id);
    if (n.task_id) {
      setOpen(false);
      router.push(`/tasks?task=${n.task_id}`, { scroll: false });
    }
  };

  const countFor = (t: Tab) =>
    notifications.filter(
      (n) => !n.read_at && (t === "tutte" || (n.kind ?? "sistema") === t),
    ).length;

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label={
          unreadCount > 0 ? `Avvisi: ${unreadCount} non letti` : "Avvisi"
        }
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative"
      >
        {unreadCount > 0 ? <BellRing /> : <Bell />}
        {unreadCount > 0 ? (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive font-mono text-[10px] font-semibold text-white ring-2 ring-white"
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
            className="glass-strong absolute right-0 z-50 mt-2 w-[360px] origin-top-right rounded-xl p-1.5"
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

            <div
              role="tablist"
              aria-label="Filtra avvisi"
              className="mb-1.5 flex gap-0.5 rounded-lg bg-white/60 p-0.5"
            >
              {TABS.map(({ key, label }) => {
                const unread = countFor(key);
                return (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={tab === key}
                    onClick={() => setTab(key)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                      tab === key
                        ? "bg-white text-ink shadow-xs"
                        : "text-ink-muted hover:text-ink",
                    )}
                  >
                    {key === "mention" ? <AtSign className="size-3" /> : null}
                    {label}
                    {unread > 0 ? (
                      <span className="font-mono text-[10px] text-brand-700">
                        {unread}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {groups.length === 0 ? (
              <p className="px-2.5 pb-3 text-[13px] text-ink-muted">
                {tab === "tutte"
                  ? "Nessun avviso. Quando un collega ti segnala qualcosa, lo trovi qui."
                  : "Niente in questa categoria."}
              </p>
            ) : (
              <ul className="max-h-[340px] space-y-0.5 overflow-y-auto">
                {groups.map((group) => {
                  const groupUnread = group.items.filter(
                    (n) => !n.read_at,
                  ).length;
                  const task = group.taskId
                    ? tasks.find((t) => t.id === group.taskId)
                    : null;
                  return (
                    <li key={group.key}>
                      {group.items.length > 1 ? (
                        <div className="flex items-center gap-2 px-2.5 pt-2 pb-1">
                          <p className="min-w-0 flex-1 truncate text-[11px] font-bold tracking-[0.04em] text-ink-secondary uppercase">
                            {task?.title ?? "Task"}
                            <span className="ml-1.5 font-mono font-normal text-ink-muted">
                              {group.items.length}
                            </span>
                          </p>
                          {groupUnread > 0 && group.taskId ? (
                            <button
                              onClick={() =>
                                markTaskNotificationsRead(group.taskId as string)
                              }
                              title="Segna letti gli avvisi di questo task"
                              className="inline-flex shrink-0 items-center gap-1 rounded-sm text-[11px] font-medium text-brand-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <CheckCheck className="size-3" />
                              Segna letti
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      {group.items.map((n) => {
                        const sender = profiles.find(
                          (p) => p.id === n.from_user_id,
                        );
                        return (
                          <button
                            key={n.id}
                            onClick={() => openTask(n)}
                            className={cn(
                              "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none transition-colors hover:bg-accent/70 focus-visible:ring-2 focus-visible:ring-ring",
                              !n.read_at && "bg-brand-50/70",
                              group.items.length > 1 && "pl-4",
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
                              {n.task_id && group.items.length === 1 ? (
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
                        );
                      })}
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
