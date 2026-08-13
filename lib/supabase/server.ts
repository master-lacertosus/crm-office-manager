/**
 * Client Supabase per il server: Server Component, Server Action e Route
 * Handler.
 *
 * L'import di `next/headers` vincola questo modulo al server — importarlo da
 * un componente client è un errore di build, il che è la protezione che
 * vogliamo senza aggiungere il pacchetto `server-only`.
 *
 * Un client nuovo per ogni render, mai condiviso fra richieste: sarebbe la
 * sessione di un utente servita a un altro.
 */

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAnonKey, supabaseUrl } from "./env";

export async function createClient(): Promise<SupabaseClient> {
  // In Next 16 `cookies()` è asincrona: senza await si ottiene la Promise.
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          /* I Server Component non possono scrivere cookie: qui la scrittura
             lancia sempre. Non è un problema perché il rinnovo del token lo
             fa il proxy a ogni richiesta — è esattamente la ragione per cui
             `proxy.ts` esiste. Se un giorno sparisse, questo catch nasconde
             il sintomo e le sessioni cadrebbero senza spiegazione. */
        }
      },
    },
  });
}
