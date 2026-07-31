/**
 * Repro v2: dal pulsante "Rivedi il tour introduttivo" in Impostazioni →
 * Workspace, con clic REALI (Input.dispatchMouseEvent) e misura delle
 * opacità dei layer (un overlay a opacity 0 blocca i clic restando invisibile).
 */

const PORT = 9223;
const report = { steps: [], exceptions: [], console: [] };

function log(step, data) {
  report.steps.push({ step, ...data });
  console.log(`[${step}]`, JSON.stringify(data));
}

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const page = targets.find((t) => t.type === "page");
if (!page) {
  console.log("NO PAGE TARGET");
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});

let msgId = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method === "Runtime.exceptionThrown") {
    const d = msg.params.exceptionDetails;
    report.exceptions.push(
      d.exception?.description?.slice(0, 300) ?? d.text ?? "unknown",
    );
  } else if (msg.method === "Runtime.consoleAPICalled") {
    if (msg.params.type === "error" || msg.params.type === "warning") {
      report.console.push(
        msg.params.args
          .map((a) => a.value ?? a.description ?? "")
          .join(" ")
          .slice(0, 300),
      );
    }
  }
};

function send(method, params = {}) {
  return new Promise((res, rej) => {
    const id = ++msgId;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        rej(new Error(`CDP TIMEOUT su ${method} — pagina probabilmente congelata`));
      }
    }, 25_000);
  });
}

async function ev(expression) {
  const r = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.result?.exceptionDetails) {
    return { evalError: r.result.exceptionDetails.text };
  }
  return r.result?.result?.value;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Clic con eventi pointer/mouse REALI alle coordinate dell'elemento. */
async function realClick(findExpr) {
  const pt = await ev(`(() => {
    const el = ${findExpr};
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`);
  if (!pt || pt.evalError) return { click: "NOT FOUND", pt };
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed", x: pt.x, y: pt.y, button: "left", clickCount: 1,
  });
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased", x: pt.x, y: pt.y, button: "left", clickCount: 1,
  });
  return { click: "ok", pt };
}

// Snapshot: url + ogni overlay fixed a schermo intero con opacità dei figli
const SNAP = `({
  url: location.href,
  tourDialog: (d => d ? getComputedStyle(d).opacity : 'assente')(
    document.querySelector('[aria-label="Introduzione guidata"]')),
  fixedOverlays: [...document.querySelectorAll('div.fixed.inset-0')].map(e => ({
    cls: e.className,
    children: [...e.children].map(c =>
      (c.getAttribute('role') || c.tagName.toLowerCase()) + ':op=' + getComputedStyle(c).opacity),
  })),
  center: (e => e ? e.tagName + '|' + String(e.className).slice(0, 70) : 'null')(
    document.elementFromPoint(innerWidth / 2, innerHeight / 2)),
})`;

await send("Runtime.enable");

// 0. utente veterano: tour già completato in passato
await ev(`location.href = 'http://localhost:3000/dashboard?tour=0'; true`);
await sleep(3500);
await ev(`localStorage.setItem('tour-done', '1'); true`);

// 1. vai in Impostazioni → Workspace come farebbe l'utente
await ev(`location.href = 'http://localhost:3000/settings/workspace'; true`);
await sleep(3500);
log("su-workspace", await ev(SNAP));

// 2. clic REALE su "Rivedi il tour introduttivo"
const c1 = await realClick(
  `[...document.querySelectorAll('a')].find(a => a.textContent.includes('Rivedi il tour introduttivo'))`,
);
await sleep(2500);
log("dopo-clic-rivedi", { ...c1, ...(await ev(SNAP)) });

// 3. attraversa il tour: 5 volte "Avanti" + "Inizia a lavorare"
for (let i = 0; i < 5; i++) {
  await realClick(
    `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Avanti')`,
  );
  await sleep(400);
}
log("ultimo-passo", await ev(SNAP));
const cFine = await realClick(
  `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Inizia a lavorare')`,
);
await sleep(1800);
log("dopo-fine-tour", { ...cFine, ...(await ev(SNAP)) });

// 4. la pagina risponde? clic REALE su una KPI della dashboard
const c2 = await realClick(
  `[...document.querySelectorAll('a')].find(a => a.textContent.includes('TASK APERTI'))`,
);
await sleep(2500);
log("dopo-clic-kpi", { ...c2, ...(await ev(SNAP)) });

// 5. e la sidebar? clic REALE su Calendario
const c3 = await realClick(
  `document.querySelector('nav[aria-label="Navigazione principale"] a[href="/calendar"]')`,
);
await sleep(2500);
log("dopo-nav-calendario", { ...c3, ...(await ev(SNAP)) });

console.log("\n=== ECCEZIONI ===");
console.log(JSON.stringify(report.exceptions, null, 1));
console.log("=== CONSOLE ERR/WARN ===");
console.log(JSON.stringify(report.console, null, 1));
ws.close();
process.exit(0);
