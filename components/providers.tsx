"use client";

import { MotionConfig } from "motion/react";

/**
 * Provider globali dell'app. MotionConfig propaga `prefers-reduced-motion`
 * a tutti i componenti Motion (regola di docs/design-system.md §8).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
