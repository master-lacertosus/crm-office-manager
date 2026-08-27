"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  Check,
  Inbox,
  MailPlus,
  Send,
  X,
} from "lucide-react";

import { diffIsoDays, formatDue, timeAgo, todayIso } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import type { TaskRequest } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AvatarInitials } from "@/components/avatar-initials";
import { EmptyState } from "@/components/empty-state";
import { PriorityBadge } from "@/components/priority-badge";
import { useToast } from "@/components/toaster";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

/**
 * Richieste di task: chiunque propone (titolo + contesto), i responsabili
 * approvano scegliendo assegnatario/scadenza/progetto — nasce il task
 * collegato — o rifiutano con un motivo. Ognuno segue le proprie.
 */

/** Chip di stato della richiesta: linguaggio coerente coi DueChip. */
function StatusChip({ req }: { req: TaskRequest }) {
  const map = {
    pending: { label: "In attesa", cls: "bg-warning-soft text-warning-text" },
    approved: { label: "Approvata", cls: "bg-success-soft text-success-text" },
    rejected: { label: "Rifiutata", cls: "bg-danger-soft text-danger-text" },
  }[req.status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        map.cls,
      )}
    >
      {map.label}
    </span>
  );
}

/** Form di invio: sempre in cima, per tutti. */
function NewRequestForm() {
  const { createRequest, projects } = useAppStore();
  const toast = useToast();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [neededBy, setNeededBy] = React.useState("");
  const [urgent, setUrgent] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || sending) return;
    setSending(true);
    await createRequest({
      title,
      description,
      project_id: projectId || null,
      requested_due: neededBy || null,
      priority: urgent ? "high" : "normal",
    });
    setSending(false);
    setTitle("");
    setDescription("");
    setProjectId("");
    setNeededBy("");
    setUrgent(false);
    toast("Richiesta inviata: i responsabili la vedranno subito.");
  };

  return (
    <form onSubmit={submit} className="card-soft space-y-2.5 p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.05em] text-ink-secondary uppercase">
        <MailPlus aria-hidden className="size-3.5 text-brand-600" />
        Nuova richiesta
      </p>
      <div className="flex flex-wrap gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Cosa serve? Es. «Shooting foto nuova linea»"
          aria-label="Titolo della richiesta"
          className="h-9 min-w-52 flex-1"
          maxLength={120}
          required
        />
        <NativeSelect
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          aria-label="Progetto (facoltativo)"
          className="h-9 w-44 shrink-0"
        >
          <option value="">Nessun progetto</option>
          {projects
            .filter((p) => !p.is_archived)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </NativeSelect>
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Contesto utile a chi decide: perché serve, materiali, riferimenti…"
        aria-label="Descrizione della richiesta"
        rows={2}
        maxLength={500}
        className="w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-ink-faint focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className="flex items-center gap-1.5 text-[13px] text-ink-secondary">
          Serve entro
          <Input
            type="date"
            value={neededBy}
            min={todayIso()}
            onChange={(e) => setNeededBy(e.target.value)}
            aria-label="Serve entro (facoltativo)"
            className="h-9 w-36 shrink-0"
          />
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-[13px] text-ink-secondary select-none">
          <input
            type="checkbox"
            checked={urgent}
            onChange={(e) => setUrgent(e.target.checked)}
            className="size-3.5 accent-brand-500"
          />
          Urgente
        </label>
        <span className="ml-auto">
          <Button type="submit" disabled={!title.trim() || sending}>
            <Send data-icon="inline-start" />
            {sending ? "Invio…" : "Invia richiesta"}
          </Button>
        </span>
      </div>
    </form>
  );
}

