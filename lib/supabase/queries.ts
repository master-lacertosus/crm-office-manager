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

import type { CustomStatus, Profile, Project, Task } from "@/lib/types";

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
/* Avvisi                                                                      */
/* -------------------------------------------------------------------------- */

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

export async function fetchAppearance(
  supabase: SupabaseClient,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("appearance")
    .maybeSingle();

  if (error) throw error;
  return (data?.appearance as Record<string, unknown>) ?? null;
}

export async function saveAppearance(
  supabase: SupabaseClient,
  userId: string,
  appearance: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from("user_preferences")
    .upsert({ user_id: userId, appearance }, { onConflict: "user_id" });
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
  problem_reason: string | null;
  problem_since: string | null;
  archived_at: string | null;
  completed_at: string | null;
  created_at: string;
}

const TASK_COLUMNS =
  "id, title, description, status, priority, owner_id, created_by, project_id, " +
  "due_date, position, repeat, template_id, batch_id, problem_reason, " +
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
