"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { SearchLink } from "@/components/search-link";

/**
 * Segmented control dei toggle di vista (Board/Elenco, Persone/Carico,
 * preset dei report…): un'unica ricetta visiva per tab-link shallow e
 * tab-bottone, al posto delle quattro copie sparse per l'app.
 */

export function Segmented({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "flex gap-0.5 rounded-xl border border-border bg-card p-0.5 shadow-xs",
        className,
      )}
      {...props}
    />
  );
}

const itemClasses = (active: boolean, className?: string) =>
  cn(
    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
    active ? "bg-brand-50 text-brand-700" : "text-ink-secondary hover:text-ink",
    className,
  );

/** Tab che scrive lo stato di vista nell'URL (shallow, istantaneo). */
export function SegmentedLink({
  active,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SearchLink> & { active: boolean }) {
  return <SearchLink className={itemClasses(active, className)} {...props} />;
}

/** Tab ad azione locale (es. preset dei report). */
export function SegmentedButton({
  active,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"button"> & { active: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={itemClasses(active, className)}
      {...props}
    />
  );
}
