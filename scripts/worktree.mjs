/**
 * Sessioni parallele senza pestarsi i piedi: una copia collegata del repo
 * (git worktree) per ogni sessione, ognuna sul suo branch.
 *
 *   node scripts/worktree.mjs nuovo <persona-argomento-feature>
 *   node scripts/worktree.mjs elenco
 *   node scripts/worktree.mjs chiudi <branch> [--forza]
 *
 * «nuovo» parte SEMPRE da origin/master aggiornato (fetch incluso) e fa
 * l'npm install nella copia (saltabile con --senza-install). «chiudi» va
 * usato dopo il merge della PR: rimuove la copia e il branch locale.
 */
import { execSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const run = (cmd, opts = {}) =>
  execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();

const ROOT = run("git rev-parse --path-format=absolute --git-common-dir").replace(/[\\/]\.git$/, "");
const WT_BASE = path.resolve(ROOT, "..", "crm-worktrees");

const [cmd, arg, ...flags] = process.argv.slice(2);
const has = (f) => flags.includes(f) || process.argv.includes(f);

function elenco() {
  console.log(run("git worktree list"));
  console.log(
    "\nSuggerimento: la copia principale tiene master; ogni sessione in più lavora in una copia sotto\n  " +
      WT_BASE,
  );
}

function nuovo() {
  if (!arg) {
    console.error("Uso: node scripts/worktree.mjs nuovo <persona-argomento-feature>");
    process.exit(1);
  }
  if (!/^[a-z0-9][a-z0-9-]+$/.test(arg) || !arg.includes("-")) {
    console.error(
      `«${arg}» non segue la convenzione persona-argomento-feature (minuscole e trattini).`,
    );
    process.exit(1);
  }
  const dir = path.join(WT_BASE, arg);
  if (existsSync(dir)) {
    console.error(`La cartella esiste già: ${dir}`);
    process.exit(1);
  }
  console.log("· Aggiorno origin/master…");
  run("git fetch origin master", { cwd: ROOT });
  console.log(`· Creo la copia su branch «${arg}» (da origin/master)…`);
  run(`git worktree add "${dir}" -b ${arg} origin/master --no-track`, { cwd: ROOT });
  if (!has("--senza-install")) {
    // npm ci: installa ESATTAMENTE il lockfile e non lo modifica mai —
    // la copia nasce pulita, senza diff spurie.
    console.log("· npm ci nella nuova copia (una tantum)…");
    const r = spawnSync("npm ci --no-audit --no-fund", {
      cwd: dir,
      stdio: "inherit",
      shell: true,
    });
    if (r.status !== 0) {
      console.error("npm ci fallito: riprova a mano dentro la copia.");
    }
  }
  console.log(`\n✔ Pronto. Nella nuova sessione:\n    cd "${dir}"\n    npm run dev   (porta diversa in automatico)\n\n  Fine lavoro: commit → push → PR. Dopo il merge:\n    node scripts/worktree.mjs chiudi ${arg}`);
}

function chiudi() {
  if (!arg) {
    console.error("Uso: node scripts/worktree.mjs chiudi <branch> [--forza]");
    process.exit(1);
  }
  const dir = path.join(WT_BASE, arg);
  if (!existsSync(dir)) {
    console.error(`Nessuna copia in ${dir}. Vedi «elenco».`);
    process.exit(1);
  }
  const dirty = run("git status --porcelain", { cwd: dir });
  if (dirty && !has("--forza")) {
    console.error(
      `Nella copia ci sono modifiche non committate:\n${dirty}\n\nCommitta (o usa --forza per buttarle) e riprova.`,
    );
    process.exit(1);
  }
  run(`git worktree remove "${dir}"${has("--forza") ? " --force" : ""}`, { cwd: ROOT });
  // Il branch resta: eliminalo solo se il lavoro è arrivato su origin/master
  // (con le squash-merge il confronto è sui contenuti, non sugli sha).
  run("git fetch origin master", { cwd: ROOT });
  const ahead = run(`git rev-list --count origin/master..${arg}`, { cwd: ROOT });
  const diff = ahead === "0" ? "" : run(`git diff --stat origin/master...${arg}`, { cwd: ROOT });
  if (ahead === "0" || diff === "" || has("--forza")) {
    run(`git branch -D ${arg}`, { cwd: ROOT });
    console.log(`✔ Copia e branch «${arg}» rimossi.`);
  } else {
    console.log(
      `✔ Copia rimossa. Il branch «${arg}» ha commit non ancora su origin/master: l'ho tenuto.\n  (Dopo il merge della PR: git branch -D ${arg})`,
    );
  }
}

if (cmd === "nuovo") nuovo();
else if (cmd === "chiudi") chiudi();
else if (cmd === "elenco" || cmd === "list") elenco();
else {
  console.log(
    "Sessioni parallele (git worktree)\n\n" +
      "  node scripts/worktree.mjs nuovo <persona-argomento-feature>   crea copia + branch da origin/master\n" +
      "  node scripts/worktree.mjs elenco                              mostra le copie attive\n" +
      "  node scripts/worktree.mjs chiudi <branch> [--forza]           rimuovi la copia dopo il merge\n",
  );
}
