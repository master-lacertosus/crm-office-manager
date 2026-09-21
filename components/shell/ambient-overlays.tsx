"use client";

import { CommandPalette } from "@/components/command-palette";
import { IlCapo } from "@/components/il-capo";
import { OnboardingTour } from "@/components/onboarding-tour";
import { PopupSondaggio } from "@/components/sondaggi/popup-sondaggio";

/** Overlay ambientali (palette ⌘K, il Capo, tour, sondaggio): raggruppati qui
 *  così viaggiano in UN solo chunk lazy — vedi lazy-overlays.tsx.
 *  Il popup del sondaggio sta qui e non in una pagina perché deve poter
 *  comparire ovunque ci si trovi: una domanda al team non aspetta che tu
 *  apra la pagina giusta. */
export function AmbientOverlays() {
  return (
    <>
      <CommandPalette />
      <IlCapo />
      <OnboardingTour />
      <PopupSondaggio />
    </>
  );
}
