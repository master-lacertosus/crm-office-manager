import type { Metadata } from "next";

import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Accedi" };

export default function LoginPage() {
  return (
    <main className="grid flex-1 place-items-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex size-8 items-center justify-center rounded-lg bg-primary text-[15px] font-bold text-primary-foreground"
          >
            L
          </span>
          <div className="leading-none">
            <p className="text-sm font-semibold tracking-tight text-ink">
              LACERTOSUS
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-ink-muted">
              Office OS
            </p>
          </div>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
