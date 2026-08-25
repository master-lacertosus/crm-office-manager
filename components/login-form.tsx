"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";

import { TiltCard } from "@/components/tilt-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  requestPasswordReset,
  signIn,
  type AuthState,
} from "@/lib/supabase/auth";

const STATO_INIZIALE: AuthState = { error: null };

/**
 * Recupero password.
 *
 * Serve piu spesso di quanto sembri: chi e stato invitato e ha perso il link
 * non puo essere reinvitato — l'account esiste gia — e senza questa via
 * resterebbe fuori senza rimedio.
 */
function RecuperoPassword({
  onIndietro,
  avviso,
}: {
  onIndietro: () => void;
  /** Perche si e finiti qui: arriva dai link di invito ormai bruciati. */
  avviso?: string | null;
}) {
  const [state, formAction, pending] = React.useActionState(
    requestPasswordReset,
    STATO_INIZIALE,
  );
  const [mandato, setMandato] = React.useState(false);

  return (
    <form
      action={(fd) => {
        setMandato(true);
        formAction(fd);
      }}
      className="glass-strong space-y-4 rounded-2xl p-5"
    >
      <div>
        <h1 className="text-[17px]/6 font-semibold tracking-[-0.008em] text-ink">
          Recupera l&rsquo;accesso
        </h1>
        <p className="mt-1 text-[13px] text-ink-secondary">
          Ti mandiamo un link per impostare una password nuova.
        </p>
      </div>

      {avviso ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-[13px] text-warning-text"
        >
          <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden />
          {avviso}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="reset-email">Email</Label>
        <Input
          id="reset-email"
          name="email"
          type="email"
          placeholder="nome@lacertosus.com"
          autoComplete="email"
          required
          autoFocus
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

      {/* Nessuna conferma diversa fra indirizzo noto e sconosciuto: dirlo
          rivelerebbe a chiunque quali email hanno un account qui. */}
      {mandato && !pending && !state.error ? (
        <p
          role="status"
          className="rounded-xl bg-success-soft px-3 py-2 text-[13px] text-success-text"
        >
          Se quell&rsquo;indirizzo ha un account, il link è appena partito.
          Controlla la posta, anche nello spam.
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" /> : null}
        Mandami il link
      </Button>

      <button
        type="button"
        onClick={onIndietro}
        className="w-full text-center text-xs text-ink-muted hover:text-ink hover:underline"
      >
        Torna all&rsquo;accesso
      </button>
    </form>
  );
}

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
  /* Chi arriva da un link ormai bruciato porta con se il motivo: va
     mostrato, altrimenti si vede una pagina di accesso muta e non si capisce
     cosa sia andato storto. */
  const avviso = searchParams.get("errore");
  const [recupero, setRecupero] = React.useState(
    searchParams.get("recupero") === "1",
  );

  if (recupero) {
    return (
      <TiltCard>
        <RecuperoPassword
          onIndietro={() => setRecupero(false)}
          avviso={avviso}
        />
      </TiltCard>
    );
  }

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

        {state.error ?? avviso ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2 text-[13px] text-danger-text"
          >
            <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden />
            {state.error ?? avviso}
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

        {configurato ? (
          <button
            type="button"
            onClick={() => setRecupero(true)}
            className="w-full text-center text-xs text-ink-muted hover:text-ink hover:underline"
          >
            Password dimenticata?
          </button>
        ) : null}

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
