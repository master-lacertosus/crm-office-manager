import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * L'icona di una stat tile: quadrato morbido, tinta tenue, tratto pieno.
 *
 * Stava dentro `dashboard-content.tsx` finché a servirle è stata una pagina
 * sola. Adesso le pagine sono due (la dashboard e «Le mie ore») e due copie
 * della stessa misura divergono al primo ritocco — su questo repo è già
 * successo con l'ordinamento e con i filtri.
 *
 * `className` porta la coppia fondo+inchiostro (`bg-*-soft text-*-text`): il
 * colore lo decide chi la usa, perché dipende da cosa sta contando.
 */
export function KpiIcon({
  icon: Icon,
  className,
}: {
  icon: LucideIcon;
  className: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-xl",
        className,
      )}
    >
      <Icon className="size-5" strokeWidth={2} />
    </span>
  );
}
