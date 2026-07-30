"use client";

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
  type LucideIcon,
} from "lucide-react";

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

/** Anello di avanzamento personale, stile activity ring. */
function ProgressRing({ percent }: { percent: number }) {
  const reduced = useReducedMotion();
  const R = 42;
  const C = 2 * Math.PI * R;
  const target = C * (1 - percent / 100);

  return (
    <div className="relative size-28 shrink-0">
      <svg viewBox="0 0 112 112" className="size-28 -rotate-90">
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F09226" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
        <circle
          cx="56"
          cy="56"
          r={R}
          fill="none"
          stroke="rgb(23 24 28 / 0.07)"
          strokeWidth="10"
        />
        <motion.circle
          cx="56"
          cy="56"
          r={R}
          fill="none"
          stroke="url(#ring-grad)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: reduced ? target : C }}
          animate={{ strokeDashoffset: target }}
          transition={{ duration: 1, ease: [0.2, 0, 0, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-mono text-[22px]/6 font-semibold text-ink">
          {percent}%
        </p>
        <p className="text-[10px] font-medium tracking-[0.06em] text-ink-muted uppercase">
          chiusi
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
        "flex size-8 items-center justify-center rounded-lg",
        className,
      )}
    >
      <Icon className="size-4" strokeWidth={2} />
    </span>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="glass hairline-gradient rounded-xl p-4">
      <header className="flex items-center gap-2 pb-2">
        <h2 className="text-[11px] font-semibold tracking-[0.06em] text-ink-secondary uppercase">
          {title}
        </h2>
        <span className="font-mono text-xs text-ink-muted">{count}</span>
      </header>
      {children}
    </section>
  );
}

export function DashboardContent() {
  const { tasks, profiles, projects, currentUser, notifications } =
    useAppStore();
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

  return (
    <div className="flex-1 space-y-4 px-4 py-4 sm:px-6">
      {/* Hero personale */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
        className="glass-hero flex flex-col justify-between gap-4 rounded-2xl p-5 sm:flex-row sm:items-center"
      >
        <div>
          <p className="font-mono text-xs text-ink-muted first-letter:uppercase">
            {DATE_FMT.format(new Date())}
          </p>
          <h2 className="mt-1 text-[28px]/9 font-semibold tracking-[-0.015em] text-ink">
            {greeting()},{" "}
            <span className="gradient-text">
              {currentUser.full_name.split(" ")[0]}
            </span>
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
        </div>
        <div className="relative">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 rounded-full opacity-60 blur-2xl"
            style={{
              background:
                "conic-gradient(from 180deg, rgb(240 146 38 / 0.35), rgb(5 150 105 / 0.3), rgb(240 146 38 / 0.35))",
            }}
          />
          <ProgressRing percent={percent} />
        </div>
      </motion.section>

      {/* KPI color-coded */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Task aperti"
          value={analytics.open}
          aurora="rgb(2 132 199 / 0.14)"
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
          tone="danger"
          aurora="rgb(217 45 32 / 0.11)"
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
          tone="brand"
          aurora="rgb(240 146 38 / 0.16)"
          icon={
            <KpiIcon
              icon={Eye}
              className="bg-status-review-soft text-status-review-text"
            />
          }
        />
        <StatTile
          label="Completati · 7 giorni"
          value={analytics.done7}
          delta={analytics.done7Delta}
          aurora="rgb(5 150 105 / 0.13)"
          icon={
            <KpiIcon
              icon={CheckCheck}
              className="bg-status-done-soft text-status-done-text"
            />
          }
        >
          <Sparkline
            values={analytics.trend.map((p) => p.value)}
            color="#047857"
            ariaLabel="Andamento completamenti, ultime due settimane"
          />
        </StatTile>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
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
        <Section title="I miei task aperti" count={mine.length}>
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
                <TaskRow key={t.id} task={t} />
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
        <Section title="In ritardo" count={overdue.length}>
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

        <Section title="In scadenza questa settimana" count={thisWeek.length}>
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
    </div>
  );
}
