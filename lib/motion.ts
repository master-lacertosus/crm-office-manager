import type { Transition, Variants } from "motion/react";

/**
 * Token e preset Motion — docs/design-system.md §8.
 * Il movimento spiega da dove arrivano le cose; spostamenti max 24px,
 * mai animare width/height, un solo momento orchestrato per vista.
 */

export const dur = {
  /** Hover, pressed, cambi colore (di norma via CSS). */
  fast: 0.12,
  /** Fade/scale di menu, toast, tooltip. */
  base: 0.18,
  /** Pannello laterale, drawer, sheet. */
  slow: 0.26,
} as const;

export const ease = {
  out: [0.2, 0, 0, 1],
  inOut: [0.45, 0, 0.15, 1],
} as const;

export const transition = {
  base: { duration: dur.base, ease: ease.out } satisfies Transition,
  slow: { duration: dur.slow, ease: ease.out } satisfies Transition,
  exit: { duration: dur.base, ease: ease.inOut } satisfies Transition,
} as const;

/** Comparsa semplice (toast container, cambi vista). */
export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transition.base },
  exit: { opacity: 0, transition: transition.exit },
};

/** Menu e popover: opacità + scala minima. */
export const pop: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.14, ease: ease.out } },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.1, ease: ease.inOut } },
};

/** Toast e card in ingresso: salgono di 4px. */
export const rise: Variants = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0, transition: transition.base },
  exit: { opacity: 0, y: 4, transition: transition.exit },
};

/** Pannello laterale del task: scivola da destra. */
export const panel: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: transition.slow },
  exit: { opacity: 0, x: 24, transition: transition.exit },
};

/** Drawer di navigazione mobile: entra dal bordo sinistro. */
export const drawer: Variants = {
  hidden: { x: "-100%" },
  visible: { x: 0, transition: transition.slow },
  exit: { x: "-100%", transition: transition.exit },
};

/** Foglio ancorato al bordo inferiore: sale dal bordo, come il drawer fa da
 *  sinistra. Fuori dalla regola dei 24px per la stessa ragione del drawer —
 *  l'elemento non «appare», entra dal bordo da cui è nato. */
export const sheet: Variants = {
  hidden: { y: "100%" },
  visible: { y: 0, transition: transition.slow },
  exit: { y: "100%", transition: transition.exit },
};

/** Velo dietro pannelli e dialoghi. */
export const scrim: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transition.base },
  exit: { opacity: 0, transition: transition.exit },
};
