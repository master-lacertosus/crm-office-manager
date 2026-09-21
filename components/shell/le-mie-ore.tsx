"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Clock4 } from "lucide-react";

import { BloccoOre } from "@/components/blocco-ore";
import { Button } from "@/components/ui/button";
import { pop } from "@/lib/motion";

/**
 * Le proprie ore, da sotto un orologio in barra.
 *
 * Stavano in un blocco della dashboard, ed erano fuori posto: un riquadro
 * che parla delle proprie ore in mezzo a task, scadenze e polso del team.
 * La stessa cosa era già successa col meteo.
 *
 * Il posto giusto era scritto nel commento della pastiglia «Timbra», due
 * bottoni più in là: «sta nella barra superiore e non in un blocco della
 * dashboard perché è un gesto, non un'informazione». Il registro di quel
 * gesto va dove sta il gesto, non in una griglia che parla d'altro.
 *
 * È un pannello a tendina come la campanella, non un modale a schermo
 * intero: guardare quanto hai fatto è una sbirciata, non un'interruzione —
 * e un velo nero sopra tutta l'applicazione per tre numeri sarebbe una
 * cerimonia sproporzionata. Il mese intero, quello sì, ha una pagina sua.
 */
export function LeMieOre() {
  const [aperto, setAperto] = React.useState(false);
  const radiceRef = React.useRef<HTMLDivElement>(null);
  const bottoneRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!aperto) return;
    const suGiu = (e: PointerEvent) => {
      if (!radiceRef.current?.contains(e.target as Node)) setAperto(false);
    };
    const suTasto = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAperto(false);
      /* Chi ha aperto con la tastiera deve ritrovarsi dov'era: senza questo
         il fuoco torna in cima alla pagina e si riparte da capo. */
      bottoneRef.current?.focus();
    };
    window.addEventListener("pointerdown", suGiu);
    window.addEventListener("keydown", suTasto);
    return () => {
      window.removeEventListener("pointerdown", suGiu);
      window.removeEventListener("keydown", suTasto);
    };
  }, [aperto]);

  return (
    <div ref={radiceRef} className="relative">
      <Button
        ref={bottoneRef}
        variant="ghost"
        size="icon"
        aria-label="Le mie ore"
        aria-expanded={aperto}
        aria-haspopup="dialog"
        onClick={() => setAperto((v) => !v)}
      >
        <Clock4 />
      </Button>

      <AnimatePresence>
        {aperto ? (
          <motion.div
            variants={pop}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-label="Le mie ore"
            /* La larghezza cede prima del bordo dello schermo: a 400px un
               pannello fisso da 380 uscirebbe fuori e porterebbe con sé la
               barra di scorrimento orizzontale. */
            className="glass-strong absolute right-0 z-50 mt-2 w-[min(23rem,calc(100vw-2rem))] origin-top-right rounded-xl p-3.5"
          >
            <p className="mb-2.5 text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
              Le mie ore
            </p>
            <BloccoOre onNaviga={() => setAperto(false)} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
