"use client";

import * as React from "react";
import {
  ImageUp,
  LoaderCircle,
  ShieldCheck,
  Trash2,
  User,
} from "lucide-react";

import { messaggioErrore } from "@/lib/errori";
import { AvatarError, fileToAvatarDataUrl } from "@/lib/avatar";
import { useAppStore } from "@/lib/store";
import { AvatarInitials } from "@/components/avatar-initials";
import { useToast } from "@/components/toaster";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm() {
  const { currentUser, updateProfile, setAvatar } = useAppStore();
  const toast = useToast();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [name, setName] = React.useState(currentUser.full_name);
  const [title, setTitle] = React.useState(currentUser.title ?? "");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onPickFile = async (file: File) => {
    setUploading(true);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setAvatar(currentUser.id, dataUrl);
      toast("Foto del profilo aggiornata");
    } catch (e) {
      toast(
        e instanceof AvatarError && e.reason === "too-big"
          ? "Immagine troppo pesante: massimo 8 MB"
          : "Il file scelto non è un'immagine leggibile",
      );
    } finally {
      setUploading(false);
    }
  };

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
    // Stesso motivo del pannello dei task: il pulsante è `disabled={saving}`,
    // e senza il `finally` un errore lo lascerebbe spento per sempre.
    try {
      await updateProfile(currentUser.id, { full_name: name, title });
      setSaved(true);
    } catch (e) {
      setError(messaggioErrore(e, "Salvataggio non riuscito."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="card-soft space-y-5 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <AvatarInitials
          name={name.trim() || currentUser.full_name}
          src={currentUser.avatar_url}
          size="lg"
          className="size-14 text-[18px]"
        />
        <div className="min-w-0 flex-1">
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
            {currentUser.avatar_url
              ? "La foto è salvata su questo dispositivo, ritagliata al centro."
              : "Senza foto si usano le iniziali del nome."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            aria-busy={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              <ImageUp data-icon="inline-start" />
            )}
            {currentUser.avatar_url ? "Cambia foto" : "Carica foto"}
          </Button>
          {currentUser.avatar_url ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setAvatar(currentUser.id, null);
                toast("Foto rimossa: si torna alle iniziali");
              }}
              className="text-ink-muted hover:text-danger-text"
            >
              <Trash2 data-icon="inline-start" />
              Rimuovi
            </Button>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onPickFile(file);
              e.target.value = "";
            }}
          />
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
