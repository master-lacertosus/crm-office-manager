"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { UserRound, Users } from "lucide-react";

import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * «Solo le mie» — l'interruttore accanto al profilo.
 *
 * Vedere il lavoro di tutti è il senso di una board condivisa, ma quando si
 * deve chiudere una cosa quel panorama è rumore. Il filtro per responsabile
 * esisteva già nell'indirizzo (`?owner=…`): qui diventa un gesto solo,
 * dove si guarda quando ci si chiede «e io cosa devo fare?».
 *
 * Non è una preferenza salvata, ed è voluto: è un modo di guardare che si
 * accende e si spegne dieci volte al giorno, non una scelta da ricordare
 * per sempre. Vive nell'indirizzo, quindi il tasto indietro lo annulla e la
 * memoria dei filtri lo riporta tornando nella sezione.
 */

/* Solo dove un filtro per responsabile ha senso. Nelle impostazioni o nei
   report un interruttore che non fa niente e' peggio che non averlo. */
const SEZIONI = ["/tasks", "/calendar", "/problems", "/projects"];

export function SoloMie({ compact = false }: { compact?: boolean }) {
  const { currentUser } = useAppStore();
  const router = useRouter();
  const pathname = usePathname();

  /* L'indirizzo si legge da `window` e non da `useSearchParams()`: quel hook
     obbliga ogni pagina che contiene questa barra a rinunciare alla
     generazione statica, e questa barra sta nel layout — cioè dentro tutte.
     È già costato una build rotta su /calendar. */
  const [attivo, setAttivo] = React.useState(false);
  React.useEffect(() => {
    const leggi = () =>
      setAttivo(
        new URLSearchParams(window.location.search).get("owner") ===
          currentUser.id,
      );
    leggi();
    window.addEventListener("popstate", leggi);
    return () => window.removeEventListener("popstate", leggi);
  }, [currentUser.id, pathname]);

  if (!SEZIONI.some((s) => pathname.startsWith(s))) return null;

  const cambia = () => {
    const params = new URLSearchParams(window.location.search);
    if (attivo) params.delete("owner");
    else params.set("owner", currentUser.id);
    /* Il pannello aperto non c'entra con il filtro: cambiando lente resta
       aperto quello che si stava guardando. */
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    setAttivo(!attivo);
  };

  const Icona = attivo ? UserRound : Users;

  return (
    <button
      type="button"
      onClick={cambia}
      aria-pressed={attivo}
      title={
        attivo
          ? "Stai vedendo solo le tue attività — premi per vedere tutto il team"
          : "Vedi solo le tue attività"
      }
      className={cn(
        "mb-1.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        attivo
          ? "bg-brand-50 text-brand-700"
          : "text-ink-secondary hover:bg-accent hover:text-ink",
      )}
    >
      <Icona aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
      <span className={cn("min-w-0 flex-1 truncate", compact && "md:hidden lg:block")}>
        {attivo ? "Solo le mie" : "Tutto il team"}
      </span>
    </button>
  );
}
