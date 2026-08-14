/**
 * Client Supabase per il browser.
 *
 * Da usare dentro i componenti client. Le query passano dalla RLS con
 * l'identità dell'utente collegato: quello che questo client può leggere è
 * esattamente quello che le policy consentono.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAnonKey, supabaseUrl } from "./env";

/* Un'istanza sola per pagina. `createBrowserClient` non è caro, ma ogni
   istanza apre il proprio canale di refresh del token: duplicarle significa
   richieste di refresh moltiplicate e, nei casi peggiori, sessioni che si
   scalzano a vicenda. */
let cached: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  cached ??= createBrowserClient(supabaseUrl(), supabaseAnonKey());
  return cached;
}
