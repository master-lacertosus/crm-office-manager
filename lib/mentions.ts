import type { Profile } from "@/lib/types";

/**
 * Menzioni nei commenti: @Nome, @Nome Cognome o @Admin (tutti gli admin).
 * Fase placeholder: matching testuale sui nomi noti; con Supabase le
 * menzioni diventeranno token con id espliciti.
 */

export interface MentionTarget {
  /** Testo da inserire nel commento (es. "@Marco"). */
  insert: string;
  label: string;
  /** id profilo, oppure "admins" per il gruppo admin. */
  id: string;
}

export function mentionTargets(
  profiles: Profile[],
  currentUserId: string,
): MentionTarget[] {
  const people = profiles
    .filter((p) => p.is_active && p.id !== currentUserId)
    .map((p) => ({
      insert: `@${p.full_name.split(" ")[0]}`,
      label: p.full_name,
      id: p.id,
    }));
  return [
    { insert: "@Team", label: "Team — avvisa tutto l'ufficio", id: "team" },
    { insert: "@Admin", label: "Admin — avvisa gli amministratori", id: "admins" },
    ...people,
  ];
}

/** Id dei profili menzionati in un corpo di commento (escluso l'autore). */
export function extractMentionIds(
  body: string,
  profiles: Profile[],
  authorId: string,
): string[] {
  const low = body.toLowerCase();
  const ids = new Set<string>();

  for (const p of profiles) {
    if (!p.is_active || p.id === authorId) continue;
    const first = p.full_name.split(" ")[0].toLowerCase();
    const full = p.full_name.toLowerCase();
    if (low.includes(`@${first}`) || low.includes(`@${full}`)) {
      ids.add(p.id);
    }
  }
  if (low.includes("@admin")) {
    for (const p of profiles) {
      if (p.is_active && p.role === "admin" && p.id !== authorId) {
        ids.add(p.id);
      }
    }
  }
  if (low.includes("@team")) {
    for (const p of profiles) {
      if (p.is_active && p.id !== authorId) ids.add(p.id);
    }
  }
  return [...ids];
}

/** Spezza il testo in parti normali e menzioni, per l'evidenziazione. */
export function splitMentions(
  body: string,
  profiles: Profile[],
): { text: string; mention: boolean }[] {
  const tokens = [
    "@admin",
    "@team",
    ...profiles.flatMap((p) => [
      `@${p.full_name.toLowerCase()}`,
      `@${p.full_name.split(" ")[0].toLowerCase()}`,
    ]),
  ].sort((a, b) => b.length - a.length);

  const parts: { text: string; mention: boolean }[] = [];
  let rest = body;
  while (rest.length > 0) {
    const low = rest.toLowerCase();
    let idx = -1;
    let len = 0;
    for (const token of tokens) {
      const i = low.indexOf(token);
      if (i !== -1 && (idx === -1 || i < idx)) {
        idx = i;
        len = token.length;
      }
    }
    if (idx === -1) {
      parts.push({ text: rest, mention: false });
      break;
    }
    if (idx > 0) parts.push({ text: rest.slice(0, idx), mention: false });
    parts.push({ text: rest.slice(idx, idx + len), mention: true });
    rest = rest.slice(idx + len);
  }
  return parts;
}
