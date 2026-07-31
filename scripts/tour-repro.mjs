/**
 * Repro interattiva del bug "Rivedi il tour" via Chrome DevTools Protocol.
 * Nessuna dipendenza: fetch + WebSocket nativi di Node 22+.
 * Prerequisito: Edge headless già avviato con --remote-debugging-port=9223.
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

const SNAP = `({
  url: location.href,
  dialogs: document.querySelectorAll('[role="dialog"]').length,
  tourOpen: !!document.querySelector('[aria-label="Introduzione guidata"]'),
  overlay85: !!document.querySelector('.z-\\\\[85\\\\]'),
  center: (e => e ? e.tagName + '|' + String(e.className).slice(0, 90) : 'null')(
    document.elementFromPoint(innerWidth / 2, innerHeight / 2)),
})`;

await send("Runtime.enable");

// 1. dashboard con tour soppresso, poi simula utente veterano (tour già fatto)
await ev(`location.href = 'http://localhost:3000/dashboard?tour=0'; true`);
await sleep(4000);
await ev(`localStorage.setItem('tour-done', '1'); true`);
log("start", await ev(SNAP));

// 2. apri il menu account (bottone in basso a sinistra col nome)
await ev(`(() => {
  const b = [...document.querySelectorAll('button')]
    .find(x => x.textContent.includes('Francesco Salafia'));
  if (!b) return 'MENU BUTTON NOT FOUND';
  b.click(); return 'clicked';
})()`);
await sleep(600);

// 3. clic su "Rivedi il tour" (client nav verso ?tour=1)
const revClick = await ev(`(() => {
  const a = [...document.querySelectorAll('a')]
    .find(x => x.textContent.includes('Rivedi il tour'));
  if (!a) return 'LINK NOT FOUND';
  a.click(); return 'clicked ' + a.getAttribute('href');
})()`);
await sleep(2500);
log("dopo-clic-rivedi", { revClick, ...(await ev(SNAP)) });

// 4. chiudi il tour con "Salta"
const saltaClick = await ev(`(() => {
  const b = [...document.querySelectorAll('button')]
    .find(x => x.textContent.trim() === 'Salta');
  if (!b) return 'SALTA NOT FOUND';
  b.click(); return 'clicked';
})()`);
await sleep(1500);
log("dopo-salta", { saltaClick, ...(await ev(SNAP)) });

// 5. la pagina è ancora usabile? prova un'azione qualsiasi: apri un task dalla dashboard
const taskClick = await ev(`(() => {
  const a = [...document.querySelectorAll('a[href*="task="]')][0];
  if (!a) return 'NO TASK LINK';
  a.click(); return 'clicked ' + a.getAttribute('href');
})()`);
await sleep(2500);
log("dopo-apertura-task", { taskClick, ...(await ev(SNAP)) });

// 6. chiudi il task (Esc) e naviga in sidebar
await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
await sleep(1500);
log("dopo-esc", await ev(SNAP));

const navClick = await ev(`(() => {
  const a = document.querySelector('nav[aria-label="Navigazione principale"] a[href="/tasks"]');
  if (!a) return 'NAV NOT FOUND';
  a.click(); return 'clicked';
})()`);
await sleep(2500);
log("dopo-nav-tasks", { navClick, ...(await ev(SNAP)) });

console.log("\n=== REPORT ===");
console.log(JSON.stringify(report, null, 2).slice(0, 6000));
ws.close();
process.exit(0);
