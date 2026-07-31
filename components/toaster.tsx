"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleCheck } from "lucide-react";

import { rise } from "@/lib/motion";

interface ToastOptions {
  /** Pulsante nel toast (es. «Annulla» per l'undo). */
  action?: { label: string; onClick: () => void };
  /** Durata custom in ms (default 3200; con azione 6000). */
  duration?: number;
}

interface Toast extends ToastOptions {
  id: number;
  message: string;
}

type PushToast = (message: string, options?: ToastOptions) => void;

const ToastContext = React.createContext<PushToast | null>(null);

export function useToast(): PushToast {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast va usato dentro ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const nextId = React.useRef(1);

  const dismiss = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = React.useCallback<PushToast>(
    (message, options) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, ...options }]);
      setTimeout(
        () => dismiss(id),
        options?.duration ?? (options?.action ? 6000 : 3200),
      );
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-[60] flex flex-col gap-2 print:hidden"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              variants={rise}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="glass-strong pointer-events-auto flex items-center gap-2 rounded-xl px-3.5 py-2.5"
            >
              <CircleCheck aria-hidden className="size-4 text-success" />
              <p className="text-[13px] font-medium text-ink">{toast.message}</p>
              {toast.action ? (
                <button
                  onClick={() => {
                    toast.action?.onClick();
                    dismiss(toast.id);
                  }}
                  className="ml-1 shrink-0 rounded-md px-2 py-0.5 text-[13px] font-bold text-brand-700 outline-none transition-colors hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {toast.action.label}
                </button>
              ) : null}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
