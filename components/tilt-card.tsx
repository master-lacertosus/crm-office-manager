"use client";

import * as React from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";

/**
 * Profondità 3D discreta: la card inclina di pochi gradi seguendo il
 * puntatore (solo pointer fine; disattivata con prefers-reduced-motion).
 */
export function TiltCard({
  children,
  maxDegrees = 4,
  className,
}: {
  children: React.ReactNode;
  maxDegrees?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);

  const rotateX = useSpring(
    useTransform(py, [0, 1], [maxDegrees, -maxDegrees]),
    { stiffness: 260, damping: 24 },
  );
  const rotateY = useSpring(
    useTransform(px, [0, 1], [-maxDegrees, maxDegrees]),
    { stiffness: 260, damping: 24 },
  );

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const rect = e.currentTarget.getBoundingClientRect();
        px.set((e.clientX - rect.left) / rect.width);
        py.set((e.clientY - rect.top) / rect.height);
      }}
      onPointerLeave={() => {
        px.set(0.5);
        py.set(0.5);
      }}
    >
      {children}
    </motion.div>
  );
}
