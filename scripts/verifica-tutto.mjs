/**
 * Tutti i controlli, in un comando solo.
 *
 *   npm run verify            codice + logica + build pulita
 *   npm run verify -- --prod  aggiunge la prova contro il sito vero
 *
 * L'ordine non e' casuale: prima quelli che costano un secondo, poi quelli
 * che costano un minuto. Chi ha rotto un tipo lo scopre subito, invece di
 * aspettare la build per sentirsi dire la stessa cosa.
 *
 * Non si ferma al primo rosso, di proposito: sapere che sono rotti tre
 * controlli su otto e' un'informazione diversa da "il primo e' rotto", e la
 * seconda costringe a rieseguire tutto a ogni correzione.
 */
import { spawnSync } from "node:child_process";

const CONTROLLI = [
  ["typecheck", "I tipi tornano", ["run", "typecheck"]],
  ["lint", "Nessuna regola violata", ["run", "lint"]],
  ["verify:sql", "Lo SQL e' accettato da PostgreSQL", ["run", "verify:sql"]],
  ["verify:rls", "Nessuna policy si morde la coda", ["run", "verify:rls"]],
  ["verify:filtro", "Ognuno vede cio' che deve vedere", ["run", "verify:filtro"]],
  ["verify:filtri", "I filtri sopravvivono al cambio pagina", ["run", "verify:filtri"]],
  ["verify:freelance", "Il calendario di chi non ha la settimana", ["run", "verify:freelance"]],
  ["verify:build", "Il sito si costruisce da zero", ["run", "verify:build"]],
];

const PROD = ["produzione", "La produzione risponde", ["run", "verify:prod"]];

const conProd = process.argv.includes("--prod");
const daFare = conProd ? [...CONTROLLI, PROD] : CONTROLLI;

const esiti = [];
for (const [nome, cosa, args] of daFare) {
  process.stdout.write(`\n▸ ${cosa} (${nome})\n`);
  const inizio = Date.now();
  const r = spawnSync("npm", args, {
    stdio: "inherit",
    shell: true,
    encoding: "utf8",
  });
  const secondi = Math.round((Date.now() - inizio) / 100) / 10;
  esiti.push({ nome, cosa, ok: r.status === 0, secondi });
}

console.log("\n" + "═".repeat(64));
for (const e of esiti) {
  console.log(
    `${e.ok ? "PASS" : "FAIL"}  ${e.cosa.padEnd(42)} ${String(e.secondi).padStart(5)}s`,
  );
}
const rotti = esiti.filter((e) => !e.ok);
console.log("═".repeat(64));
console.log(
  rotti.length === 0
    ? `TUTTO VERDE — ${esiti.length} controlli`
    : `${rotti.length} controlli su ${esiti.length} falliti: ${rotti.map((e) => e.nome).join(", ")}`,
);
if (!conProd) {
  console.log("\n(con --prod si controlla anche il sito vero)");
}
process.exit(rotti.length === 0 ? 0 : 1);
