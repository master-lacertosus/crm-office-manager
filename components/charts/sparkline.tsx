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

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      className="mt-2 h-7 w-full"
      preserveAspectRatio="none"
    >
      <path
        d={`${line} L${width},${height} L0,${height} Z`}
        fill={color}
        opacity={0.08}
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
