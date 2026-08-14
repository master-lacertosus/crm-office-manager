import type { Metadata } from "next";
import Link from "next/link";
import { Compass, KeyRound, MailPlus, UserX } from "lucide-react";

import { ConfigBackup } from "@/components/config-backup";
import { PhaseManager } from "@/components/phase-manager";
import { TemplateManager } from "@/components/template-manager";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Workspace" };

/** Gestione delle persone: tutto sulla pagina Team, non qui. Questo riquadro
 *  serve solo a dire dove sta, perché in Impostazioni la si cerca. */
const GESTIONE_PERSONE = [
  {
    icon: MailPlus,
    title: "Inviti",
    text: "«Invita» sulla pagina Team manda l'email per impostare la password.",
  },
  {
    icon: KeyRound,
    title: "Ruoli",
    text: "Promozione e retrocessione fra Member e Admin, dalla scheda della persona.",
  },
  {
    icon: UserX,
    title: "Disattivazione",
    text: "Un membro non si cancella: si disattiva, dopo aver riassegnato i suoi task aperti.",
  },
];

export default function WorkspaceSettingsPage() {
  return (
    <div className="space-y-4">
      <div className="card-soft p-4">
        <p className="text-[13px] font-medium text-ink-secondary">Workspace</p>
        <p className="mt-1 text-sm font-medium text-ink">
          Lacertosus — Marketing &amp; E-commerce
        </p>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link href="/dashboard?tour=1">
            <Compass data-icon="inline-start" />
            Rivedi il tour introduttivo
          </Link>
        </Button>
      </div>

      <TemplateManager />

      <PhaseManager />

      <ConfigBackup />

      <div className="card-soft p-4">
        <p className="text-[13px] font-medium text-ink-secondary">
          Gestione delle persone
        </p>
        <p className="mt-1 text-[13px] text-ink-muted">
          Si fa dalla pagina{" "}
          <Link href="/team" className="font-medium text-brand-600 hover:underline">
            Team
          </Link>
          .
        </p>
        <ul className="mt-3 space-y-3">
          {GESTIONE_PERSONE.map((item) => (
            <li key={item.title} className="flex gap-2.5">
              <item.icon
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-ink-faint"
                strokeWidth={1.75}
              />
              <div>
                <p className="text-sm font-medium text-ink">{item.title}</p>
                <p className="text-[13px] text-ink-muted">{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
