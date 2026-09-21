import type { Metadata } from "next";
import { Suspense } from "react";

import { richiediResponsabile } from "@/lib/supabase/guardie";
import { InviteButton } from "@/components/invite-button";
import { TeamViews, TeamViewToggle } from "@/components/team-views";
import { Topbar } from "@/components/shell/topbar";

export const metadata: Metadata = { title: "Team" };

/**
 * La vista (?view=) è letta lato client in TeamViews, così il toggle
 * Persone/Carico è istantaneo e non passa dal server.
 *
 * La route però NON è statica, e il commento che stava qui diceva il
 * contrario. `richiediResponsabile()` legge i cookie e interroga il database:
 * Team è una delle due sole pagine dinamiche del prodotto — l'altra è
 * Workspace, stesso cancello. Le altre nove sono prerenderizzate e si aprono
 * all'istante, ed è per questo che l'attesa di questa non si legge come «più
 * lenta» ma come «rotta»: si preme, e resta a vista la pagina di prima.
 *
 * La risposta è `loading.tsx`, accanto a questo file. Non rende la pagina più
 * veloce: la rende visibile mentre lavora.
 *
 * Il cancello resta dov'è, prima di tutto il resto. Le email e i carichi di
 * tutti non devono arrivare al browser di chi non li può vedere, e un
 * controllo fatto dopo aver disegnato sarebbe una tenda, non una porta.
 */
export default async function TeamPage() {
  // Email, carichi e ruoli di tutti: sezione da responsabili.
  await richiediResponsabile();

  return (
    <>
      <Topbar
        title="Team"
        actions={
          <>
            <Suspense>
              <TeamViewToggle />
            </Suspense>
            <Suspense>
              <InviteButton />
            </Suspense>
          </>
        }
      />
      <Suspense>
        <TeamViews />
      </Suspense>
    </>
  );
}
