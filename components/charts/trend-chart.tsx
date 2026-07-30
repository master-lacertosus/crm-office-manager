"use client";

import * as React from "react";

import { formatDue } from "@/lib/format";
import type { TrendPoint } from "@/lib/analytics";
import { ChartTip, type TipState } from "@/components/charts/chart-tip";

const COLOR = "#047857";
const HEIGHT = 150;
const PAD = { top: 12, right: 10, bottom: 22, left: 10 };

/**
 * Trend dei completamenti (serie singola: niente legenda, il titolo la
 * nomina). Linea 2px, area soffusa, griglia recessiva, crosshair + tooltip.
 */
export function TrendChart({ points }: { points: TrendPoint[] }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);
  const [hover, setHover] = React.useState<number | null>(null);
  const [tip, setTip] = React.useState<TipState | null>(null);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const yMax = Math.max(4, Math.ceil(Math.max(...points.map((p) => p.value)) * 1.15));
  const step = points.length > 1 ? innerW / (points.length - 1) : 0;

  const coords = points.map((p, i) => ({
    x: PAD.left + i * step,
    y: PAD.top + innerH - (p.value / yMax) * innerH,
  }));
  const line = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`)
    .join(" ");
  const area = `${line} L${PAD.left + innerW},${PAD.top + innerH} L${PAD.left},${PAD.top + innerH} Z`;

  const onMove = (e: React.PointerEvent) => {
    if (!containerRef.current || step === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const index = Math.min(
      points.length - 1,
      Math.max(0, Math.round((x - PAD.left) / step)),
    );
    setHover(index);
    setTip({
      x: coords[index].x,
      y: coords[index].y,
      title: formatDue(points[index].iso),
      value: `${points[index].value} completat${points[index].value === 1 ? "o" : "i"}`,
    });
  };

  const clear = () => {
    setHover(null);
    setTip(null);
  };

  const gridYs = [0.5, 1].map((f) => PAD.top + innerH - f * innerH);
  const labelIdx = [0, Math.floor((points.length - 1) / 2), points.length - 1];

  return (
    <div
      ref={containerRef}
      className="relative"
      onPointerMove={onMove}
      onPointerLeave={clear}
    >
      <svg
        width="100%"
        height={HEIGHT}
        role="img"
        aria-label={`Task completati al giorno, ultimi ${points.length} giorni`}
      >
        {width > 0 ? (
          <>
            {/* griglia recessiva + baseline */}
            {gridYs.map((y) => (
              <line
                key={y}
                x1={PAD.left}
                x2={PAD.left + innerW}
                y1={y}
                y2={y}
                stroke="#EEEFF1"
              />
            ))}
            <line
              x1={PAD.left}
              x2={PAD.left + innerW}
              y1={PAD.top + innerH}
              y2={PAD.top + innerH}
              stroke="#E3E5E8"
            />
            <text
              x={PAD.left}
              y={PAD.top - 2}
              className="fill-ink-faint font-mono text-[10px]"
            >
              {yMax}
            </text>

            <path d={area} fill={COLOR} opacity={0.07} />
            <path
              d={line}
              fill="none"
              stroke={COLOR}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* etichette x essenziali */}
            {labelIdx.map((i) => (
              <text
                key={i}
                x={coords[i].x}
                y={HEIGHT - 6}
                textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
                className="fill-ink-muted font-mono text-[10px]"
              >
                {formatDue(points[i].iso)}
              </text>
            ))}

            {/* crosshair + marker (anello di superficie 2px) */}
            {hover !== null ? (
              <>
                <line
                  x1={coords[hover].x}
                  x2={coords[hover].x}
                  y1={PAD.top}
                  y2={PAD.top + innerH}
                  stroke="#C9CDD3"
                />
                <circle
                  cx={coords[hover].x}
                  cy={coords[hover].y}
                  r={5}
                  fill={COLOR}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
              </>
            ) : null}
          </>
        ) : null}
      </svg>
      <ChartTip tip={tip} />
      <ul className="sr-only">
        {points.map((p) => (
          <li key={p.iso}>
            {formatDue(p.iso)}: {p.value} completati
          </li>
        ))}
      </ul>
    </div>
  );
}
