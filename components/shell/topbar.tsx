"use client";

import { Menu } from "lucide-react";

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
    <header className="glass sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 !rounded-none !border-x-0 !border-t-0 !border-b-white/60 px-4 sm:px-6">
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
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <NotificationsBell />
      </div>
    </header>
  );
}
