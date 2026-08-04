"use client";

import { cn } from "@/lib/utils";

/**
 * Sparkline minimale (dentro le stat tile): niente assi, solo la forma.
 * Pensata come fascia a tutta larghezza sul fondo della tile; l'ultimo
 * valore è marcato da un punto pieno con anello bianco di superficie.
 */
export function Sparkline({
  values,
  color = "#047857",
  ariaLabel,
  className,
  endDot = true,
}: {
  values: number[];
  color?: string;
  ariaLabel: string;
  /** Dimensioni del contenitore (default: fascia h-9 a tutta larghezza). */
  className?: string;
  /** Punto sull'ultimo valore (il «periodo corrente» del trend). */
  endDot?: boolean;
}) {
  const width = 120;
  const height = 28;

  if (values.length < 2) return null;

  const max = Math.max(1, ...values);
  const step = width / (values.length - 1);

  // 5px di riserva sopra/sotto: l'end-dot (r=4) resta dentro la fascia.
  const points = values.map((v, i) => ({
    x: i * step,
    y: height - 5 - (v / max) * (height - 10),
  }));
  const last = points[points.length - 1];
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  const gradId = `spark-${color.replace("#", "")}`;

  return (
    <div className={cn("relative h-9 w-full", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        className="size-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path
          d={`${line} L${width},${height} L0,${height} Z`}
          fill={`url(#${gradId})`}
        />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {endDot ? (
        <span
          aria-hidden
          className="absolute size-2 -translate-y-1/2 rounded-full ring-2 ring-white"
          style={{
            top: `${(last.y / height) * 100}%`,
            right: 2,
            background: color,
          }}
        />
      ) : null}
    </div>
  );
}
