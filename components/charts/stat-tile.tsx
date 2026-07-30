"use client";

import * as React from "react";
import { animate, motion, useReducedMotion } from "motion/react";
import { MoveDown, MoveUp } from "lucide-react";

import { cn } from "@/lib/utils";

function useCountUp(value: number): number {
  const reduced = useReducedMotion();
  const [display, setDisplay] = React.useState(0);
  const previous = React.useRef(0);

  React.useEffect(() => {
    if (reduced) {
      previous.current = value;
      return;
    }
    const controls = animate(previous.current, value, {
      duration: 0.7,
      ease: [0.2, 0, 0, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    previous.current = value;
    return () => controls.stop();
  }, [value, reduced]);

  return reduced ? value : display;
}

/**
 * Numero-titolo con count-up e leggera profondità 3D all'hover.
 * `delta`: variazione vs periodo precedente (verde se il segno "buono"
 * coincide, rosso altrimenti).
 */
export function StatTile({
  label,
  value,
  delta,
  deltaPositiveIsGood = true,
  tone = "default",
  children,
  className,
}: {
  label: string;
  value: number;
  delta?: number;
  deltaPositiveIsGood?: boolean;
  tone?: "default" | "danger" | "brand";
  children?: React.ReactNode;
  className?: string;
}) {
  const display = useCountUp(value);
  const good = delta !== undefined && (delta >= 0) === deltaPositiveIsGood;

  return (
    <motion.div
      whileHover={{ y: -2, rotateX: 3 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      style={{ transformPerspective: 700 }}
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-xs transition-shadow hover:shadow-sm",
        className,
      )}
    >
      <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
        {label}
      </p>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <p
          className={cn(
            "font-mono text-[28px]/8 font-medium tabular-nums",
            tone === "danger" && value > 0 ? "text-danger-text" : "text-ink",
            tone === "brand" && value > 0 && "text-brand-700",
          )}
        >
          {display}
        </p>
        {delta !== undefined ? (
          <p
            className={cn(
              "flex items-center gap-0.5 pb-1 font-mono text-xs",
              delta === 0
                ? "text-ink-muted"
                : good
                  ? "text-success-text"
                  : "text-danger-text",
            )}
          >
            {delta > 0 ? (
              <MoveUp aria-hidden className="size-3" />
            ) : delta < 0 ? (
              <MoveDown aria-hidden className="size-3" />
            ) : null}
            {delta > 0 ? `+${delta}` : delta}
            <span className="sr-only"> rispetto ai 7 giorni precedenti</span>
          </p>
        ) : null}
      </div>
      {children}
    </motion.div>
  );
}
