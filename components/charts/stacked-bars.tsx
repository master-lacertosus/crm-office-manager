"use client";

import * as React from "react";

import {
  BACKLOG_HATCH,
  CHART_STATUS_COLORS,
  type PersonLoad,
  type StatusCounts,
} from "@/lib/analytics";
import { STATUS_ORDER, type TaskStatus } from "@/lib/types";
import { StatusPip, TASK_STATUSES } from "@/components/status-pip";
import { ChartTip, type TipState } from "@/components/charts/chart-tip";

function Segment({
  status,
  count,
  total,
  onHover,
  onLeave,
}: {
  status: TaskStatus;
  count: number;
  total: number;
  onHover: (e: React.PointerEvent, status: TaskStatus, count: number) => void;
  onLeave: () => void;
}) {
  if (count === 0) return null;
  return (
    <div
      className="h-full min-w-[3px]"
      style={{
        flexGrow: count,
        flexBasis: 0,
        background:
          status === "backlog" ? BACKLOG_HATCH : CHART_STATUS_COLORS[status],
      }}
      onPointerEnter={(e) => onHover(e, status, count)}
      onPointerLeave={onLeave}
      aria-hidden
      data-total={total}
    />
  );
}

function BarRow({
  label,
  counts,
  total,
  widthPct,
  onHover,
  onLeave,
}: {
  label: string;
  counts: StatusCounts;
  total: number;
  widthPct: number;
  onHover: (e: React.PointerEvent, status: TaskStatus, count: number) => void;
  onLeave: () => void;
}) {
  return (
    <div className="grid grid-cols-[92px_1fr_28px] items-center gap-3">
      <p className="truncate text-[13px] text-ink-secondary">{label}</p>
      <div className="h-[22px]">
        {total > 0 ? (
          <div
            className="flex h-full gap-[2px] overflow-hidden rounded-r-[4px]"
            style={{ width: `${widthPct}%` }}
          >
            {STATUS_ORDER.map((status) => (
              <Segment
                key={status}
                status={status}
                count={counts[status]}
                total={total}
                onHover={onHover}
                onLeave={onLeave}
              />
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-ink-faint">—</p>
        )}
      </div>
      <p className="text-right font-mono text-xs text-ink-muted">{total}</p>
    </div>
  );
}

/**
 * Carico di lavoro: barre orizzontali impilate per persona, palette di
 * stato validata (backlog tratteggiato = codifica secondaria), gap 2px,
 * estremo dati arrotondato 4px, legenda con le tacche (forma + colore).
 */
export function WorkloadChart({
  people,
  max,
}: {
  people: PersonLoad[];
  max: number;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [tip, setTip] = React.useState<TipState | null>(null);

  const onHover = (
    e: React.PointerEvent,
    status: TaskStatus,
    count: number,
  ) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const target = (e.target as HTMLElement).getBoundingClientRect();
    setTip({
      x: target.left + target.width / 2 - rect.left,
      y: target.top - rect.top,
      title: TASK_STATUSES[status].label,
      value: `${count} task`,
    });
  };

  return (
    <div ref={containerRef} className="relative space-y-2.5">
      {people.map((person) => (
        <BarRow
          key={person.profile.id}
          label={person.profile.full_name.split(" ")[0]}
          counts={person.counts}
          total={person.total}
          widthPct={(person.total / max) * 100}
          onHover={onHover}
          onLeave={() => setTip(null)}
        />
      ))}

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-2">
        {STATUS_ORDER.map((status) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <StatusPip status={status} className="size-3.5" />
            <span className="text-xs text-ink-secondary">
              {TASK_STATUSES[status].label}
            </span>
          </span>
        ))}
      </div>

      <ChartTip tip={tip} />

      <table className="sr-only">
        <caption>Carico di lavoro per persona e stato</caption>
        <thead>
          <tr>
            <th>Persona</th>
            {STATUS_ORDER.map((s) => (
              <th key={s}>{TASK_STATUSES[s].label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.profile.id}>
              <td>{p.profile.full_name}</td>
              {STATUS_ORDER.map((s) => (
                <td key={s}>{p.counts[s]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
