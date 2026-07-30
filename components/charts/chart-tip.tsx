"use client";

/** Tooltip dei grafici: posizionato dal padre (relative), mai interattivo. */
export interface TipState {
  x: number;
  y: number;
  title: string;
  value: string;
}

export function ChartTip({ tip }: { tip: TipState | null }) {
  if (!tip) return null;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-card px-2.5 py-1.5 whitespace-nowrap shadow-sm"
      style={{ left: tip.x, top: tip.y - 8 }}
    >
      <p className="text-xs text-ink-secondary">{tip.title}</p>
      <p className="font-mono text-[13px] font-medium text-ink">{tip.value}</p>
    </div>
  );
}
