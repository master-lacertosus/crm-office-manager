"use client";

import * as React from "react";

import { useZen } from "@/components/shell/modalita-zen";
import { ZenScrivi } from "@/components/zen-scrivi";

/**
 * Il riquadro per scrivere, in cima ai Task quando la Zen è accesa.
 *
 * La Zen era nata togliendo voci di menu — utile, ma non era questo il
 * punto. Il punto era togliere il MODULO: scrivere quello che va fatto in
 * una frase, e vederlo diventare lavoro.
 *
 * Compare solo in Zen, e solo sui Task. Chi lavora normalmente ha già la
 * board e il pannello; chi entra in Zen sta dicendo «adesso butto giù
 * cose», ed è a quel gesto che serve una casella di testo grande.
 */
export function ZenRiquadro() {
  const [zen] = useZen();
  if (!zen) return null;

  return (
    <div className="border-b border-border-soft px-4 py-4 sm:px-6">
      <div className="card-soft p-4">
        <ZenScrivi />
      </div>
    </div>
  );
}
