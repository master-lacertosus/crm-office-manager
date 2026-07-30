"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleCheck } from "lucide-react";

import { rise } from "@/lib/motion";

interface Toast {
  id: number;
  message: string;
}

const ToastContext = React.createContext<((message: string) => void) | null>(
  null,
);

export function useToast(): (message: string) => void {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast va usato dentro ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const nextId = React.useRef(1);

  const push = React.useCallback((message: string) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-[60] flex flex-col gap-2"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              variants={rise}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="glass-strong flex items-center gap-2 rounded-xl px-3.5 py-2.5"
            >
              <CircleCheck aria-hidden className="size-4 text-success" />
              <p className="text-[13px] font-medium text-ink">{toast.message}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
