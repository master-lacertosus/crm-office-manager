import { Suspense } from "react";

import { CommandPalette } from "@/components/command-palette";
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
        </AppShell>
      </ToastProvider>
    </AppStoreProvider>
  );
}
