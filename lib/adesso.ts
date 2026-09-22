"use client";

import * as React from "react";

/**
 * Che ora è — ma solo nel browser.
 *
 * SUL SERVER NON ESISTE UN «ADESSO» CHE SI POSSA DISEGNARE, e questa non è
 * una sottigliezza: è un guasto che questo progetto ha già pagato tre volte
 * (la modalità Zen, la memoria dei filtri, la pastiglia «Timbra») e una
 * quarta il 22/09/2026, quando la pagina Sondaggi ha smesso di aprirsi.
 *
 * Il meccanismo è sempre lo stesso. Next disegna la pagina due volte: una sul
 * server e una nel browser, e pretende che vengano identiche — se non lo sono,
 * l'idratazione fallisce e il ramo di errore si porta via tutta la pagina.
 * Ma il server di Vercel vive in UTC e chi guarda sta a Roma. Quindi:
 *
 *     `min` del campo scadenza, dal server : 2026-09-22T15:29
 *     lo stesso campo, dal browser          : 2026-09-22T17:29
 *
 * Due ore di differenza, sempre, tutto l'anno — e basta un attributo diverso.
 * Una durata («3h 12m») se la cava perché è la stessa in ogni fuso; un'ora,
 * una data o un giorno locale no.
 *
 * LA CURA. `getServerSnapshot` torna `null`, e React lo usa sia sul server sia
 * al PRIMO disegno nel browser: i due si assomigliano per costruzione, perché
 * nessuno dei due conosce l'ora. Subito dopo l'idratazione si passa a
 * `getSnapshot` e l'ora compare. Chi usa questo hook deve quindi saper
 * disegnare anche il caso `null` — ed è giusto che gli sia chiesto: è il caso
 * che vede il server.
 *
 * `passoMs` è ogni quanto si riguarda l'orologio. Un minuto per le scadenze:
 * un contatore al secondo sarebbe un movimento che nessuno ha chiesto.
 */
export function useAdesso(passoMs = 60_000): Date | null {
  const battito = React.useSyncExternalStore(
    React.useCallback(
      (avvisa: () => void) => {
        const t = setInterval(avvisa, passoMs);
        return () => clearInterval(t);
      },
      [passoMs],
    ),
    () => Math.floor(Date.now() / passoMs),
    /* Il server non ha un adesso da mostrare, e nemmeno il primo disegno del
       browser: devono combaciare. */
    () => null,
  );

  /* `battito` serve a far ridisegnare, non come valore: l'ora vera si legge
     qui, al momento del disegno. */
  return battito === null ? null : new Date();
}
