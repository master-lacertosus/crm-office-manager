/**
 * Aggiornamenti del workspace dal vivo.
 *
 * Il canale non porta i dati: annuncia soltanto che qualcosa è cambiato. A
 * rileggere ci pensa lo store, con una lettura completa — così il risultato
 * è identico a quello di un avvio pulito, invece di venti fusioni riga per
 * riga da tenere in piedi (e da sbagliare).
 *
 * Le tabelle sono quelle che cambiano durante una giornata di lavoro: la
 * cronologia e i registri append-only si ricaricano insieme al resto, non
 * serve un annuncio per loro.
 */

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

const TABELLE = [
  "tasks",
  "task_checklist_items",
  "task_links",
  "task_collaborators",
  "task_comments",
  "project_comments",
  "task_requests",
  "leave_requests",
  "notifications",
  /* I sondaggi cambiano durante la giornata e riguardano gli ALTRI: e il
     criterio dichiarato qui sopra. Senza queste tre righe il canale si apre
     e non arriva mai niente, e il battito da 60 secondi maschera il buco
     facendo sembrare il sondaggio lento invece che rotto.
     `sondaggio_schede` NO, ed e una scelta: e lurna. Non ha lettori oltre
     al proprietario, quindi non porterebbe niente a nessuno -- ma lasciarla
     fuori dice a chi legge che li dentro non si entra. */
  "sondaggi",
  "sondaggio_opzioni",
  "sondaggio_firme",
] as const;

export function subscribeToWorkspace(
  supabase: SupabaseClient,
  callbacks: {
    /** Qualcosa è cambiato sul database: è ora di rileggere. */
    onCambio: () => void;
    /** Il canale è aperto? Se non lo è, lo store torna al controllo
     *  periodico: meglio lenti che fermi. */
    onStato?: (attivo: boolean) => void;
  },
): RealtimeChannel {
  const canale = supabase.channel("workspace-live");

  for (const table of TABELLE) {
    canale.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      () => callbacks.onCambio(),
    );
  }

  canale.subscribe((stato) => {
    callbacks.onStato?.(stato === "SUBSCRIBED");
  });

  return canale;
}
