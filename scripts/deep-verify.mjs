/**
 * Verifica dei 10 upgrade + report a range. Edge headless via CDP (:9223).
 * Ogni sezione stampa PASS/FAIL con l'evidenza raccolta.
 */

import { writeFileSync } from "node:fs";

const PORT = 9223;
const OUT = process.env.TEMP ?? ".";
let failures = 0;

function check(name, ok, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let msgId = 0;
const pending = new Map();
const exceptions = [];
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method === "Runtime.exceptionThrown") {
    exceptions.push(
      msg.params.exceptionDetails.exception?.description?.slice(0, 200) ?? "?",
    );
  }
};
function send(method, params = {}) {
  return new Promise((res, rej) => {
    const id = ++msgId;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error(`TIMEOUT ${method}`)); } }, 25_000);
  });
}
async function ev(expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) return { evalError: r.result.exceptionDetails.text ?? "err" };
  return r.result?.result?.value;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${OUT}\\${name}.png`, Buffer.from(r.result.data, "base64"));
}

await send("Runtime.enable");
await send("Page.enable");

/* ---------- 1. Board: checklist chip + undo toast su spostamento ------- */
await ev(`location.href = 'http://localhost:3000/tasks?tour=0'; true`);
await sleep(4000);
const chip = await ev(`(() => {
  const card = [...document.querySelectorAll('[data-card-id]')].find(el => el.textContent.includes('Newsletter di settembre'));
  return card ? /2\\/4/.test(card.textContent) : 'card mancante';
})()`);
check("Checklist chip 2/4 sulla card Newsletter", chip === true, String(chip));

/* tastiera: freccia destra seleziona, poi Shift+→ sposta con toast Annulla */
await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); true`);
await sleep(400);
const selected = await ev(`(() => {
  const ring = document.querySelector('a[class*="ring-brand-500"]');
  return ring ? ring.textContent.slice(0, 40) : null;
})()`);
check("Tastiera: selezione visibile con ring", !!selected, String(selected));

await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true })); true`);
await sleep(700);
const undoToast = await ev(`(() => {
  const t = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Annulla');
  return t ? 'toast con Annulla presente' : null;
})()`);
check("Undo: toast con Annulla dopo Shift+freccia", !!undoToast, String(undoToast));
await shot("deep-1-board");

/* clic su Annulla: il task torna dove stava */
const beforeUndo = await ev(`document.querySelector('section[aria-label="Backlog"]')?.querySelectorAll('[data-card-id]').length`);
await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Annulla')?.click(); true`);
await sleep(700);
const afterUndo = await ev(`document.querySelector('section[aria-label="Backlog"]')?.querySelectorAll('[data-card-id]').length`);
check("Undo: il task è tornato in Backlog", afterUndo === beforeUndo + 1, `${beforeUndo} → ${afterUndo}`);

/* ---------- 2. Pannello: checklist interattiva + cronologia ------------ */
await ev(`[...document.querySelectorAll('[data-card-id]')].find(el => el.textContent.includes('Newsletter di settembre'))?.querySelector('a')?.click(); true`);
await sleep(1500);
const panel = await ev(`(() => {
  const dlg = document.querySelector('[role="dialog"]');
  if (!dlg) return { aperto: false };
  return {
    aperto: true,
    checklist: dlg.querySelectorAll('section[aria-label="Checklist"] input[type="checkbox"]').length,
    cronologia: dlg.textContent.includes('ha creato il task'),
  };
})()`);
check("Pannello: sezione checklist con 4 voci", panel.checklist === 4, JSON.stringify(panel));
check("Pannello: cronologia visibile tra i commenti", panel.cronologia === true);

/* spunta una voce → chip card diventa 3/4 */
await ev(`document.querySelector('[role="dialog"] section[aria-label="Checklist"] input[type="checkbox"]:not(:checked)')?.click(); true`);
await sleep(600);
const after = await ev(`document.querySelector('[role="dialog"] section[aria-label="Checklist"]')?.textContent.includes('3/4')`);
check("Checklist: spunta aggiorna il conteggio a 3/4", after === true);
await shot("deep-2-panel");
await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
await sleep(800);

/* ---------- 3. Pacchetto Lancio prodotto dal planner ------------------- */
await ev(`[...document.querySelectorAll('button')].find(x => x.textContent.includes('Ricorrenti'))?.click(); true`);
await sleep(1000);
const packRow = await ev(`(() => {
  const d = document.querySelector('[aria-label="Attività ricorrenti"]');
  return d ? d.textContent.includes('Pacchetto · 5 task') : false;
})()`);
check("Planner: riga «Pacchetto · 5 task» per Lancio prodotto", packRow === true);

await ev(`(() => {
  const d = document.querySelector('[aria-label="Attività ricorrenti"]');
  const box = [...d.querySelectorAll('input[type="checkbox"]')].find(c => c.getAttribute('aria-label')?.includes('Lancio prodotto'));
  if (box && !box.checked) box.click();
  const date = [...d.querySelectorAll('input[type="date"]')].find(i => i.getAttribute('aria-label')?.includes('Lancio prodotto'));
  if (date) { const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; setter.call(date, '2026-08-20'); date.dispatchEvent(new Event('input', { bubbles: true })); }
  return true;
})()`);
await sleep(400);
await ev(`[...document.querySelectorAll('[aria-label="Attività ricorrenti"] button')].find(b => b.textContent.trim().startsWith('Crea'))?.click(); true`);
await sleep(2500);
const packTasks = await ev(`(() => {
  const text = document.body.textContent;
  return ['Lancio — scheda prodotto online', 'Lancio — ADV attive'].every(t => text.includes(t));
})()`);
check("Pacchetto: 5 task Lancio creati sulla board", packTasks === true);

