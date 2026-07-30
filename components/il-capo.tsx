"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";

import { diffIsoDays, todayIso } from "@/lib/format";
import { useAppStore } from "@/lib/store";

/**
 * IL CAPO — easter egg motivazionale. Il CEO (caricatura, nessuna persona
 * reale) appare a sorpresa in basso a destra e commenta i dati VERI dello
 * store: ritardi, revisioni, completamenti. Cliccalo per congedarlo,
 * «Non oggi» lo silenzia fino a domani (localStorage). Debug: ?capo=1.
 */

const STORAGE_KEY = "ilcapo-off-until";
const FIRST_DELAY = () => 25_000 + Math.random() * 20_000;
const NEXT_DELAY = () => 240_000 + Math.random() * 180_000;
const SHOW_MS = 13_000;

interface CapoContext {
  overdue: number;
  worstLateDays: number;
  inReview: number;
  myOpen: number;
  hour: number;
}

function pickMessage(ctx: CapoContext): string {
  const pool: { text: string; weight: number }[] = [];
  const add = (text: string, weight = 1) => pool.push({ text, weight });

  if (ctx.overdue > 0) {
    add("TI VEDO CHE NON STAI COMPLETANDO LE TASK!", 3);
    add(
      ctx.overdue === 1
        ? `C'È UN TASK IN RITARDO DA ${Math.max(1, ctx.worstLateDays)} GIORNI. IO. VEDO. TUTTO.`
        : `${ctx.overdue} TASK IN RITARDO. IO. VEDO. TUTTO.`,
      3,
    );
    add("LE FERIE SONO UN CONCETTO. LE SCADENZE SONO REALTÀ.", 2);
  }
  if (ctx.inReview >= 2) {
    add(
      `${ctx.inReview} TASK IN REVISIONE. LE REVISIONI NON SI APPROVANO DA SOLE.`,
      2,
    );
  }
  if (ctx.myOpen === 0) {
    add("TUTTO FATTO?! NON CI CREDO. ORA CONTROLLO.", 3);
  }
  if (ctx.hour < 10) {
    add("IL CAFFÈ È FINITO. SI PERFORMA.", 2);
  }
  if (ctx.hour >= 18) {
    add("ANCORA QUI? RISPETTO. MA DOMANI SI SPINGE DI PIÙ.", 2);
  }
  add("DEVI LAVORARE. PERFORMA MEGLIO.", 2);
  add("MENO SCROLL, PIÙ DELIVERY.", 2);
  add("TRATTA LE TASK COME GLI STACCHI: UNA RIPETIZIONE ALLA VOLTA.", 2);
  add("IL BLACK FRIDAY NON SI PREPARA DA SOLO.", 1);
  add("CHI CHIUDE TASK OGGI, SOLLEVA DI PIÙ DOMANI.", 1);

  const total = pool.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of pool) {
    r -= p.weight;
    if (r <= 0) return p.text;
  }
  return pool[0].text;
}

const PRAISE = [
  "COSÌ SI FA! ORA FANNE UN ALTRO.",
  "VISTO? QUANDO VUOI, PUOI.",
  "BENE. NON MONTARTI LA TESTA.",
];

function offUntilToday(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === todayIso();
  } catch {
    return false;
  }
}

/** Effetto macchina da scrivere: si monta con key={testo}, si resetta da solo. */
function TypewriterText({ text }: { text: string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = React.useState(reduced ? text.length : 0);

  React.useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      setShown((v) => {
        if (v >= text.length) {
          clearInterval(id);
          return v;
        }
        return v + 1;
      });
    }, 28);
    return () => clearInterval(id);
  }, [text, reduced]);

  return (
    <>
      {text.slice(0, shown)}
      {shown < text.length ? <span className="animate-pulse">▍</span> : null}
    </>
  );
}

/** Caricatura SVG: giacca, cravatta arancio, occhiali, bicipiti. */
function CapoSvg() {
  return (
    <svg viewBox="0 0 120 130" className="h-[120px] w-[112px] drop-shadow-md">
      {/* braccia incrociate (dietro) */}
      <path
        d="M14 96 q6 -26 26 -30 l40 0 q20 4 26 30 l0 34 -92 0 Z"
        fill="#1f2937"
      />
      {/* spalle esagerate */}
      <ellipse cx="24" cy="82" rx="16" ry="14" fill="#1f2937" />
      <ellipse cx="96" cy="82" rx="16" ry="14" fill="#1f2937" />
      {/* camicia */}
      <path d="M46 72 l14 14 14 -14 0 58 -28 0 Z" fill="#f8fafc" />
      {/* cravatta arancio */}
      <path d="M56 84 l4 -6 4 6 -3 8 3 26 -4 8 -4 -8 3 -26 Z" fill="#ff6b00" />
      {/* avambracci incrociati */}
      <path
        d="M18 104 q22 -14 52 -4 q-4 12 -20 12 q-20 0 -32 -8 Z"
        fill="#111827"
      />
      <path
        d="M102 104 q-22 -14 -52 -4 q4 12 20 12 q20 0 32 -8 Z"
        fill="#374151"
      />
      {/* pugni */}
      <circle cx="78" cy="108" r="7" fill="#e8b088" />
      <circle cx="42" cy="108" r="7" fill="#e8b088" />
      {/* collo taurino */}
      <rect x="50" y="58" width="20" height="16" rx="6" fill="#e8b088" />
      {/* testa */}
      <circle cx="60" cy="38" r="24" fill="#f0bd93" />
      {/* orecchie */}
      <circle cx="37" cy="40" r="4.5" fill="#e8b088" />
      <circle cx="83" cy="40" r="4.5" fill="#e8b088" />
      {/* capelli rasati */}
      <path d="M38 30 q4 -16 22 -16 q18 0 22 16 q-10 -7 -22 -7 q-12 0 -22 7 Z" fill="#374151" />
      {/* occhiali da sole */}
      <rect x="41" y="32" width="17" height="11" rx="5" fill="#111827" />
      <rect x="62" y="32" width="17" height="11" rx="5" fill="#111827" />
      <rect x="56" y="35" width="8" height="3" rx="1.5" fill="#111827" />
      {/* riflesso arancio */}
      <path d="M44 34 l6 0 -4 6 -3 0 Z" fill="#ff8a1f" opacity="0.85" />
      <path d="M65 34 l6 0 -4 6 -3 0 Z" fill="#ff8a1f" opacity="0.85" />
      {/* naso e baffi */}
      <path d="M58 44 q2 4 4 0" stroke="#d99b6d" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M50 51 q10 6 20 0 q-4 7 -10 7 q-6 0 -10 -7 Z" fill="#374151" />
      {/* bocca decisa */}
      <path d="M55 56 q5 3 10 0" stroke="#8a5a3b" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* badge CEO */}
      <rect x="26" y="94" width="16" height="9" rx="2.5" fill="#ff6b00" />
      <text x="34" y="101" textAnchor="middle" fontSize="6.2" fontWeight="800" fill="#ffffff">
        CEO
      </text>
    </svg>
  );
}

