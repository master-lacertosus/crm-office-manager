"use client";

import * as React from "react";

import { MobileDrawer, Sidebar } from "@/components/shell/sidebar";

interface ShellContextValue {
  openDrawer: () => void;
}

const ShellContext = React.createContext<ShellContextValue | null>(null);

export function useShell(): ShellContextValue {
  const ctx = React.useContext(ShellContext);
  if (!ctx) throw new Error("useShell va usato dentro AppShell");
  return ctx;
}

/** Struttura autenticata: sidebar fissa + colonna contenuto su canvas. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  return (
    <ShellContext.Provider
      value={{ openDrawer: () => setDrawerOpen(true) }}
    >
      <div className="flex min-h-dvh w-full">
        <Sidebar />
        <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </ShellContext.Provider>
  );
}
