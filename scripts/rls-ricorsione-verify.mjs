/**
 * Cerca le policy che interrogano la propria tabella.
 *
 * Una policy su `tasks` che contiene `select ... from public.tasks` non si
 * puo' valutare: per leggere quelle righe PostgreSQL deve applicare le
 * policy di `tasks`, che sono quelle che sta gia' valutando. Il server se
 * ne accorge e risponde «infinite recursion detected in policy for relation»
 * (42P17) — e la tabella diventa inutilizzabile per quell'operazione.
 *
 * E' successo davvero: la policy di inserimento dei sotto-task (M10)
 * controllava il lavoro padre con un `exists (select 1 from public.tasks)`
 * scritto in linea. Ogni creazione di task falliva, anche quelle senza
 * padre.
 *
 * La via giusta e' una funzione `security definer`, che gira con i diritti
 * di chi l'ha creata e non ripassa dalle policy. `puo_modificare_task` era
 * gia' scritta cosi'; la policy di inserimento no.
 *
 * Nota sui limiti: questo e' un controllo testuale. Vede le letture scritte
 * dentro la policy, non quelle nascoste in una funzione che non sia
 * `security definer`. Copre il caso che ci ha morso, non ogni ricorsione
 * possibile.
 *
 *   node scripts/rls-ricorsione-verify.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "supabase/migrations";

/** Nomi delle funzioni dichiarate `security definer` in tutte le migrazioni. */
function funzioniSicure(testi) {
  const nomi = new Set();
  for (const t of testi) {
    for (const [, nome] of t.matchAll(
      /create\s+(?:or\s+replace\s+)?function\s+(public\.\w+)\s*\([\s\S]*?security\s+definer/gi,
    )) {
      nomi.add(nome.toLowerCase());
    }
  }
  return nomi;
}

/** Ogni `create policy` con il suo corpo, fino al punto e virgola. */
function policy(testo, file) {
  const trovate = [];
  const re = /create\s+policy\s+(\w+)\s*\n\s*on\s+(public\.\w+)/gi;
  let m;
  while ((m = re.exec(testo)) !== null) {
    // Il corpo finisce al primo «;» fuori da parentesi.
    let i = re.lastIndex;
    let livello = 0;
    while (i < testo.length) {
      const c = testo[i];
      if (c === "(") livello++;
      else if (c === ")") livello--;
      else if (c === ";" && livello === 0) break;
      i++;
    }
    trovate.push({
      nome: m[1],
      tabella: m[2].toLowerCase(),
      corpo: testo.slice(re.lastIndex, i),
      riga: testo.slice(0, m.index).split("\n").length,
      file,
    });
  }
  return trovate;
}

const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const testi = files.map((f) => readFileSync(join(DIR, f), "utf8"));
const sicure = funzioniSicure(testi);

const storia = [];
files.forEach((f, i) => storia.push(...policy(testi[i], f)));

/* Conta lo stato finale del database, non ogni riga della sua storia: una
   migrazione successiva puo' sostituire una policy, e le migrazioni gia'
   applicate non si riscrivono. Delle definizioni con lo stesso nome sulla
   stessa tabella vale l'ultima, nell'ordine in cui i file vengono eseguiti. */
const finali = new Map();
for (const p of storia) finali.set(`${p.tabella}::${p.nome}`, p);
const tutte = [...finali.values()];

let sospette = 0;
for (const p of tutte) {
  /* Si guarda solo se la policy legge la PROPRIA tabella. Leggere un'altra
     tabella e' normale: le sue policy sono altre, e non si rientra. */
  const nuda = p.tabella.replace("public.", "");
  const re = new RegExp(`\\bfrom\\s+(?:public\\.)?${nuda}\\b`, "i");
  if (!re.test(p.corpo)) continue;

  sospette++;
  console.log(`FAIL  ${p.file}:${p.riga}  policy ${p.nome} legge ${p.tabella} dentro se stessa`);
  const riga = p.corpo.split("\n").find((r) => re.test(r));
  if (riga) console.log(`        ${riga.trim()}`);
  console.log("        va spostata in una funzione security definer");
}

/* Controprova: le funzioni che leggono `tasks` e finiscono nelle policy
   devono essere security definer, altrimenti il problema si sposta. */
const chiamate = new Set();
for (const p of tutte) {
  for (const [, fn] of p.corpo.matchAll(/\b(public\.\w+)\s*\(/g)) {
    chiamate.add(fn.toLowerCase());
  }
}
const insicure = [...chiamate].filter((fn) => {
  const dichiarata = testi.some((t) =>
    new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+${fn.replace(".", "\\.")}\\s*\\(`, "i").test(t),
  );
  return dichiarata && !sicure.has(fn);
});

for (const fn of insicure) {
  sospette++;
  console.log(`FAIL  ${fn} e' usata in una policy ma non e' security definer`);
}

console.log(
  sospette === 0
    ? `\nTUTTO VERDE — ${tutte.length} policy, nessuna legge la propria tabella; ${sicure.size} funzioni security definer`
    : `\n${sospette} policy o funzioni a rischio di ricorsione`,
);
process.exit(sospette === 0 ? 0 : 1);
