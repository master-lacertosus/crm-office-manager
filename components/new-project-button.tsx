"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { LoaderCircle, X } from "lucide-react";

import { messaggioErrore } from "@/lib/errori";
import { pop, scrim } from "@/lib/motion";
import { puoGestireProgetti } from "@/lib/permessi";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Creazione di un progetto. Prima era un pulsante disabilitato in attesa di
 * Supabase: ora scrive davvero, e la policy `projects_insert_own` pretende
 * che `created_by` sia l'utente collegato — cosa che lo store garantisce.
 */
export function NewProjectButton() {
  const { createProject, currentUser, loading } = useAppStore();
  /* I progetti sono struttura del workspace: li creano i responsabili. Chi
     ha bisogno di un contenitore nuovo lo chiede — è una conversazione, non
     un pulsante. */
  const puoCreare = puoGestireProgetti(currentUser);
  const router = useRouter();
  const toast = useToast();

  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving]);

  const chiudi = () => {
    setOpen(false);
    setName("");
    setDescription("");
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nome = name.trim();
    if (!nome || saving) return;
    setSaving(true);
    setError(null);
    try {
      const progetto = await createProject({ name: nome, description });
      toast(`Progetto «${progetto.name}» creato`);
      chiudi();
      router.push(`/projects/${progetto.id}`);
    } catch (err) {
      /* Qui finisce anche il rifiuto della RLS. Non si chiude il dialog: il
         testo scritto resta dov'è, così non va perso insieme all'errore. */
      setError(
        messaggioErrore(err, "Creazione non riuscita."),
      );
    } finally {
      setSaving(false);
    }
  };

  if (!puoCreare) return null;

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={loading || !currentUser.id}>
        Nuovo progetto
      </Button>

      {/* Stessa guardia degli altri dialog del progetto: nel render sul
          server `document` non esiste. Uno stato «montato» aggiornato in un
          effetto sarebbe equivalente, ma il React Compiler lo rifiuta. */}
      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <div className="fixed inset-0 z-100 grid place-items-center p-4">
                  <motion.div
                    variants={scrim}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    onClick={() => (saving ? null : chiudi())}
                    className="absolute inset-0 bg-ink/20 backdrop-blur-[2px]"
                  />
                  <motion.div
                    variants={pop}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Nuovo progetto"
                    className="relative w-full max-w-md rounded-2xl border border-border bg-white p-5 shadow-[0_24px_64px_rgb(15_23_42/0.22)]"
                  >
                    <button
                      type="button"
                      onClick={chiudi}
                      disabled={saving}
                      aria-label="Chiudi"
                      className="absolute top-3 right-3 rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-accent hover:text-ink"
                    >
                      <X className="size-4" />
                    </button>

                    <h2 className="text-[15px] font-semibold text-ink">
                      Nuovo progetto
                    </h2>
                    <p className="mt-1 text-[13px] text-ink-secondary">
                      I progetti raggruppano i task. Si archiviano, non si
                      cancellano.
                    </p>

                    <form onSubmit={submit} className="mt-4 space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="project-name">Nome</Label>
                        <Input
                          id="project-name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Es. E-commerce 2026"
                          maxLength={80}
                          autoFocus
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="project-description">
                          Descrizione{" "}
                          <span className="font-normal text-ink-muted">
                            (facoltativa)
                          </span>
                        </Label>
                        <Textarea
                          id="project-description"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          rows={3}
                          maxLength={2000}
                        />
                      </div>

                      {error ? (
                        <p
                          role="alert"
                          className="rounded-xl bg-danger-soft px-3 py-2 text-[13px] text-danger-text"
                        >
                          {error}
                        </p>
                      ) : null}

                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={chiudi}
                          disabled={saving}
                        >
                          Annulla
                        </Button>
                        <Button
                          type="submit"
                          disabled={!name.trim() || saving}
                          aria-busy={saving}
                        >
                          {saving ? (
                            <LoaderCircle className="animate-spin" />
                          ) : null}
                          Crea progetto
                        </Button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}
