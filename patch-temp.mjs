/**
 * Sostituisce `e instanceof Error ? e.message : "..."` con messaggioErrore.
 *
 * Gli errori di Supabase non sono istanze di Error: sono oggetti con
 * message, details, hint e code. Con quel controllo finivano tutti nel
 * ramo di ripiego, e al posto del motivo vero si leggeva una frase
 * generica. Nello store era gia' stato corretto; nei componenti no.
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = [
  "components/chat-panel.tsx",
  "components/collaborators-section.tsx",
  "components/member-actions.tsx",
  "components/new-project-button.tsx",
  "components/onboarding-profile.tsx",
  "components/set-password-form.tsx",
  "components/task-panel.tsx",
  "components/profile-form.tsx",
];

const RE =
  /(\w+)\s+instanceof\s+Error\s*\?\s*\1\.message\s*:\s*("(?:[^"\\]|\\.)*")/gs;

let totale = 0;
for (const f of FILE) {
  let s = readFileSync(f, "utf8");
  const eol = s.includes("\r\n") ? "\r\n" : "\n";

  const quanti = [...s.matchAll(RE)].length;
  if (quanti > 0) {
    s = s.replace(RE, (tutto, varname, ripiego) => `messaggioErrore(${varname}, ${ripiego})`);
    totale += quanti;
  }

  // L'import serve solo dove la funzione viene davvero usata.
  const serve = s.includes("messaggioErrore(");
  const gia = /import \{ messaggioErrore \} from "@\/lib\/errori";/.test(s);
  if (serve && !gia) {
    // Si aggancia al primo import da "@/..." per restare nel gruppo giusto.
    const m = s.match(/^import .*from "@\/[^"]+";$/m);
    if (!m) {
      console.error(`${f}: nessun import "@/..." a cui agganciarsi`);
      process.exit(1);
    }
    s = s.replace(m[0], `import { messaggioErrore } from "@/lib/errori";${eol}${m[0]}`);
  }

  writeFileSync(f, s);
  if (quanti > 0 || (serve && !gia)) {
    console.log(`  ${f}: ${quanti} sostituzioni${serve && !gia ? " + import" : ""}`);
  }
}

/* Controprova: nessuno schema vecchio deve sopravvivere nei componenti. */
let rimasti = 0;
for (const f of FILE) {
  const s = readFileSync(f, "utf8");
  rimasti += [...s.matchAll(/instanceof\s+Error\s*\?/g)].length;
}
console.log(`\n${totale} sostituzioni; schemi vecchi rimasti: ${rimasti} (attesi 0)`);
if (rimasti > 0) process.exit(1);
