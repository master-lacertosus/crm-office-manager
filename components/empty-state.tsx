import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Stato vuoto = invito all'azione (docs/design-system.md §6). */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border px-6 py-10 text-center",
        className,
      )}
    >
      <Icon aria-hidden className="size-5 text-ink-faint" />
      <p className="text-sm font-medium text-ink-secondary">{title}</p>
      {hint ? <p className="text-[13px] text-ink-muted">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
