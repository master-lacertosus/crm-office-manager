"use client";

import { Menu } from "lucide-react";

import { useShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";

/** Topbar di pagina: titolo a sinistra, azioni a destra (design system §7). */
export function Topbar({
  title,
  actions,
}: {
  title: string;
  actions?: React.ReactNode;
}) {
  const { openDrawer } = useShell();

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border-soft px-4 sm:px-6">
      <Button
        variant="ghost"
        size="icon-sm"
        className="md:hidden"
        onClick={openDrawer}
        aria-label="Apri navigazione"
      >
        <Menu />
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-[22px]/7 font-semibold tracking-[-0.012em] text-ink">
        {title}
      </h1>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
