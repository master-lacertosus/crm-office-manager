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

import type { Profile, Project } from "@/lib/types";

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
}

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
  };
}

/** Tutti i profili visibili. La policy concede la lettura ai soli membri
 *  attivi: da disattivati la lista torna vuota, non parziale. */
export async function fetchProfiles(
  supabase: SupabaseClient,
): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, title, avatar_url, is_active")
    .order("full_name");

  if (error) throw error;
  return (data as ProfileRow[]).map(toProfile);
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
