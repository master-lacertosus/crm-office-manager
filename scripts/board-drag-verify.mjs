/**
 * Verifica dell'auto-scroll della board durante il drag, a finestra stretta.
 * Flusso: prendi un task dal Backlog, porta il puntatore al bordo destro,
 * tienilo fermo (la board deve scorrere da sola), rilascia su «Fatto».
 * Prerequisito: Edge headless con --remote-debugging-port=9223 (finestra 900px).
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
const mouse = (type, x, y) =>
  send("Input.dispatchMouseEvent", { type, x: Math.round(x), y: Math.round(y), button: "left", clickCount: type === "mouseMoved" ? 0 : 1 });
async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${OUT}\\${name}.png`, Buffer.from(r.result.data, "base64"));
  console.log(`  [shot] ${OUT}\\${name}.png`);
}

await send("Runtime.enable");
await send("Page.enable");

await ev(`location.href = 'http://localhost:3000/tasks?tour=0'; true`);
await sleep(4000);

const setup = await ev(`(() => {
  const scroller = document.querySelector('.snap-x.overflow-x-auto') ?? document.querySelector('[class*="overflow-x-auto"]');
  const card = [...document.querySelectorAll('[data-card-id]')]
    .find(el => el.textContent.includes('Audit SEO'));
  if (!card) return { errore: 'card non trovata' };
  const r = card.getBoundingClientRect();
  return {
    vw: innerWidth,
    scrollMax: scroller ? scroller.scrollWidth - scroller.clientWidth : -1,
    scrollLeft: scroller ? scroller.scrollLeft : -1,
    card: { x: r.x + r.width / 2, y: r.y + r.height / 2 },
    fattoVisibile: (() => { const f = document.querySelector('section[aria-label="Fatto"]'); if (!f) return false; const fr = f.getBoundingClientRect(); return fr.left < innerWidth; })(),
  };
})()`);
console.log("[setup]", JSON.stringify(setup));
if (setup.errore) { ws.close(); process.exit(1); }

// drag: premi sulla card, muovi verso il bordo destro, TIENI FERMO
const { card, vw } = setup;
await mouse("mousePressed", card.x, card.y);
for (let i = 1; i <= 8; i++) {
  const t = i / 8;
  await mouse("mouseMoved", card.x + (vw - 24 - card.x) * t, card.y + 40 * t);
  await sleep(40);
}
console.log("[drag] puntatore fermo al bordo destro, attendo l'auto-scroll…");
await sleep(2600);

const during = await ev(`(() => {
  const scroller = document.querySelector('.snap-x.overflow-x-auto') ?? document.querySelector('[class*="overflow-x-auto"]');
  const f = document.querySelector('section[aria-label="Fatto"]');
  const fr = f?.getBoundingClientRect();
  return {
    scrollLeft: scroller ? Math.round(scroller.scrollLeft) : -1,
    fattoVisibile: fr ? fr.left < innerWidth && fr.right > 0 : false,
    fattoEvidenziata: f?.className.includes('bg-brand-50') ?? false,
  };
})()`);
console.log("[durante il drag]", JSON.stringify(during));
await shot("drag-at-edge");

await mouse("mouseReleased", vw - 24, card.y + 40);
await sleep(1200);

const after = await ev(`(() => {
  const f = document.querySelector('section[aria-label="Fatto"]');
  const inFatto = f ? [...f.querySelectorAll('[data-card-id]')].some(el => el.textContent.includes('Audit SEO')) : false;
  const scroller = document.querySelector('.snap-x.overflow-x-auto') ?? document.querySelector('[class*="overflow-x-auto"]');
  return {
    auditInFatto: inFatto,
    snapRipristinato: scroller ? scroller.style.scrollSnapType === '' : 'n/d',
    cursore: document.body.style.cursor === '',
  };
})()`);
console.log("[dopo il rilascio]", JSON.stringify(after));
await shot("drag-dropped");

console.log("[eccezioni]", JSON.stringify(exceptions));
ws.close();
process.exit(0);
