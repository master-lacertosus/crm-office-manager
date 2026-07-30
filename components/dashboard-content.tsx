"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  AlarmClockMinus,
  ArrowRight,
  CalendarClock,
  CheckCheck,
  CircleCheck,
  Eye,
  FolderOpen,
  Inbox,
  Presentation,
  Star,
  type LucideIcon,
} from "lucide-react";

import { StandupMode } from "@/components/standup-mode";
import { Button } from "@/components/ui/button";

import { buildAnalytics } from "@/lib/analytics";
import { addDaysIso, timeAgo, todayIso } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AvatarInitials } from "@/components/avatar-initials";
import { Sparkline } from "@/components/charts/sparkline";
import { StatTile } from "@/components/charts/stat-tile";
import { EmptyState } from "@/components/empty-state";
import { TaskRow } from "@/components/task-row";

function byDue(a: Task, b: Task): number {
  if (!a.due_date && !b.due_date) return a.position - b.position;
  if (!a.due_date) return 1;
  if (!b.due_date) return -1;
  return a.due_date.localeCompare(b.due_date);
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 13) return "Buongiorno";
  if (h < 18) return "Buon pomeriggio";
  return "Buonasera";
}

const DATE_FMT = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** Anello di avanzamento personale (mockup: arancio pieno su traccia chiara). */
function ProgressRing({ percent, delta }: { percent: number; delta: number }) {
  const reduced = useReducedMotion();
  const R = 50;
  const C = 2 * Math.PI * R;
  const target = C * (1 - percent / 100);

  return (
    <div className="relative size-[132px] shrink-0 rounded-full bg-white shadow-[0_10px_30px_rgb(15_23_42/0.08)]">
      <svg viewBox="0 0 132 132" className="size-[132px] -rotate-90">
        <circle
          cx="66"
          cy="66"
          r={R}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="11"
        />
        <motion.circle
          cx="66"
          cy="66"
          r={R}
          fill="none"
          stroke="var(--brand-500)"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: reduced ? target : C }}
          animate={{ strokeDashoffset: target }}
          transition={{ duration: 1, ease: [0.2, 0, 0, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[26px]/7 font-bold tracking-[-0.01em] text-ink">
          {percent}%
        </p>
        <p className="text-[10px] font-semibold tracking-[0.08em] text-ink-muted uppercase">
          chiusi
        </p>
        <p
          className={cn(
            "mt-0.5 font-mono text-[10px]",
            delta > 0
              ? "text-success-text"
              : delta < 0
                ? "text-danger-text"
                : "text-ink-muted",
          )}
        >
          {delta > 0 ? `+${delta}` : delta} vs sett.
        </p>
      </div>
    </div>
  );
}

function KpiIcon({
  icon: Icon,
  className,
}: {
  icon: LucideIcon;
  className: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-xl",
        className,
      )}
    >
      <Icon className="size-5" strokeWidth={2} />
    </span>
  );
}

function Section({
  title,
  count,
  seeAllHref,
  children,
}: {
  title: string;
  count: number;
  seeAllHref?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-soft p-4">
      <header className="flex items-center gap-2 pb-2.5">
        <h2 className="text-[11px] font-semibold tracking-[0.05em] text-ink-secondary uppercase">
          {title}
        </h2>
        <span className="inline-flex min-w-5 items-center justify-center rounded-full border border-border px-1.5 font-mono text-[11px] text-ink-muted">
          {count}
        </span>
        {seeAllHref ? (
          <Link
            href={seeAllHref}
            className="ml-auto rounded-sm text-[12px] font-medium text-brand-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            Vedi tutti
          </Link>
        ) : null}
      </header>
      {children}
    </section>
  );
}