/** Card della coda admin: decisione inline, senza dialog. */
function PendingCard({ req }: { req: TaskRequest }) {
  const { profiles, projects, approveRequest, rejectRequest } = useAppStore();
  const toast = useToast();
  const router = useRouter();
  const requester = profiles.find((p) => p.id === req.requester_id);
  const [owner, setOwner] = React.useState(req.requester_id);
  // «Serve entro» del richiedente pre-compila la scadenza del task.
  const [due, setDue] = React.useState(req.requested_due ?? "");
  const [projectId, setProjectId] = React.useState(req.project_id ?? "");
  const [rejecting, setRejecting] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // Da quanti giorni aspetta: oltre i 3 l'attesa diventa un segnale.
  const waitingDays = Math.max(
    0,
    diffIsoDays(req.created_at.slice(0, 10), todayIso()),
  );
  const stale = waitingDays >= 3;

  const approve = async () => {
    if (busy) return;
    setBusy(true);
    const task = await approveRequest(req.id, {
      owner_id: owner,
      due_date: due || null,
      project_id: projectId || null,
    });
    setBusy(false);
    if (task) {
      const name =
        profiles.find((p) => p.id === owner)?.full_name.split(" ")[0] ?? "";
      toast(`Task creato e assegnato a ${name}`, {
        action: {
          label: "Apri task",
          onClick: () => router.push(`/tasks?task=${task.id}`),
        },
      });
    }
  };

  const reject = async () => {
    if (busy) return;
    setBusy(true);
    await rejectRequest(req.id, reason);
    setBusy(false);
    toast("Richiesta rifiutata: il richiedente è stato avvisato.");
  };

  return (
    <div
      className={cn(
        "card-soft space-y-3 p-4",
        stale && "border-warning/50",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <AvatarInitials
          name={requester?.full_name ?? "?"}
          src={requester?.avatar_url}
          size="sm"
        />
        <span className="text-[13px] font-medium text-ink">
          {requester?.full_name ?? "—"}
        </span>
        <span
          className={cn(
            "font-mono text-[11px]",
            stale ? "font-semibold text-warning-text" : "text-ink-muted",
          )}
        >
          {stale ? `in attesa da ${waitingDays} g` : timeAgo(req.created_at)}
        </span>
        {req.priority === "high" ? <PriorityBadge /> : null}
        {req.requested_due ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-status-todo-soft px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-status-todo-text">
            <CalendarClock aria-hidden className="size-3" />
            serve entro {formatDue(req.requested_due)}
          </span>
        ) : null}
        {req.project_id ? (
          <Badge className="min-w-0 shrink text-ellipsis">
            {projects.find((p) => p.id === req.project_id)?.name}
          </Badge>
        ) : null}
      </div>
      <div>
        <p className="text-[15px] font-bold text-ink">{req.title}</p>
        {req.description ? (
          /* `whitespace-pre-line` non è un dettaglio tipografico: senza, gli
             a-capo collassano e una richiesta scritta a elenco puntato
             diventa un unico blocco corrente. Il testo c'era ed era anche
             completo — semplicemente non si riusciva più a leggerlo.
             `break-words` tiene dentro i link lunghi, che altrimenti
             sfondano la scheda. */
          <p className="mt-1 text-[13px]/[19px] break-words whitespace-pre-line text-ink-secondary">
            {req.description}
          </p>
        ) : null}
      </div>

      {rejecting ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border-soft pt-3">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                reject();
              }
              if (e.key === "Escape") setRejecting(false);
            }}
            placeholder="Motivo del rifiuto (lo vede il richiedente)"
            aria-label="Motivo del rifiuto"
            className="h-9 min-w-52 flex-1"
            autoFocus
            maxLength={200}
          />
          <Button
            variant="destructive"
            size="sm"
            onClick={reject}
            disabled={busy}
          >
            {busy ? "Invio…" : "Conferma rifiuto"}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setRejecting(false)}
            aria-label="Annulla rifiuto"
          >
            <X />
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-t border-border-soft pt-3">
          <label className="sr-only" htmlFor={`owner-${req.id}`}>
            Assegna a
          </label>
          <NativeSelect
            id={`owner-${req.id}`}
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="h-9 w-44 shrink-0"
          >
            {profiles
              .filter((p) => p.is_active)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
          </NativeSelect>
          <Input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            aria-label="Scadenza del task"
            className="h-9 w-36 shrink-0"
          />
          <NativeSelect
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            aria-label="Progetto del task"
            className="hidden h-9 w-40 shrink-0 sm:inline-flex"
          >
            <option value="">Nessun progetto</option>
            {projects
              .filter((p) => !p.is_archived)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </NativeSelect>
          <span className="ml-auto flex gap-1.5">
            <Button size="sm" onClick={approve} disabled={busy}>
              <Check data-icon="inline-start" />
              {busy ? "Creazione…" : "Approva → task"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejecting(true)}
              disabled={busy}
            >
              Rifiuta
            </Button>
          </span>
        </div>
      )}
    </div>
  );
}

