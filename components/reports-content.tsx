"use client";

import { motion, useReducedMotion } from "motion/react";

import { buildAnalytics } from "@/lib/analytics";
import { useAppStore } from "@/lib/store";
import { BarList } from "@/components/charts/bar-list";
import { Sparkline } from "@/components/charts/sparkline";
import { StatTile } from "@/components/charts/stat-tile";
import { WorkloadChart } from "@/components/charts/stacked-bars";
import { TrendChart } from "@/components/charts/trend-chart";

function Card({
  title,
  hint,
  children,
  className = "",
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card-soft p-4 ${className}`}>
      <header className="mb-3">
        <h2 className="text-[11px] font-semibold tracking-[0.06em] text-ink-secondary uppercase">
          {title}
        </h2>
        {hint ? <p className="mt-0.5 text-xs text-ink-muted">{hint}</p> : null}
      </header>
      {children}
    </section>
  );
}

/** Colori per progetto: ordine fisso per entità, mai riassegnati al riordino. */
const PROJECT_HUES = ["#F09226", "#0284C7", "#6D28D9"];

export function ReportsContent() {
  const { tasks, profiles, projects, statuses } = useAppStore();
  const reduced = useReducedMotion();
  const a = buildAnalytics(
    tasks,
    profiles,
    projects,
    statuses.map((s) => s.key),
  );
  const projectColors = new Map<string, string>(
    projects.map((p, i) => [p.id, PROJECT_HUES[i % PROJECT_HUES.length]]),
  );
  projectColors.set("none", "#94A3B8");

  const rise = (order: number) => ({
    initial: reduced ? false : { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.24, delay: order * 0.05, ease: [0.2, 0, 0, 1] as const },
  });

  return (
    <div className="flex-1 space-y-4 px-4 py-4 sm:px-6">
      {/* KPI — reagiscono in tempo reale alla board */}
      <motion.div {...rise(0)} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Task aperti"
          value={a.open}
          aurora="rgb(2 132 199 / 0.14)"
        />
        <StatTile
          label="In ritardo"
          value={a.overdue}
          tone="danger"
          aurora="rgb(217 45 32 / 0.11)"
        />
        <StatTile
          label="In revisione"
          value={a.inReview}
          tone="brand"
          aurora="rgb(240 146 38 / 0.16)"
        />
        <StatTile
          label="Completati · 7g"
          value={a.done7}
          delta={a.done7Delta}
          aurora="rgb(22 163 101 / 0.11)"
        >
          <Sparkline
            values={a.trend.map((p) => p.value)}
            ariaLabel="Andamento completamenti, ultime due settimane"
          />
        </StatTile>
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div {...rise(1)} className="lg:col-span-2">
          <Card
            title="Flusso di completamento"
            hint="Task completati al giorno, ultime due settimane"
            className="h-full"
          >
            <TrendChart points={a.trend} />
          </Card>
        </motion.div>

        <motion.div {...rise(2)}>
          <Card title="Riepilogo" hint="Generato dai dati correnti" className="h-full">
            <ul className="space-y-2.5 text-[13px]/[19px] text-ink-secondary">
              <li>
                Negli ultimi 7 giorni il team ha completato{" "}
                <span className="font-mono font-medium text-ink">{a.done7}</span>{" "}
                task (
                <span className="font-mono">
                  {a.done7Delta >= 0 ? `+${a.done7Delta}` : a.done7Delta}
                </span>{" "}
                sui 7 precedenti).
              </li>
              <li>
                {a.overdue === 0 ? (
                  <>Nessun task in ritardo. Ottimo ritmo.</>
                ) : (
                  <>
                    <span className="font-mono font-medium text-danger-text">
                      {a.overdue}
                    </span>{" "}
                    in ritardo{a.mostUrgent ? (
                      <>
                        ; il più urgente è{" "}
                        <span className="font-medium text-ink">
                          «{a.mostUrgent.title}»
                        </span>
                        .
                      </>
                    ) : (
                      "."
                    )}
                  </>
                )}
              </li>
              <li>
                <span className="font-mono font-medium text-brand-700">
                  {a.inReview}
                </span>{" "}
                task aspettano una revisione.
              </li>
              {a.busiest ? (
                <li>
                  Il carico più alto è di{" "}
                  <span className="font-medium text-ink">
                    {a.busiest.profile.full_name.split(" ")[0]}
                  </span>{" "}
                  con{" "}
                  <span className="font-mono font-medium text-ink">
                    {a.busiest.open}
                  </span>{" "}
                  task aperti.
                </li>
              ) : null}
            </ul>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div {...rise(3)} className="lg:col-span-2">
          <Card
            title="Carico di lavoro"
            hint="Task per persona e stato — il backlog è tratteggiato"
          >
            <WorkloadChart
              people={a.people}
              max={a.maxPersonTotal}
              statuses={statuses}
            />
          </Card>
        </motion.div>

        <motion.div {...rise(4)}>
          <Card title="Per progetto" className="h-full">
            <BarList rows={a.projects} colors={projectColors} />
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
