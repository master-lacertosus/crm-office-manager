"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { Download, Printer } from "lucide-react";

import { buildAnalytics } from "@/lib/analytics";
import {
  addDaysIso,
  diffIsoDays,
  formatDue,
  monthRangeIso,
  todayIso,
} from "@/lib/format";
import { updateSearch } from "@/lib/shallow-nav";
import { useAppStore } from "@/lib/store";
import { BarList } from "@/components/charts/bar-list";
import { Sparkline } from "@/components/charts/sparkline";
import { StatTile } from "@/components/charts/stat-tile";
import { WorkloadChart } from "@/components/charts/stacked-bars";
import { TrendChart } from "@/components/charts/trend-chart";
import { useToast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented, SegmentedButton } from "@/components/ui/segmented";

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

const PRESETS = [
  { key: "7", label: "7 giorni" },
  { key: "30", label: "30 giorni" },
  { key: "90", label: "90 giorni" },
  { key: "month", label: "Mese corrente" },
  { key: "prevmonth", label: "Mese scorso" },
] as const;

type PresetKey = (typeof PRESETS)[number]["key"] | "custom";

function resolveRange(
  preset: PresetKey,
  from: string | null,
  to: string | null,
): { from: string; to: string } {
  const today = todayIso();
  switch (preset) {
    case "7":
      return { from: addDaysIso(-6), to: today };
    case "90":
      return { from: addDaysIso(-89), to: today };
    case "month": {
      const m = monthRangeIso(0);
      return { from: m.from, to: today < m.to ? today : m.to };
    }
    case "prevmonth":
      return monthRangeIso(-1);
    case "custom":
      if (from && to && from <= to) return { from, to };
      return { from: addDaysIso(-29), to: today };
    default:
      return { from: addDaysIso(-29), to: today };
  }
}

