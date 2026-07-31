/** Emulazione mobile VERA (390x844, mobile:true) + misura + screenshot. */
import { writeFileSync } from "node:fs";

const PORT = 9223;
const OUT = process.env.TEMP ?? ".";
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let msgId = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
function send(method, params = {}) {
  return new Promise((res) => {
    const id = ++msgId; pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function ev(expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  return r.result?.result?.value;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await send("Runtime.enable");
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
});
await ev(`location.href = 'http://localhost:3000/dashboard?tour=0'; true`);
await sleep(4500);

console.log(JSON.stringify(await ev(`(() => {
  const vw = document.documentElement.clientWidth;
  const wide = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width > vw + 2 && wide.length < 12) {
      wide.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 60), w: Math.round(r.width) });
    }
  }
  return { vw, innerWidth, docScroll: document.documentElement.scrollWidth, wide };
})()`)));

const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(`${OUT}\\mob-real.png`, Buffer.from(shot.result.data, "base64"));
console.log("shot: mob-real.png");
ws.close();
process.exit(0);
