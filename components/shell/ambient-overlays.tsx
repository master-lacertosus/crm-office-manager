"use client";

import { CommandPalette } from "@/components/command-palette";
import { IlCapo } from "@/components/il-capo";
import { OnboardingTour } from "@/components/onboarding-tour";

/** Overlay ambientali (palette ⌘K, il Capo, tour): raggruppati qui così
 *  viaggiano in UN solo chunk lazy — vedi lazy-overlays.tsx. */
export function AmbientOverlays() {
  return (
    <>
      <CommandPalette />
      <IlCapo />
      <OnboardingTour />
    </>
  );
}
