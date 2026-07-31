"use client";

import { Menu } from "lucide-react";

import { DeadlineIndicator } from "@/components/deadline-indicator";
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
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 bg-canvas/85 px-4 backdrop-blur-md sm:px-6 print:hidden">
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
        {actions}
        <DeadlineIndicator />
        <NotificationsBell />
      </div>
    </header>
  );
}
