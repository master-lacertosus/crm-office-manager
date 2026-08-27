"use client";

import * as React from "react";
import { Check, MoonStar, Palette, Rows3, Sparkles } from "lucide-react";

import {
  ACCENTS,
  DENSITIES,
  TEMI,
  usePreferences,
  type AccentKey,
} from "@/lib/preferences";
import { cn } from "@/lib/utils";

/** Intestazione comune di un blocco impostazione. */
function SettingCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-soft p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.05em] text-ink-secondary uppercase">
        <Icon className="size-3.5" />
        {title}
      </p>
      <p className="mt-1 text-[13px] text-ink-muted">{description}</p>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

function AccentSwatch({
  accentKey,
  label,
  swatch,
  active,
  onSelect,
}: {
  accentKey: AccentKey;
  label: string;
  swatch: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      aria-label={`Accento ${label}`}
      className={cn(
        "group flex flex-col items-center gap-1.5 rounded-xl border p-2.5 outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
        active
          ? "border-transparent bg-brand-50 ring-2 ring-brand-500"
          : "border-border hover:bg-accent/70",
      )}
    >
      <span
        aria-hidden
        className="flex size-8 items-center justify-center rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]"
        style={{ backgroundColor: swatch }}
        data-accent={accentKey}
      >
        {active ? (
          <Check className="size-4 text-white" strokeWidth={3} />
        ) : null}
      </span>
      <span
        className={cn(
          "text-[12px] font-medium",
          active ? "text-brand-700" : "text-ink-secondary",
        )}
      >
        {label}
      </span>
    </button>
  );
}

/** Interruttore accessibile (role="switch"), niente dipendenze extra. */
function Switch({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
        checked ? "bg-primary" : "bg-input",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block size-5 rounded-full bg-card shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function AppearanceSettings() {
  const {
    prefs,
    setAccent,
    setDensity,
    setReduceMotion,
    setAvvisiAltrui,
    setTema,
  } = usePreferences();
  const reduceId = React.useId();
  const avvisiId = React.useId();

  return (
    <div className="space-y-4">
      <SettingCard
        icon={MoonStar}
        title="Tema"
        description="Chiaro, scuro, o quello che usa il tuo computer."
      >
        <div
          role="radiogroup"
          aria-label="Tema dell'interfaccia"
          className="grid grid-cols-3 gap-2"
        >
          {TEMI.map((t) => {
            const active = prefs.tema === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTema(t.key)}
                className={cn(
                  "flex flex-col items-start rounded-xl border p-3 text-left outline-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                  active
                    ? "border-transparent bg-brand-50 ring-2 ring-brand-500"
                    : "border-border hover:bg-accent/70",
                )}
              >
                <span
                  className={cn(
                    "text-[13px] font-semibold",
                    active ? "text-brand-700" : "text-ink",
                  )}
                >
                  {t.label}
                </span>
                <span className="mt-0.5 text-[11px] text-ink-muted">
                  {t.hint}
                </span>
              </button>
            );
          })}
        </div>
      </SettingCard>

      <SettingCard
        icon={Palette}
        title="Colore d'accento"
        description="Ricolora bottoni, evidenze e navigazione. La scelta vale su questo dispositivo."
      >
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {ACCENTS.map((a) => (
            <AccentSwatch
              key={a.key}
              accentKey={a.key}
              label={a.label}
              swatch={a.swatch}
              active={prefs.accent === a.key}
              onSelect={() => setAccent(a.key)}
            />
          ))}
        </div>
      </SettingCard>

      <SettingCard
        icon={Rows3}
        title="Densità"
        description="Regola la spaziatura dell'intera interfaccia."
      >
        <div
          role="radiogroup"
          aria-label="Densità interfaccia"
          className="grid grid-cols-3 gap-2"
        >
          {DENSITIES.map((d) => {
            const active = prefs.density === d.key;
            return (
              <button
                key={d.key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setDensity(d.key)}
                className={cn(
                  "flex flex-col items-start rounded-xl border p-3 text-left outline-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                  active
                    ? "border-transparent bg-brand-50 ring-2 ring-brand-500"
                    : "border-border hover:bg-accent/70",
                )}
              >
                <span
                  className={cn(
                    "text-[13px] font-semibold",
                    active ? "text-brand-700" : "text-ink",
                  )}
                >
                  {d.label}
                </span>
                <span className="mt-0.5 text-[11px] text-ink-muted">
                  {d.hint}
                </span>
              </button>
            );
          })}
        </div>
      </SettingCard>

      <SettingCard
        icon={Sparkles}
        title="Movimento"
        description="Per chi preferisce un'interfaccia più calma."
      >
        <div className="flex items-center justify-between gap-4">
          <label htmlFor={reduceId} className="min-w-0">
            <span className="block text-[13px] font-medium text-ink">
              Riduci le animazioni
            </span>
            <span className="block text-[12px] text-ink-muted">
              Disattiva transizioni ed effetti non essenziali.
            </span>
          </label>
          <Switch
            id={reduceId}
            checked={prefs.reduceMotion}
            onChange={setReduceMotion}
          />
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border-soft pt-4">
          <label htmlFor={avvisiId} className="min-w-0">
            <span className="block text-[13px] font-medium text-ink">
              Avvisami quando lavora qualcun altro
            </span>
            <span className="block text-[12px] text-ink-muted">
              La board si aggiorna da sola in ogni caso: qui si sceglie solo
              se farsi interrompere da un avviso.
            </span>
          </label>
          <Switch
            id={avvisiId}
            checked={prefs.avvisiAltrui}
            onChange={setAvvisiAltrui}
          />
        </div>
      </SettingCard>
    </div>
  );
}