export function DashboardContent() {
  const { tasks, profiles, projects, currentUser, notifications, focusIds } =
    useAppStore();
  const [standup, setStandup] = React.useState(false);
  const today = todayIso();
  const weekEnd = addDaysIso(7);
  const analytics = buildAnalytics(tasks, profiles, projects);

  const open = tasks.filter((t) => t.status !== "done");
  const overdue = open
    .filter((t) => t.due_date && t.due_date < today)
    .sort(byDue);
  const thisWeek = open
    .filter((t) => t.due_date && t.due_date >= today && t.due_date <= weekEnd)
    .sort(byDue);
  const mine = open.filter((t) => t.owner_id === currentUser.id).sort(byDue);
  const mineDone = tasks.filter(
    (t) => t.owner_id === currentUser.id && t.status === "done",
  ).length;
  const percent =
    mine.length + mineDone === 0
      ? 0
      : Math.round((mineDone / (mine.length + mineDone)) * 100);
  const latestAlerts = notifications.slice(0, 3);
  const focusTasks = focusIds
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is Task => Boolean(t) && t!.status !== "done");

  return (
    <div className="flex-1 space-y-4 px-4 py-4 sm:px-6">
      {/* Hero personale */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
        className="glass-hero flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center"
      >
        <div className="relative">
          <p className="text-[13px] text-ink-muted first-letter:uppercase">
            {DATE_FMT.format(new Date())}
          </p>
          <h2 className="mt-1 text-[30px]/10 font-bold tracking-[-0.018em] text-ink sm:text-[38px]/12">
            {greeting()},{" "}
            <span className="gradient-text">
              {currentUser.full_name.split(" ")[0]}
            </span>{" "}
            <span aria-hidden>👋</span>
          </h2>
          <p className="mt-1.5 max-w-md text-sm text-ink-secondary">
            {overdue.length > 0 ? (
              <>
                <span className="font-mono font-medium text-danger-text">
                  {overdue.length}
                </span>{" "}
                task in ritardo e{" "}
                <span className="font-mono font-medium text-status-review-text">
                  {analytics.inReview}
                </span>{" "}
                in revisione chiedono attenzione oggi.
              </>
            ) : (
              <>
                Nessun ritardo:{" "}
                <span className="font-mono font-medium text-status-review-text">
                  {analytics.inReview}
                </span>{" "}
                task in revisione e{" "}
                <span className="font-mono font-medium text-ink">
                  {mine.length}
                </span>{" "}
                tuoi aperti.
              </>
            )}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setStandup(true)}
          >
            <Presentation data-icon="inline-start" />
            Modalità standup
          </Button>
        </div>
        <div className="relative">
          <ProgressRing percent={percent} delta={analytics.done7Delta} />
        </div>
      </motion.section>

      {/* KPI color-coded */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Task aperti"
          value={analytics.open}
          sublabel="Totali"
          href="/tasks"
          aurora="rgb(59 130 246 / 0.10)"
          icon={
            <KpiIcon
              icon={FolderOpen}
              className="bg-status-todo-soft text-status-todo-text"
            />
          }
        />
        <StatTile
          label="In ritardo"
          value={analytics.overdue}
          sublabel="Da gestire"
          tone="danger"
          href="/tasks"
          aurora="rgb(239 68 68 / 0.10)"
          icon={
            <KpiIcon
              icon={AlarmClockMinus}
              className="bg-danger-soft text-danger-text"
            />
          }
        />
        <StatTile
          label="In revisione"
          value={analytics.inReview}
          sublabel="In attesa"
          tone="brand"
          href="/tasks"
          aurora="rgb(255 107 0 / 0.12)"
          icon={
            <KpiIcon
              icon={Eye}
              className="bg-status-review-soft text-status-review-text"
            />
          }
        />
        <StatTile
          label="Completati · 7g"
          value={analytics.done7}
          delta={analytics.done7Delta}
          aurora="rgb(22 163 101 / 0.11)"
          icon={
            <KpiIcon
              icon={CheckCheck}
              className="bg-status-done-soft text-status-done-text"
            />
          }
        >
          <Sparkline
            values={analytics.trend.map((p) => p.value)}
            color="#0E7A4A"
            ariaLabel="Andamento completamenti, ultime due settimane"
          />
        </StatTile>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Focus di oggi */}
        <Section title="Focus di oggi" count={focusTasks.length}>
          {focusTasks.length === 0 ? (
            <EmptyState
              icon={Star}
              title="Scegli fino a 3 task"
              hint="Usa la stella accanto ai tuoi task per metterli a fuoco."
              className="py-6"
            />
          ) : (
            <div className="-mx-1 flex flex-col">
              {focusTasks.map((t) => (
                <TaskRow key={t.id} task={t} focusable />
              ))}
            </div>
          )}
        </Section>

        {/* Avvisi */}
        <Section title="Avvisi recenti" count={latestAlerts.length}>
          {latestAlerts.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Nessun avviso"
              hint="Quando un collega ti segnala qualcosa, appare qui."
              className="py-6"
            />
          ) : (
            <ul className="space-y-1">
              {latestAlerts.map((n) => {
                const sender = profiles.find((p) => p.id === n.from_user_id);
                const inner = (
                  <>
                    <AvatarInitials
                      name={sender?.full_name ?? "?"}
                      size="sm"
                      className="mt-0.5"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-ink">
                          {sender?.full_name ?? "—"}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-ink-muted">
                          {timeAgo(n.created_at)}
                        </span>
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-[13px]/[18px] text-ink-secondary">
                        {n.message}
                      </span>
                    </span>
                    {!n.read_at ? (
                      <span
                        aria-hidden
                        className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500"
                      />
                    ) : null}
                  </>
                );
                return (
                  <li key={n.id}>
                    {n.task_id ? (
                      <Link
                        href={`/tasks?task=${n.task_id}`}
                        scroll={false}
                        className={cn(
                          "flex items-start gap-2.5 rounded-lg px-2 py-2 outline-none transition-colors hover:bg-accent/70 focus-visible:ring-2 focus-visible:ring-ring",
                          !n.read_at && "bg-brand-50/70",
                        )}
                      >
                        {inner}
                      </Link>
                    ) : (
                      <div
                        className={cn(
                          "flex items-start gap-2.5 rounded-lg px-2 py-2",
                          !n.read_at && "bg-brand-50/70",
                        )}
                      >
                        {inner}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* I miei task */}
        <Section title="I miei task aperti" count={mine.length} seeAllHref="/tasks">
          {mine.length === 0 ? (
            <EmptyState
              icon={CircleCheck}
              title="Nessun task assegnato a te"
              hint="Creane uno con «Nuovo task»."
              className="py-6"
            />
          ) : (
            <div className="-mx-1 flex flex-col">
              {mine.map((t) => (
                <TaskRow key={t.id} task={t} focusable />
              ))}
            </div>
          )}
          <Link
            href="/tasks"
            className="mt-2 inline-flex items-center gap-1 rounded-sm text-[13px] font-medium text-brand-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            Vai alla board
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="In ritardo" count={overdue.length} seeAllHref="/tasks">
          {overdue.length === 0 ? (
            <EmptyState
              icon={CircleCheck}
              title="Niente in ritardo"
              hint="Ottimo ritmo."
              className="py-6"
            />
          ) : (
            <div className="-mx-1 flex flex-col">
              {overdue.map((t) => (
                <TaskRow key={t.id} task={t} showOwner />
              ))}
            </div>
          )}
        </Section>

        <Section
          title="In scadenza questa settimana"
          count={thisWeek.length}
          seeAllHref="/calendar"
        >
          {thisWeek.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Nessuna scadenza in settimana"
              hint="Pianifica dalla board."
              className="py-6"
            />
          ) : (
            <div className="-mx-1 flex flex-col">
              {thisWeek.map((t) => (
                <TaskRow key={t.id} task={t} showOwner />
              ))}
            </div>
          )}
        </Section>
      </div>

      <StandupMode open={standup} onClose={() => setStandup(false)} />
    </div>
  );
}
