"use client";

import * as React from "react";
import Link from "next/link";
import { animate, motion, useReducedMotion } from "motion/react";
import { ChevronRight, MoveDown, MoveUp } from "lucide-react";

import { cn } from "@/lib/utils";

function useCountUp(value: number, decimals = 0): number {
  const reduced = useReducedMotion();
  const [display, setDisplay] = React.useState(0);
  const previous = React.useRef(0);
  const factor = 10 ** decimals;

  React.useEffect(() => {
    if (reduced) {
      previous.current = value;
      return;
    }
    const controls = animate(previous.current, value, {
      duration: 0.7,
      ease: [0.2, 0, 0, 1],
      onUpdate: (v) => setDisplay(Math.round(v * factor) / factor),
    });
    previous.current = value;
    return () => controls.stop();
  }, [value, reduced, factor]);

  return reduced ? value : display;
}

/**
 * KPI in stile mockup: icona in quadrato soft, etichetta uppercase, numero
 * con count-up, sottotitolo operativo o delta a pillola; chevron se naviga.
 * Il contenuto extra (sparkline) è una fascia a tutta larghezza ancorata al
 * fondo della card; con `h-full` la griglia tiene ogni riga di tile alla
 * stessa altezza e il testo si centra nello spazio che avanza.
 * Alone «aurora» via --aurora.
 */
export function StatTile({
  label,
  value,
  decimals = 0,
  sublabel,
  delta,
  deltaLabel = "vs sett.",
  deltaPositiveIsGood = true,
  tone = "default",
  icon,
  aurora,
  href,
  children,
  className,
}: {
  label: string;
  value: number;
  /** Cifre decimali mostrate (es. 1 per «4,5 giorni»). */
  decimals?: number;
  sublabel?: string;
  delta?: number;
  /** Suffisso del delta (default «vs sett.»). */
  deltaLabel?: string;
  deltaPositiveIsGood?: boolean;
  tone?: "default" | "danger" | "brand";
  icon?: React.ReactNode;
  /** Alone colorato in alto a destra (es. "rgb(59 130 246 / 0.10)"). */
  aurora?: string;
  href?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const display = useCountUp(value, decimals);
  const good = delta !== undefined && (delta >= 0) === deltaPositiveIsGood;

  const body = (
    <motion.div
      whileHover={href ? { y: -2 } : undefined}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      style={aurora ? ({ "--aurora": aurora } as React.CSSProperties) : undefined}
      className={cn(
        "card-soft flex h-full min-w-0 flex-col p-4",
        aurora && "tile-aurora",
        href && "transition-shadow hover:shadow-sm",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        {icon}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.05em] text-ink-secondary uppercase sm:truncate">
            {label}
          </p>
          <p
            className={cn(
              "mt-0.5 text-[30px]/9 font-bold tracking-[-0.01em]",
              tone === "danger" && value > 0 ? "text-danger-text" : "text-ink",
              tone === "brand" && value > 0 && "text-status-review-text",
            )}
          >
            {display}
          </p>
          {sublabel ? (
            <p className="truncate text-xs text-ink-muted">{sublabel}</p>
          ) : null}
          {delta !== undefined ? (
            <p className="mt-1">
              <span
                className={cn(
                  "inline-flex max-w-full items-center gap-0.5 rounded-full px-1.5 py-px font-mono text-[11px] font-medium whitespace-nowrap",
                  delta === 0
                    ? "bg-muted text-ink-muted"
                    : good
                      ? "bg-success-soft text-success-text"
                      : "bg-danger-soft text-danger-text",
                )}
              >
                {delta > 0 ? (
                  <MoveUp aria-hidden className="size-3 shrink-0" />
                ) : delta < 0 ? (
                  <MoveDown aria-hidden className="size-3 shrink-0" />
                ) : null}
                {delta > 0 ? `+${delta}` : delta} {deltaLabel}
              </span>
            </p>
          ) : null}
        </div>
        {href ? (
          <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-faint" />
        ) : null}
      </div>
      {children ? (
        <div className="-mx-4 -mb-4 mt-2 shrink-0 overflow-hidden rounded-b-[19px]">
          {children}
        </div>
      ) : null}
    </motion.div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block h-full rounded-[20px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        {body}
      </Link>
    );
  }
  return body;
}
