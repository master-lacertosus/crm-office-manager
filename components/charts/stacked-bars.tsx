"use client";

import * as React from "react";

import {
  BACKLOG_HATCH,
  CHART_STATUS_COLORS,
  type PersonLoad,
  type StatusCounts,
} from "@/lib/analytics";
import type { StatusMeta } from "@/lib/types";
import { StatusPip } from "@/components/status-pip";
import { ChartTip, type TipState } from "@/components/charts/chart-tip";

function segColor(key: string, meta: StatusMeta): string {
  return CHART_STATUS_COLORS[key] ?? meta.color;
}

function Segment({
  meta,
  count,
  onHover,
  onLeave,
}: {
  meta: StatusMeta;
  count: number;
  onHover: (e: React.PointerEvent, meta: StatusMeta, count: number) => void;
  onLeave: () => void;
}) {
  if (count === 0) return null;
  return (
    <div
      className="h-full min-w-[3px] transition-transform duration-150 ease-out hover:-translate-y-px hover:brightness-105"
      style={{
        flexGrow: count,
        flexBasis: 0,
        background:
          meta.key === "backlog" ? BACKLOG_HATCH : segColor(meta.key, meta),
        boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.25)",
      }}
      onPointerEnter={(e) => onHover(e, meta, count)}
      onPointerLeave={onLeave}
      aria-hidden
    />
  );
}

function BarRow({
  label,
  counts,
  total,
  widthPct,
  statuses,
  onHover,
  onLeave,
}: {
  label: string;
  counts: StatusCounts;
  total: number;
  widthPct: number;
  statuses: StatusMeta[];
  onHover: (e: React.PointerEvent, meta: StatusMeta, count: number) => void;
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
            {statuses.map((meta) => (
              <Segment
                key={meta.key}
                meta={meta}
                count={counts[meta.key] ?? 0}
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
 * Carico di lavoro: barre impilate per persona sull'ordine dinamico delle
 * fasi (core validate CVD + Problema + custom col loro colore). Backlog
 * tratteggiato, gap 2px, legenda con le tacche.
 */
export function WorkloadChart({
  people,
  max,
  statuses,
}: {
  people: PersonLoad[];
  max: number;
  statuses: StatusMeta[];
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [tip, setTip] = React.useState<TipState | null>(null);

  const onHover = (
    e: React.PointerEvent,
    meta: StatusMeta,
    count: number,
  ) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const target = (e.target as HTMLElement).getBoundingClientRect();
    setTip({
      x: target.left + target.width / 2 - rect.left,
      y: target.top - rect.top,
      title: meta.label,
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
          statuses={statuses}
          onHover={onHover}
          onLeave={() => setTip(null)}
        />
      ))}

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-2">
        {statuses.map((meta) => (
          <span key={meta.key} className="inline-flex items-center gap-1.5">
            <StatusPip status={meta.key} className="size-3.5" />
            <span className="text-xs text-ink-secondary">{meta.label}</span>
          </span>
        ))}
      </div>

      <ChartTip tip={tip} />

      <div className="sr-only">
      <table>
        <caption>Carico di lavoro per persona e fase</caption>
        <thead>
          <tr>
            <th>Persona</th>
            {statuses.map((s) => (
              <th key={s.key}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.profile.id}>
              <td>{p.profile.full_name}</td>
              {statuses.map((s) => (
                <td key={s.key}>{p.counts[s.key] ?? 0}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
