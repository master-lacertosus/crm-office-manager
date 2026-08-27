"use client";

import * as React from "react";

import { usePreferences } from "@/lib/preferences";
import { useAppStore } from "@/lib/store";

/**
 * Applica la vista di partenza aprendo i Task.
 *
 * Chi guarda sempre le stesse cose — «i miei in corso», «tutto il progetto
 * X» — rimetteva gli stessi filtri a ogni apertura. La memoria dei filtri
 * copre lo spostamento fra sezioni; questa copre il primo arrivo della
 * giornata.
 *
 * Si applica SOLO se non è stato chiesto altro. Un indirizzo con dei
 * parametri viene da qualche parte — un link di un collega, il tasto
 * indietro, la memoria dei filtri — e sovrascriverlo con una preferenza
 * sarebbe ignorare una richiesta esplicita per imporre una vecchia.
 *
 * E una volta sola per visita: `replace` invece di `push`, così il tasto
 * indietro non rimbalza sulla vista di partenza all'infinito.
 */
export function VistaDiPartenza() {
  const { savedViews } = useAppStore();
  const {
    prefs: { vistaPredefinita },
  } = usePreferences();
  const fatto = React.useRef(false);

  React.useEffect(() => {
    if (fatto.current) return;
    if (!vistaPredefinita) return;

    /* L'indirizzo si legge da `window`: `useSearchParams()` toglierebbe la
       generazione statica alla pagina, ed è già costato una build. */
    const params = new URLSearchParams(window.location.search);
    const giaChiesto = ["owner", "project", "view"].some((k) => params.get(k));
    if (giaChiesto) {
      /* Non si riproverà a ogni cambio di filtro: la vista di partenza è
         per l'arrivo, non un guardiano. */
      fatto.current = true;
      return;
    }

    const vista = savedViews.find((v) => v.id === vistaPredefinita);
    /* Le viste arrivano dal server: finché non ci sono non si conclude
       niente, o si perderebbe la partenza per una manciata di millisecondi
       di ritardo. */
    if (!vista) return;

    fatto.current = true;
    if (!vista.params) return;
    /* `replaceState` e non `pushState`: la vista di partenza non è un passo
       della navigazione, è il punto in cui si arriva. Con `push` il tasto
       indietro rimbalzerebbe sull'indirizzo nudo e la partenza si
       riapplicherebbe, in un cerchio da cui non si esce. */
    window.history.replaceState(null, "", `?${vista.params}`);
    /* Le pagine leggono i filtri da `useSearchParams`, che non si accorge
       di una scrittura fatta a mano nella cronologia: glielo si dice. */
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, [savedViews, vistaPredefinita]);

  return null;
}