export function ReportsContent() {
  const { tasks, profiles, projects, statuses } = useAppStore();
  const reduced = useReducedMotion();
  const searchParams = useSearchParams();
  const toast = useToast();

  const rawPreset = searchParams.get("range");
  const preset: PresetKey =
    rawPreset === "custom" ||
    PRESETS.some((p) => p.key === rawPreset)
      ? (rawPreset as PresetKey)
      : "30";
  const range = resolveRange(
    preset,
    searchParams.get("from"),
    searchParams.get("to"),
  );

  const setPreset = (key: PresetKey, custom?: { from: string; to: string }) => {
    updateSearch(
      {
        range: key === "30" ? null : key,
        from: key === "custom" && custom ? custom.from : null,
        to: key === "custom" && custom ? custom.to : null,
      },
      { replace: true },
    );
  };

  const a = buildAnalytics(
    tasks,
    profiles,
    projects,
    statuses.map((s) => s.key),
    range,
  );

  const projectColors = new Map<string, string>(
    projects.map((p, i) => [p.id, PROJECT_HUES[i % PROJECT_HUES.length]]),
  );
  projectColors.set("none", "#94A3B8");
  const doneColors = new Map<string, string>(
    a.donePerPerson.map((p) => [p.key, "#047857"]),
  );

  const rangeLabel = `${formatDue(range.from)} – ${formatDue(range.to)}`;

  /** Esporta i task completati nel periodo (CSV per Excel, ; e BOM). */
  const exportCsv = () => {
    const rows = tasks
      .filter((t) => {
        const d =
          t.status === "done" && t.completed_at
            ? t.completed_at.slice(0, 10)
            : null;
        return d !== null && d >= range.from && d <= range.to;
      })
      .sort((x, y) =>
        (x.completed_at ?? "").localeCompare(y.completed_at ?? ""),
      );
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const name = (id: string) =>
      profiles.find((p) => p.id === id)?.full_name ?? "";
    const proj = (id: string | null) =>
      id ? (projects.find((p) => p.id === id)?.name ?? "") : "";
    const lines = [
      ["Titolo", "Progetto", "Responsabile", "Priorità", "Creato", "Completato", "Giorni"].join(";"),
      ...rows.map((t) =>
        [
          esc(t.title),
          esc(proj(t.project_id)),
          esc(name(t.owner_id)),
          t.priority === "high" ? "Alta" : t.priority === "low" ? "Bassa" : "Normale",
          t.created_at.slice(0, 10),
          t.completed_at?.slice(0, 10) ?? "",
          String(
            diffIsoDays(
              t.created_at.slice(0, 10),
              t.completed_at?.slice(0, 10) ?? t.created_at.slice(0, 10),
            ),
          ),
        ].join(";"),
      ),
    ];
    const blob = new Blob(["﻿" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `report-lacertosus-${range.from}-${range.to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast(`CSV esportato: ${rows.length} task del periodo`);
  };

  const rise = (order: number) => ({
    initial: reduced ? false : { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.24, delay: order * 0.05, ease: [0.2, 0, 0, 1] as const },
  });

  return (
    <div className="flex-1 space-y-4 px-4 py-4 sm:px-6">
      {/* Selettore periodo + azioni */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Segmented className="flex-wrap">
          {PRESETS.map(({ key, label }) => (
            <SegmentedButton
              key={key}
              active={preset === key}
              onClick={() => setPreset(key)}
            >
              {label}
            </SegmentedButton>
          ))}
        </Segmented>
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={range.from}
            max={range.to}
            onChange={(e) =>
              e.target.value &&
              setPreset("custom", { from: e.target.value, to: range.to })
            }
            aria-label="Dal giorno"
            className="h-8 w-36 text-[13px]"
          />
          <span className="text-xs text-ink-muted">→</span>
          <Input
            type="date"
            value={range.to}
            min={range.from}
            max={todayIso()}
            onChange={(e) =>
              e.target.value &&
              setPreset("custom", { from: range.from, to: e.target.value })
            }
            aria-label="Al giorno"
            className="h-8 w-36 text-[13px]"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download data-icon="inline-start" />
            Esporta CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer data-icon="inline-start" />
            Stampa
          </Button>
        </div>
      </div>

      <p className="hidden font-mono text-xs text-ink-muted print:block">
        Report Lacertosus Office OS · periodo {rangeLabel}
      </p>

      {/* KPI del periodo — reagiscono in tempo reale alla board */}
      <motion.div
        {...rise(0)}
        className="grid auto-rows-fr grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <StatTile
          label={`Completati · ${a.rangeDays}g`}
          value={a.doneInRange}
          delta={a.doneInRangeDelta}
          deltaLabel="vs periodo prec."
          aurora="rgb(22 163 101 / 0.11)"
        >
          <Sparkline
            values={a.trend.map((p) => p.value)}
            ariaLabel={`Andamento completamenti nel periodo ${rangeLabel}`}
          />
        </StatTile>
        <StatTile
          label="Creati nel periodo"
          value={a.createdInRange}
          aurora="rgb(2 132 199 / 0.14)"
        />
        <StatTile
          label="Tempo medio (giorni)"
          value={a.avgLeadDays ?? 0}
          decimals={1}
          aurora="rgb(109 40 217 / 0.10)"
          sublabel="da creazione a completamento"
        />
        <StatTile
          label="In ritardo (oggi)"
          value={a.overdue}
          tone="danger"
          aurora="rgb(217 45 32 / 0.11)"
        />
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div {...rise(1)} className="lg:col-span-2">
          <Card
            title="Flusso di completamento"
            hint={`Task completati al giorno · ${rangeLabel}`}
            className="h-full"
          >
            <TrendChart points={a.trend} />
          </Card>
        </motion.div>

        <motion.div {...rise(2)}>
          <Card title="Riepilogo" hint={`Periodo ${rangeLabel}`} className="h-full">
            <ul className="space-y-2.5 text-[13px]/[19px] text-ink-secondary">
              <li>
                Nel periodo il team ha completato{" "}
                <span className="font-mono font-medium text-ink">
                  {a.doneInRange}
                </span>{" "}
                task (
                <span className="font-mono">
                  {a.doneInRangeDelta >= 0
                    ? `+${a.doneInRangeDelta}`
                    : a.doneInRangeDelta}
                </span>{" "}
                sul periodo precedente) e ne ha creati{" "}
                <span className="font-mono font-medium text-ink">
                  {a.createdInRange}
                </span>
                .
              </li>
              {a.avgLeadDays !== null ? (
                <li>
                  Un task si chiude in media in{" "}
                  <span className="font-mono font-medium text-ink">
                    {a.avgLeadDays}
                  </span>{" "}
                  giorni.
                </li>
              ) : null}
              <li>
                {a.overdue === 0 ? (
                  <>Nessun task in ritardo oggi. Ottimo ritmo.</>
                ) : (
                  <>
                    <span className="font-mono font-medium text-danger-text">
                      {a.overdue}
                    </span>{" "}
                    in ritardo oggi{a.mostUrgent ? (
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
            title="Carico di lavoro (oggi)"
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
          <Card
            title="Completati per persona"
            hint={`Periodo ${rangeLabel}`}
            className="h-full"
          >
            <BarList rows={a.donePerPerson} colors={doneColors} valueOnly />
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div {...rise(5)}>
          <Card title="Per progetto (oggi)" className="h-full">
            <BarList rows={a.projects} colors={projectColors} />
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
