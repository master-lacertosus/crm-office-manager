/**
 * Verifica indipendente dello schema Supabase, usando solo le chiavi
 * pubbliche lette da .env.local. Non scrive niente: interroga l'API REST e
 * confronta con quello che le migrazioni M1 + M2 dovrebbero aver creato.
 *
 *   node scripts/supabase-verify.mjs
 *
 * Node nativo, zero dipendenze (v24 ha fetch globale).
 */

import { readFileSync } from "node:fs";

/* .env.local a mano: caricarlo con una libreria significherebbe una
   dipendenza in più per tre righe. */
function loadEnv(path) {
  const out = {};
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    console.error(`Manca ${path}. Copia .env.example e compilalo.`);
    process.exit(1);
  }
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) out[match[1]] = match[2].trim();
  }
  return out;
}

const env = loadEnv(".env.local");
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY mancanti in .env.local.");
  process.exit(1);
}

/** Le 20 tabelle attese: 4 da M1, 16 da M2. */
const ATTESE = [
  "profiles", "projects", "tasks", "task_comments",
  "task_statuses", "task_checklist_items", "task_links", "task_events",
  "task_comment_reactions", "project_comments", "project_comment_reactions",
  "notifications", "leave_requests", "company_closures", "task_requests",
  "workspace_templates", "workspace_template_pack_items", "user_task_state",
  "saved_views", "user_preferences",
];

const headers = { apikey: key, Authorization: `Bearer ${key}` };

console.log(`Progetto: ${url}\n`);

// --- 1. Esistenza delle tabelle ---------------------------------------------
// La radice OpenAPI ora pretende la chiave segreta, quindi si interroga ogni
// tabella singolarmente. PostgREST distingue i due casi che ci interessano:
//   404 con codice PGRST205 → la tabella non esiste
//   200 con array vuoto     → esiste, e la RLS sta bloccando (atteso)
const mancanti = [];
const errori = [];

for (const tabella of ATTESE) {
  const res = await fetch(`${url}/rest/v1/${tabella}?select=*&limit=1`, { headers });
  if (res.status === 404) {
    mancanti.push(tabella);
  } else if (!res.ok && res.status !== 401 && res.status !== 403) {
    errori.push(`${tabella}: HTTP ${res.status} ${(await res.text()).slice(0, 80)}`);
  }
}

console.log(`1. Tabelle attese     ${ATTESE.length - mancanti.length}/${ATTESE.length}`);
console.log(mancanti.length === 0
  ? "   OK — schema M1 + M2 completo"
  : `   MANCANO: ${mancanti.join(", ")}`);
if (errori.length) console.log(`   Risposte inattese:\n   ${errori.join("\n   ")}`);

// --- 2. La RLS blocca davvero l'anonimo? ------------------------------------
// Le policy sono tutte `to authenticated`: senza login, ogni tabella deve
// rispondere vuoto (o negare). Se tornassero righe, la RLS non è attiva.
console.log("\n2. RLS verso l'anonimo");
let perdite = 0;
for (const tabella of ["profiles", "tasks", "leave_requests", "notifications"]) {
  const res = await fetch(`${url}/rest/v1/${tabella}?select=*&limit=1`, { headers });
  const body = await res.text();
  let righe = null;
  try {
    const parsed = JSON.parse(body);
    righe = Array.isArray(parsed) ? parsed.length : null;
  } catch { /* non è JSON: lo si mostra grezzo sotto */ }

  if (righe === 0) {
    console.log(`   ${tabella.padEnd(16)} OK — nessuna riga senza login`);
  } else if (righe > 0) {
    perdite++;
    console.log(`   ${tabella.padEnd(16)} ATTENZIONE — ${righe} riga/e leggibili senza login!`);
  } else {
    console.log(`   ${tabella.padEnd(16)} HTTP ${res.status}: ${body.slice(0, 100)}`);
  }
}

// --- 3. Le fasi di sistema --------------------------------------------------
// Anche questa tabella è protetta: il conteggio vero si vede solo da loggati.
// Qui interessa che esista e risponda.
console.log("\n3. Fasi del flusso");
const fasi = await fetch(`${url}/rest/v1/task_statuses?select=key,label,kind&order=sort_order`, { headers });
const fasiBody = await fasi.text();
console.log(`   HTTP ${fasi.status} — ${fasiBody.slice(0, 200)}`);

// --- 4. Colonne di M3 -------------------------------------------------------
// Trucco: la RLS nasconde le RIGHE, non le COLONNE. Chiedere una colonna che
// non esiste produce 400 con codice 42703; se invece esiste, la risposta è
// 200 con lista vuota. Basta a distinguere «migrazione applicata» da «no».
console.log("\n4. Colonne aggiunte da M3");
let m3Ok = true;
for (const [tabella, colonna] of [["profiles", "onboarded_at"]]) {
  const res = await fetch(
    `${url}/rest/v1/${tabella}?select=${colonna}&limit=1`,
    { headers },
  );
  if (res.ok) {
    console.log(`   ${tabella}.${colonna.padEnd(14)} OK`);
  } else {
    m3Ok = false;
    const body = await res.text();
    console.log(`   ${tabella}.${colonna.padEnd(14)} MANCA — ${body.slice(0, 120)}`);
  }
}

// --- 5. Bucket delle foto ---------------------------------------------------
// Stessa logica: un bucket assente risponde «Bucket not found», uno presente
// si lamenta dell'oggetto inesistente. Due errori diversi, due significati.
console.log("\n5. Deposito delle foto profilo");
const sonda = await fetch(
  `${url}/storage/v1/object/public/avatars/sonda-inesistente.png`,
);
const sondaBody = await sonda.text();
const bucketAssente = /bucket not found/i.test(sondaBody);
console.log(
  bucketAssente
    ? `   bucket «avatars»   MANCA — ${sondaBody.slice(0, 100)}`
    : "   bucket «avatars»   OK — risponde, l'oggetto di prova non esiste (atteso)",
);

console.log(
  mancanti.length === 0 && perdite === 0 && m3Ok && !bucketAssente
    ? "\nSchema applicato e RLS attiva."
    : "\nCi sono problemi da guardare sopra.",
);
