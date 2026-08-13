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

import { createAdminClient } from "./admin";
import { createClient } from "./server";

export interface InviteState {
  error: string | null;
  ok: string | null;
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

  /* 1. Chi sta chiedendo? Si legge con il client NORMALE, quello che passa
     dalla RLS: è l'unico modo di sapere chi è davvero l'utente collegato.
     Con il client amministrativo si leggerebbe qualunque riga, e la domanda
     «sei un responsabile?» perderebbe significato. */
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) {
    return { error: "Sessione scaduta: rientra e riprova.", ok: null };
  }

  const { data: profilo, error: erroreProfilo } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (erroreProfilo || !profilo) {
    return { error: "Profilo non leggibile: riprova.", ok: null };
  }
  if (profilo.role !== "admin" || !profilo.is_active) {
    // Il messaggio è volutamente asciutto: non è un errore tecnico, è un no.
    return { error: "Solo un responsabile può invitare.", ok: null };
  }

  /* 2. Ora sì, i poteri amministrativi. `inviteUserByEmail` crea l'utente e
     manda il link per impostare la password; i metadati finiscono in
     `raw_user_meta_data`, da cui il trigger `handle_new_user` pesca nome e
     qualifica per il profilo. */
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, title: title || null },
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
