import Link from "next/link";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * L'indirizzo che non porta da nessuna parte.
 *
 * Mancava, ed era l'unico stato scoperto in un prodotto che altrove copre
 * vuoto, errore e caricamento con cura. Senza questo file Next.js mostra la
 * sua pagina di serie: inglese, senza barra, senza tema, senza una strada per
 * tornare indietro — e capita per cose ordinarie, un link vecchio a un task
 * cancellato o un indirizzo scritto male.
 *
 * Non dice «404» in grande: il numero non aiuta nessuno a fare quello che
 * stava facendo. Dice cosa è successo e dove si torna.
 */
export default function NonTrovata() {
  return (
    <main className="grid min-h-dvh flex-1 place-items-center p-6">
      <div className="card-soft w-full max-w-md p-6 text-center">
        <span
          aria-hidden
          className="mx-auto flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600"
        >
          <Compass className="size-5" />
        </span>
        <h1 className="mt-3 text-[20px]/7 font-bold text-ink">
          Questa pagina non c&rsquo;è
        </h1>
        <p className="mt-1.5 text-sm text-ink-secondary">
          L&rsquo;indirizzo non porta da nessuna parte. Di solito è un link
          vecchio: la cosa che cercavi potrebbe essere stata archiviata o
          spostata.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/dashboard">Vai alla Dashboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/tasks">Apri i task</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
