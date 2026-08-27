/**
 * Quanto capisce, e soprattutto quanto NON sbaglia.
 *
 * Non c'e' un modello linguistico dietro: ci sono regole, e le regole
 * sbagliano. La scommessa e' che indovinare l'80% e lasciar correggere il
 * resto sia molto piu' veloce che riempire otto campi a mano.
 *
 * Per questo la prova non misura solo cosa riconosce: misura anche che di
 * fronte all'incerto lasci il campo VUOTO. Una scadenza sbagliata costa
 * piu' di una scadenza assente, perche' quella assente si vede.
 *
 *   node --import ./scripts/alias.mjs scripts/interpreta-verify.mjs
 */
import { interpreta, spezza, trovaData } from "../lib/interpreta.ts";

let falliti = 0;
function check(nome, ok, dettaglio = "") {
  if (!ok) falliti++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}

/* Un mercoledi', per avere giorni della settimana prevedibili. */
const OGGI = "2026-08-26";

const PROFILI = [
  { id: "francesco", full_name: "Francesco Salafia", is_active: true },
  { id: "lorenzo", full_name: "Lorenzo Cavicchioli", is_active: true },
  { id: "klea", full_name: "Klea Qyra", is_active: true },
];
const PROGETTI = [
  { id: "rw", name: "Rimini Wellness", is_archived: false },
  { id: "sito", name: "Sito web", is_archived: false },
];
const CTX = { profiles: PROFILI, projects: PROGETTI, io: "francesco", oggi: OGGI };

/* --- 1. La frase da cui e' nata la richiesta ------------------------- */
{
  const r = interpreta(
    "Devo fare un video entro venerdi per Rimini Wellness ed ho bisogno entro il 12 di Lorenzo che mi faccia una landing page",
    CTX,
  );
  console.log("\n  «Devo fare un video entro venerdi per Rimini Wellness");
  console.log("   ed ho bisogno entro il 12 di Lorenzo che mi faccia una landing page»\n");
  for (const t of r) {
    console.log(
      `    · ${t.titolo.padEnd(26)} ${String(t.owner_id).padEnd(10)} ${t.due_date ?? "—"}  ${t.project_id ?? "—"}`,
    );
  }
  console.log("");

  check("Ne ricava due lavori", r.length === 2, `${r.length}`);
  check("Il primo e' di chi scrive", r[0]?.owner_id === "francesco");
  check("Il secondo e' di Lorenzo", r[1]?.owner_id === "lorenzo");
  check(
    "«venerdi» diventa il 28 agosto",
    r[0]?.due_date === "2026-08-28",
    r[0]?.due_date ?? "nessuna",
  );
  check(
    "«entro il 12» diventa il 12 settembre",
    r[1]?.due_date === "2026-09-12",
    r[1]?.due_date ?? "nessuna",
  );
  check(
    "Il progetto vale per tutti e due",
    r.every((t) => t.project_id === "rw"),
    "«per Rimini Wellness» e' detto una volta sola",
  );
  check(
    "I titoli non contengono date, nomi o progetti",
    r.every(
      (t) =>
        !/venerdi|lorenzo|rimini|entro il 12/i.test(t.titolo),
    ),
    r.map((t) => `«${t.titolo}»`).join(" · "),
  );
}

/* --- 2. Le date, una per una ---------------------------------------- */
{
  const casi = [
    ["domani", "2026-08-27"],
    ["dopodomani", "2026-08-28"],
    ["entro lunedi", "2026-08-31"],
    ["fra due settimane", "2026-09-09"],
    ["tra 3 giorni", "2026-08-29"],
    ["il 12 marzo", "2027-03-12"],
    ["entro il 30/9", "2026-09-30"],
    ["entro il 5", "2026-09-05"],
  ];
  for (const [testo, atteso] of casi) {
    const d = trovaData(testo, OGGI);
    check(`«${testo}» → ${atteso}`, d?.iso === atteso, d?.iso ?? "non riconosciuta");
  }
}

/* --- 3. Nell'incertezza, campo vuoto -------------------------------- */
{
  const r = interpreta("Sistemare il montaggio del video", CTX);
  check(
    "Senza data non se ne inventa una",
    r[0]?.due_date === null,
    "una scadenza sbagliata costa piu' di una assente",
  );
  check(
    "Senza nomi il lavoro e' di chi scrive",
    r[0]?.owner_id === "francesco",
  );
  const s = interpreta("Preparare il preventivo per Acme", CTX);
  check(
    "Un progetto che non esiste non viene inventato",
    s[0]?.project_id === null,
    "si propone di crearlo, non lo si immagina",
  );
}

/* --- 4. Non si spezza dove non serve -------------------------------- */
{
  check(
    "Una frase sola resta un lavoro solo",
    spezza("Montare il video di presentazione").length === 1,
  );
  check(
    "«e» dentro un titolo non spezza",
    interpreta("Riprese e montaggio del video", CTX).length === 1,
    "solo i connettivi che introducono una richiesta",
  );
}

/* --- 5. Le forme in cui si chiede una cosa a qualcuno ---------------- */
{
  const forme = [
    "Klea mi serve la grafica entro domani",
    "Ho bisogno che Klea faccia la grafica entro domani",
    "Chiedere a Klea la grafica entro domani",
  ];
  for (const f of forme) {
    const r = interpreta(f, CTX);
    const suKlea = r.some((t) => t.owner_id === "klea");
    check(`«${f.slice(0, 34)}…» riconosce Klea`, suKlea, suKlea ? "" : "non trovata");
  }
}

/* --- 6. Il nome intero e gli accenti -------------------------------- */
{
  const r = interpreta("Lorenzo Cavicchioli deve fare la landing", CTX);
  check("Riconosce anche il nome intero", r[0]?.owner_id === "lorenzo");
  const s = interpreta("Video entro venerdì", CTX);
  check(
    "L'accento non cambia niente",
    s[0]?.due_date === "2026-08-28",
    s[0]?.due_date ?? "nessuna",
  );
}

/* --- 7. Il testo vuoto non produce niente --------------------------- */
{
  check("Testo vuoto: nessun lavoro", interpreta("   ", CTX).length === 0);
}

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
