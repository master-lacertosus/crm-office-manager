/**
 * Sonda mobile: a 390px trova gli elementi più larghi del viewport
 * (il colpevole dell'overflow orizzontale della dashboard).
 * Prerequisito: Edge headless con --remote-debugging-port=9223, finestra 390x844.
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
  return r.result?.exceptionDetails
    ? { ERR: r.result.exceptionDetails.exception?.description?.slice(0, 200) }
    : r.result?.result?.value;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await send("Runtime.enable");
await ev(`location.href = 'http://localhost:3000/dashboard?tour=0'; true`);
await sleep(4500);

console.log(JSON.stringify(await ev(`(() => {
  const vw = document.documentElement.clientWidth;
  const wide = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width > vw + 2 && wide.length < 25) {
      wide.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className).slice(0, 80),
        w: Math.round(r.width),
        sw: el.scrollWidth,
      });
    }
  }
  return {
    vw,
    innerWidth,
    docScroll: document.documentElement.scrollWidth,
    bodyScroll: document.body.scrollWidth,
    wide,
  };
})()`), null, 1));

ws.close();
process.exit(0);
