/**
 * Verifica interattiva del pianificatore ricorrenti via CDP.
 * Prerequisito: Edge headless con --remote-debugging-port=9223 e server su :3000.
 * Salva screenshot del pianificatore e della pagina Impostazioni → Workspace.
 */

import { writeFileSync } from "node:fs";

const PORT = 9223;
const OUT = process.env.TEMP ?? ".";

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
  if (r.result?.exceptionDetails) return { evalError: r.result.exceptionDetails.text };
  return r.result?.result?.value;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${OUT}\\${name}.png`, Buffer.from(r.result.data, "base64"));
  console.log(`  [shot] ${OUT}\\${name}.png`);
}

await send("Runtime.enable");
await send("Page.enable");

// 1. pagina Task (tour soppresso)
await ev(`location.href = 'http://localhost:3000/tasks?tour=0'; true`);
await sleep(4000);
const btn = await ev(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Ricorrenti'));
  return b ? 'presente' : 'ASSENTE';
})()`);
console.log("[pulsante Ricorrenti]", btn);

// 2. apri il pianificatore
await ev(`[...document.querySelectorAll('button')].find(x => x.textContent.includes('Ricorrenti'))?.click(); true`);
await sleep(1200);
const dlg = await ev(`(() => {
  const d = document.querySelector('[aria-label="Attività ricorrenti"]');
  if (!d) return { aperto: false };
  return {
    aperto: true,
    righeAttive: d.querySelectorAll('[aria-label="Già pianificata"]').length,
    checkbox: d.querySelectorAll('input[type="checkbox"]').length,
    spuntate: [...d.querySelectorAll('input[type="checkbox"]')].filter(c => c.checked).length,
    pulsante: [...d.querySelectorAll('button')].map(b => b.textContent.trim()).find(t => t.startsWith('Crea')) ?? 'nessuno',
  };
})()`);
console.log("[pianificatore]", JSON.stringify(dlg));
await shot("planner-open");

// 3. crea i task selezionati
await ev(`[...document.querySelectorAll('[aria-label="Attività ricorrenti"] button')].find(b => b.textContent.trim().startsWith('Crea'))?.click(); true`);
await sleep(2500);
const after = await ev(`({
  dialogAperto: !!document.querySelector('[aria-label="Attività ricorrenti"]'),
  newsletterPromoInBoard: document.body.textContent.includes('Newsletter Promo'),
  rubricaInBoard: document.body.textContent.includes('Rubrica Lacertosus Arena'),
  toast: [...document.querySelectorAll('[role="status"]')].map(t => t.textContent).join(' | '),
})`);
console.log("[dopo creazione]", JSON.stringify(after));
await shot("planner-board-after");

// 4. riapri: le attività ora devono risultare attive
await ev(`[...document.querySelectorAll('button')].find(x => x.textContent.includes('Ricorrenti'))?.click(); true`);
await sleep(1200);
const reopen = await ev(`(() => {
  const d = document.querySelector('[aria-label="Attività ricorrenti"]');
  if (!d) return { aperto: false };
  return {
    righeAttive: d.querySelectorAll('[aria-label="Già pianificata"]').length,
    daPianificare: d.querySelectorAll('input[type="checkbox"]').length,
  };
})()`);
console.log("[riapertura]", JSON.stringify(reopen));
await shot("planner-reopen");
await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
await sleep(600);

// 5. impostazioni workspace: gestione template
await ev(`location.href = 'http://localhost:3000/settings/workspace?tour=0'; true`);
await sleep(3500);
const settings = await ev(`({
  sezione: document.body.textContent.includes('Template attività ricorrenti'),
  nuovoTemplate: [...document.querySelectorAll('button')].some(b => b.textContent.includes('Nuovo template')),
  righe: document.querySelectorAll('ul li')?.length,
})`);
console.log("[impostazioni]", JSON.stringify(settings));
await shot("planner-settings");

console.log("[eccezioni]", JSON.stringify(exceptions));
ws.close();
process.exit(0);
