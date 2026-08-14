"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { LoaderCircle, TriangleAlert, Upload, UserRound } from "lucide-react";

import {
  ACCENTS,
  DENSITIES,
  usePreferences,
} from "@/lib/preferences";
import { useAppStore } from "@/lib/store";
import { AvatarInitials } from "@/components/avatar-initials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Limite del bucket: 2 MB. Controllarlo qui evita di scoprire il rifiuto
 *  dopo aver caricato per intero un file inutilmente grande. */
const MAX_BYTES = 2 * 1024 * 1024;
const TIPI_AMMESSI = ["image/jpeg", "image/png", "image/webp"];

/**
 * Primo accesso guidato.
 *
 * Compare quando `profiles.onboarded_at` è nullo. Serve perché il nome
 * iniziale lo deduce il database dalla parte prima della chiocciola
 * dell'email: senza questa procedura ci si chiamerebbe «francesco.s» per
 * sempre.
 *
 * Non è chiudibile: è il momento in cui la persona decide come apparirà ai
 * colleghi, e rimandarlo significa lasciare in giro profili anonimi.
 */
export function OnboardingProfile() {
  const { needsOnboarding, currentUser, completeOnboarding } = useAppStore();
  const { prefs, setAccent, setDensity, setReduceMotion } = usePreferences();

  const [fullName, setFullName] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [anteprima, setAnteprima] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputFileRef = React.useRef<HTMLInputElement>(null);

  if (!needsOnboarding) return null;

  const scegliFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const scelto = e.target.files?.[0];
    if (!scelto) return;
    if (!TIPI_AMMESSI.includes(scelto.type)) {
      setError("Formato non ammesso: servono JPEG, PNG o WebP.");
      return;
    }
    if (scelto.size > MAX_BYTES) {
      setError(
        `La foto pesa ${(scelto.size / 1024 / 1024).toFixed(1)} MB: il limite è 2 MB.`,
      );
      return;
    }
    setError(null);
    setFile(scelto);
    /* L'anteprima si costruisce qui e non in un effetto: il React Compiler
       vieta setState dentro useEffect, e comunque questo è l'unico momento
       in cui la foto cambia. L'oggetto URL precedente va revocato subito,
       altrimenti ogni tentativo resta in memoria fino alla ricarica. */
    setAnteprima((precedente) => {
      if (precedente) URL.revokeObjectURL(precedente);
      return URL.createObjectURL(scelto);
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await completeOnboarding({
        full_name: fullName,
        title: title || null,
        avatarFile: file,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Salvataggio non riuscito.",
      );
    } finally {
      setSaving(false);
    }
  };

  const nomeAnteprima = fullName.trim() || currentUser.full_name;

  const dialog = (
    <div className="fixed inset-0 z-100 grid place-items-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[3px]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Configura il tuo profilo"
        className="relative my-auto w-full max-w-lg rounded-2xl border border-border bg-white p-6 shadow-[0_28px_72px_rgb(15_23_42/0.24)]"
      >
        <h2 className="text-[17px] font-semibold tracking-[-0.008em] text-ink">
          Benvenuto in Office OS
        </h2>
        <p className="mt-1 text-[13px] text-ink-secondary">
          Due minuti per dire ai colleghi chi sei. Potrai cambiare tutto più
          tardi da Impostazioni.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-5">
          {/* --- Identità ---------------------------------------------- */}
          <div className="flex items-center gap-4">
            <AvatarInitials
              name={nomeAnteprima}
              src={anteprima ?? currentUser.avatar_url}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <input
                ref={inputFileRef}
                type="file"
                accept={TIPI_AMMESSI.join(",")}
                onChange={scegliFile}
                className="sr-only"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputFileRef.current?.click()}
              >
                {file ? <UserRound data-icon="inline-start" /> : <Upload data-icon="inline-start" />}
                {file ? "Cambia foto" : "Carica una foto"}
              </Button>
              <p className="mt-1.5 text-[11px] text-ink-muted">
                JPEG, PNG o WebP, fino a 2 MB. Facoltativa: senza foto restano
                le iniziali.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ob-name">Nome e cognome</Label>
            <Input
              id="ob-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Es. Francesco Salafia"
              maxLength={80}
              autoFocus
              required
            />
            <p className="text-[11px] text-ink-muted">
              Ora ti chiami «{currentUser.full_name}», dedotto dalla tua email.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ob-title">
              Qualifica{" "}
              <span className="font-normal text-ink-muted">(facoltativa)</span>
            </Label>
            <Input
              id="ob-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Es. Responsabile · Webmaster"
              maxLength={80}
            />
          </div>

          {/* --- Aspetto ------------------------------------------------ */}
          <div className="space-y-2 border-t border-border-soft pt-4">
            <Label>Colore d&rsquo;accento</Label>
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => setAccent(a.key)}
                  aria-pressed={prefs.accent === a.key}
                  title={a.label}
                  className={
                    "size-8 rounded-full border-2 transition-transform " +
                    (prefs.accent === a.key
                      ? "scale-110 border-ink"
                      : "border-transparent hover:scale-105")
                  }
                  style={{ background: a.swatch }}
                >
                  <span className="sr-only">{a.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Densità</Label>
            <div className="flex flex-wrap gap-2">
              {DENSITIES.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setDensity(d.key)}
                  aria-pressed={prefs.density === d.key}
                  className={
                    "rounded-lg border px-3 py-1.5 text-[13px] transition-colors " +
                    (prefs.density === d.key
                      ? "border-ink bg-accent font-medium text-ink"
                      : "border-border text-ink-secondary hover:bg-accent")
                  }
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-[13px] text-ink">
            <input
              type="checkbox"
              checked={prefs.reduceMotion}
              onChange={(e) => setReduceMotion(e.target.checked)}
              className="size-4 rounded border-border"
            />
            Riduci le animazioni
          </label>

          {error ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2 text-[13px] text-danger-text"
            >
              <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!fullName.trim() || saving}
            aria-busy={saving}
          >
            {saving ? <LoaderCircle className="animate-spin" /> : null}
            Entra in Office OS
          </Button>
        </form>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(dialog, document.body)
    : null;
}
