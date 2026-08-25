/**
 * Letture e scritture verso Supabase, tipizzate sui tipi di dominio.
 *
 * Un solo posto dove le colonne del database incontrano `lib/types.ts`: se
 * una migrazione rinomina qualcosa, il compilatore lo segnala qui invece che
 * a runtime in una pagina qualsiasi.
 *
 * Tutto passa dalla RLS con l'identità dell'utente collegato: queste funzioni
 * non hanno privilegi propri, chiedono e basta.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AppNotification,
  ChecklistItem,
  CompanyClosure,
  CustomStatus,
  LeaveRequest,
  Profile,
  Project,
  ProjectComment,
  Task,
  TaskComment,
  TaskEvent,
  TaskLink,
  TaskRequest,
  TemplatePackItem,
  WorkspaceTemplate,
} from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Profili                                                                     */
/* -------------------------------------------------------------------------- */

interface ProfileRow {
  id: string;
  full_name: string;
  email: string | null;
  role: string;
  title: string | null;
  avatar_url: string | null;
  is_active: boolean;
  onboarded_at: string | null;
}

const PROFILE_COLUMNS =
  "id, full_name, email, role, title, avatar_url, is_active, onboarded_at";

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    full_name: row.full_name,
    // La colonna ammette null (profili nati prima di M2); il tipo dell'app no.
    email: row.email ?? "",
    role: row.role === "admin" ? "admin" : "member",
    title: row.title ?? undefined,
    avatar_url: row.avatar_url,
    is_active: row.is_active,
    onboarded_at: row.onboarded_at,
  };
}

/** Tutti i profili visibili. La policy concede la lettura ai soli membri
 *  attivi: da disattivati la lista torna vuota, non parziale. */
export async function fetchProfiles(
  supabase: SupabaseClient,
): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .order("full_name");

  if (error) throw error;
  return (data as unknown as ProfileRow[]).map(toProfile);
}

/** Aggiorna il proprio profilo. La policy `profiles_update_self_or_admin`
 *  decide chi può toccare cosa; `role` e `is_active` restano fuori di
 *  proposito — li governa la guardia `profiles_guard`, non questo modulo. */
export async function updateProfileRow(
  supabase: SupabaseClient,
  id: string,
  patch: {
    full_name?: string;
    title?: string | null;
    avatar_url?: string | null;
    onboarded_at?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) throw error;
}

/**
 * Ruolo e stato attivo di un collega.
 *
 * Separata da `updateProfileRow` di proposito: queste due colonne le governa
 * la guardia `profiles_guard`, che le rifiuta se chi chiede non è un
 * amministratore, se resterebbe il workspace senza admin attivi, o se la
 * persona ha ancora task aperti. Tenerle in una funzione a parte rende
 * evidente che qui il database può dire di no — e che quel no va mostrato.
 */
