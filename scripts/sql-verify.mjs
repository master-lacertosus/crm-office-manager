/**
 * Passa ogni file .sql del repo attraverso il parser vero di PostgreSQL.
 *
 * Perché serve: né la build né il typecheck né ESLint guardano dentro un
 * file .sql. Una migrazione può essere sbagliata in modo grossolano e
 * arrivare fino al SQL Editor senza che nessuno se ne accorga — è successo:
 * due funzioni di M9 avevano `as $` invece di `as $$`, e il server si
 * sarebbe fermato a metà applicazione, lasciando il database mezzo
 * cambiato. Peggio ancora, si sarebbe scoperto in produzione.
 *
 * libpg-query è la grammatica del server PostgreSQL compilata: qui non si
 * indovina, si chiede a chi poi dovrà leggerlo davvero. Attenzione: verifica
 * la sintassi, non il significato — che una policy dica la cosa giusta lo
 * dicono le prove dedicate.
 *
 *   node scripts/sql-verify.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";

let parse, loadModule;
try {
  ({ parse, loadModule } = await import("libpg-query"));
  if (loadModule) await loadModule();
} catch {
  console.log("libpg-query non installato: `npm install` e riprova.");
  process.exit(1);
}

function sqlNella(dir, dentro = []) {
  for (const voce of readdirSync(dir)) {
    if (voce === "node_modules" || voce === ".git" || voce === ".next") continue;
    const p = join(dir, voce);
    if (statSync(p).isDirectory()) sqlNella(p, dentro);
    else if (voce.endsWith(".sql")) dentro.push(p);
  }
  return dentro;
}

const files = sqlNella("supabase").sort();
let rotti = 0;

for (const f of files) {
  const sql = readFileSync(f, "utf8");
  const nome = f.split(sep).join("/");
  try {
    const albero = await parse(sql);
    const n = albero.stmts?.length ?? 0;
    // Un file che parsa in zero statement è quasi sempre un file svuotato
    // per sbaglio: vale la pena dirlo invece di dare per buono il silenzio.
    if (n === 0 && sql.replace(/--[^\n]*/g, "").trim()) {
      rotti++;
      console.log(`FAIL  ${nome} — nessuno statement riconosciuto`);
    } else {
      console.log(`PASS  ${nome} — ${n} statement`);
    }
  } catch (e) {
    rotti++;
    console.log(`FAIL  ${nome} — ${e.message}`);
  }
}

console.log(
  rotti === 0
    ? `\nTUTTO VERDE — ${files.length} file accettati da PostgreSQL`
    : `\n${rotti} file su ${files.length} non passano`,
);
process.exit(rotti === 0 ? 0 : 1);
