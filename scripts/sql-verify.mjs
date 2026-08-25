/**
 * Passa ogni file .sql del repo attraverso il parser vero di PostgreSQL, e
 * controlla che i file destinati al copia-e-incolla reggano il viaggio.
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

/* ------------------------------------------------------------------ */
/* I file che qualcuno incolla a mano dentro un browser                */
/*                                                                     */
/* Per questi vale una regola in più. Un carattere fuori dall'ASCII    */
/* dentro una stringa fra apici è un dato: se si rovina per strada si  */
/* legge un messaggio con un glifo sbagliato, e pazienza. Lo stesso    */
/* carattere FUORI da una stringa è codice, e se si rovina PostgreSQL  */
/* si ferma con «syntax error» a metà del lavoro.                      */
/*                                                                     */
/* Sono due rischi di gravità diversissima, quindi qui si separano.    */
/* ------------------------------------------------------------------ */
const DA_INCOLLARE = [
  "supabase/AGGIORNA-DATABASE.sql",
  "supabase/audit-ruoli.sql",
  "supabase/allinea-ruoli.sql",
  "supabase/perche-non-salva.sql",
  "supabase/migrations/20260825160000_m11_ricorsione.sql",
];

/** Svuota le stringhe fra apici, lasciando spazi al loro posto: così le
 *  posizioni non si spostano e i numeri di riga restano quelli veri.
 *  I commenti restano: viaggiano anche loro fino al server, e un carattere
 *  rovinato lì dentro fa fallire la query come ovunque altrove. */
function fuoriDalleStringhe(sql) {
  let fuori = "";
  let i = 0;
  while (i < sql.length) {
    // I commenti si copiano interi, senza guardarci dentro: un apostrofo in
    // «non c'e'» non apre nessuna stringa, e trattarlo come tale farebbe
    // sparire il codice che segue.
    if (sql[i] === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") { fuori += sql[i]; i++; }
      continue;
    }
    if (sql[i] === "/" && sql[i + 1] === "*") {
      while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) { fuori += sql[i]; i++; }
      fuori += sql.slice(i, i + 2); i += 2;
      continue;
    }
    if (sql[i] === "'") {
      fuori += " "; i++;
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") { fuori += "  "; i += 2; continue; }
        if (sql[i] === "'") { fuori += " "; i++; break; }
        fuori += sql[i] === "\n" ? "\n" : " "; i++;
      }
      continue;
    }
    const tag = /^\$[A-Za-z_]*\$/.exec(sql.slice(i, i + 40));
    if (tag) {
      // Il delimitatore resta visibile: è codice, e un $ dimezzato va visto.
      fuori += tag[0]; i += tag[0].length;
      continue;
    }
    fuori += sql[i]; i++;
  }
  return fuori;
}

function fuoriDallAscii(sql) {
  const righe = fuoriDalleStringhe(sql).split("\n");
  const trovati = [];
  righe.forEach((r, n) => {
    for (const ch of r) {
      if (ch.codePointAt(0) > 127) {
        trovati.push(`riga ${n + 1}: «${ch}» (U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")})`);
        break;
      }
    }
  });
  return trovati;
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
      continue;
    }

    if (DA_INCOLLARE.includes(nome)) {
      const sporchi = fuoriDallAscii(sql);
      if (sporchi.length > 0) {
        rotti++;
        console.log(`FAIL  ${nome} — ${sporchi.length} caratteri non-ASCII fuori dalle stringhe`);
        sporchi.slice(0, 5).forEach((s) => console.log(`        ${s}`));
        continue;
      }
      console.log(`PASS  ${nome} — ${n} statement, ASCII fuori dalle stringhe`);
      continue;
    }

    console.log(`PASS  ${nome} — ${n} statement`);
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
