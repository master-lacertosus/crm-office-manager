"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { BellPlus, LoaderCircle, Send } from "lucide-react";

import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { AvatarInitials } from "@/components/avatar-initials";
import { useToast } from "@/components/toaster";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function AlertForm({
  toUserId,
  toName,
  onDone,
}: {
  toUserId: string;
  toName: string;
  onDone: () => void;
}) {
  const { sendNotification } = useAppStore();
  const toast = useToast();
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length === 0) return;
    setSending(true);
    await sendNotification(toUserId, message);
    setSending(false);
    toast(`Avviso inviato a ${toName.split(" ")[0]}`);
    onDone();
  };

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
      onSubmit={submit}
      className="overflow-hidden"
    >
      <div className="space-y-2 px-4 pb-4 sm:pl-[60px]">
        <Label htmlFor={`alert-${toUserId}`}>
          Avviso per {toName.split(" ")[0]}
        </Label>
        <Textarea
          id={`alert-${toUserId}`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Es. Ricordati la consegna dei banner entro venerdì."
          className="min-h-16"
          autoFocus
        />
        <div className="flex items-center gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={sending || message.trim().length === 0}
            aria-busy={sending}
          >
            {sending ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Send data-icon="inline-start" />
            )}
            Invia avviso
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            Annulla
          </Button>
        </div>
      </div>
    </motion.form>
  );
}

export function TeamContent() {
  const { profiles, tasks, currentUser } = useAppStore();
  const [alertFor, setAlertFor] = React.useState<string | null>(null);
  const isAdmin = currentUser.role === "admin";

  return (
    <div className="flex-1 px-4 py-4 sm:px-6">
      <div className="card-soft overflow-hidden">
        {profiles.map((profile, index) => {
          const openCount = tasks.filter(
            (t) => t.owner_id === profile.id && t.status !== "done",
          ).length;
          const canAlert =
            isAdmin && profile.id !== currentUser.id && profile.is_active;
          return (
            <div
              key={profile.id}
              className={cn(index > 0 && "border-t border-border-soft")}
            >
              <div
                className={cn(
                  "flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3",
                  !profile.is_active && "opacity-60",
                )}
              >
                <AvatarInitials
                  name={profile.full_name}
                  src={profile.avatar_url}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-ink">
                    {profile.full_name}
                    {profile.title ? (
                      <span className="text-xs font-normal text-ink-secondary">
                        · {profile.title}
                      </span>
                    ) : null}
                    {profile.id === currentUser.id ? (
                      <span className="text-xs font-normal text-ink-muted">
                        (tu)
                      </span>
                    ) : null}
                  </p>
                  <p className="font-mono text-xs text-ink-muted">
                    {profile.email}
                  </p>
                </div>
                <span className="hidden font-mono text-xs text-ink-muted sm:inline">
                  {openCount} task aperti
                </span>
                {!profile.is_active ? (
                  <Badge variant="outline">Disattivato</Badge>
                ) : profile.role === "admin" ? (
                  <Badge variant="brand">Admin</Badge>
                ) : (
                  <Badge>Member</Badge>
                )}
                {canAlert ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setAlertFor((v) => (v === profile.id ? null : profile.id))
                    }
                    aria-expanded={alertFor === profile.id}
                  >
                    <BellPlus data-icon="inline-start" />
                    Invia avviso
                  </Button>
                ) : null}
              </div>
              <AnimatePresence>
                {alertFor === profile.id ? (
                  <AlertForm
                    toUserId={profile.id}
                    toName={profile.full_name}
                    onDone={() => setAlertFor(null)}
                  />
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[13px] text-ink-muted">
        Gli avvisi arrivano nella campanella del destinatario. Inviti e ruoli
        si attiveranno con il collegamento a Supabase (M2).
      </p>
    </div>
  );
}