/* pannello del task pacchetto mostra i fratelli */
await ev(`[...document.querySelectorAll('[data-card-id]')].find(el => el.textContent.includes('Lancio — ADV attive'))?.querySelector('a')?.click(); true`);
await sleep(1500);
const siblings = await ev(`(() => {
  const dlg = document.querySelector('[role="dialog"]');
  return dlg ? dlg.textContent.includes('Pacchetto · altri 4 task') : false;
})()`);
check("Pannello: «Pacchetto · altri 4 task» visibile", siblings === true);
await shot("deep-3-pack");
await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
await sleep(800);

/* ---------- 4. Persistenza: reload conserva i task creati -------------- */
await ev(`location.reload(); true`);
await sleep(4500);
const persisted = await ev(`document.body.textContent.includes('Lancio — ADV attive')`);
check("Persistenza: dopo reload i task del pacchetto ci sono ancora", persisted === true);

/* ---------- 5. Archivio --------------------------------------------------- */
await ev(`location.href = 'http://localhost:3000/tasks?view=archive&tour=0'; true`);
await sleep(3000);
const archive = await ev(`(() => {
  const rows = document.querySelectorAll('button');
  const restore = [...rows].filter(b => b.textContent.includes('Ripristina')).length;
  const counter = document.body.textContent.match(/(\\d+) task in archivio/);
  return { restore, totale: counter ? Number(counter[1]) : 0 };
})()`);
check("Archivio: pagina con task archiviati e Ripristina", archive.restore > 10 && archive.totale > 10, JSON.stringify(archive));
await shot("deep-5-archive");

/* ---------- 6. Carico di lavoro ---------------------------------------- */
await ev(`location.href = 'http://localhost:3000/team?view=carico&tour=0'; true`);
await sleep(3000);
const workload = await ev(`(() => {
  const cols = document.querySelectorAll('section[aria-label^="Carico di"]');
  return { colonne: cols.length, apertiLabel: document.body.textContent.includes('aperti') };
})()`);
check("Carico: una colonna per persona (7)", workload.colonne === 7, JSON.stringify(workload));
await shot("deep-6-workload");

/* ---------- 7. Notifiche: tab + gruppi --------------------------------- */
await ev(`(() => {
  const btn = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') ?? '').startsWith('Avvisi'));
  btn?.click(); return !!btn;
})()`);
await sleep(800);
const notif = await ev(`(() => {
  const dlg = document.querySelector('[role="dialog"][aria-label="Avvisi"]');
  if (!dlg) return { aperto: false };
  const tabs = [...dlg.querySelectorAll('[role="tab"]')].map(t => t.textContent.trim());
  return { aperto: true, tabs };
})()`);
check("Notifiche: tab Tutte/Menzioni/Solleciti", notif.aperto && notif.tabs?.length === 3, JSON.stringify(notif));
await ev(`[...document.querySelectorAll('[role="tab"]')].find(t => t.textContent.includes('Menzioni'))?.click(); true`);
await sleep(500);
const mentions = await ev(`(() => {
  const dlg = document.querySelector('[role="dialog"][aria-label="Avvisi"]');
  return dlg ? dlg.textContent.includes('didascalie') : false;
})()`);
check("Notifiche: tab Menzioni filtra correttamente", mentions === true);
await shot("deep-7-notifications");
await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);

/* ---------- 8. Report: range + storico --------------------------------- */
await ev(`location.href = 'http://localhost:3000/reports?tour=0'; true`);
await sleep(3500);
const rep30 = await ev(`(() => {
  const text = document.body.textContent;
  const m = text.match(/Completati · (\\d+)g(\\d+)/);
  return { label30: text.includes('Completati · 30g'), presets: ['7 giorni','30 giorni','90 giorni','Mese corrente','Mese scorso'].every(p => text.includes(p)), csv: text.includes('Esporta CSV'), stampa: text.includes('Stampa') };
})()`);
check("Report: preset range + azioni CSV/Stampa", rep30.label30 && rep30.presets && rep30.csv && rep30.stampa, JSON.stringify(rep30));

await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === '90 giorni')?.click(); true`);
await sleep(1500);
const rep90 = await ev(`(() => {
  const text = document.body.textContent;
  return { label90: text.includes('Completati · 90g'), url: location.search };
})()`);
check("Report: passaggio a 90 giorni aggiorna label e URL", rep90.label90 && rep90.url.includes('range=90'), JSON.stringify(rep90));
await shot("deep-8-reports");

/* ---------- 9. Backup config ------------------------------------------- */
await ev(`location.href = 'http://localhost:3000/settings/workspace?tour=0'; true`);
await sleep(3000);
const backup = await ev(`(() => {
  const text = document.body.textContent;
  return { card: text.includes('Backup configurazione'), esporta: text.includes('Esporta'), importa: text.includes('Importa'), azzera: text.includes('Azzera dati demo'), pack: text.includes('Pacchetto · 5 task') };
})()`);
check("Backup: card con Esporta/Importa/Azzera", backup.card && backup.esporta && backup.importa && backup.azzera, JSON.stringify(backup));
check("Template manager: Lancio mostrato come pacchetto", backup.pack === true);
await shot("deep-9-settings");

console.log("\\n[eccezioni]", JSON.stringify(exceptions.slice(0, 5)));
console.log(failures === 0 ? "\\nTUTTO VERDE" : `\\n${failures} CONTROLLI FALLITI`);
ws.close();
process.exit(failures === 0 ? 0 : 1);
