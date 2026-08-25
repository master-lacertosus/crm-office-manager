/**
 * Verifica delle regole dei processi a più mani: ordine delle fasi e
 * avanzamento. Non serve né browser né database — si controlla la regola,
 * non la sua rappresentazione.
 *
 *   node scripts/processo-verify.mjs
 *
 * Node 24 legge i .ts direttamente (type stripping): `lib/processo.ts` non
 * importa nulla apposta, così resta caricabile da qui.
 */

import { avanzamentoProcesso, ordinaFasi } from "../lib/processo.ts";

let falliti = 0;
function check(nome, ok, dettaglio = "") {
  if (!ok) falliti++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}

const fase = (id, position, status, due_date, owner_id = "klea") => ({
  id,
  title: `Fase ${id}`,
  status,
  owner_id,
  due_date,
  position,
});

/* Un processo tipico: testi, foto, caricamento, controllo. */
const processo = [
  fase("controllo", 4, "todo", "2026-09-10", "francesco"),
  fase("testi", 1, "done", "2026-09-01", "klea"),
  fase("caricamento", 3, "in_progress", "2026-09-08", "lorenzo"),
  fase("foto", 2, "done", "2026-09-04", "sara"),
];

/* ---------- 1. L'ordine è quello del processo, non delle date --------- */
check(
  "Le fasi seguono l'ordine del template, non la scadenza",
  ordinaFasi(processo).map((f) => f.id).join(",") ===
    "testi,foto,caricamento,controllo",
  ordinaFasi(processo).map((f) => f.id).join(","),
);

/* Spostare una scadenza non deve rimescolare il flusso. */
const conDataSpostata = processo.map((f) =>
  f.id === "testi" ? { ...f, due_date: "2026-12-31" } : f,
);
check(
  "Spostare una data non rimescola le fasi",
  ordinaFasi(conDataSpostata).map((f) => f.id).join(",") ===
    "testi,foto,caricamento,controllo",
  ordinaFasi(conDataSpostata).map((f) => f.id).join(","),
);

/* ---------- 2. Avanzamento ------------------------------------------- */
const a = avanzamentoProcesso(processo);
check(
  "Conteggio: 2 fasi chiuse su 4, metà del percorso",
  a.totale === 4 && a.fatte === 2 && a.percento === 50,
  JSON.stringify({ totale: a.totale, fatte: a.fatte, percento: a.percento }),
);
check(
  "La fase corrente è la prima non chiusa, in ordine di processo",
  a.corrente?.id === "caricamento",
  a.corrente?.id ?? "nessuna",
);

/* ---------- 3. Processo bloccato -------------------------------------- */
const bloccato = processo.map((f) =>
  f.id === "caricamento" ? { ...f, status: "alert" } : f,
);
const b = avanzamentoProcesso(bloccato);
check(
  "Una fase in Problema si conta come blocco, e resta la corrente",
  b.bloccate === 1 && b.corrente?.id === "caricamento" && b.percento === 50,
  JSON.stringify({ bloccate: b.bloccate, corrente: b.corrente?.id }),
);

/* ---------- 4. Estremi ------------------------------------------------ */
const finito = processo.map((f) => ({ ...f, status: "done" }));
const f = avanzamentoProcesso(finito);
check(
  "Processo finito: 100% e nessuna fase corrente",
  f.percento === 100 && f.corrente === null,
  JSON.stringify({ percento: f.percento, corrente: f.corrente }),
);
const vuoto = avanzamentoProcesso([]);
check(
  "Nessuna fase: nessuna divisione per zero",
  vuoto.percento === 0 && vuoto.totale === 0 && vuoto.corrente === null,
  JSON.stringify(vuoto),
);

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
