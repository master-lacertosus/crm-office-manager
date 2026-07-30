"use client";

import * as React from "react";
import { RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Error boundary di segmento: qualunque errore runtime (inclusi i chunk
 * stantii dopo un deploy) mostra una schermata brandizzata con recupero
 * a un click invece della pagina bianca.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid flex-1 place-items-center p-6">
      <div className="card-soft w-full max-w-md p-6 text-center">
        <span
          aria-hidden
          className="mx-auto flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600"
        >
          <RotateCw className="size-5" />
        </span>
        <h1 className="mt-3 text-[20px]/7 font-bold text-ink">
          Qualcosa è andato storto
        </h1>
        <p className="mt-1.5 text-sm text-ink-secondary">
          Di solito succede dopo un aggiornamento dell&rsquo;app con una
          scheda rimasta aperta. Ricaricare risolve.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button onClick={() => window.location.reload()}>
            <RotateCw data-icon="inline-start" />
            Ricarica la pagina
          </Button>
          <Button variant="outline" onClick={reset}>
            Riprova
          </Button>
        </div>
        {error.digest ? (
          <p className="mt-3 font-mono text-[10px] text-ink-faint">
            codice: {error.digest}
          </p>
        ) : null}
      </div>
    </main>
  );
}
