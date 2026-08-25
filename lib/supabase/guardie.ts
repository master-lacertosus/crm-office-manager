import { redirect } from "next/navigation";

import { createClient } from "./server";
import { isSupabaseConfigured } from "./env";

/**
 * Cancello di pagina per le sezioni di governo (Team, Workspace).
 *
 * La RLS impedisce le SCRITTURE dei dipendenti, ma non nasconde una pagina:
 * chi digitava l'indirizzo vedeva la libreria dei template o le email di
 * tutti i colleghi. Qui si decide prima di disegnare, sul server, così non
 * arriva al browser nemmeno il contenuto.
 */
export async function richiediResponsabile(): Promise<void> {
  // Senza Supabase configurato non esiste una sessione da controllare: si
  // lascia passare, come fa il proxy, altrimenti l'app locale è inutilizzabile.
  if (!isSupabaseConfigured) return;

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) redirect("/login");

  const { data: profilo } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (!profilo || profilo.role !== "admin" || !profilo.is_active) {
    redirect("/dashboard");
  }
}
