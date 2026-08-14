/**
 * Atterraggio dei link mandati per email: inviti, recupero password, conferma
 * indirizzo.
 *
 * Perché una rotta e non una pagina: il link va trasformato in una sessione
 * scrivendo dei cookie, e i cookie si scrivono qui — non da un componente.
 *
 * Supabase manda due forme diverse a seconda di come sono impostati i
 * template delle email, e non è detto che restino uguali nel tempo. Si
 * gestiscono entrambe invece di scommettere su una:
 *
 *  - `token_hash` + `type` → template moderni, si verifica con `verifyOtp`;
 *  - `code` → flusso PKCE, si scambia con `exchangeCodeForSession`.
 *
 * Se non arriva né l'uno né l'altro, il link porta un frammento `#access_token`
 * (flusso implicito): il frammento non viaggia fino al server, quindi la
 * gestione tocca al browser e si rimanda alla pagina che sa farlo.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const parametri = request.nextUrl.searchParams;
  const tokenHash = parametri.get("token_hash");
  const code = parametri.get("code");
  const type = parametri.get("type") as EmailOtpType | null;

  /* Dove mandare dopo. Solo percorsi interni: un `next` assoluto
     trasformerebbe questa rotta in un rimbalzo verso siti esterni,
     autenticato per giunta. */
  const richiesto = parametri.get("next") ?? "";
  const destinazione =
    richiesto.startsWith("/") && !richiesto.startsWith("//")
      ? richiesto
      : "/auth/imposta-password";

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(new URL(destinazione, request.url));
    }
    return NextResponse.redirect(
      new URL(
        `/login?errore=${encodeURIComponent(messaggio(error.message))}`,
        request.url,
      ),
    );
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(destinazione, request.url));
    }
    return NextResponse.redirect(
      new URL(
        `/login?errore=${encodeURIComponent(messaggio(error.message))}`,
        request.url,
      ),
    );
  }

  /* Nessuno dei due: probabilmente il token è nel frammento dell'URL, che il
     server non vede mai. Si passa la palla al browser. */
  return NextResponse.redirect(new URL(destinazione, request.url));
}

/** I messaggi di Supabase sono in inglese e tecnici: qui diventano
 *  qualcosa che si può leggere in una pagina di accesso. */
function messaggio(originale: string): string {
  if (/expired/i.test(originale)) {
    return "Il link è scaduto. Chiedi a un responsabile di rimandare l'invito.";
  }
  if (/already|used/i.test(originale)) {
    return "Questo link è già stato usato. Prova ad accedere normalmente.";
  }
  return "Link non valido. Chiedi a un responsabile di rimandare l'invito.";
}
