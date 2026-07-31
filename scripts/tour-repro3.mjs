/**
 * Repro v3: ipotesi "parametro incastrato".
 * 1) apri tour, chiudilo → URL resta ?tour=1
 * 2) ri-clicca "Rivedi il tour" → si riapre? (atteso col bug: NO)
 * 3) premi F5 → il tour si ripresenta da solo? (atteso col bug: SÌ)
 */

const PORT = 9223;

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let msgId = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
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
  return r.result?.result?.value;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SNAP = `({ url: location.href, tourOpen: !!document.querySelector('[aria-label="Introduzione guidata"]') })`;

// setup: utente veterano, URL pulito
await ev(`location.href = 'http://localhost:3000/dashboard?tour=0'; true`);
await sleep(3500);
await ev(`localStorage.setItem('tour-done', '1'); location.href = 'http://localhost:3000/settings/workspace'; true`);
await sleep(3500);

// 1. primo clic dal pulsante impostazioni → tour si apre
await ev(`[...document.querySelectorAll('a')].find(a => a.textContent.includes('Rivedi il tour introduttivo'))?.click(); true`);
await sleep(2200);
console.log("[1° clic]        ", JSON.stringify(await ev(SNAP)));

// chiudi con "Salta"
await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Salta')?.click(); true`);
await sleep(1200);
console.log("[dopo Salta]     ", JSON.stringify(await ev(SNAP)));

// 2. secondo clic: menu account → "Rivedi il tour" (stesso URL di destinazione)
await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Francesco Salafia'))?.click(); true`);
await sleep(500);
await ev(`[...document.querySelectorAll('a')].find(a => a.textContent.includes('Rivedi il tour'))?.click(); true`);
await sleep(2200);
console.log("[2° clic]        ", JSON.stringify(await ev(SNAP)), "← col bug atteso: tourOpen false (pulsante morto)");

// 3. F5 con ?tour=1 incastrato nell'URL
await ev(`location.reload(); true`);
await sleep(4500);
console.log("[dopo F5]        ", JSON.stringify(await ev(SNAP)), "← col bug atteso: tourOpen true (si ripresenta da solo)");

// 4. e un secondo F5
await ev(`location.reload(); true`);
await sleep(4500);
console.log("[dopo F5 n.2]    ", JSON.stringify(await ev(SNAP)));

ws.close();
process.exit(0);
