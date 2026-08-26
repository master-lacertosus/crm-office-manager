"use client";

import * as React from "react";

import { usePreferences } from "@/lib/preferences";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/components/toaster";

/**
 * Dice che la board si è aggiornata da sola.
 *
 * Senza l'avviso il lavoro degli altri comparirebbe di soppiatto: si
 * vedrebbero schede spostarsi senza sapere perché. Vive qui e non nello
 * store perché i toast stanno più in basso nell'albero dei provider.
 */
export function AggiornamentiLive() {
  const { aggiornamentoRemoto } = useAppStore();
  const { prefs } = usePreferences();
  const toast = useToast();
  const ultimoRef = React.useRef(0);

  React.useEffect(() => {
    if (!aggiornamentoRemoto) return;
    /* Si annota comunque l'aggiornamento visto, anche a avvisi spenti:
       riaccendendoli non deve arrivare in blocco l'arretrato di mezza
       giornata. */
    const nuovo = aggiornamentoRemoto.id !== ultimoRef.current;
    ultimoRef.current = aggiornamentoRemoto.id;
    if (!nuovo) return;
    /* Chi ha spento gli avvisi vede comunque la board aggiornarsi: quello
       che sparisce è l'interruzione, non il dato. */
    if (!prefs.avvisiAltrui) return;
    toast(aggiornamentoRemoto.testo);
  }, [aggiornamentoRemoto, prefs.avvisiAltrui, toast]);

  return null;
}
