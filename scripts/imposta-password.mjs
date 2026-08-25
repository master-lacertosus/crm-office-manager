/**
 * Imposta la password di un account, da responsabile.
 *
 * La via normale e' l'altra: Team > Rimanda il link, e la persona sceglie
 * la propria password senza che nessuno la conosca. Questo script serve
 * quando quella strada e' chiusa -- l'email non arriva, il collega e'
 * bloccato adesso -- e vale la pena saperlo: una password decisa da altri
 * e' una password che qualcun altro conosce, e che viaggia su una chat.
 * Dopo averla usata, conviene che la persona se la cambi.
 *
 * Non e' un'azione dell'app, ed e' voluto: nel CRM un responsabile puo'
 * rimandare il link, non entrare nell'account di un collega. Qui serve la
 * chiave di servizio, che sta sul tuo computer e non nel browser di
 * nessuno.
 *
 * USO
 *   1. Prendi la chiave: Supabase > Project Settings > API >
 *      `service_role`. Da' pieni poteri sul database: non finisce in un
 *      file committato, non si incolla in una chat.
 *   2. Esegui:
 *
 *      SUPABASE_URL=https://xxxx.supabase.co \
 *      SUPABASE_SERVICE_ROLE_KEY=... \
 *      node scripts/imposta-password.mjs collega@lacertosus.com 'LaPassword'
 *
 *      Su PowerShell:
 *      $env:SUPABASE_URL="https://xxxx.supabase.co"
 *      $env:SUPABASE_SERVICE_ROLE_KEY="..."
 *      node scripts/imposta-password.mjs collega@lacertosus.com 'LaPassword'
 *
 *   Se hai gia' un .env.local con quelle due variabili, le legge da li'.
 */
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/* --- Le due variabili: dall'ambiente, o da .env.local ---------------- */
function daEnvLocale(nome) {
  if (process.env[nome]) return process.env[nome];
  if (!existsSync(".env.local")) return null;
  for (const riga of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*)$/.exec(riga);
    if (m && m[1] === nome) return m[2].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

const URL_PROGETTO =
  daEnvLocale("SUPABASE_URL") ?? daEnvLocale("NEXT_PUBLIC_SUPABASE_URL");
const CHIAVE = daEnvLocale("SUPABASE_SERVICE_ROLE_KEY");

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error(
    "Uso: node scripts/imposta-password.mjs <email> <password>\n" +
      "     (leggi l'intestazione del file per le due variabili d'ambiente)",
  );
  process.exit(1);
}
if (!URL_PROGETTO || !CHIAVE) {
  console.error(
    "Mancano SUPABASE_URL e/o SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Si trovano in Supabase > Project Settings > API.\n" +
      "La service_role da' pieni poteri: passala per variabile d'ambiente,\n" +
      "non scrivendola dentro un file che finisce in git.",
  );
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password troppo corta: servono almeno 8 caratteri.");
  process.exit(1);
}

const supabase = createClient(URL_PROGETTO, CHIAVE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/* --- Si cerca la persona, e si controlla che sia una sola ------------ */
const cercata = email.trim().toLowerCase();
let utente = null;
let pagina = 1;

while (!utente) {
  const { data, error } = await supabase.auth.admin.listUsers({
    page: pagina,
    perPage: 200,
  });
  if (error) {
    console.error(`Elenco utenti non riuscito: ${error.message}`);
    process.exit(1);
  }
  utente = data.users.find((u) => (u.email ?? "").toLowerCase() === cercata);
  if (utente || data.users.length < 200) break;
  pagina++;
}

if (!utente) {
  console.error(
    `Nessun account con l'indirizzo ${email}.\n` +
      "Controlla la scrittura: qui non si crea niente, si cambia solo una\n" +
      "password esistente.",
  );
  process.exit(1);
}

/* --- Il cambio ------------------------------------------------------- */
const { error } = await supabase.auth.admin.updateUserById(utente.id, {
  password,
});

if (error) {
  console.error(`Cambio non riuscito: ${error.message}`);
  process.exit(1);
}

console.log(`Password impostata per ${utente.email}.`);
console.log(`  id     : ${utente.id}`);
console.log(
  `  ultimo accesso: ${utente.last_sign_in_at ?? "mai entrato finora"}`,
);
console.log(
  "\nLe sessioni gia' aperte restano valide: se serve chiuderle, si fa\n" +
    "dal dashboard (Authentication > Users > l'utente).\n" +
    "Ricordati di dire al collega di cambiarsela dalle sue impostazioni.",
);
