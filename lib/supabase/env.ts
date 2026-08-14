/**
 * Configurazione Supabase letta dall'ambiente.
 *
 * I riferimenti sono scritti per esteso — `process.env.NEXT_PUBLIC_…` — e mai
 * con indice dinamico: Next sostituisce a build time solo le occorrenze
 * letterali, quindi `process.env[nome]` arriverebbe al browser come
 * `undefined` (docs/01-app/02-guides/environment-variables.md).
 *
 * Fase di transizione: finché `.env.local` non è compilato, l'app continua a
 * girare sui dati mock. Per questo la mancanza delle variabili non è un
 * errore fatale all'avvio — lo diventa solo quando si prova davvero a creare
 * un client.
 */

const URL_ENV = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY_ENV = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Vero quando entrambe le variabili pubbliche sono presenti e non vuote. */
export const isSupabaseConfigured = Boolean(URL_ENV && ANON_KEY_ENV);

function missing(name: string): never {
  throw new Error(
    `Variabile d'ambiente mancante: ${name}.\n` +
      "Copia .env.example in .env.local e compilalo con i valori del progetto " +
      "Supabase (Project Settings › API). Il file è già ignorato da git.",
  );
}

/** URL del progetto Supabase. Lancia se assente: chiamare solo dopo aver
 *  verificato `isSupabaseConfigured`, o dove la configurazione è dovuta. */
export function supabaseUrl(): string {
  return URL_ENV || missing("NEXT_PUBLIC_SUPABASE_URL");
}

/** Chiave `anon`. È pubblica per progetto — finisce nel bundle del browser e
 *  va bene così: da sola non autorizza nulla, è la RLS a decidere cosa si
 *  può leggere e scrivere. La `service_role` invece non compare mai qui. */
export function supabaseAnonKey(): string {
  return ANON_KEY_ENV || missing("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}
