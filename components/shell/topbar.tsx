"use client";

import { Menu } from "lucide-react";

import { DeadlineIndicator } from "@/components/deadline-indicator";
import { CercaTutto } from "@/components/shell/cerca-tutto";
import { Timbra } from "@/components/shell/timbra";
import { NotificationsBell } from "@/components/notifications";
import { useShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";

/** Topbar di pagina: titolo, azioni e campanella avvisi (design system §7). */
export function Topbar({
  title,
  actions,
}: {
  title: string;
  actions?: React.ReactNode;
}) {
  const { openDrawer } = useShell();

  return (
    <header className="glass-chrome sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-velo/60 px-4 sm:px-6 lg:top-4 print:hidden">
      <Button
        variant="ghost"
        size="icon-sm"
        className="md:hidden"
        onClick={openDrawer}
        aria-label="Apri navigazione"
      >
        <Menu />
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-[26px]/8 font-bold tracking-[-0.015em] text-ink">
        {title}
      </h1>
      <div className="flex shrink-0 items-center gap-2">
        <CercaTutto />
        {actions}
        <Timbra />
        <DeadlineIndicator />
        <NotificationsBell />
      </div>
    </header>
  );
}
