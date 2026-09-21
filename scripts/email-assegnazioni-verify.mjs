/**
 * La mail del lavoro assegnato dice qualcosa, e non parte a raffica.
 *
 * Il rischio di questa funzionalita' non e' tecnico: e' diventare rumore che
 * si impara a filtrare. Bastano due errori perche' succeda — un oggetto
 * sempre uguale, e una mail per ogni riga invece che per ogni gesto — e
 * tutti e due si scrivono senza accorgersene.
 *
 * Qui si esercita il modulo vero che compone il testo, e si vigila sulle
 * scelte strutturali che tengono il volume basso.
 *
 *   node --import ./scripts/alias.mjs scripts/email-assegnazioni-verify.mjs
 */
import { readFileSync } from "node:fs";

import {
  componiMail,
  oggettoDi,
  testoDi,
} from "@/lib/email/assegnazioni.ts";

let falliti = 0;
function check(nome, ok, dettaglio = "") {
  if (!ok) falliti++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}
const leggi = (p) => readFileSync(p, "utf8");

const BASE = "https://lct-ufficio.vercel.app";
let n = 0;
const lavoro = (p = {}) => ({
  taskId: `t${++n}`,
  titolo: "Rifare la scheda prodotto",
  daChi: "Francesco Salafia",
  scadenza: null,
  progetto: null,
  priorita: "normal",
  ...p,
});

/* ------------------------------------------------------------------ */
console.log("\n# L'oggetto dice il lavoro, non la categoria dell'avviso\n");
/* ------------------------------------------------------------------ */

const uno = oggettoDi([lavoro({ scadenza: "2026-09-24" })]);
check(
  "Un lavoro solo: chi, cosa, per quando",
  uno === "Da Francesco: Rifare la scheda prodotto — entro il 24 set",
  uno,
);
check(
  "Niente scadenza, niente coda inventata",
  oggettoDi([lavoro()]) === "Da Francesco: Rifare la scheda prodotto",
);
check(
  "Solo il nome di battesimo",
  !uno.includes("Salafia"),
  "fra colleghi il cognome e' burocrazia",
);
check(
  "Piu' lavori: quanti e da chi, non sei titoli in fila",
  oggettoDi([lavoro(), lavoro(), lavoro()]) === "3 lavori nuovi da Francesco",
);
check(
  "Mittenti diversi: non si attribuisce a uno solo",
  oggettoDi([lavoro({ daChi: "Sara" }), lavoro({ daChi: "Klea" })]) ===
    "2 lavori nuovi per te",
);
check(
  "Senza mittente umano non si finge che ci sia",
  oggettoDi([lavoro({ daChi: null })]) === "Rifare la scheda prodotto",
  "un lavoro pianificato non ha un nome da mettere",
);

/* Il difetto che questa prova esiste per impedire. */
check(
  "Due oggetti diversi per due lavori diversi",
  oggettoDi([lavoro({ titolo: "Packaging" })]) !==
    oggettoDi([lavoro({ titolo: "Spedizioni" })]),
  "un oggetto identico ogni volta e' invisibile dopo tre invii",
);

/* ------------------------------------------------------------------ */
console.log("\n# Il corpo si legge anche senza immagini\n");
/* ------------------------------------------------------------------ */

const testo = testoDi(
  [lavoro({ titolo: "Packaging", scadenza: "2026-09-24", progetto: "LCT B2C", priorita: "high" })],
  "Lorenzo Cavicchioli",
  BASE,
);
check("Saluta per nome", testo.startsWith("Ciao Lorenzo,"));
check("C'e' il titolo del lavoro", testo.includes("Packaging"));
check("C'e' il progetto", testo.includes("LCT B2C"));
check("C'e' la scadenza", testo.includes("entro il 24 set"));
check("La priorita' alta si dice", testo.includes("priorità alta"));
check(
  "Un lavoro solo porta direttamente a quel lavoro",
  testo.includes(`${BASE}/tasks?task=`),
  "non alla lista da cui ricercarlo",
);
check(
  "Piu' lavori portano all'elenco",
  testoDi([lavoro(), lavoro()], "Lorenzo", BASE).includes(`${BASE}/tasks\n`),
);
check(
  "C'e' sempre come smettere di riceverle",
  testo.includes("/settings/appearance"),
);

/* ------------------------------------------------------------------ */
console.log("\n# L'HTML non si fa iniettare\n");
/* ------------------------------------------------------------------ */

const cattivo = componiMail(
  [lavoro({ titolo: `<script>alert(1)</script> & "virgolette"` })],
  "Lorenzo",
  BASE,
);
check(
  "Un titolo con del markup dentro viene scappato",
  !cattivo.html.includes("<script>") && cattivo.html.includes("&lt;script&gt;"),
  "i titoli li scrivono le persone, e prima o poi qualcuno ci mette una parentesi angolare",
);
check(
  "Le virgolette non spezzano gli attributi",
  cattivo.html.includes("&quot;"),
);
check(
  "Il testo in chiaro resta leggibile com'e' stato scritto",
  cattivo.testo.includes("<script>"),
  "li' non c'e' niente da interpretare: scapparlo lo renderebbe solo illeggibile",
);

