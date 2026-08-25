"use server";

/**
 * Azioni di autenticazione.
 *
 * Vivono sul server: la password non passa mai dal client Supabase del
 * browser, e i cookie di sessione si scrivono qui — le Server Action sono uno
 * dei pochi punti della richiesta in cui Next lo consente.
 *
 * Nota di sicurezza (docs/01-app/03-api-reference/03-file-conventions/proxy.md):
 * le Server Action non sono rotte, quindi il matcher del proxy non le copre.
 * L'autorizzazione va verificata dentro ciascuna azione, mai delegata al
 * proxy soltanto. Qui non serve — sono azioni di accesso, aperte per
 * definizione — ma vale per tutte quelle che scriveremo dopo.
 */

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "./server";

export interface AuthState {
  error: string | null;
}

/** Messaggi di Supabase tradotti in qualcosa di leggibile. */
function messaggio(codice: string | undefined, fallback: string): string {
  switch (codice) {
    case "invalid_credentials":
      return "Email o password non corrette.";
    case "email_not_confirmed":
      return "Devi confermare l'email prima di accedere.";
    case "over_request_rate_limit":
      return "Troppi tentativi. Aspetta qualche minuto e riprova.";
    case "user_banned":
      return "Questo account è sospeso. Contatta un responsabile.";
    default:
      return fallback;
  }
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  // Dove tornare dopo l'accesso: solo percorsi interni, mai un URL assoluto,
  // altrimenti il parametro diventa un rimbalzo verso un sito esterno.
  const richiesto = String(formData.get("next") ?? "");
  const destinazione =
    richiesto.startsWith("/") && !richiesto.startsWith("//")
      ? richiesto
      : "/dashboard";

  if (!email || !password) {
    return { error: "Inserisci email e password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: messaggio(error.code, "Accesso non riuscito. Riprova.") };
  }

  /* `redirect` lancia un'eccezione speciale che Next intercetta: va chiamata
     fuori da qualunque try/catch, altrimenti la si cattura per errore e la
     navigazione non avviene mai. */
  redirect(destinazione);
}

/**
 * Recupero della password.
 *
 * Serve anche a chi è stato invitato e ha perso il link: un secondo invito
 * verrebbe rifiutato, perché l'account ormai esiste.
 *
 * Risponde allo stesso modo che l'indirizzo esista o no. Dire «questa email
 * non è registrata» direbbe a chiunque quali indirizzi hanno un account qui.
 */
export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email || !email.includes("@")) {
    return { error: "Inserisci il tuo indirizzo email." };
  }

  const h = await headers();
  const origine = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origine}/auth/conferma?next=/auth/imposta-password`,
  });

  // Un errore di invio è un problema nostro, non dell'utente: si mostra.
  // L'indirizzo sconosciuto invece non produce errore, per costruzione.
  if (error && !/not found|user/i.test(error.message)) {
    return { error: messaggio(error.code, "Invio non riuscito. Riprova.") };
  }

  return { error: null };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
