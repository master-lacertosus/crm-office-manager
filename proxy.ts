/**
 * Proxy: rinnovo della sessione Supabase a ogni richiesta.
 *
 * In Next 16 il file si chiama `proxy.ts` e la funzione `proxy`:
 * `middleware.ts` è deprecato (docs/01-app/03-api-reference/03-file-conventions/
 * proxy.md). Tutte le guide Supabase in circolazione usano ancora il nome
 * vecchio — qui no.
 *
 * A cosa serve: i Server Component non possono scrivere cookie, quindi il
 * token rinnovato non potrebbe tornare al browser. Il proxy è l'unico punto
 * della richiesta in cui si può, e senza di lui le sessioni cadono in modo
 * apparentemente casuale.
 *
 * Fa anche da cancello: senza sessione si finisce sul login. Ma è solo la
 * prima linea — le Server Action non sono rotte e il matcher non le copre,
 * quindi ognuna deve verificare i permessi per conto proprio
 * (docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import {
  isSupabaseConfigured,
  supabaseAnonKey,
  supabaseUrl,
} from "@/lib/supabase/env";

export async function proxy(request: NextRequest) {
  // Fase di transizione: senza `.env.local` l'app vive di dati mock e qui non
  // c'è niente da rinnovare. Senza questa uscita anticipata ogni richiesta
  // fallirebbe finché le variabili non sono compilate.
  if (!isSupabaseConfigured) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        // I cookie aggiornati vanno sia sulla richiesta (così il render che
        // segue vede già la sessione nuova) sia sulla risposta (così il
        // browser la conserva).
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Gli header anti-cache che accompagnano i cookie di sessione: senza,
        // una CDN davanti all'app può servire il token di un utente a un
        // altro. Questo secondo argomento è recente e i tutorial lo omettono.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  /* Va chiamata presto, prima che la risposta sia composta: se il rinnovo
     arriva a risposta già chiusa, il token nuovo si perde e la richiesta
     successiva rinnova di nuovo, all'infinito. `getClaims()` è la via
     raccomandata rispetto a `getSession()`. */
  const { data } = await supabase.auth.getClaims();
  const autenticato = Boolean(data?.claims);

  const percorso = request.nextUrl.pathname;
  const pubblica = percorso === "/login" || percorso.startsWith("/auth");

  if (!autenticato && !pubblica) {
    // Si ricorda dove si stava andando, così dopo l'accesso si atterra lì e
    // non sempre sulla dashboard.
    const login = new URL("/login", request.url);
    if (percorso !== "/") {
      login.searchParams.set("next", percorso + request.nextUrl.search);
    }
    return NextResponse.redirect(login);
  }

  if (autenticato && percorso === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Tutte le rotte tranne:
     * - _next/static e _next/image (asset di build)
     * - favicon, sitemap, robots (file di metadati)
     * - immagini e font serviti da public/
     *
     * Senza queste esclusioni il proxy girerebbe anche sugli asset,
     * moltiplicando le chiamate di rinnovo per ogni CSS e ogni icona.
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2)$).*)",
  ],
};
