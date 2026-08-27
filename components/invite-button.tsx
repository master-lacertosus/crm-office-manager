"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, LoaderCircle, TriangleAlert, X } from "lucide-react";

import { useAppStore } from "@/lib/store";
import { inviteMember, type InviteState } from "@/lib/supabase/invites";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STATO_INIZIALE: InviteState = { error: null, ok: null };

/**
 * Invito di un collega. Visibile solo ai responsabili — ma nascondere il
 * pulsante non è la protezione: quella sta dentro la Server Action, che
 * verifica il ruolo prima di usare i poteri amministrativi. Qui si evita
 * soltanto di mostrare una porta che si aprirebbe con un no.
 */
export function InviteButton() {
  const { currentUser, loading } = useAppStore();
  const [open, setOpen] = React.useState(false);
  const [state, formAction, pending] = React.useActionState(
    inviteMember,
    STATO_INIZIALE,
  );

  if (loading || currentUser.role !== "admin") return null;

  const dialog = (
    <div className="fixed inset-0 z-100 grid place-items-center p-4">
      <div
        onClick={() => (pending ? null : setOpen(false))}
        className="absolute inset-0 bg-ink/20 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Invita un collega"
        className="relative w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-[0_24px_64px_rgb(15_23_42/0.22)]"
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          aria-label="Chiudi"
          className="absolute top-3 right-3 rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-accent hover:text-ink"
        >
          <X className="size-4" />
        </button>

        <h2 className="text-[15px] font-semibold text-ink">Invita un collega</h2>
        <p className="mt-1 text-[13px] text-ink-secondary">
          Riceverà un&rsquo;email per impostare la password. Nasce come membro:
          il ruolo di responsabile si assegna dopo.
        </p>

        <form action={formAction} className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="inv-email">Email</Label>
            <Input
              id="inv-email"
              name="email"
              type="email"
              placeholder="nome@lacertosus.com"
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inv-name">Nome e cognome</Label>
            <Input
              id="inv-name"
              name="full_name"
              placeholder="Es. Sara Bianchi"
              maxLength={80}
              required
            />
            <p className="text-[11px] text-ink-muted">
              Potrà cambiarlo al primo accesso.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inv-title">
              Qualifica{" "}
              <span className="font-normal text-ink-muted">(facoltativa)</span>
            </Label>
            <Input id="inv-title" name="title" maxLength={80} />
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

          {state.ok ? (
            <p
              role="status"
              className="flex items-start gap-2 rounded-xl bg-success-soft px-3 py-2 text-[13px] text-success-text"
            >
              <CheckCircle2 className="mt-px size-4 shrink-0" aria-hidden />
              {state.ok}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              {state.ok ? "Chiudi" : "Annulla"}
            </Button>
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {pending ? <LoaderCircle className="animate-spin" /> : null}
              Manda l&rsquo;invito
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <Button onClick={() => setOpen(true)}>Invita</Button>
      {open && typeof document !== "undefined"
        ? createPortal(dialog, document.body)
        : null}
    </>
  );
}
