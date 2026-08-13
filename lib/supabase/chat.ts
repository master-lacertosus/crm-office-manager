/**
 * Chat interna: letture, scritture e sottoscrizione dal vivo.
 *
 * Sta a parte da `queries.ts` perché la chat ha una sua logica di canale che
 * non riguarda il resto del dominio: mescolarle renderebbe entrambi i file
 * più difficili da leggere.
 */

import type {
  RealtimeChannel,
  SupabaseClient,
} from "@supabase/supabase-js";

/** Chiave del canale: «general» oppure l'id del progetto. Corrisponde al
 *  vincolo `message_reads_channel_format` della migrazione M4. */
export type ChannelKey = string;
export const GENERAL: ChannelKey = "general";

export interface ChatMessage {
  id: string;
  project_id: string | null;
  author_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
}

const COLUMNS = "id, project_id, author_id, body, created_at, edited_at";

/** Da chiave di canale a filtro su `project_id`. Il Generale è l'assenza di
 *  progetto, non un progetto speciale. */
function filtroCanale(canale: ChannelKey) {
  return canale === GENERAL
    ? { colonna: "project_id", nullo: true, valore: null as string | null }
    : { colonna: "project_id", nullo: false, valore: canale };
}

/**
 * Gli ultimi messaggi del canale, dal più vecchio al più recente.
 *
 * Si chiedono i più RECENTI (ordine discendente + limite) e poi si inverte:
 * chiedere i primi N in ordine crescente restituirebbe l'inizio della
 * conversazione, che è esattamente ciò che non interessa in una chat.
 */
export async function fetchMessages(
  supabase: SupabaseClient,
  canale: ChannelKey,
  limite = 100,
): Promise<ChatMessage[]> {
  const f = filtroCanale(canale);
  let query = supabase
    .from("messages")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limite);

  query = f.nullo
    ? query.is(f.colonna, null)
    : query.eq(f.colonna, f.valore as string);

  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as ChatMessage[]).reverse();
}

/**
 * Gli ultimi messaggi di TUTTI i canali, in una sola richiesta.
 *
 * Caricarli canale per canale costava una richiesta a progetto: con venti
 * progetti, ventuno viaggi di rete all'apertura dell'app. Qui se ne fa uno
 * solo e si raggruppa a valle.
 *
 * Il limite è globale, non per canale: un canale molto attivo può quindi
 * mangiarsi la quota degli altri. È accettabile perché serve a popolare i
 * contatori dei non letti e le ultime battute; quando un canale si apre
 * davvero, `fetchMessages` ne carica la storia per intero.
 */
export async function fetchRecentMessages(
  supabase: SupabaseClient,
  limite = 400,
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limite);

  if (error) throw error;
  return (data as unknown as ChatMessage[]).reverse();
}

export async function insertMessage(
  supabase: SupabaseClient,
  messaggio: ChatMessage,
): Promise<void> {
  const { error } = await supabase.from("messages").insert({
    id: messaggio.id,
    project_id: messaggio.project_id,
    author_id: messaggio.author_id,
    body: messaggio.body,
  });
  if (error) throw error;
}

/** `edited_at` non si invia: lo scrive il trigger `messages_guard`. */
export async function updateMessage(
  supabase: SupabaseClient,
  id: string,
  body: string,
): Promise<void> {
  const { error } = await supabase.from("messages").update({ body }).eq("id", id);
  if (error) throw error;
}

export async function deleteMessage(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("messages").delete().eq("id", id);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Segnalibri di lettura                                                       */
/* -------------------------------------------------------------------------- */

export async function fetchReads(
  supabase: SupabaseClient,
): Promise<Record<ChannelKey, string>> {
  const { data, error } = await supabase
    .from("message_reads")
    .select("channel_key, last_read_at");
  if (error) throw error;

  const out: Record<string, string> = {};
  for (const r of data as { channel_key: string; last_read_at: string }[]) {
    out[r.channel_key] = r.last_read_at;
  }
  return out;
}

export async function markChannelRead(
  supabase: SupabaseClient,
  userId: string,
  canale: ChannelKey,
): Promise<string> {
  const quando = new Date().toISOString();
  const { error } = await supabase.from("message_reads").upsert(
    { user_id: userId, channel_key: canale, last_read_at: quando },
    { onConflict: "user_id,channel_key" },
  );
  if (error) throw error;
  return quando;
}

/* -------------------------------------------------------------------------- */
/* Dal vivo                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Ascolta gli inserimenti su `messages` e la presenza.
 *
 * Un canale solo per TUTTI i messaggi, non uno per stanza: il filtro sul
 * canale si applica a valle. Sottoscrivere una stanza per volta farebbe
 * perdere i messaggi delle altre, e con essi i pallini dei non letti — che
 * sono metà del motivo per cui una chat serve.
 *
 * Le policy valgono anche qui: Realtime consegna solo le righe che chi
 * ascolta avrebbe potuto leggere comunque.
 */
export function subscribeToChat(
  supabase: SupabaseClient,
  utente: { id: string; nome: string },
  callbacks: {
    onInsert: (m: ChatMessage) => void;
    onUpdate: (m: ChatMessage) => void;
    onDelete: (id: string) => void;
    onPresence: (idsCollegati: string[]) => void;
  },
): RealtimeChannel {
  const canale = supabase.channel("chat-interna", {
    config: { presence: { key: utente.id } },
  });

  canale
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => callbacks.onInsert(payload.new as ChatMessage),
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "messages" },
      (payload) => callbacks.onUpdate(payload.new as ChatMessage),
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "messages" },
      // Nella cancellazione arriva solo la chiave primaria: il resto della
      // riga non esiste più.
      (payload) => callbacks.onDelete((payload.old as { id: string }).id),
    )
    .on("presence", { event: "sync" }, () => {
      callbacks.onPresence(Object.keys(canale.presenceState()));
    })
    .subscribe((stato) => {
      // La presenza si dichiara solo a sottoscrizione avvenuta: farlo prima
      // significa annunciarsi su un canale che non è ancora aperto.
      if (stato === "SUBSCRIBED") {
        void canale.track({ id: utente.id, nome: utente.nome });
      }
    });

  return canale;
}
