"use client";

import * as React from "react";
import { LoaderCircle, Plus, Split } from "lucide-react";

import { puoAggiungereSottoTask, puoModificareTask } from "@/lib/permessi";
import { useAppStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AvatarInitials } from "@/components/avatar-initials";
import { DueChip } from "@/components/due-chip";
import { SearchLink } from "@/components/search-link";
import { StatusPip } from "@/components/status-pip";
import { useToast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

/**
 * I pezzi di un lavoro.
 *
 * «Video prodotto X» non è un blocco solo: sono riprese, montaggio, testi,
 * caricamento. Ogni pezzo qui dentro è un task vero — con il suo
 * responsabile, la sua scadenza, il suo stato — e compare nella board e nel
 * carico di chi lo esegue. Il padre resta il quadro d'insieme.
 *
 * Non si annida oltre: un pezzo non ha pezzi. Servono liste di lavori, non
 * alberi in cui perdersi.
 */
export function SottoTask({ task }: { task: Task }) {
  const { tasks, profiles, currentUser, createTask, updateTask } =
    useAppStore();
  const toast = useToast();

  const [titolo, setTitolo] = React.useState("");
  const [responsabile, setResponsabile] = React.useState(currentUser.id);
  const [scadenza, setScadenza] = React.useState("");
  /* Facoltativo: il quadro d'insieme sta nel padre, e da lì si legge anche
     aprendo il pezzo. Serve quando il singolo pezzo ha istruzioni sue —
     un formato, un percorso, una persona da sentire — che nel brief
     generale non stanno. */
  const [dettagli, setDettagli] = React.useState("");
  const [creando, setCreando] = React.useState(false);

  // Un pezzo non ha pezzi: la sezione compare solo sui lavori principali.
  if (task.parent_id) return null;

  const pezzi = tasks
    .filter((t) => t.parent_id === task.id && !t.archived_at)
    .sort((a, b) => a.position - b.position);
  const fatti = pezzi.filter((p) => p.status === "done").length;
  const percento =
    pezzi.length === 0 ? 0 : Math.round((fatti / pezzi.length) * 100);
  const puoAggiungere = puoAggiungereSottoTask(task, currentUser);

  const aggiungi = async (e: React.FormEvent) => {
    e.preventDefault();
    const nome = titolo.trim();
    if (!nome || creando) return;
    setCreando(true);
    /* Il `finally` non è pignoleria: il pulsante è `disabled={creando}`, e
       se qualcosa saltasse fuori qui in mezzo resterebbe spento per sempre,
       senza dire perché. */
    try {
      await createTask({
        title: nome,
        owner_id: responsabile,
        parent_id: task.id,
        project_id: task.project_id,
        due_date: scadenza || null,
        priority: task.priority,
        description: dettagli.trim() ? dettagli.trim() : null,
      });
    } finally {
      setCreando(false);
    }
    setTitolo("");
    setScadenza("");
    setDettagli("");
    const chi = profiles.find((p) => p.id === responsabile);
    toast(
      responsabile === currentUser.id
        ? `«${nome}» aggiunto ai tuoi lavori`
        : `«${nome}» affidato a ${chi?.full_name.split(" ")[0] ?? "un collega"}`,
    );
  };

  return (
    <section aria-label="Pezzi del lavoro" className="px-5 pb-2">
      <Separator className="mb-4" />
      <h3 className="flex flex-wrap items-center gap-2 text-[11px] font-bold tracking-[0.06em] text-ink-secondary uppercase">
        <Split className="size-3.5" />
        Lavori
        {pezzi.length > 0 ? (
          <span className="font-mono text-[11px] font-normal text-ink-muted">
            {fatti}/{pezzi.length}
          </span>
        ) : null}
      </h3>

      {pezzi.length > 0 ? (
        <div
          role="progressbar"
          aria-valuenow={percento}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Lavoro completato al ${percento}%`}
          className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-border-soft"
        >
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              percento === 100 ? "bg-success" : "bg-brand-500",
            )}
            style={{ width: `${percento}%` }}
          />
        </div>
      ) : null}

      <ul className="mt-2.5 space-y-0.5">
        {pezzi.length === 0 ? (
          <li className="text-[13px] text-ink-muted">
            Nessun pezzo: questo lavoro è di una persona sola. Dividilo se ci
            lavorano in più.
          </li>
        ) : (
          pezzi.map((pezzo) => {
            const chi = profiles.find((p) => p.id === pezzo.owner_id);
            const mio = puoModificareTask(pezzo, currentUser, task);
            return (
              <li key={pezzo.id} className="flex items-center gap-2">
                {/* La spunta chiude il pezzo senza aprirlo: è il gesto più
                    frequente, e chiederne tre sarebbe un dispetto. */}
                <input
                  type="checkbox"
                  checked={pezzo.status === "done"}
                  disabled={!mio}
                  aria-label={`Segna «${pezzo.title}» come ${
                    pezzo.status === "done" ? "da fare" : "fatto"
                  }`}
                  title={
                    mio
                      ? undefined
                      : `Lo chiude ${chi?.full_name.split(" ")[0] ?? "chi ne risponde"}`
                  }
                  onChange={() =>
                    void updateTask(pezzo.id, {
                      status: pezzo.status === "done" ? "todo" : "done",
                    })
                  }
                  className="size-4 shrink-0 accent-(--brand-500) disabled:opacity-40"
                />
                <SearchLink
                  params={{ task: pezzo.id }}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1.5 outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <StatusPip status={pezzo.status} className="size-3 shrink-0" />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-[13px] text-ink",
                      pezzo.status === "done" && "text-ink-muted line-through",
                    )}
                  >
                    {pezzo.title}
                  </span>
                  {chi ? (
                    <span
                      className="flex shrink-0 items-center gap-1.5"
                      title={`Responsabile: ${chi.full_name}`}
                    >
                      <AvatarInitials name={chi.full_name} size="sm" />
                      <span className="hidden text-[11px] text-ink-muted sm:inline">
                        {chi.full_name.split(" ")[0]}
                      </span>
                    </span>
                  ) : null}
                  <DueChip iso={pezzo.due_date} status={pezzo.status} />
                </SearchLink>
              </li>
            );
          })
        )}
      </ul>

      {puoAggiungere ? (
        <form onSubmit={aggiungi} className="mt-2 flex flex-wrap gap-2">
          <Label htmlFor="sotto-titolo" className="sr-only">
            Titolo del pezzo
          </Label>
          <Input
            id="sotto-titolo"
            value={titolo}
            onChange={(e) => setTitolo(e.target.value)}
            placeholder="Es. Montaggio video"
            className="h-9 min-w-40 flex-1"
            maxLength={200}
          />
          <Label htmlFor="sotto-owner" className="sr-only">
            Responsabile del pezzo
          </Label>
          <NativeSelect
            id="sotto-owner"
            value={responsabile}
            onChange={(e) => setResponsabile(e.target.value)}
            className="h-9 w-40 shrink-0"
          >
            {profiles
              .filter((p) => p.is_active)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
          </NativeSelect>
          <Label htmlFor="sotto-due" className="sr-only">
            Scadenza del pezzo
          </Label>
          <Input
            id="sotto-due"
            type="date"
            value={scadenza}
            onChange={(e) => setScadenza(e.target.value)}
            className="h-9 w-36 shrink-0"
          />
          <Label htmlFor="sotto-dettagli" className="sr-only">
            Dettagli del pezzo (facoltativi)
          </Label>
          <Textarea
            id="sotto-dettagli"
            value={dettagli}
            onChange={(e) => setDettagli(e.target.value)}
            placeholder="Dettagli per chi lo esegue (facoltativo)"
            rows={2}
            className="min-h-0 w-full"
            maxLength={2000}
          />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={!titolo.trim() || creando}
            aria-busy={creando}
          >
            {creando ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Plus data-icon="inline-start" />
            )}
            Aggiungi
          </Button>
        </form>
      ) : null}
    </section>
  );
}
