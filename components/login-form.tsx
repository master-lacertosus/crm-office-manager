"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";

import { TiltCard } from "@/components/tilt-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, type AuthState } from "@/lib/supabase/auth";

const STATO_INIZIALE: AuthState = { error: null };

export function LoginForm({ configurato }: { configurato: boolean }) {
  /* useActionState (React 19) tiene insieme invio, stato di attesa ed errore
     restituito dal server: niente useState per il caricamento, e il form
     resta funzionante anche prima che il JavaScript sia arrivato. */
  const [state, formAction, pending] = React.useActionState(
    signIn,
    STATO_INIZIALE,
  );
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";

  return (
    <TiltCard>
      <form action={formAction} className="glass-strong space-y-4 rounded-2xl p-5">
        <div>
          <h1 className="text-[17px]/6 font-semibold tracking-[-0.008em] text-ink">
            Accedi
          </h1>
          <p className="mt-1 text-[13px] text-ink-secondary">
            La piattaforma operativa dell&rsquo;ufficio marketing ed e-commerce.
          </p>
        </div>

        <input type="hidden" name="next" value={next} />

        <div className="space-y-2">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            name="email"
            type="email"
            placeholder="nome@lacertosus.com"
            autoComplete="email"
            required
            disabled={!configurato}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={!configurato}
          />
        </div>

        {state.error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2 text-[13px] text-danger-text"
          >
            <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden />
            {state.error}
          </p>
        ) : null}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={pending || !configurato}
          aria-busy={pending}
        >
          {pending ? <LoaderCircle className="animate-spin" /> : null}
          Accedi
        </Button>

        {!configurato ? (
          <p className="text-center text-xs text-ink-muted">
            Supabase non è configurato: compila <code>.env.local</code> con URL
            e chiave pubblicabile del progetto.
          </p>
        ) : null}
      </form>
    </TiltCard>
  );
}
