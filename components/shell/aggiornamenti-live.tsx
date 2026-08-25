"use client";

import * as React from "react";

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
  const toast = useToast();
  const ultimoRef = React.useRef(0);

  React.useEffect(() => {
    if (!aggiornamentoRemoto) return;
    if (aggiornamentoRemoto.id === ultimoRef.current) return;
    ultimoRef.current = aggiornamentoRemoto.id;
    toast(aggiornamentoRemoto.testo);
  }, [aggiornamentoRemoto, toast]);

  return null;
}
