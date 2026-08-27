"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Focus, X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Modalità Zen: solo Task, Richieste e Progetti.
 *
 * Il CRM ha dieci sezioni perché servono tutte, ma non nello stesso
 * momento. Quando si deve chiudere del lavoro, report, team, calendario e
 * impostazioni sono posti dove non si andrà — e stanno lì a occupare
 * l'angolo dell'occhio.
 *
 * Non è una pagina a parte e non nasconde dati: toglie di mezzo le
 * destinazioni che non servono adesso. Si accende e si spegne con un tasto,
 * e resta accesa fra un ricaricamento e l'altro perché chi la usa la tiene
 * per ore, non per un minuto.
 *
 * Vive accanto alla chat, in fondo allo schermo: sono i due interruttori
 * che riguardano «come sto lavorando adesso» invece che «cosa sto
 * guardando».
 */

const CHIAVE = "zen";

/** Le uniche sezioni che restano. Il resto si raggiunge spegnendo Zen. */
export const SEZIONI_ZEN = ["/tasks", "/requests", "/projects"];

export function useZen(): [boolean, (v: boolean) => void] {
  /* Si parte da spento e si legge dopo: leggere `localStorage` durante il
     primo render darebbe un risultato diverso fra server e browser, e React
     se ne accorgerebbe. */
  const [zen, setZen] = React.useState(false);

  React.useEffect(() => {
    const leggi = () => {
      try {
        setZen(localStorage.getItem(CHIAVE) === "1");
      } catch {
        /* senza storage si resta spenti, che è il comportamento di prima */
      }
    };
    leggi();
    /* Due schede aperte devono raccontare la stessa cosa. */
    window.addEventListener("storage", leggi);
    window.addEventListener("zen-cambiato", leggi);
    return () => {
      window.removeEventListener("storage", leggi);
      window.removeEventListener("zen-cambiato", leggi);
    };
  }, []);

  const cambia = React.useCallback((v: boolean) => {
    try {
      localStorage.setItem(CHIAVE, v ? "1" : "0");
    } catch {
      /* pazienza: vale per questa sessione */
    }
    setZen(v);
    /* L'evento `storage` non arriva alla scheda che ha scritto: si avvisa
       a mano chi sta ascoltando qui dentro. */
    window.dispatchEvent(new Event("zen-cambiato"));
  }, []);

  return [zen, cambia];
}

/** L'interruttore, accanto alla linguetta della chat. */
export function InterruttoreZen() {
  const [zen, setZen] = useZen();
  const router = useRouter();
  const pathname = usePathname();

  const accendi = () => {
    const prossimo = !zen;
    setZen(prossimo);
    /* Accendendo Zen da una sezione che Zen non ha, si resterebbe fermi su
       una pagina irraggiungibile: si accompagna ai Task, che è il posto in
       cui si va a lavorare. */
    if (prossimo && !SEZIONI_ZEN.some((s) => pathname.startsWith(s))) {
      router.push("/tasks");
    }
  };

  return (
    <button
      type="button"
      onClick={accendi}
      aria-pressed={zen}
      title={
        zen
          ? "Esci dalla modalità Zen"
          : "Modalità Zen: solo Task, Richieste e Progetti"
      }
      className={cn(
        "fixed bottom-0 left-1/2 z-90 flex h-10 w-20 translate-x-[calc(-50%+5.5rem)] items-end justify-center rounded-t-full pb-2.5 shadow-[0_-6px_24px_rgb(15_23_42/0.22)] transition-[height,padding] duration-200 outline-none hover:h-12 hover:pb-3.5 focus-visible:ring-2 focus-visible:ring-ring",
        zen
          ? "btn-glow text-white"
          : "border border-b-0 border-border bg-card text-ink-secondary hover:text-ink",
      )}
    >
      {zen ? (
        <X aria-hidden className="size-4" />
      ) : (
        <Focus aria-hidden className="size-4" />
      )}
      <span className="sr-only">
        {zen ? "Esci dalla modalità Zen" : "Modalità Zen"}
      </span>
    </button>
  );
}