export function IlCapo() {
  const { tasks, currentUser } = useAppStore();
  const searchParams = useSearchParams();
  const reduced = useReducedMotion();

  const [visible, setVisible] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const hideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneCountRef = React.useRef<number | null>(null);

  const tasksRef = React.useRef(tasks);
  React.useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);
  const userRef = React.useRef(currentUser);
  React.useEffect(() => {
    userRef.current = currentUser;
  }, [currentUser]);

  const show = React.useCallback((text: string) => {
    setMessage(text);
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), SHOW_MS);
  }, []);

  const summon = React.useCallback(() => {
    const now = todayIso();
    const list = tasksRef.current;
    const open = list.filter((t) => t.status !== "done");
    const late = open.filter((t) => t.due_date && t.due_date < now);
    const ctx: CapoContext = {
      overdue: late.length,
      worstLateDays: late.length
        ? Math.max(...late.map((t) => diffIsoDays(t.due_date as string, now)))
        : 0,
      inReview: open.filter((t) => t.status === "in_review").length,
      myOpen: open.filter((t) => t.owner_id === userRef.current.id).length,
      hour: new Date().getHours(),
    };
    show(pickMessage(ctx));
  }, [show]);

  /* Apparizioni programmate (random), rispettando il silenzio giornaliero */
  React.useEffect(() => {
    if (offUntilToday()) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = (delay: number) => {
      timer = setTimeout(() => {
        if (!offUntilToday() && document.visibilityState === "visible") {
          summon();
        }
        schedule(NEXT_DELAY());
      }, delay);
    };
    schedule(FIRST_DELAY());
    return () => clearTimeout(timer);
  }, [summon]);

  /* Elogio (a modo suo) quando un task viene completato */
  React.useEffect(() => {
    const done = tasks.filter((t) => t.status === "done").length;
    if (doneCountRef.current === null) {
      doneCountRef.current = done;
      return;
    }
    if (done > doneCountRef.current && !offUntilToday() && Math.random() < 0.5) {
      show(PRAISE[Math.floor(Math.random() * PRAISE.length)]);
    }
    doneCountRef.current = done;
  }, [tasks, show]);

  /* Evocazione manuale: ?capo=1 */
  const forced = searchParams.get("capo") === "1";
  React.useEffect(() => {
    if (forced) summon();
  }, [forced, summon]);

  const dismissToday = () => {
    try {
      localStorage.setItem(STORAGE_KEY, todayIso());
    } catch {
      /* niente storage, pazienza */
    }
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 130 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 130 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="fixed right-4 bottom-0 z-40 flex items-end gap-2"
        >
          {/* nuvoletta */}
          <motion.div
            initial={reduced ? false : { opacity: 0, scale: 0.9, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className="card-soft relative mb-16 max-w-[250px] rounded-2xl p-3.5"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-bold tracking-[0.08em] text-brand-600 uppercase">
                Il Capo · CEO
              </p>
              <button
                onClick={() => setVisible(false)}
                aria-label="Chiudi il Capo"
                className="-mt-0.5 rounded-sm text-ink-faint outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <p className="mt-1 min-h-9 text-[13px]/[18px] font-bold text-ink">
              <TypewriterText key={message} text={message} />
            </p>
            <button
              onClick={dismissToday}
              className="mt-1.5 rounded-sm text-[11px] text-ink-muted outline-none hover:text-ink hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              Non oggi, capo
            </button>
            {/* codina del fumetto */}
            <span
              aria-hidden
              className="absolute -right-1.5 bottom-5 size-3 rotate-45 border-t border-r border-border bg-white"
            />
          </motion.div>

          {/* il Capo, con respiro d'attesa */}
          <motion.button
            onClick={() => setVisible(false)}
            aria-label="Congeda il Capo"
            animate={reduced ? undefined : { y: [0, -3, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            <CapoSvg />
          </motion.button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
