"use client";

import * as React from "react";

import { ChatPanel } from "@/components/chat-panel";
import { OnboardingProfile } from "@/components/onboarding-profile";
import { MobileDrawer, Sidebar } from "@/components/shell/sidebar";
import { SyncErrorBanner } from "@/components/sync-error-banner";

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
      {/* Cornice flottante (da lg): l'app galleggia sul fondale aurora —
          la firma della reference. Gli sticky interni compensano il
          margine con top-4; overflow-clip non crea scroll context. */}
      <div className="flex min-h-dvh w-full lg:m-4 lg:min-h-[calc(100dvh-2rem)] lg:w-[calc(100%-2rem)] lg:overflow-clip lg:rounded-[28px] lg:border lg:border-white/70 lg:bg-white/50 lg:shadow-[0_1px_2px_rgb(15_23_42/0.04),0_28px_90px_rgb(15_23_42/0.16),inset_0_1px_0_rgb(255_255_255/0.9)]">
        <Sidebar />
        <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        {/* Copre l'app finché il profilo non è configurato: si decide una
            volta come apparire ai colleghi, e non si rimanda. */}
        <OnboardingProfile />
        {/* Comunicazione rapida: raggiungibile da ogni pagina, perché serve
            mentre si sta facendo altro. */}
        <ChatPanel />
        {/* Quando il database rifiuta una scrittura lo store annulla da solo:
            senza questo, l'annullamento sarebbe invisibile. */}
        <SyncErrorBanner />
      </div>
    </ShellContext.Provider>
  );
}
