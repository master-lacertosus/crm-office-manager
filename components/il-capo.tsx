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
const FIRST_DELAY = () => 2_000 + Math.random() * 2_000;
const NEXT_DELAY = () => 240_000 + Math.random() * 180_000;
const SHOW_MS = 13_000;

interface CapoContext {
  overdue: number;
  worstLateDays: number;
  inReview: number;
  myOpen: number;
  staleProblems: number;
  hour: number;
  minute: number;
}

const clock = (h: number, m: number) => {
  const total = (((h * 60 + m) % 1440) + 1440) % 1440;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

function pickMessage(ctx: CapoContext): string {
  const pool: { text: string; weight: number }[] = [];
  const add = (text: string, weight = 1) => pool.push({ text, weight });

  /* --- contestuali (dure) --- */
  if (ctx.overdue > 0) {
    add("TI VEDO CHE NON STAI COMPLETANDO LE TASK!", 3);
    add("IL SEGNALE È ACCESO: C'È UN TASK IN RITARDO.", 2);
    add(
      ctx.overdue === 1
        ? `QUEL TASK È IN RITARDO DA ${Math.max(1, ctx.worstLateDays)} GIORNI. HA MESSO RADICI.`
        : `${ctx.overdue} TASK IN RITARDO. IO. VEDO. TUTTO.`,
      3,
    );
    add("IL RITARDO NON È UN'OPINIONE. È UN FATTO. VOSTRO.", 2);
    add("LE FERIE SONO UN CONCETTO. LE SCADENZE SONO REALTÀ.", 2);
  }
  if (ctx.staleProblems > 0) {
    add("UN PROBLEMA DI DUE GIORNI NON È UN PROBLEMA. È UNA SCELTA.", 3);
  }
  if (ctx.inReview >= 2) {
    add(
      `${ctx.inReview} TASK IN REVISIONE. LE REVISIONI SI APPROVANO, NON SI COVANO.`,
      2,
    );
  }
  if (ctx.myOpen === 0) {
    add("TUTTO FATTO?! ALLORA PERCHÉ NON STATE GIÀ FACENDO ALTRO?", 3);
  }
  if (ctx.hour < 10) {
    add("IL SOLE È SORTO ALLE 6:12. VOI?", 2);
    add("IL CAFFÈ È FINITO. SI PERFORMA.", 2);
  }
  if (ctx.hour >= 18) {
    add(`ALLE ${clock(ctx.hour, ctx.minute)} ANCORA QUI. ALLE 8:31 VEDIAMO.`, 2);
  }

  /* --- dure sempre valide --- */
  add("DEVI LAVORARE. PERFORMA MEGLIO.", 2);
  add("IO SONO LA SCADENZA.", 2);
  add("MENO SCROLL, PIÙ DELIVERY.", 2);
  add("TRATTA LE TASK COME GLI STACCHI: UNA RIPETIZIONE ALLA VOLTA.", 2);
  add("PARMA DORME. LE TASK NO.", 1);
  add("NON SONO IL CAPO CHE MERITATE. SONO QUELLO CHE VI SERVE.", 1);
  add("IL BLACK FRIDAY NON SI PREPARA DA SOLO.", 1);

  /* --- assurde senza senso (marchio di fabbrica del Capo) --- */
  add("COME MAI SIETE ARRIVATI ALLE 8:26? LA TIMBRATURA È ALLE 8:30.", 3);
  add(
    `SONO LE ${clock(ctx.hour, ctx.minute)} E SIETE QUI DALLE ${clock(ctx.hour, ctx.minute - 4)}. CHI VE L'HA CHIESTO?`,
    2,
  );
  add("HO CONTATO I VOSTRI CLICK. TROPPI.", 2);
  add("LA PAUSA CAFFÈ DI IERI È DURATA 4 MINUTI. CHI VI CREDETE DI ESSERE?", 2);
  add("VI HO VISTO RESPIRARE TRA UNA TASK E L'ALTRA.", 2);
  add("CHI HA APPROVATO IL WEEKEND?", 2);
  add("TROPPO SILENZIO. NON SENTO DIGITARE.", 2);
  add("LA SEDIA È INCLINATA DI 3 GRADI. RADDRIZZATEVI.", 1);
  add("LE FERIE DI AGOSTO 2019 NON LE HO DIMENTICATE.", 1);
  add("LA LUCERTOLA SUL MIO PETTO LAVORA PIÙ DI VOI.", 1);
  add("HO SOGNATO CHE ERAVATE PRODUTTIVI. POI MI SONO SVEGLIATO.", 1);
  add("IL BADGE VI HA VISTI USCIRE ALLE 18:00 IN PUNTO. SOSPETTO.", 1);
  add("QUESTA DASHBOARD È TROPPO BELLA PER I RISULTATI CHE PORTATE.", 1);

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
  "PARMA È FIERA DI TE. IO QUASI.",
  "UN TASK CHIUSO. NE RESTANO INFINITI.",
  "BRAVO. ORA DIMOSTRATE CHE NON ERA FORTUNA.",
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

/**
 * Claudio P. — il Cavaliere di Parma. Parodia originale in salsa
 * Lacertosus: cappuccio con orecchie, mantello, LUCERTOLA arancio sul
 * petto (lacertosus = «lucertoloso»), cintura con fibbia CEO. Nessun
 * asset DC: design disegnato a mano.
 */
function CapoSvg() {
  return (
    <svg viewBox="0 0 120 130" className="h-[120px] w-[112px] drop-shadow-md">
      {/* mantello (dietro, con orlo frastagliato che spunta ai lati) */}
      <path
        d="M12 128 L15 78 Q22 58 40 53 L80 53 Q98 58 105 78 L108 128 L97 117 L86 128 L74 117 L62 128 L50 117 L38 128 L26 117 Z"
        fill="#0f172a"
      />
      {/* busto e spalle */}
      <path
        d="M14 96 q6 -26 26 -30 l40 0 q20 4 26 30 l0 34 -92 0 Z"
        fill="#172033"
      />
      <ellipse cx="24" cy="82" rx="16" ry="14" fill="#172033" />
      <ellipse cx="96" cy="82" rx="16" ry="14" fill="#172033" />
      {/* scudo pettorale con emblema lucertola */}
      <ellipse cx="60" cy="92" rx="14" ry="10" fill="#0b1220" />
      <g
        stroke="#ff6b00"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      >
        {/* corpo a S della lucertola */}
        <path d="M57 85 q6 2 5 7 q-1 4 -5 5" strokeWidth="3" />
        {/* coda arricciata */}
        <path d="M57 97 q-4 2 -3 5" strokeWidth="2" />
        {/* zampe */}
        <path d="M56 88 l-4 -2" />
        <path d="M62 89 l4 -2" />
        <path d="M55 94 l-4 2" />
        <path d="M61 95 l4 2" />
      </g>
      {/* testa della lucertola */}
      <circle cx="58" cy="84" r="2.4" fill="#ff6b00" />
      {/* cintura CEO */}
      <rect x="32" y="114" width="56" height="8" rx="3" fill="#ff6b00" />
      <rect x="51" y="112" width="18" height="12" rx="3" fill="#e05300" />
      <text
        x="60"
        y="121"
        textAnchor="middle"
        fontSize="6.5"
        fontWeight="800"
        fill="#ffffff"
      >
        CEO
      </text>
      {/* avambracci incrociati con pinne */}
      <path
        d="M18 104 q22 -14 52 -4 q-4 12 -20 12 q-20 0 -32 -8 Z"
        fill="#0b1220"
      />
      <path
        d="M102 104 q-22 -14 -52 -4 q4 12 20 12 q20 0 32 -8 Z"
        fill="#24303f"
      />
      <path d="M40 101 l5 -7 2 8 Z" fill="#ff6b00" opacity="0.9" />
      <path d="M80 101 l-5 -7 -2 8 Z" fill="#ff8a1f" opacity="0.9" />
      {/* pugni guantati */}
      <circle cx="78" cy="108" r="7" fill="#111827" />
      <circle cx="42" cy="108" r="7" fill="#172033" />
      {/* collo */}
      <rect x="50" y="56" width="20" height="18" rx="6" fill="#e8b088" />
      {/* mascella scoperta */}
      <path d="M40 42 q0 22 20 22 q20 0 20 -22 Z" fill="#f0bd93" />
      {/* cappuccio con orecchie */}
      <path
        d="M36 46 q-3 -27 24 -27 q27 0 24 27 q0 5 -3 7 l-42 0 q-3 -2 -3 -7 Z"
        fill="#111b2e"
      />
      <path d="M42 23 l3 -13 7 11 Z" fill="#111b2e" />
      <path d="M78 23 l-3 -13 -7 11 Z" fill="#111b2e" />
      {/* occhi bianchi decisi */}
      <path d="M44 37 l12 -2.5 0 6 -11 1 Z" fill="#ffffff" />
      <path d="M76 37 l-12 -2.5 0 6 11 1 Z" fill="#ffffff" />
      {/* bocca severa */}
      <path
        d="M54 56 q6 3 12 0"
        stroke="#8a5a3b"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
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
      staleProblems: open.filter(
        (t) =>
          t.status === "alert" &&
          t.problem_since &&
          Date.now() - new Date(t.problem_since).getTime() > 48 * 3600_000,
      ).length,
      hour: new Date().getHours(),
      minute: new Date().getMinutes(),
    };
    show(pickMessage(ctx));
  }, [show]);

  /* Apparizioni programmate (random), rispettando il silenzio giornaliero.
     Se c'è un dialog aperto (tour, dettaglio task, palette, standup) NON
     spreca l'entrata: riprova poco dopo. */
  React.useEffect(() => {
    if (offUntilToday()) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = (delay: number) => {
      timer = setTimeout(() => {
        const busy =
          document.visibilityState !== "visible" ||
          document.querySelector('[role="dialog"]') !== null;
        if (offUntilToday()) {
          schedule(NEXT_DELAY());
        } else if (busy) {
          schedule(20_000 + Math.random() * 15_000);
        } else {
          summon();
          schedule(NEXT_DELAY());
        }
      }, delay);
    };
    schedule(FIRST_DELAY());
    return () => clearTimeout(timer);
  }, [summon]);

  /* Evocazione manuale dalla palette (ignora anche il silenzio) */
  React.useEffect(() => {
    const onSummon = () => summon();
    window.addEventListener("capo:summon", onSummon);
    return () => window.removeEventListener("capo:summon", onSummon);
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
          className="fixed right-4 bottom-0 z-30 flex items-end gap-2"
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
                Claudio P. · Il Cavaliere di Parma
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
