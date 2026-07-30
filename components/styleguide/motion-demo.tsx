"use client";

import * as React from "react";
import { motion, type Variants } from "motion/react";

import { fade, panel, pop, rise } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { StatusLabel } from "@/components/status-pip";

const PRESETS: Record<string, { variants: Variants; note: string }> = {
  fade: { variants: fade, note: "180ms · cambi vista, toast container" },
  pop: { variants: pop, note: "140ms · menu e popover" },
  rise: { variants: rise, note: "180ms · toast e card in ingresso" },
  panel: { variants: panel, note: "260ms · pannello laterale del task" },
};

/** Riproduce i preset di lib/motion.ts su una card campione. */
export function MotionDemo() {
  const [preset, setPreset] = React.useState<keyof typeof PRESETS>("panel");
  const [replay, setReplay] = React.useState(0);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="flex flex-wrap gap-2 sm:w-44 sm:flex-col">
        {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((name) => (
          <Button
            key={name}
            variant={name === preset ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setPreset(name);
              setReplay((n) => n + 1);
            }}
            className="justify-start font-mono text-xs"
          >
            {name}
          </Button>
        ))}
      </div>

      <div className="flex min-h-36 flex-1 items-center justify-center overflow-hidden rounded-xl border border-border-soft bg-canvas p-6">
        <motion.div
          key={`${preset}-${replay}`}
          variants={PRESETS[preset].variants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-xs"
        >
          <p className="text-sm font-medium text-ink">
            Shooting still life OKTA RIG 3.5
          </p>
          <div className="mt-2 flex items-center justify-between">
            <StatusLabel status="in_review" />
            <span className="font-mono text-xs text-ink-muted">12 set</span>
          </div>
        </motion.div>
      </div>

      <p className="text-[13px] text-ink-muted sm:w-40">
        {PRESETS[preset].note}. Con <em>prefers-reduced-motion</em> ogni
        preset degrada a una dissolvenza.
      </p>
    </div>
  );
}
