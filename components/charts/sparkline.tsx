"use client";

/** Sparkline minimale (dentro le stat tile): niente assi, solo la forma. */
export function Sparkline({
  values,
  color = "#047857",
  ariaLabel,
}: {
  values: number[];
  color?: string;
  ariaLabel: string;
}) {
  const width = 120;
  const height = 28;
  const max = Math.max(1, ...values);
  const step = width / (values.length - 1);

  const points = values.map((v, i) => ({
    x: i * step,
    y: height - 3 - (v / max) * (height - 6),
  }));
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  const gradId = `spark-${color.replace("#", "")}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      className="mt-2 h-7 w-full"
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
  );
}
