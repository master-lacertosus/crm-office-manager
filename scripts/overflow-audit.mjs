/**
 * Audit responsive: per ogni route e a più viewport rileva
 *   (a) overflow orizzontale di pagina (scrollWidth > clientWidth)
 *   (b) elementi il cui bordo destro/sinistro sfora il contenitore che li
 *       ritaglia (overflow hidden/clip/auto) — il vero «contenuto tagliato».
 * Non richiede Chrome esterno: lancia il proprio Chromium headless.
 *
 *   node scripts/overflow-audit.mjs            (tutte le route, 3 viewport)
 *   node scripts/overflow-audit.mjs /dashboard 390   (una route, un width)
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "scripts/.audit";
mkdirSync(OUT, { recursive: true });

const ROUTES = [
  "/dashboard",
  "/tasks",
  "/tasks?view=list",
  "/tasks?view=archive",
  "/calendar",
  "/problems",
  "/requests",
  "/projects",
  // progetto demo «Rebranding» — board, gantt e bacheca
  "/projects/00000000-0000-4000-8000-000000000102",
  "/projects/00000000-0000-4000-8000-000000000102?view=timeline",
  "/projects/00000000-0000-4000-8000-000000000102?view=bacheca",
  "/reports",
  "/team",
  "/team?view=carico",
  "/settings/profile",
  "/settings/workspace",
  "/styleguide",
];
const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844, mobile: true },
  { name: "tablet", width: 768, height: 1024, mobile: false },
  { name: "laptopsm", width: 1024, height: 720, mobile: false },
  { name: "laptop", width: 1152, height: 720, mobile: false },
  { name: "desktop", width: 1280, height: 800, mobile: false },
  { name: "wide", width: 1440, height: 900, mobile: false },
];

const argRoute = process.argv[2];
const argWidth = process.argv[3] ? Number(process.argv[3]) : null;
const routes = argRoute ? [argRoute] : ROUTES;
const viewports = argWidth ? VIEWPORTS.filter((v) => v.width === argWidth) : VIEWPORTS;

// Funzione eseguita nel browser: trova contenuto tagliato dal proprio clipper.
const DETECT = `(() => {
  const vw = document.documentElement.clientWidth;
  const pageOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  const clips = ['hidden', 'clip', 'auto', 'scroll'];
  const isClipX = (s) => clips.includes(s.overflowX);
  const desc = (el) => {
    const t = (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 32);
    return el.tagName.toLowerCase()
      + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.') : '')
      + (t ? ' «' + t + '»' : '');
  };
  const out = { vw, pageOverflow, offViewport: [], clipped: [] };
  const els = document.querySelectorAll('main *, [role=main] *, body > div *');
  for (const el of els) {
    if (el.closest('.sr-only')) continue; // contenuto a11y nascosto: invisibile, non conta
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    // (a) elemento che finisce oltre il viewport a destra
    if (r.right > vw + 1.5 && out.offViewport.length < 25) {
      out.offViewport.push({ d: desc(el), right: Math.round(r.right), vw });
    }
    // (b) elemento tagliato dal proprio contenitore-clipper
    let p = el.parentElement, guard = 0;
    while (p && guard++ < 30) {
      const cs = getComputedStyle(p);
      if (isClipX(cs)) {
        const pr = p.getBoundingClientRect();
        // il clipper NON è uno scroller intenzionale se non scrolla in x
        const scrollable = p.scrollWidth > p.clientWidth + 4 && (cs.overflowX === 'auto' || cs.overflowX === 'scroll');
        if (!scrollable) {
          const padR = parseFloat(cs.paddingRight) || 0;
          const overR = r.right - (pr.right - padR);
          const overL = (pr.left + (parseFloat(cs.paddingLeft) || 0)) - r.left;
          if ((overR > 1.5 || overL > 1.5) && out.clipped.length < 40) {
            out.clipped.push({ d: desc(el), over: Math.round(Math.max(overR, overL)), inside: desc(p) });
          }
        }
        break;
      }
      p = p.parentElement;
    }
  }
  return out;
})()`;

const browser = await chromium.launch();
let totalIssues = 0;
const report = [];

for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.mobile ? 2 : 1,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
  });
  const page = await context.newPage();
  for (const route of routes) {
    let res;
    try {
      await page.goto(`${BASE}${route}${route.includes("?") ? "&" : "?"}tour=0&capo=0`, { waitUntil: "networkidle", timeout: 20000 });
    } catch {
      await page.goto(`${BASE}${route}${route.includes("?") ? "&" : "?"}tour=0&capo=0`, { waitUntil: "domcontentloaded", timeout: 20000 });
    }
    await page.waitForTimeout(1200);
    res = await page.evaluate(DETECT);
    const issues = res.clipped.length + res.offViewport.length + (res.pageOverflow > 1 ? 1 : 0);
    totalIssues += issues;
    const tag = `[${vp.name} ${vp.width}] ${route}`;
    if (issues === 0) {
      report.push(`✓ ${tag} — pulito`);
    } else {
      report.push(`✗ ${tag} — pageOverflow=${res.pageOverflow}px, offViewport=${res.offViewport.length}, clipped=${res.clipped.length}`);
      for (const o of res.offViewport) report.push(`    off→ ${o.d}  (right ${o.right} > vw ${o.vw})`);
      for (const c of res.clipped) report.push(`    clip→ ${c.d}  +${c.over}px oltre  [${c.inside}]`);
      const safe = route.replace(/\W+/g, "_");
      await page.screenshot({ path: `${OUT}/${vp.name}${safe}.png`, fullPage: true });
    }
  }
  await context.close();
}

await browser.close();
console.log(report.join("\n"));
console.log(`\nTOTALE PROBLEMI: ${totalIssues}`);
