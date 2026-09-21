/**
 * Spedisce le email del lavoro appena assegnato.
 *
 * Chi la chiama: il lavoro pianificato del database (M15), ogni cinque
 * minuti, e solo quando c'è davvero qualcosa da spedire. Non è una rotta per
 * il browser e non ha niente da mostrare.
 *
 * Perché la composizione sta qui e non in SQL: il testo di una mail si
 * ritocca dieci volte prima di andare bene, e ogni ritocco in SQL sarebbe una
 * migrazione. Il database fa l'unica cosa che l'app non sa fare da sola —
 * svegliarsi a orario — e per il resto suona un campanello.
 *
 * Sicurezza: questa rotta usa la chiave che bypassa la RLS, quindi il
 * controllo di chi bussa va fatto QUI DENTRO. È lo stesso ragionamento della
 * Server Action di invito (lib/supabase/invites.ts): il proxy non è una
 * difesa sufficiente, e per questa rotta è anzi disattivato apposta —
 * altrimenti rimanderebbe al login una richiesta che una sessione non ce
 * l'ha e non può averla.
 */

import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { componiMail, type LavoroArrivato } from "@/lib/email/assegnazioni";
import { createAdminClient } from "@/lib/supabase/admin";

/** Non si prerenderizza e non si mette in cache: è un'azione, non una pagina. */
export const dynamic = "force-dynamic";

/**
 * Confronto a tempo costante.
 *
 * Con `===` il tempo di risposta dipende da quanti caratteri iniziali sono
 * giusti, e su una rotta pubblica quella differenza si misura: si indovina il
 * segreto un carattere alla volta. `timingSafeEqual` pretende la stessa
 * lunghezza, quindi la si controlla prima — ed è già di per sé un filtro.
 */
