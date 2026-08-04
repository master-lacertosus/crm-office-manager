"use client";

import * as React from "react";
import { LoaderCircle, ShieldCheck, User } from "lucide-react";

import { useAppStore } from "@/lib/store";
import { AvatarInitials } from "@/components/avatar-initials";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm() {
  const { currentUser, updateProfile } = useAppStore();
  const [name, setName] = React.useState(currentUser.full_name);
  const [title, setTitle] = React.useState(currentUser.title ?? "");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isAdmin = currentUser.role === "admin";
  const dirty =
    name.trim() !== currentUser.full_name ||
    title.trim() !== (currentUser.title ?? "");

  React.useEffect(() => {
    if (!saved) return;
    const id = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(id);
  }, [saved]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length === 0) {
      setError("Il nome è obbligatorio.");
      return;
    }
    setError(null);
    setSaving(true);
    await updateProfile(currentUser.id, { full_name: name, title });
    setSaving(false);
    setSaved(true);
  };

  return (
    <form onSubmit={submit} noValidate className="card-soft space-y-5 p-4">
      <div className="flex items-center gap-3">
        <AvatarInitials name={name.trim() || currentUser.full_name} size="lg" />
        <div className="min-w-0">
          <p className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-ink">
              {name.trim() || currentUser.full_name}
            </span>
            <Badge variant={isAdmin ? "brand" : "outline"}>
              {isAdmin ? (
                <ShieldCheck aria-hidden />
              ) : (
                <User aria-hidden />
              )}
              {isAdmin ? "Responsabile" : "Membro"}
            </Badge>
          </p>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            Avatar a iniziali: si genera dal nome, nessun upload nell&rsquo;MVP.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-name">Nome e cognome</Label>
        <Input
          id="profile-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "profile-name-error" : undefined}
        />
        {error ? (
          <p id="profile-name-error" className="text-[13px] text-danger-text">
            {error}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-title">Qualifica</Label>
        <Input
          id="profile-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="es. Responsabile · Webmaster"
          maxLength={60}
        />
        <p className="text-[13px] text-ink-muted">
          Appare accanto al tuo nome nel team e nello standup.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-email">Email</Label>
        <Input id="profile-email" value={currentUser.email} disabled />
        <p className="text-[13px] text-ink-muted">
          L&rsquo;email è gestita dall&rsquo;accesso e non si modifica qui.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving || !dirty} aria-busy={saving}>
          {saving ? <LoaderCircle className="animate-spin" /> : null}
          Salva modifiche
        </Button>
        {saved ? (
          <span
            role="status"
            className="inline-flex items-center gap-1.5 rounded-lg bg-success-soft px-2.5 py-1 text-[13px] font-medium text-success-text"
          >
            <span className="size-1.5 rounded-full bg-success" />
            Salvato
          </span>
        ) : null}
      </div>
    </form>
  );
}