/* ------------------------------------------------------------------ */
console.log("\n# Le scelte che tengono basso il volume\n");
/* ------------------------------------------------------------------ */

const rotta = leggi("app/api/avvisi-email/route.ts");
const m15 = leggi("supabase/migrations/20260921120000_m15_email_assegnazioni.sql");

check(
  "Si raggruppa per destinatario: un gesto, una mail",
  /perDestinatario/.test(rotta) && /gruppo\.lavori\.push/.test(rotta),
  "un template a pacchetto crea sei task: a invio immediato sarebbero sei mail",
);
check(
  "La finestra e' di cinque minuti",
  /'\*\/5 \* \* \* \*'/.test(m15),
);
check(
  "Non si spedisce l'arretrato al primo giro",
  /interval '24 hours'/.test(m15) && /24 \* 60 \* 60 \* 1000/.test(rotta),
  "la colonna nasce oggi: senza il filtro, il primo giro spedirebbe tutto lo storico",
);
check(
  "La sveglia tace se non c'e' niente da spedire",
  /if quanti = 0 then\s+return 0;/.test(m15),
  "un campanello a vuoto ogni cinque minuti e' una richiesta HTTP a vuoto ogni cinque minuti",
);
check(
  "Si segna spedito SOLO dopo un invio riuscito",
  /spedite \+= 1;[\s\S]{0,400}email_inviata_at: adesso/.test(rotta),
  "segnare prima significherebbe perdere la mail in silenzio se il fornitore rifiuta",
);
check(
  "Chi non ricevera' mai la mail non resta in coda per sempre",
  /daSegnareSenzaInvio/.test(rotta),
  "spento, disattivato, senza indirizzo, task sparito",
);
check(
  "Un task gia' chiuso o archiviato non produce mail",
  /task\.archived_at \|\|\s*task\.status === "done"/.test(rotta),
);

/* ------------------------------------------------------------------ */
console.log("\n# Chi bussa alla rotta, e chi no\n");
/* ------------------------------------------------------------------ */

const proxy = leggi("proxy.ts");

check(
  "La rotta e' esclusa dal cancello",
  /percorso === "\/api\/avvisi-email"/.test(proxy),
  "senza, il proxy rimanda al login una richiesta che una sessione non puo' averla, e l'invio fallisce in silenzio",
);
check(
  "Il segreto si confronta a tempo costante",
  /timingSafeEqual/.test(rotta),
  "con === si indovina un carattere alla volta misurando i tempi",
);
check(
  "Chi sbaglia segreto non scopre che la rotta esiste",
  /status: 404/.test(rotta),
);
check(
  "Il segreto non sta nel file della migrazione",
  !/[0-9a-f]{32}/.test(m15),
  "quel file finisce su GitHub: la configurazione si inserisce a parte",
);
check(
  "La tabella della configurazione non si legge dall'API",
  /alter table public\.impostazioni_invio enable row level security/.test(m15) &&
    !/create policy[\s\S]*impostazioni_invio/.test(m15),
  "RLS accesa e nessuna policy: la legge solo la funzione security definer",
);

/* ------------------------------------------------------------------ */
console.log("\n# Si spegne, e senza migrazioni\n");
/* ------------------------------------------------------------------ */

const prefs = leggi("lib/preferences.tsx");
const aspetto = leggi("components/appearance-settings.tsx");

check(
  "La preferenza esiste ed e' accesa di serie",
  /emailAssegnazioni: boolean;/.test(prefs) && /emailAssegnazioni: true,/.test(prefs),
);
check(
  "C'e' l'interruttore nelle impostazioni",
  /prefs\.emailAssegnazioni/.test(aspetto),
);
check(
  "Il lavoro di invio la legge davvero",
  /a\?\.emailAssegnazioni === false/.test(rotta),
  "una preferenza che vive solo nel browser non puo' governare un invio server-side",
);
check(
  "Nessuna colonna nuova per l'interruttore",
  !/alter table public\.user_preferences/.test(m15),
  "le preferenze stanno gia' in un jsonb: una chiave in piu' costa zero",
);

/* ------------------------------------------------------------------ */
console.log("\n# Nessuna dipendenza nuova\n");
/* ------------------------------------------------------------------ */

const pkg = JSON.parse(leggi("package.json"));
const dipendenze = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
check(
  "Resend si chiama via fetch, senza pacchetto",
  !dipendenze.some((d) => /resend|nodemailer|@sendgrid|postmark|mailgun/.test(d)) &&
    /fetch\("https:\/\/api\.resend\.com\/emails"/.test(rotta),
  "la regola del repo: nessuna dipendenza senza spiegarne il perche'",
);

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
