"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { TiltCard } from "@/components/tilt-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Placeholder: nessuna autenticazione reale (arriverà con Supabase, M1).
    await new Promise((r) => setTimeout(r, 400));
    router.push("/dashboard");
  };

  return (
    <TiltCard>
    <form
      onSubmit={submit}
      className="glass-strong space-y-4 rounded-2xl p-5"
    >
      <div>
        <h1 className="text-[17px]/6 font-semibold tracking-[-0.008em] text-ink">
          Accedi
        </h1>
        <p className="mt-1 text-[13px] text-ink-secondary">
          La piattaforma operativa dell&rsquo;ufficio marketing ed e-commerce.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          placeholder="nome@lacertosus.com"
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="login-password">Password</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
        />
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? <LoaderCircle className="animate-spin" /> : null}
        Accedi
      </Button>

      <p className="text-center text-xs text-ink-muted">
        Accesso dimostrativo: qualunque credenziale entra.
        L&rsquo;autenticazione arriverà con Supabase.
      </p>
    </form>
    </TiltCard>
  );
}
