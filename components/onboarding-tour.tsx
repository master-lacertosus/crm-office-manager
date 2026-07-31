"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  AtSign,
  Bell,
  CalendarDays,
  Columns3,
  Command,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { pop, scrim } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "tour-done";

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Sparkles,
    title: "Benvenuto in Office OS",
    text: "La piattaforma operativa dell'ufficio Lacertosus: task, scadenze, progetti e report in un posto solo. Due minuti e sei operativo.",
  },
  {
    icon: Columns3,
    title: "La board è il cuore",
    text: "Trascina le card tra le fasi col mouse; ogni fase ha il suo colore e «Problema» segnala i blocchi. Gli admin possono aggiungere fasi custom col «+» in fondo.",
  },
  {
    icon: CalendarDays,
    title: "Le scadenze si vedono ovunque",
    text: "Chip rossi per i ritardi, arancio per oggi, ambra per l'imminente. Nel Calendario trascini un task su un giorno per ripianificarlo; il «+» crea task già datati.",
  },
  {
    icon: AtSign,
    title: "Parla con i colleghi",
    text: "Nei commenti digita «@» per menzionare qualcuno (o @Admin): riceverà un avviso nella campanella con il salto diretto al task.",
  },
  {
    icon: Bell,
    title: "Niente più dimenticanze",
    text: "La campanella raccoglie avvisi e solleciti; la pillola rossa in alto conta i TUOI task urgenti. E ogni tanto passa il Capo… non farci caso. O forse sì.",
  },
  {
    icon: Command,
    title: "Vola con la tastiera",
    text: "Ctrl+K apre i comandi rapidi: cerca task, progetti e persone o crea al volo. Nel dettaglio task, ← → navigano tra i task. «/» sulla board va al filtro.",
  },
];

/** Intro guidata per i nuovi utenti (riapribile con ?tour=1). */
export function OnboardingTour() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const forced = searchParams.get("tour") === "1";
  const suppressed = searchParams.get("tour") === "0";
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const checkedStorageRef = React.useRef(false);

  React.useEffect(() => {
    if (suppressed) return; // demo/test: niente tour
    if (forced) {
      queueMicrotask(() => {
        setStep(0);
        setOpen(true);
      });
      // Toglie subito ?tour=1 dall'URL: se restasse, «Rivedi il tour»
      // smetterebbe di rispondere (stesso URL → nessuna navigazione) e
      // ogni ricarica o back lo farebbe ripartire da solo.
      const params = new URLSearchParams(searchParams);
      params.delete("tour");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      return;
    }
    if (checkedStorageRef.current) return; // solo al primo mount
    checkedStorageRef.current = true;
    queueMicrotask(() => {
      try {
        if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
      } catch {
        /* senza storage niente tour automatico */
      }
    });
  }, [forced, suppressed, searchParams, pathname, router]);

  const finish = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignora */
    }
    setOpen(false);
  };

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight" && step < STEPS.length - 1) setStep(step + 1);
      if (e.key === "ArrowLeft" && step > 0) setStep(step - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step]);

  const current = STEPS[step];
  const Icon = current.icon;
  const last = step === STEPS.length - 1;

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[85]">
          <motion.div
            variants={scrim}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute inset-0 bg-scrim backdrop-blur-[3px]"
            aria-hidden
          />
          <motion.div
            variants={pop}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-label="Introduzione guidata"
            className="absolute inset-x-4 top-1/2 mx-auto max-w-md -translate-y-1/2 rounded-3xl border border-border bg-white p-6 shadow-[0_28px_90px_rgb(15_23_42/0.24)] sm:inset-x-auto sm:left-1/2 sm:w-full sm:-translate-x-1/2"
          >
            <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <Icon className="size-6" strokeWidth={2} />
            </span>
            <h2 className="mt-4 text-[20px]/7 font-bold text-ink">
              {current.title}
            </h2>
            <p className="mt-2 min-h-16 text-sm/relaxed text-ink-secondary">
              {current.text}
            </p>

            <div className="mt-4 flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  aria-label={`Passo ${i + 1}`}
                  className={cn(
                    "h-1.5 rounded-full transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    i === step
                      ? "w-6 bg-brand-500"
                      : "w-1.5 bg-border hover:bg-ink-faint",
                  )}
                />
              ))}
              <span className="ml-auto font-mono text-[11px] text-ink-muted">
                {step + 1}/{STEPS.length}
              </span>
            </div>

            <div className="mt-5 flex items-center gap-2">
              <Button
                onClick={() => (last ? finish() : setStep(step + 1))}
                className="flex-1"
              >
                {last ? "Inizia a lavorare" : "Avanti"}
              </Button>
              {step > 0 ? (
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  Indietro
                </Button>
              ) : null}
              {!last ? (
                <Button variant="ghost" onClick={finish}>
                  Salta
                </Button>
              ) : null}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
