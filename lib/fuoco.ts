/**
 * La trappola del fuoco, e il fuoco che torna dove stava.
 *
 * Nel repo non esisteva: in tutti i dialoghi, premendo Tab, si usciva dietro
 * il velo, e alla chiusura il fuoco restava su `<body>` — da lì il Tab
 * successivo riparte dalla cima della pagina, e chi naviga da tastiera deve
 * riattraversare tutta l'interfaccia per tornare dov'era.
 *
 * `docs/design-system.md:255` lo dà già per regola. Quindi questo non è
 * un'aggiunta al sistema: è un debito che si paga, e si paga qui perché il
 * popup del sondaggio è l'unico dialogo che si apre **senza che nessuno
 * l'abbia aperto** e chiede un gesto.
 *
 * Nasce riusabile di proposito: il secondo dialogo che lo adotta non deve
 * riscriverlo.
 */
import * as React from "react";

const FOCUSABILI = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function useTrappolaFuoco(
  rif: React.RefObject<HTMLElement | null>,
  aperto: boolean,
): void {
  React.useEffect(() => {
    if (!aperto) return;

    /* Si cattura PRIMA che l'`autoFocus` del dialogo sposti il fuoco. Se si
       leggesse dopo, si salverebbe il dialogo stesso, e alla chiusura il
       fuoco tornerebbe su un nodo che non esiste più. */
    const prima = document.activeElement as HTMLElement | null;

    const suTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !rif.current) return;
      const dentro = Array.from(
        rif.current.querySelectorAll<HTMLElement>(FOCUSABILI),
      ).filter(
        /* `offsetParent` è nullo per ciò che è nascosto: un bottone dentro un
           ramo chiuso non deve entrare nel giro. L'eccezione serve a non
           perdere l'elemento che ha il fuoco proprio adesso. */
        (n) => n.offsetParent !== null || n === document.activeElement,
      );
      if (dentro.length === 0) return;
      const primo = dentro[0];
      const ultimo = dentro[dentro.length - 1];
      if (e.shiftKey && document.activeElement === primo) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primo.focus();
      }
    };

    window.addEventListener("keydown", suTab);
    return () => {
      window.removeEventListener("keydown", suTab);
      prima?.focus?.();
    };
  }, [rif, aperto]);
}