export async function updateProfileAccess(
  supabase: SupabaseClient,
  id: string,
  patch: { role?: "admin" | "member"; is_active?: boolean },
): Promise<void> {
  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Foto profilo su Storage                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Carica la foto e restituisce l'URL pubblico.
 *
 * Il percorso è «<id utente>/<nome>»: il primo segmento è quello che le
 * policy del bucket confrontano con auth.uid(). Cambiarne la forma
 * significherebbe rendere impossibile ogni caricamento.
 *
 * Il nome cambia a ogni caricamento — la CDN tiene in cache per URL, e
 * riusare lo stesso nome mostrerebbe la foto vecchia per ore.
 */
export async function uploadAvatar(
  supabase: SupabaseClient,
  userId: string,
  file: File,
): Promise<string> {
  const estensione = file.type === "image/png"
    ? "png"
    : file.type === "image/webp"
      ? "webp"
      : "jpg";
  const percorso = `${userId}/${crypto.randomUUID()}.${estensione}`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(percorso, file, { contentType: file.type, upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(percorso);
  return data.publicUrl;
}

/** Rimuove la foto precedente. Fallire qui non è grave — resta un file
 *  orfano, non un errore per l'utente — quindi non si propaga. */
export async function removeAvatarByUrl(
  supabase: SupabaseClient,
  url: string | null | undefined,
): Promise<void> {
  if (!url) return;
  const marcatore = "/avatars/";
  const i = url.indexOf(marcatore);
  if (i === -1) return;
  const percorso = url.slice(i + marcatore.length);
  await supabase.storage.from("avatars").remove([percorso]);
}

/* -------------------------------------------------------------------------- */
/* Checklist                                                                   */
/* -------------------------------------------------------------------------- */

/** Le voci raggruppate per task: il tipo `Task` le porta dentro di sé, ma il
 *  database le tiene in tabella perché si spuntano una alla volta e l'ordine
 *  conta. La ricomposizione avviene qui, una volta sola. */
export async function fetchChecklists(
  supabase: SupabaseClient,
): Promise<Record<string, ChecklistItem[]>> {
  const { data, error } = await supabase
    .from("task_checklist_items")
    .select("id, task_id, body, done, position")
    .order("position");
  if (error) throw error;

  const out: Record<string, ChecklistItem[]> = {};
  for (const r of data as {
    id: string;
    task_id: string;
    body: string;
    done: boolean;
  }[]) {
    (out[r.task_id] ??= []).push({ id: r.id, text: r.body, done: r.done });
  }
  return out;
}

export async function insertChecklistItem(
  supabase: SupabaseClient,
  taskId: string,
  item: ChecklistItem,
  position: number,
): Promise<void> {
  const { error } = await supabase.from("task_checklist_items").insert({
    id: item.id,
    task_id: taskId,
    body: item.text,
    done: item.done,
    position,
  });
  if (error) throw error;
}

export async function setChecklistItemDone(
  supabase: SupabaseClient,
  id: string,
  done: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("task_checklist_items")
    .update({ done })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteChecklistItem(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("task_checklist_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Collaboratori                                                               */
/* -------------------------------------------------------------------------- */

/** Raggruppati per task, come le checklist: il tipo `Task` li porta dentro
 *  di sé, il database li tiene in tabella perché sono una relazione. */
export async function fetchCollaborators(
  supabase: SupabaseClient,
): Promise<Record<string, string[]>> {
  const { data, error } = await supabase
    .from("task_collaborators")
    .select("task_id, user_id");
  if (error) throw error;

  const out: Record<string, string[]> = {};
  for (const r of data as { task_id: string; user_id: string }[]) {
    (out[r.task_id] ??= []).push(r.user_id);
  }
  return out;
}

export async function insertCollaborator(
  supabase: SupabaseClient,
  taskId: string,
  userId: string,
  addedBy: string,
): Promise<void> {
  const { error } = await supabase
    .from("task_collaborators")
    .insert({ task_id: taskId, user_id: userId, added_by: addedBy });
  if (error) throw error;
}

export async function deleteCollaborator(
  supabase: SupabaseClient,
  taskId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("task_collaborators")
    .delete()
    .eq("task_id", taskId)
    .eq("user_id", userId);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Allegati-link                                                               */
/* -------------------------------------------------------------------------- */

export async function fetchTaskLinks(
  supabase: SupabaseClient,
): Promise<TaskLink[]> {
  const { data, error } = await supabase
    .from("task_links")
    .select("id, task_id, url, label")
    .order("created_at");
  if (error) throw error;
  return data as TaskLink[];
}

export async function insertTaskLink(
  supabase: SupabaseClient,
  link: TaskLink,
  createdBy: string,
): Promise<void> {
  const { error } = await supabase.from("task_links").insert({
    id: link.id,
    task_id: link.task_id,
    url: link.url,
    label: link.label,
    created_by: createdBy,
  });
  if (error) throw error;
}

export async function deleteTaskLink(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("task_links").delete().eq("id", id);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Cronologia                                                                  */
/* -------------------------------------------------------------------------- */

/** Le colonne si chiamano `from_value`/`to_value` nel database: `from` è una
 *  parola riservata di SQL e come nome di colonna avrebbe richiesto le
 *  virgolette ovunque. */
export async function fetchTaskEvents(
  supabase: SupabaseClient,
): Promise<TaskEvent[]> {
  const { data, error } = await supabase
    .from("task_events")
    .select("id, task_id, actor_id, type, from_value, to_value, created_at")
    .order("created_at");
  if (error) throw error;

  return (data as {
    id: string;
    task_id: string;
    actor_id: string;
    type: TaskEvent["type"];
    from_value: string | null;
    to_value: string | null;
    created_at: string;
  }[]).map((r) => ({
    id: r.id,
    task_id: r.task_id,
    actor_id: r.actor_id,
    type: r.type,
    from: r.from_value,
    to: r.to_value,
    created_at: r.created_at,
  }));
}

export async function insertTaskEvents(
  supabase: SupabaseClient,
  eventi: TaskEvent[],
): Promise<void> {
  if (eventi.length === 0) return;
  const { error } = await supabase.from("task_events").insert(
    eventi.map((e) => ({
      id: e.id,
      task_id: e.task_id,
      actor_id: e.actor_id,
      type: e.type,
      from_value: e.from ?? null,
      to_value: e.to ?? null,
    })),
  );
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Commenti e reazioni                                                         */
/* -------------------------------------------------------------------------- */

/** Le reazioni stanno in tabella (una riga per persona ed emoji) ma l'app le
 *  vuole come mappa emoji → elenco di id. La conversione sta qui. */
function raggruppaReazioni(
  righe: { comment_id: string; user_id: string; emoji: string }[],
): Record<string, Record<string, string[]>> {
  const out: Record<string, Record<string, string[]>> = {};
  for (const r of righe) {
    ((out[r.comment_id] ??= {})[r.emoji] ??= []).push(r.user_id);
  }
  return out;
}

export async function fetchTaskComments(
  supabase: SupabaseClient,
): Promise<TaskComment[]> {
  const [commenti, reazioni] = await Promise.all([
    supabase
      .from("task_comments")
      .select("id, task_id, author_id, body, is_decision, created_at")
      .order("created_at"),
    supabase
      .from("task_comment_reactions")
      .select("comment_id, user_id, emoji"),
  ]);
  if (commenti.error) throw commenti.error;
  if (reazioni.error) throw reazioni.error;

  const mappa = raggruppaReazioni(
    reazioni.data as { comment_id: string; user_id: string; emoji: string }[],
  );
  return (commenti.data as TaskComment[]).map((c) => ({
    ...c,
    reactions: mappa[c.id] ?? {},
  }));
}

export async function fetchProjectComments(
  supabase: SupabaseClient,
): Promise<ProjectComment[]> {
  const [commenti, reazioni] = await Promise.all([
    supabase
      .from("project_comments")
      .select("id, project_id, author_id, body, is_decision, created_at")
      .order("created_at"),
    supabase
      .from("project_comment_reactions")
      .select("comment_id, user_id, emoji"),
  ]);
  if (commenti.error) throw commenti.error;
  if (reazioni.error) throw reazioni.error;

  const mappa = raggruppaReazioni(
    reazioni.data as { comment_id: string; user_id: string; emoji: string }[],
  );
  return (commenti.data as ProjectComment[]).map((c) => ({
    ...c,
    reactions: mappa[c.id] ?? {},
  }));
}

export async function insertTaskComment(
  supabase: SupabaseClient,
  c: TaskComment,
): Promise<void> {
  const { error } = await supabase.from("task_comments").insert({
    id: c.id,
    task_id: c.task_id,
    author_id: c.author_id,
    body: c.body,
  });
  if (error) throw error;
}

export async function insertProjectComment(
  supabase: SupabaseClient,
  c: ProjectComment,
): Promise<void> {
  const { error } = await supabase.from("project_comments").insert({
    id: c.id,
    project_id: c.project_id,
    author_id: c.author_id,
    body: c.body,
  });
  if (error) throw error;
}

/** `scope` decide la tabella: le due famiglie di commenti hanno chiavi
 *  esterne diverse e non si possono unire senza polimorfismo. */
export async function setDecision(
  supabase: SupabaseClient,
  scope: "task" | "project",
  commentId: string,
  isDecision: boolean,
): Promise<void> {
  const tabella = scope === "task" ? "task_comments" : "project_comments";
  const { error } = await supabase
    .from(tabella)
    .update({ is_decision: isDecision })
    .eq("id", commentId);
  if (error) throw error;
}

export async function toggleReactionRow(
  supabase: SupabaseClient,
  scope: "task" | "project",
  commentId: string,
  userId: string,
  emoji: string,
  attiva: boolean,
): Promise<void> {
  const tabella =
    scope === "task" ? "task_comment_reactions" : "project_comment_reactions";
  if (attiva) {
    const { error } = await supabase
      .from(tabella)
      .insert({ comment_id: commentId, user_id: userId, emoji });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from(tabella)
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", userId)
      .eq("emoji", emoji);
    if (error) throw error;
  }
}

/* -------------------------------------------------------------------------- */
/* Template ricorrenti                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Template e voci del pacchetto in due richieste, ricomposti qui.
 *
 * `checklist` e `links` restano JSONB perché sono liste brevi sempre lette e
 * scritte per intero insieme al template; le voci del pacchetto invece sono
 * righe, perché hanno responsabile e scarto propri e servono a generare task.
 */
export async function fetchTemplates(
  supabase: SupabaseClient,
): Promise<WorkspaceTemplate[]> {
  const [templates, voci] = await Promise.all([
    supabase
      .from("workspace_templates")
      .select(
        "id, name, description, project_id, owner_id, priority, repeat, due_day, checklist, links",
      )
      .order("name"),
    supabase
      .from("workspace_template_pack_items")
      .select("template_id, title, owner_id, offset_days")
      .order("position"),
  ]);
  if (templates.error) throw templates.error;
  if (voci.error) throw voci.error;

  const perTemplate: Record<string, TemplatePackItem[]> = {};
  for (const v of voci.data as {
    template_id: string;
    title: string;
    owner_id: string | null;
    offset_days: number;
  }[]) {
    (perTemplate[v.template_id] ??= []).push({
      title: v.title,
      owner_id: v.owner_id,
      offset_days: v.offset_days,
    });
  }

  return (templates.data as unknown as (WorkspaceTemplate & {
    due_day: number | null;
  })[]).map((t) => ({
    ...t,
    checklist: (t.checklist as string[] | null) ?? [],
    links: (t.links as { url: string; label: string }[] | null) ?? [],
    pack: perTemplate[t.id],
  }));
}

export async function upsertTemplate(
  supabase: SupabaseClient,
  t: WorkspaceTemplate,
  createdBy: string,
): Promise<void> {
  const { error } = await supabase.from("workspace_templates").upsert({
    id: t.id,
    name: t.name,
    description: t.description ?? "",
    project_id: t.project_id,
    owner_id: t.owner_id,
    priority: t.priority,
    repeat: t.repeat,
    due_day: t.due_day,
    checklist: t.checklist ?? [],
    links: t.links ?? [],
    created_by: createdBy,
  });
  if (error) throw error;

  /* Le voci del pacchetto si riscrivono per intero: sono poche, non hanno
     identità stabile lato app (il tipo non porta un id) e confrontarle una a
     una costerebbe più di quanto valgano. */
  const { error: pulizia } = await supabase
    .from("workspace_template_pack_items")
    .delete()
    .eq("template_id", t.id);
  if (pulizia) throw pulizia;

  if (t.pack && t.pack.length > 0) {
    const { error: inserimento } = await supabase
      .from("workspace_template_pack_items")
      .insert(
        t.pack.map((v, i) => ({
          template_id: t.id,
          title: v.title,
          owner_id: v.owner_id,
          offset_days: v.offset_days,
          position: i,
        })),
      );
    if (inserimento) throw inserimento;
  }
}

export async function deleteTemplate(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  // Le voci del pacchetto se ne vanno da sole: `on delete cascade`.
  const { error } = await supabase
    .from("workspace_templates")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Viste salvate e stato personale                                             */
/* -------------------------------------------------------------------------- */

export async function fetchSavedViews(
  supabase: SupabaseClient,
): Promise<{ id: string; name: string; params: string }[]> {
  const { data, error } = await supabase
    .from("saved_views")
    .select("id, name, params")
    .order("created_at");
  if (error) throw error;
  return data as { id: string; name: string; params: string }[];
}

export async function insertSavedView(
  supabase: SupabaseClient,
  userId: string,
  vista: { id: string; name: string; params: string },
): Promise<void> {
  const { error } = await supabase
    .from("saved_views")
    .insert({ ...vista, user_id: userId });
  if (error) throw error;
}

export async function deleteSavedView(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("saved_views").delete().eq("id", id);
  if (error) throw error;
}

/** Focus di oggi e posticipi: righe private, una per task toccato. */
export async function fetchUserTaskState(
  supabase: SupabaseClient,
): Promise<{ focusIds: string[]; snoozes: Record<string, string> }> {
  const { data, error } = await supabase
    .from("user_task_state")
    .select("task_id, is_focus, snoozed_until");
  if (error) throw error;

  const focusIds: string[] = [];
  const snoozes: Record<string, string> = {};
  for (const r of data as {
    task_id: string;
    is_focus: boolean;
    snoozed_until: string | null;
  }[]) {
    if (r.is_focus) focusIds.push(r.task_id);
    if (r.snoozed_until) snoozes[r.task_id] = r.snoozed_until;
  }
  return { focusIds, snoozes };
}

/** Una riga per coppia utente-task: l'upsert la crea o la aggiorna senza
 *  doversi chiedere quale dei due casi sia. */
export async function setUserTaskState(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
  patch: { is_focus?: boolean; snoozed_until?: string | null },
): Promise<void> {
  const { error } = await supabase.from("user_task_state").upsert(
    { user_id: userId, task_id: taskId, ...patch },
    { onConflict: "user_id,task_id" },
  );
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Richieste di task                                                           */
/* -------------------------------------------------------------------------- */

const REQUEST_COLUMNS =
  "id, title, description, requester_id, status, requested_due, priority, " +
  "decided_by, decided_at, rejection_reason, owner_id, due_date, project_id, " +
  "task_id, created_at";

export async function fetchTaskRequests(
  supabase: SupabaseClient,
): Promise<TaskRequest[]> {
  const { data, error } = await supabase
    .from("task_requests")
    .select(REQUEST_COLUMNS)
    .order("created_at");
  if (error) throw error;
  return data as unknown as TaskRequest[];
}

export async function insertTaskRequest(
  supabase: SupabaseClient,
  r: TaskRequest,
): Promise<void> {
  /* Lo stato non si invia: la policy pretende `status = 'pending'`
     all'inserimento, ed è anche il default. Mandarlo sarebbe un modo per
     sbagliarlo. */
  const { error } = await supabase.from("task_requests").insert({
    id: r.id,
    title: r.title,
    description: r.description,
    requester_id: r.requester_id,
    requested_due: r.requested_due ?? null,
    priority: r.priority ?? "normal",
  });
  if (error) throw error;
}

/** La decisione: `decided_by` e `decided_at` NON si inviano, li scrive la
 *  guardia `task_requests_guard` verificando che chi decide sia un
 *  responsabile. Mandarli da qui sarebbe dichiarare chi ha deciso. */
export async function decideTaskRequest(
  supabase: SupabaseClient,
  id: string,
  esito:
    | {
        status: "approved";
        owner_id: string;
        due_date: string | null;
        project_id: string | null;
        task_id: string;
      }
    | { status: "rejected"; rejection_reason: string },
): Promise<void> {
  const { error } = await supabase.from("task_requests").update(esito).eq("id", id);
  if (error) throw error;
}

export async function deleteTaskRequest(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("task_requests").delete().eq("id", id);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Ferie, permessi e chiusure                                                  */
/* -------------------------------------------------------------------------- */

const LEAVE_COLUMNS =
  "id, requester_id, type, start_date, end_date, time_range, note, status, " +
  "decided_by, decided_at, decision_note, created_at";

export async function fetchLeaveRequests(
  supabase: SupabaseClient,
): Promise<LeaveRequest[]> {
  const { data, error } = await supabase
    .from("leave_requests")
    .select(LEAVE_COLUMNS)
    .order("start_date");
  if (error) throw error;
  return data as unknown as LeaveRequest[];
}

export async function insertLeaveRequest(
  supabase: SupabaseClient,
  l: LeaveRequest,
): Promise<void> {
  const { error } = await supabase.from("leave_requests").insert({
    id: l.id,
    requester_id: l.requester_id,
    type: l.type,
    start_date: l.start_date,
    end_date: l.end_date,
    time_range: l.time_range ?? null,
    note: l.note,
  });
  if (error) throw error;
}

/** Come per le richieste, `decided_by` e `decided_at` li scrive la guardia —
 *  che verifica anche che nessuno decida sulla propria assenza. */
export async function decideLeaveRequest(
  supabase: SupabaseClient,
  id: string,
  status: "approved" | "rejected",
  decisionNote: string,
): Promise<void> {
  const { error } = await supabase
    .from("leave_requests")
    .update({ status, decision_note: decisionNote })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteLeaveRequest(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("leave_requests").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchClosures(
  supabase: SupabaseClient,
): Promise<CompanyClosure[]> {
  const { data, error } = await supabase
    .from("company_closures")
    .select("id, title, start_date, end_date, created_by")
    .order("start_date");
  if (error) throw error;
  return data as CompanyClosure[];
}

export async function insertClosure(
  supabase: SupabaseClient,
  c: CompanyClosure,
): Promise<void> {
  const { error } = await supabase.from("company_closures").insert({
    id: c.id,
    title: c.title,
    start_date: c.start_date,
    end_date: c.end_date,
    created_by: c.created_by,
  });
  if (error) throw error;
}

export async function deleteClosure(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("company_closures").delete().eq("id", id);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Avvisi                                                                      */
/* -------------------------------------------------------------------------- */

/** Solo i propri: la policy `notifications_select_recipient` non concede gli
 *  avvisi altrui a nessuno, nemmeno agli amministratori. */
export async function fetchNotifications(
  supabase: SupabaseClient,
): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, to_user_id, from_user_id, message, task_id, kind, created_at, read_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as AppNotification[];
}

/** Segna letti in blocco. `read_at` è l'unica colonna che la guardia del
 *  database lascia cambiare dopo l'invio. */
export async function markNotificationsRead(
  supabase: SupabaseClient,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw error;
}

/** Un avviso per ogni destinatario. La policy pretende
 *  `from_user_id = auth.uid()`: nessuno può scrivere a nome di un altro. */
export async function insertNotifications(
  supabase: SupabaseClient,
  avvisi: {
    to_user_id: string;
    from_user_id: string;
    message: string;
    task_id?: string | null;
    kind?: "mention" | "sollecito" | "sistema";
  }[],
): Promise<void> {
  if (avvisi.length === 0) return;
  const { error } = await supabase.from("notifications").insert(
    avvisi.map((a) => ({
      to_user_id: a.to_user_id,
      from_user_id: a.from_user_id,
      message: a.message,
      task_id: a.task_id ?? null,
      kind: a.kind ?? "sistema",
    })),
  );
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Preferenze d'aspetto                                                        */
/* -------------------------------------------------------------------------- */

/** Le tre colonne di `user_preferences`. Sono preferenze personali diverse
 *  ma con lo stesso ciclo di vita, quindi condividono le funzioni invece di
 *  averne tre coppie quasi identiche. */
export type ColonnaPreferenza =
  | "appearance"
  | "dashboard_layout"
  | "collapsed_statuses";

/** `maybeSingle` e non `single`: alla prima apertura la riga non esiste
 *  ancora, e non averla non è un errore. */
export async function fetchPreference<T>(
  supabase: SupabaseClient,
  colonna: ColonnaPreferenza,
): Promise<T | null> {
  const { data, error } = await supabase
    .from("user_preferences")
    .select(colonna)
    .maybeSingle();

  if (error) throw error;
  // Il tipo della select con colonna variabile è un'unione: il cast qui
  // vale più di una firma generica illeggibile.
  return ((data as Record<string, unknown> | null)?.[colonna] as T) ?? null;
}

/**
 * Scrive una sola colonna, lasciando intatte le altre.
 *
 * L'upsert aggiorna solo le colonne passate: chi cambia il tema non azzera
 * il layout della dashboard di chi lo stava sistemando in un'altra scheda.
 */
export async function savePreference(
  supabase: SupabaseClient,
  userId: string,
  colonna: ColonnaPreferenza,
  valore: unknown,
): Promise<void> {
  const { error } = await supabase
    .from("user_preferences")
    .upsert({ user_id: userId, [colonna]: valore }, { onConflict: "user_id" });
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Progetti                                                                    */
/* -------------------------------------------------------------------------- */

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  is_archived: boolean;
  created_by: string;
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    is_archived: row.is_archived,
    created_by: row.created_by,
  };
}

export async function fetchProjects(
  supabase: SupabaseClient,
): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, description, is_archived, created_by")
    .order("name");

  if (error) throw error;
  return (data as ProjectRow[]).map(toProject);
}

/** Il progetto singolo, per la pagina di dettaglio. `null` se non esiste o se
 *  la RLS non lo concede: all'utente le due cose si presentano uguali, ed è
 *  corretto — non deve poter distinguere «non esiste» da «non ti riguarda». */
export async function fetchProject(
  supabase: SupabaseClient,
  id: string,
): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, description, is_archived, created_by")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? toProject(data as ProjectRow) : null;
}

/* -------------------------------------------------------------------------- */
/* Fasi personalizzate                                                         */
/* -------------------------------------------------------------------------- */

/** Solo le custom: le sei fasi di sistema restano definite nell'app, con gli
 *  stessi colori che la migrazione M2 ha scritto nel database. Duplicarle
 *  qui eviterebbe una query per dati che non cambiano mai. */
export async function fetchCustomStatuses(
  supabase: SupabaseClient,
): Promise<CustomStatus[]> {
  const { data, error } = await supabase
    .from("task_statuses")
    .select("key, label, color, soft, text_color")
    .eq("kind", "custom")
    .order("sort_order");

  if (error) throw error;
  return (data as {
    key: string;
    label: string;
    color: string;
    soft: string;
    text_color: string;
  }[]).map((r) => ({
    key: r.key,
    label: r.label,
    color: r.color,
    soft: r.soft,
    text: r.text_color,
  }));
}

/** Le custom si inseriscono fra «In corso» (30) e «In revisione» (50): il
 *  posto che l'app assegna loro sulla board. */
export async function insertCustomStatus(
  supabase: SupabaseClient,
  status: CustomStatus,
  ordine: number,
): Promise<void> {
  const { error } = await supabase.from("task_statuses").insert({
    key: status.key,
    label: status.label,
    color: status.color,
    soft: status.soft,
    text_color: status.text,
    kind: "custom",
    sort_order: 40 + ordine,
  });
  if (error) throw error;
}

export async function deleteCustomStatus(
  supabase: SupabaseClient,
  key: string,
): Promise<void> {
  /* I task che ci stavano tornano in «Da fare» da soli: la chiave esterna è
     `on delete set default`. Nessun aggiornamento da fare a mano. */
  const { error } = await supabase.from("task_statuses").delete().eq("key", key);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Task                                                                        */
/* -------------------------------------------------------------------------- */

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  owner_id: string;
  created_by: string;
  project_id: string | null;
  due_date: string | null;
  position: number;
  repeat: string;
  template_id: string | null;
  batch_id: string | null;
  parent_id: string | null;
  problem_reason: string | null;
  problem_since: string | null;
  archived_at: string | null;
  completed_at: string | null;
  created_at: string;
}

const TASK_COLUMNS =
  "id, title, description, status, priority, owner_id, created_by, project_id, " +
  "due_date, position, repeat, template_id, batch_id, parent_id, problem_reason, " +
  "problem_since, archived_at, completed_at, created_at";

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority as Task["priority"],
    owner_id: row.owner_id,
    created_by: row.created_by,
    project_id: row.project_id,
    due_date: row.due_date,
    position: Number(row.position),
    repeat: row.repeat as Task["repeat"],
    template_id: row.template_id,
    batch_id: row.batch_id,
    parent_id: row.parent_id,
    problem_reason: row.problem_reason,
    problem_since: row.problem_since,
    archived_at: row.archived_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
  };
}

export async function fetchTasks(supabase: SupabaseClient): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .order("position");

  if (error) throw error;
  return (data as unknown as TaskRow[]).map(toTask);
}

/** L'id lo genera il client e si passa esplicitamente: l'interfaccia deve
 *  poter mostrare la scheda prima che il database risponda, e riconciliare
 *  un id inventato con quello vero sarebbe una fonte inesauribile di bug. */
export async function insertTask(
  supabase: SupabaseClient,
  task: Task,
): Promise<void> {
  const { error } = await supabase.from("tasks").insert({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    owner_id: task.owner_id,
    created_by: task.created_by,
    project_id: task.project_id,
    due_date: task.due_date,
    position: task.position,
    repeat: task.repeat,
    template_id: task.template_id,
    batch_id: task.batch_id,
    parent_id: task.parent_id ?? null,
  });
  if (error) throw error;
}

/** Solo le colonne che l'app modifica davvero. `completed_at` e
 *  `problem_since` non ci sono di proposito: li impongono i trigger del
 *  database, e scriverli da qui significherebbe due sorgenti di verità. */
export async function updateTaskRow(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Task>,
): Promise<void> {
  const campi: Record<string, unknown> = {};
  if (patch.title !== undefined) campi.title = patch.title;
  if (patch.description !== undefined) campi.description = patch.description;
  if (patch.status !== undefined) campi.status = patch.status;
  if (patch.priority !== undefined) campi.priority = patch.priority;
  if (patch.owner_id !== undefined) campi.owner_id = patch.owner_id;
  if (patch.project_id !== undefined) campi.project_id = patch.project_id;
  if (patch.due_date !== undefined) campi.due_date = patch.due_date;
  if (patch.position !== undefined) campi.position = patch.position;
  if (patch.repeat !== undefined) campi.repeat = patch.repeat;
  if (patch.problem_reason !== undefined) {
    campi.problem_reason = patch.problem_reason;
  }
  if (patch.archived_at !== undefined) campi.archived_at = patch.archived_at;

  if (Object.keys(campi).length === 0) return;

  const { error } = await supabase.from("tasks").update(campi).eq("id", id);
  if (error) throw error;
}

export async function deleteTaskRow(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

export async function insertProject(
  supabase: SupabaseClient,
  input: { name: string; description: string | null; createdBy: string },
): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .insert({
      name: input.name,
      description: input.description,
      // La policy pretende created_by = auth.uid(): passarlo esplicitamente
      // rende l'intenzione leggibile e fa fallire subito un uso sbagliato.
      created_by: input.createdBy,
    })
    .select("id, name, description, is_archived, created_by")
    .single();

  if (error) throw error;
  return toProject(data as ProjectRow);
}
