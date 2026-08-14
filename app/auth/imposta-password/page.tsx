import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";

import { SetPasswordForm } from "@/components/set-password-form";

export const metadata: Metadata = { title: "Imposta la password" };

/**
 * Dove atterra chi arriva da un invito o da un recupero password.
 *
 * Il proxy lascia passare tutto ciò che sta sotto `/auth`: qui si arriva
 * senza sessione — o con una sessione appena creata dal link — e chiedere
 * l'accesso prima di poter impostare la password sarebbe un cerchio chiuso.
 */
export default function ImpostaPasswordPage() {
  return (
    <main className="grid min-h-dvh flex-1 place-items-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <Image
            src="/lacertosus-logo.svg"
            alt="Lacertosus"
            width={850}
            height={96}
            priority
            unoptimized
            className="h-[18px] w-auto"
          />
          <p className="mt-2 font-mono text-[11px] text-ink-muted">Office OS</p>
        </div>
        <Suspense fallback={<div className="h-64" />}>
          <SetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
