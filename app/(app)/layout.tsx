import { Suspense } from "react";

import { CommandPalette } from "@/components/command-palette";
import { IlCapo } from "@/components/il-capo";
import { OnboardingTour } from "@/components/onboarding-tour";
import { AppShell } from "@/components/shell/app-shell";
import { TaskPanelHost } from "@/components/task-panel";
import { ToastProvider } from "@/components/toaster";
import { AppStoreProvider } from "@/lib/store";

/**
 * Layout autenticato (fase placeholder: nessuna sessione reale, l'utente
 * corrente è fisso nello store). Con Supabase qui arriveranno il controllo
 * di sessione e il redirect a /login.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppStoreProvider>
      <ToastProvider>
        <AppShell>
          {children}
          <Suspense>
            <TaskPanelHost />
          </Suspense>
          <CommandPalette />
          <Suspense>
            <IlCapo />
          </Suspense>
          <Suspense>
            <OnboardingTour />
          </Suspense>
        </AppShell>
      </ToastProvider>
    </AppStoreProvider>
  );
}