function segretoValido(ricevuto: string | null, atteso: string): boolean {
  if (!ricevuto) return false;
  const a = Buffer.from(ricevuto);
  const b = Buffer.from(atteso);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Le righe che servono, lette con i poteri amministrativi. */
interface AvvisoDaSpedire {
  id: string;
  to_user_id: string;
  from_user_id: string | null;
  task_id: string | null;
}

export async function POST(request: NextRequest) {
  const atteso = process.env.SEGRETO_INVIO_EMAIL;
  const chiaveResend = process.env.RESEND_API_KEY;
  const mittente = process.env.MITTENTE_EMAIL;

  /* Finché la configurazione non c'è, la rotta esiste e non fa niente: è
     meglio di un errore, perché il lavoro pianificato parte comunque dal
     giorno in cui si applica M15, e un 500 ogni cinque minuti riempirebbe i
     log di un guasto che guasto non è. */
  if (!atteso) {
    return NextResponse.json(
      { ok: false, motivo: "SEGRETO_INVIO_EMAIL non configurato" },
      { status: 503 },
    );
  }
  if (!segretoValido(request.headers.get("x-segreto-invio"), atteso)) {
    /* Nessun dettaglio a chi sbaglia: dire «segreto errato» invece di
       «non trovato» conferma che la rotta esiste e cosa si aspetta. */
    return new NextResponse(null, { status: 404 });
  }
  if (!chiaveResend || !mittente) {
    return NextResponse.json(
      { ok: false, motivo: "RESEND_API_KEY o MITTENTE_EMAIL non configurati" },
      { status: 503 },
    );
  }

  const admin = createAdminClient();

  /* Solo le ultime 24 ore, come la sveglia: la colonna nasce oggi e senza
     questo filtro il primo giro spedirebbe l'arretrato di tutta l'app. */
  const dayFa = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: avvisi, error: erroreAvvisi } = await admin
    .from("notifications")
    .select("id, to_user_id, from_user_id, task_id")
    .eq("kind", "assegnazione")
    .is("email_inviata_at", null)
    .gt("created_at", dayFa)
    .order("created_at", { ascending: true })
    .limit(200)
    .returns<AvvisoDaSpedire[]>();

  if (erroreAvvisi) {
    return NextResponse.json(
      { ok: false, motivo: erroreAvvisi.message },
      { status: 500 },
    );
  }
  if (!avvisi || avvisi.length === 0) {
    return NextResponse.json({ ok: true, spedite: 0, avvisi: 0 });
  }

  /* --- I dati che servono per scrivere, in tre letture invece che in N --- */
  const idTask = [...new Set(avvisi.map((a) => a.task_id).filter(Boolean))];
  const idPersone = [
    ...new Set([
      ...avvisi.map((a) => a.to_user_id),
      ...avvisi.map((a) => a.from_user_id).filter(Boolean),
    ]),
  ] as string[];

  const [{ data: tasks }, { data: profili }, { data: preferenze }] =
    await Promise.all([
      admin
        .from("tasks")
        .select("id, title, due_date, priority, project_id, archived_at, status")
        .in("id", idTask as string[]),
      admin
        .from("profiles")
        .select("id, full_name, email, is_active")
        .in("id", idPersone),
      admin
        .from("user_preferences")
        .select("user_id, appearance")
        .in("user_id", avvisi.map((a) => a.to_user_id)),
    ]);

  const progettiId = [
    ...new Set((tasks ?? []).map((t) => t.project_id).filter(Boolean)),
  ] as string[];
  const { data: progetti } = progettiId.length
    ? await admin.from("projects").select("id, name").in("id", progettiId)
    : { data: [] as { id: string; name: string }[] };

  const taskPerId = new Map((tasks ?? []).map((t) => [t.id, t]));
  const profiloPerId = new Map((profili ?? []).map((p) => [p.id, p]));
  const progettoPerId = new Map((progetti ?? []).map((p) => [p.id, p.name]));

  /* Chi ha spento le email nelle impostazioni. La preferenza vive nel jsonb
     `appearance` insieme alle altre: scritta dal browser, letta qui. Manca la
     riga? Non ha mai toccato le impostazioni, quindi vale il predefinito
     (acceso). */
  const spente = new Set(
    (preferenze ?? [])
      .filter((r) => {
        const a = r.appearance as Record<string, unknown> | null;
        return a?.emailAssegnazioni === false;
      })
      .map((r) => r.user_id),
  );

  /* --- Un gruppo per destinatario: un clic che crea sei task fa una mail --- */
  const perDestinatario = new Map<
    string,
    { lavori: LavoroArrivato[]; idAvvisi: string[] }
  >();
  /* Gli avvisi che non diventeranno mai una mail (destinatario spento,
     disattivato, senza indirizzo, task sparito) si segnano comunque come
     fatti: altrimenti il lavoro li ripescherebbe per sempre. */
  const daSegnareSenzaInvio: string[] = [];

  for (const avviso of avvisi) {
    const chi = profiloPerId.get(avviso.to_user_id);
    const task = avviso.task_id ? taskPerId.get(avviso.task_id) : null;
    const saltare =
      !chi ||
      !chi.is_active ||
      !chi.email ||
      spente.has(avviso.to_user_id) ||
      !task ||
      task.archived_at ||
      task.status === "done";

    if (saltare) {
      daSegnareSenzaInvio.push(avviso.id);
      continue;
    }

    const gruppo = perDestinatario.get(avviso.to_user_id) ?? {
      lavori: [],
      idAvvisi: [],
    };
    gruppo.lavori.push({
      taskId: task.id,
      titolo: task.title,
      daChi: avviso.from_user_id
        ? (profiloPerId.get(avviso.from_user_id)?.full_name ?? null)
        : null,
      scadenza: task.due_date,
      progetto: task.project_id
        ? (progettoPerId.get(task.project_id) ?? null)
        : null,
      priorita: task.priority,
    });
    gruppo.idAvvisi.push(avviso.id);
    perDestinatario.set(avviso.to_user_id, gruppo);
  }

  const base = process.env.BASE_URL_APP ?? new URL(request.url).origin;
  const adesso = new Date().toISOString();
  let spedite = 0;
  const falliti: string[] = [];

  for (const [userId, gruppo] of perDestinatario) {
    const chi = profiloPerId.get(userId);
    if (!chi?.email) continue;
    const mail = componiMail(gruppo.lavori, chi.full_name, base);

    try {
      const risposta = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${chiaveResend}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: mittente,
          to: [chi.email],
          subject: mail.oggetto,
          text: mail.testo,
          html: mail.html,
        }),
      });
      if (!risposta.ok) {
        falliti.push(`${chi.email}: ${risposta.status} ${await risposta.text()}`);
        continue;
      }
      spedite += 1;
      /* Si segna solo dopo un invio riuscito: se il fornitore rifiuta, il
         giro successivo riprova invece di perdere la mail in silenzio. */
      await admin
        .from("notifications")
        .update({ email_inviata_at: adesso })
        .in("id", gruppo.idAvvisi);
    } catch (e) {
      falliti.push(`${chi.email}: ${e instanceof Error ? e.message : "rete"}`);
    }
  }

  if (daSegnareSenzaInvio.length > 0) {
    await admin
      .from("notifications")
      .update({ email_inviata_at: adesso })
      .in("id", daSegnareSenzaInvio);
  }

  return NextResponse.json({
    ok: falliti.length === 0,
    avvisi: avvisi.length,
    spedite,
    saltati: daSegnareSenzaInvio.length,
    ...(falliti.length > 0 ? { falliti } : {}),
  });
}
