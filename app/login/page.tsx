import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";

import { LoginForm } from "@/components/login-form";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Accedi" };

export default function LoginPage() {
  return (
    <main className="grid flex-1 place-items-center p-6">
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
          <p className="mt-2 font-mono text-[11px] text-ink-muted">
            Office OS
          </p>
        </div>
        {/* Il form legge `next` dalla query per tornare dove si era diretti:
            useSearchParams esige un confine Suspense, altrimenti l'intera
            pagina uscirebbe dal rendering statico. */}
        <Suspense fallback={<div className="h-[340px]" />}>
          <LoginForm configurato={isSupabaseConfigured} />
        </Suspense>
      </div>
    </main>
  );
}
