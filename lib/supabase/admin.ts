/**
 * Client con poteri amministrativi.
 *
 * Usa la chiave segreta, che **bypassa completamente la RLS**: ciò che si fa
 * con questo client non passa da nessuna policy. Va usato solo dove serve
 * davvero — creare un utente di autenticazione è un'operazione che nessuna
 * policy potrebbe consentire, perché avviene prima che l'utente esista.
 *
 * Non ha `"use server"`: non è un modulo di azioni, è una fabbrica. Ma
 * importa `next/headers` indirettamente da nessuna parte, quindi la barriera
 * la mette la variabile d'ambiente — senza prefisso `NEXT_PUBLIC_`, Next non
 * la include nel bundle del browser e qualsiasi import lato client
 * otterrebbe `undefined`, fallendo subito invece di esporre la chiave.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseUrl } from "./env";

export function createAdminClient(): SupabaseClient {
  const chiave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chiave) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY mancante: senza, gli inviti non possono " +
        "creare l'utente. Compilala in .env.local (e nelle variabili di Vercel).",
    );
  }

  return createSupabaseClient(supabaseUrl(), chiave, {
    auth: {
      // Nessuna sessione da conservare: questo client agisce per conto del
      // sistema, non di una persona. Conservarla rischierebbe di mescolarla
      // con quella dell'utente collegato.
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
