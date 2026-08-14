"use server";

/**
 * Invito di un collega.
 *
 * Crea l'utente di autenticazione e gli manda l'email per impostare la
 * password; il profilo nasce da solo, dal trigger `on_auth_user_created`.
 *
 * Sicurezza — il punto delicato di tutto il file: questa azione usa la chiave
 * che bypassa la RLS, quindi **il controllo dei permessi va fatto qui dentro**.
 * Il proxy non copre le Server Action (non sono rotte, e il matcher non le
 * vede: docs/01-app/03-api-reference/03-file-conventions/proxy.md), perciò
 * affidarsi a lui significherebbe lasciare a chiunque la possibilità di
 * creare utenti chiamando l'azione direttamente.
 */

import { headers } from "next/headers";

import { createAdminClient } from "./admin";
import { createClient } from "./server";

/**
 * L'indirizzo pubblico di questa installazione, dedotto dalla richiesta.
 *
 * Non da una variabile d'ambiente: su Vercel `VERCEL_URL` è l'indirizzo del
 * singolo deploy, non il dominio di produzione, e ricordarsi di impostarne
 * una terza sarebbe l'ennesima cosa da configurare a mano.
 */
async function origineDelSito(): Promise<string> {
  const h = await headers();
  const host = h.get("host");
  // Dietro il proxy di Vercel lo schema vero sta in x-forwarded-proto: `host`
  // da solo non dice se si è in https.
  const schema = h.get("x-forwarded-proto") ?? "https";
  return `${schema}://${host}`;
}

export interface InviteState {
  error: string | null;
  ok: string | null;
}

/** Chi sta chiedendo è un responsabile attivo? Si legge con il client
 *  NORMALE, quello che passa dalla RLS: con quello amministrativo si
 *  leggerebbe qualunque riga e la domanda perderebbe significato. */
async function chiediSeAdmin(): Promise<string | null> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return "Sessione scaduta: rientra e riprova.";

  const { data: profilo, error } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profilo) return "Profilo non leggibile: riprova.";
  if (profilo.role !== "admin" || !profilo.is_active) {
    return "Solo un responsabile può farlo.";
  }
  return null;
}

/**
 * Rimanda il link per impostare la password a un collega.
 *
 * Serve quando qualcuno non trova l'email dell'invito: chiedergli di
 * arrangiarsi da «Password dimenticata» funziona, ma un responsabile deve
 * poterlo fare per lui invece di spiegargli dove cliccare.
 *
 * Non usa i poteri amministrativi per mandare: `resetPasswordForEmail` fa già
 * il giro giusto, template compresi. I poteri servirebbero solo a generare un
 * link da consegnare a mano, che è peggio — passerebbe da una chat o da un
 * foglietto invece che dalla casella del destinatario.
 */
export async function resendPasswordLink(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) return { error: "Indirizzo mancante.", ok: null };

  const negato = await chiediSeAdmin();
  if (negato) return { error: negato, ok: null };

  const supabase = await createClient();
  const origine = await origineDelSito();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origine}/auth/confirm?next=/auth/imposta-password`,
  });

  if (error) {
    /* Supabase limita gli invii allo stesso indirizzo (di norma uno al
       minuto): senza dirlo, un secondo tentativo sembrerebbe un guasto. */
    const troppoPresto = /rate|limit|seconds|60/i.test(error.message);
    return {
      error: troppoPresto
        ? "Link già mandato da poco: aspetta un minuto prima di riprovare."
        : `Invio non riuscito: ${error.message}`,
      ok: null,
    };
  }

  return { error: null, ok: `Link mandato a ${email}.` };
}

export async function inviteMember(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();

  if (!email || !email.includes("@")) {
    return { error: "Serve un indirizzo email valido.", ok: null };
  }
  if (!fullName) {
    return { error: "Serve il nome del collega.", ok: null };
  }

  /* 1. Chi sta chiedendo? Il controllo sta QUI, non nel proxy: le Server
     Action non sono rotte e il suo matcher non le copre, quindi affidarsi a
     lui lascerebbe a chiunque la possibilità di creare utenti chiamando
     l'azione direttamente. */
  const negato = await chiediSeAdmin();
  if (negato) return { error: negato, ok: null };

  /* 2. Ora sì, i poteri amministrativi. `inviteUserByEmail` crea l'utente e
     manda il link per impostare la password; i metadati finiscono in
     `raw_user_meta_data`, da cui il trigger `handle_new_user` pesca nome e
     qualifica per il profilo. */
  /* `redirectTo` è la riga che fa funzionare l'invito.
     Senza, Supabase riporta la persona al Site URL — la radice del sito — da
     cui il proxy la manda al login: e lì non c'è modo di impostare una
     password, perché il token viaggia nel frammento dell'URL e nessuno lo
     legge. Puntando a `/auth/confirm` il token viene consumato dove deve, e
     `next` porta alla pagina della password.
     L'indirizzo deve comparire fra i Redirect URLs di Supabase, dove il
     carattere jolly `/**` lo copre. */
  const origine = await origineDelSito();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, title: title || null },
    redirectTo: `${origine}/auth/confirm?next=/auth/imposta-password`,
  });

  if (error) {
    const gia = /already|registered|exists/i.test(error.message);
    return {
      error: gia
        ? "Esiste già un account con questa email."
        : `Invito non riuscito: ${error.message}`,
      ok: null,
    };
  }

  return {
    error: null,
    ok: `Invito mandato a ${email}. Imposterà la password dal link ricevuto.`,
  };
}
