import type { Metadata } from "next";
import { KeyRound, MailPlus, UserX } from "lucide-react";

export const metadata: Metadata = { title: "Workspace" };

const UPCOMING = [
  {
    icon: MailPlus,
    title: "Inviti",
    text: "Invito via email dei nuovi membri (solo admin).",
  },
  {
    icon: KeyRound,
    title: "Ruoli",
    text: "Promozione e retrocessione tra Member e Admin.",
  },
  {
    icon: UserX,
    title: "Disattivazione",
    text: "Uscita di un membro con riassegnazione guidata dei task aperti.",
  },
];

export default function WorkspaceSettingsPage() {
  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-4">
        <p className="text-[13px] font-medium text-ink-secondary">Workspace</p>
        <p className="mt-1 text-sm font-medium text-ink">
          Lacertosus — Marketing &amp; E-commerce
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-border p-4">
        <p className="text-[13px] font-medium text-ink-secondary">
          In arrivo con il collegamento a Supabase (M2)
        </p>
        <ul className="mt-3 space-y-3">
          {UPCOMING.map((item) => (
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