/** Riga compatta nello storico / nelle proprie richieste. */
function RequestRow({ req, showRequester }: { req: TaskRequest; showRequester?: boolean }) {
  const { profiles, currentUser, withdrawRequest } = useAppStore();
  const toast = useToast();
  const requester = profiles.find((p) => p.id === req.requester_id);
  const decider = profiles.find((p) => p.id === req.decided_by);
  const owner = profiles.find((p) => p.id === req.owner_id);
  const canWithdraw =
    req.status === "pending" && req.requester_id === currentUser.id;

  const withdraw = () => {
    const undo = withdrawRequest(req.id);
    if (undo) {
      toast(`Richiesta «${req.title}» ritirata`, {
        action: { label: "Annulla", onClick: undo },
      });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-accent/60">
      {showRequester ? (
        <AvatarInitials
          name={requester?.full_name ?? "?"}
          src={requester?.avatar_url}
          size="sm"
        />
      ) : null}
      <span className="min-w-0 flex-1 basis-48">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-sm font-medium text-ink">
            {req.title}
          </span>
          {req.priority === "high" ? <PriorityBadge iconOnly /> : null}
        </span>
        <span className="block truncate text-[11px] text-ink-muted">
          {showRequester ? `${requester?.full_name.split(" ")[0]} · ` : ""}
          {timeAgo(req.created_at)}
          {req.status === "pending" && req.requested_due
            ? ` — serve entro ${formatDue(req.requested_due)}`
            : ""}
          {req.status === "rejected" && req.rejection_reason
            ? ` — ${req.rejection_reason}`
            : ""}
          {req.status === "approved" && owner
            ? ` — assegnata a ${owner.full_name.split(" ")[0]}`
            : ""}
          {req.status !== "pending" && decider
            ? ` (${decider.full_name.split(" ")[0]})`
            : ""}
        </span>
      </span>
      {req.due_date ? (
        <span className="font-mono text-[11px] text-ink-muted">
          {formatDue(req.due_date)}
        </span>
      ) : null}
      <StatusChip req={req} />
      {req.task_id ? (
        <Link
          href={`/tasks?task=${req.task_id}`}
          scroll={false}
          className="inline-flex items-center gap-1 rounded-sm text-[12px] font-semibold text-brand-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          Vedi task
          <ArrowRight aria-hidden className="size-3" />
        </Link>
      ) : null}
      {canWithdraw ? (
        <button
          type="button"
          onClick={withdraw}
          aria-label={`Ritira la richiesta «${req.title}»`}
          title="Ritira la richiesta"
          className="rounded-md p-1 text-ink-faint outline-none transition-colors hover:bg-danger-soft hover:text-danger-text focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="card-soft min-w-0 p-4">
      <header className="flex items-center gap-2 pb-2.5">
        <h2 className="text-[11px] font-semibold tracking-[0.05em] text-ink-secondary uppercase">
          {title}
        </h2>
        <span className="inline-flex min-w-5 items-center justify-center rounded-full border border-border px-1.5 font-mono text-[11px] text-ink-muted">
          {count}
        </span>
      </header>
      {children}
    </section>
  );
}

export function RequestsContent() {
  const { requests, currentUser } = useAppStore();
  const isAdmin = currentUser.role === "admin";

  const pending = requests
    .filter((r) => r.status === "pending")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const mine = requests
    .filter((r) => r.requester_id === currentUser.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const decided = requests
    .filter((r) => r.status !== "pending")
    .sort((a, b) => (b.decided_at ?? "").localeCompare(a.decided_at ?? ""));

  return (
    <div className="flex-1 space-y-4 px-4 py-4 sm:px-6">
      <NewRequestForm />

      {isAdmin ? (
        <Section title="Da approvare" count={pending.length}>
          {pending.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Nessuna richiesta in attesa"
              hint="Quando un collega propone un task, appare qui."
              className="py-6"
            />
          ) : (
            <div className="space-y-3">
              {pending.map((req) => (
                <PendingCard key={req.id} req={req} />
              ))}
            </div>
          )}
        </Section>
      ) : null}

      <div className={cn("grid gap-4", isAdmin && "lg:grid-cols-2")}>
        <Section title="Le mie richieste" count={mine.length}>
          {mine.length === 0 ? (
            <EmptyState
              icon={Send}
              title="Non hai ancora inviato richieste"
              hint="Proponi un task dal modulo qui sopra: i responsabili decidono e tu segui lo stato."
              className="py-6"
            />
          ) : (
            <div className="-mx-1 flex flex-col">
              {mine.map((req) => (
                <RequestRow key={req.id} req={req} />
              ))}
            </div>
          )}
        </Section>

        {isAdmin ? (
          <Section title="Decise di recente" count={decided.length}>
            {decided.length === 0 ? (
              <EmptyState
                icon={Check}
                title="Ancora nessuna decisione"
                className="py-6"
              />
            ) : (
              <div className="-mx-1 flex flex-col">
                {decided.slice(0, 12).map((req) => (
                  <RequestRow key={req.id} req={req} showRequester />
                ))}
              </div>
            )}
          </Section>
        ) : null}
      </div>
    </div>
  );
}
