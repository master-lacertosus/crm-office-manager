"use client";

import * as React from "react";
import {
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  MailPlus,
  TriangleAlert,
  UserCheck,
  UserX,
} from "lucide-react";

import { useAppStore } from "@/lib/store";
import {
  resendPasswordLink,
  type InviteState,
} from "@/lib/supabase/invites";
import type { Profile } from "@/lib/types";
import { Button } from "@/components/ui/button";

/**
 * Promozione, retrocessione e disattivazione di un collega.
 *
 * Le regole non stanno qui: le impone la guardia `profiles_guard` del
 * database, che rifiuta di lasciare il workspace senza amministratori attivi
 * e di disattivare chi ha ancora task aperti. Questo componente si limita a
 * chiedere e a mostrare il no quando arriva.
 *
 * È una scelta, non una pigrizia: replicare quelle condizioni in interfaccia
 * significherebbe due copie della stessa regola, e quella nel browser si
 * potrebbe aggirare.
 */
export function MemberActions({ profile }: { profile: Profile }) {
  const { currentUser, setProfileRole, setProfileActive, tasks } = useAppStore();
  const [inCorso, setInCorso] = React.useState<"ruolo" | "stato" | null>(null);
  const [errore, setErrore] = React.useState<string | null>(null);
  const [linkStato, linkAction, linkPending] = React.useActionState(
    resendPasswordLink,
    { error: null, ok: null } as InviteState,
  );

  // Su di sé non si agisce: né retrocedersi né disattivarsi.
  if (currentUser.role !== "admin" || profile.id === currentUser.id) return null;

  const eraAdmin = profile.role === "admin";
  const apertiSuoi = tasks.filter(
    (t) => t.owner_id === profile.id && t.status !== "done" && !t.archived_at,
  ).length;

  const esegui = async (
    quale: "ruolo" | "stato",
    azione: () => Promise<void>,
  ) => {
    setInCorso(quale);
    setErrore(null);
    try {
      await azione();
    } catch (e) {
      /* Qui arriva il messaggio della guardia, già in italiano e già
         esplicativo: «Operazione negata: è l'ultimo admin attivo», oppure
         «L'utente è responsabile di task aperti: riassegnarli prima di
         disattivarlo». Mostrarlo così com'è è meglio di qualunque
         riformulazione generica. */
      setErrore(e instanceof Error ? e.message : "Operazione non riuscita.");
    } finally {
      setInCorso(null);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={inCorso !== null}
        onClick={() =>
          esegui("ruolo", () =>
            setProfileRole(profile.id, eraAdmin ? "member" : "admin"),
          )
        }
      >
        {inCorso === "ruolo" ? (
          <LoaderCircle className="animate-spin" data-icon="inline-start" />
        ) : (
          <KeyRound data-icon="inline-start" />
        )}
        {eraAdmin ? "Rendi member" : "Rendi admin"}
      </Button>

      <Button
        variant={profile.is_active ? "outline" : "default"}
        size="sm"
        disabled={inCorso !== null}
        /* Il conteggio dei task aperti non blocca il pulsante: lo dice il
           titolo, ma la decisione resta al database. Disabilitare qui
           significherebbe fidarsi di un conteggio del browser, che può
           essere vecchio di qualche secondo. */
        title={
          profile.is_active && apertiSuoi > 0
            ? `Ha ${apertiSuoi} task aperti: vanno riassegnati prima`
            : undefined
        }
        onClick={() =>
          esegui("stato", () =>
            setProfileActive(profile.id, !profile.is_active),
          )
        }
      >
        {inCorso === "stato" ? (
          <LoaderCircle className="animate-spin" data-icon="inline-start" />
        ) : profile.is_active ? (
          <UserX data-icon="inline-start" />
        ) : (
          <UserCheck data-icon="inline-start" />
        )}
        {profile.is_active ? "Disattiva" : "Riattiva"}
      </Button>

      {/* Rimanda il link per impostare la password. Serve quando qualcuno non
          trova l'email dell'invito: potrebbe arrangiarsi da «Password
          dimenticata», ma un responsabile deve poterlo fare per lui invece di
          spiegargli dove cliccare. */}
      <form action={linkAction} className="contents">
        <input type="hidden" name="email" value={profile.email} />
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          disabled={linkPending || !profile.is_active}
          title={
            profile.is_active
              ? "Manda a questa persona il link per impostare la password"
              : "Riattiva il profilo prima di mandare il link"
          }
        >
          {linkPending ? (
            <LoaderCircle className="animate-spin" data-icon="inline-start" />
          ) : (
            <MailPlus data-icon="inline-start" />
          )}
          Link password
        </Button>
      </form>

      {errore || linkStato.error ? (
        <p
          role="alert"
          className="flex w-full items-start gap-2 rounded-lg bg-danger-soft px-2.5 py-1.5 text-[12px] text-danger-text"
        >
          <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          {errore ?? linkStato.error}
        </p>
      ) : null}

      {linkStato.ok ? (
        <p
          role="status"
          className="flex w-full items-start gap-2 rounded-lg bg-success-soft px-2.5 py-1.5 text-[12px] text-success-text"
        >
          <CheckCircle2 className="mt-px size-3.5 shrink-0" aria-hidden />
          {linkStato.ok}
        </p>
      ) : null}
    </>
  );
}
