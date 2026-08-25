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

/**
 * Il POST arriva dalla pagina /auth/conferma: e li che il token si consuma
 * davvero. Gli scanner antivirus delle caselle aziendali aprono i link con un
 * GET e lo brucerebbero prima della persona; un modulo da inviare no.
 */
export async function POST(request: NextRequest) {
  const modulo = await request.formData();
  const tokenHash = String(modulo.get("token_hash") ?? "");
  const type = String(modulo.get("type") ?? "") as EmailOtpType;
  const destinazione = interna(String(modulo.get("next") ?? ""));

  if (!tokenHash || !type) {
    return vaiAlRecupero(request, "Link non valido: chiedine uno nuovo.", 303);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  /* 303: dopo un POST il redirect deve diventare un GET, altrimenti il
     browser riproverebbe a inviare il modulo alla pagina d'arrivo. */
  if (!error) {
    return NextResponse.redirect(new URL(destinazione, request.url), 303);
  }
  return vaiAlRecupero(request, messaggio(error.message), 303);
}

/** Percorso interno, o la pagina della password come ripiego. */
function interna(valore: string): string {
  return valore.startsWith("/") && !valore.startsWith("//")
    ? valore
    : "/auth/imposta-password";
}

/**
 * Un link bruciato non deve essere un vicolo cieco: si torna all'accesso con
 * il modulo di recupero gia aperto e il motivo spiegato, cosi chi e rimasto
 * fuori si rimanda il link da solo.
 */
function vaiAlRecupero(
  request: NextRequest,
  spiegazione: string,
  stato?: number,
) {
  const url = new URL("/login", request.url);
  url.searchParams.set("recupero", "1");
  url.searchParams.set("errore", spiegazione);
  return NextResponse.redirect(url, stato);
}

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
    return vaiAlRecupero(request, messaggio(error.message));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(destinazione, request.url));
    }
    return vaiAlRecupero(request, messaggio(error.message));
  }

  /* Nessuno dei due: probabilmente il token è nel frammento dell'URL, che il
     server non vede mai. Si passa la palla al browser. */
  return NextResponse.redirect(new URL(destinazione, request.url));
}

/** I messaggi di Supabase sono in inglese e tecnici: qui diventano
 *  qualcosa che si può leggere in una pagina di accesso. */
function messaggio(originale: string): string {
  if (/expired/i.test(originale)) {
    return "Il link è scaduto: qui sotto puoi fartene mandare uno nuovo.";
  }
  if (/already|used/i.test(originale)) {
    return "Questo link era già stato usato. Se hai già una password accedi pure, altrimenti fattene mandare uno nuovo.";
  }
  return "Link non valido: qui sotto puoi fartene mandare uno nuovo.";
}
