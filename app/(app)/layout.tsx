import { AggiornamentiLive } from "@/components/shell/aggiornamenti-live";
import { AppShell } from "@/components/shell/app-shell";
import { LazyOverlays } from "@/components/shell/lazy-overlays";
import { InterruttoreZen } from "@/components/shell/modalita-zen";
import { Scorciatoie } from "@/components/shell/scorciatoie";
import { AzioniMultiple } from "@/components/azioni-multiple";
import { SelezioneProvider } from "@/lib/selezione";
import { ToastProvider } from "@/components/toaster";
import { PreferencesProvider } from "@/lib/preferences";
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
    <PreferencesProvider>
      <AppStoreProvider>
        <SelezioneProvider>
          <ToastProvider>
            <AppShell>
            {children}
            <AggiornamentiLive />
            <Scorciatoie />
            <InterruttoreZen />
            <AzioniMultiple />
            <LazyOverlays />
            </AppShell>
          </ToastProvider>
        </SelezioneProvider>
      </AppStoreProvider>
    </PreferencesProvider>
  );
}
