"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { ricorda, riprendiDallaSessione } from "@/lib/memoria-filtri";

/**
 * Annota i filtri della sezione che si sta lasciando, comunque la si lasci.
 *
 * Fino a ieri l'unico posto che chiamava `ricorda()` era il clic su una voce
 * della barra laterale. Tutto il resto usciva in silenzio: la palette
 * (Ctrl+K), le scorciatoie T e P, un link dentro una scheda, il tasto
 * indietro, un avviso della campanella. Chi filtrava i task per progetto e
 * poi saltava al Calendario con la palette tornava a un elenco completo,
 * e la memoria sembrava rotta pur essendo giusta: nessuno le aveva detto
 * niente.
 *
 * Qui si guarda l'indirizzo invece dei gesti. Ogni volta che il percorso
 * cambia si annota DOVE SI ERA un istante prima, con i filtri che c'erano.
 * Un solo punto, e non importa più da quale bottone si è usciti — che è
 * anche il motivo per cui la prossima strada di navigazione, quella che
 * nessuno ha ancora scritto, funzionerà senza che qualcuno se ne ricordi.
 *
 * Va montato dentro un <Suspense>: legge `useSearchParams`, e senza la
 * sospensione obbligherebbe ogni pagina del guscio a rinunciare alla
 * generazione statica — è già costato una build su /calendar una volta.
 */
export function MemoriaDiDoveEri() {
  const pathname = usePathname();
  /* Serve iscriversi ai parametri, non solo leggerli: cambiando un filtro
     l'indirizzo cambia senza cambiare percorso, e senza questa iscrizione
     il componente non si ridisegnerebbe e annoterebbe i filtri di due
     schermate fa. */
  const searchParams = useSearchParams();
  const dovEro = React.useRef<{ percorso: string; search: string } | null>(
    null,
  );

  /* Prima cosa dopo il montaggio: riprendere quello che si era annotato
     prima del ricaricamento. Qui e non al caricamento del modulo, o il
     browser disegnerebbe link diversi da quelli arrivati dal server. */
  React.useEffect(() => {
    riprendiDallaSessione();
  }, []);

  React.useEffect(() => {
    const prima = dovEro.current;
    /* `window.location.search` e non `searchParams.toString()`: il secondo
       riordina e ricodifica, e quello che si vuole ricordare è l'indirizzo
       così com'era. */
    const search = window.location.search;
    if (prima && prima.percorso !== pathname) {
      ricorda(prima.percorso, prima.search);
    }
    dovEro.current = { percorso: pathname, search };
  }, [pathname, searchParams]);

  return null;
}
