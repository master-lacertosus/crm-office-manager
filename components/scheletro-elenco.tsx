import { cn } from "@/lib/utils";

/**
 * La forma di un elenco che sta arrivando.
 *
 * Serve a due momenti diversi che producono lo stesso identico vuoto:
 * l'attesa del SERVER (le pagine Team e Workspace sono le uniche due
 * dinamiche del prodotto: hanno un cancello che decide sul server se sei un
 * responsabile, e finché non risponde il browser resta fermo sulla pagina da
 * cui sei partito) e l'attesa del CLIENT (lo store legge diciotto tabelle, e
 * fino ad allora l'elenco è un array vuoto, cioè una scheda con dentro
 * niente).
 *
 * Senza questo, premere «Team» sembrava che non facesse nulla. Non era un
 * link rotto: era una pagina che non aveva niente da mostrare mentre
 * lavorava, in mezzo a nove pagine che si aprono all'istante.
 *
 * `.skeleton` era documentata fra le primitive e non l'aveva mai usata
 * nessuno — e fino a ieri non era nemmeno utilizzabile, perché aveva il fondo
 * e il luccichio scritti in bianco a mano.
 */
export function ScheletroElenco({
  righe = 5,
  className,
}: {
  righe?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex-1 px-4 py-4 sm:px-6", className)}>
      <div
        className="card-soft overflow-hidden"
        role="status"
        aria-label="Caricamento in corso"
      >
        {Array.from({ length: righe }, (_, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center gap-3 px-4 py-3",
              i > 0 && "border-t border-border-soft",
            )}
          >
            <span aria-hidden className="skeleton size-9 shrink-0 rounded-full" />
            <span className="min-w-0 flex-1 space-y-1.5">
              {/* Larghezze che si alternano invece di essere tutte uguali: una
                  colonna di barre identiche si legge come un difetto di
                  disegno, non come del testo in arrivo. */}
              <span
                aria-hidden
                className="skeleton block h-3.5"
                style={{ width: i % 2 === 0 ? "38%" : "46%" }}
              />
              <span
                aria-hidden
                className="skeleton block h-3"
                style={{ width: i % 2 === 0 ? "56%" : "48%" }}
              />
            </span>
            <span aria-hidden className="skeleton h-5 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
