import type { Metadata } from "next";
import { LoaderCircle, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { StatusLabel, TASK_STATUSES, type TaskStatus } from "@/components/status-pip";
import { MotionDemo } from "@/components/styleguide/motion-demo";

export const metadata: Metadata = {
  title: "Design system",
};

function Section({
  overline,
  title,
  children,
}: {
  overline: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
          {overline}
        </p>
        <h2 className="mt-1 text-[17px]/6 font-semibold tracking-[-0.008em] text-ink">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function Swatch({
  name,
  value,
  className,
  border = false,
}: {
  name: string;
  value: string;
  className: string;
  border?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`size-9 shrink-0 rounded-lg ${border ? "border border-border" : ""} ${className}`}
      />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-ink">{name}</p>
        <p className="font-mono text-xs text-ink-muted">{value}</p>
      </div>
    </div>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-card p-4 shadow-xs ${className}`}
    >
      {children}
    </div>
  );
}

export default function StyleguidePage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:py-12">
      {/* Intestazione */}
      <header className="mb-12">
        <p className="font-mono text-xs text-ink-muted">
          docs/design-system.md · light only · v1
        </p>
        <h1 className="mt-2 text-[28px]/[34px] font-semibold tracking-[-0.015em] text-ink">
          Fondamenta del design system
        </h1>
        <p className="mt-2 max-w-xl text-sm/5 text-ink-secondary">
          Bianco da sala d&rsquo;esposizione, grafite come l&rsquo;attrezzatura,
          arancio Lacertosus solo dove si agisce. Questa pagina è la verifica
          visiva dei token: se un componente non deriva da qui, non esiste.
        </p>
      </header>

      <div className="space-y-12">
        {/* Colori */}
        <Section overline="Token" title="Colore">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <p className="mb-3 text-[13px] font-medium text-ink-secondary">
                Superfici e grafite
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Swatch name="canvas" value="#F7F7F8" className="bg-canvas" border />
                <Swatch name="surface / card" value="#FFFFFF" className="bg-card" border />
                <Swatch name="ink" value="#212327" className="bg-ink" />
                <Swatch name="ink-secondary" value="#5A5E66" className="bg-ink-secondary" />
                <Swatch name="ink-muted" value="#696E76" className="bg-ink-muted" />
                <Swatch name="border" value="#E3E5E8" className="bg-border" border />
              </div>
            </Card>
            <Card>
              <p className="mb-3 text-[13px] font-medium text-ink-secondary">
                Arancio Lacertosus — dal CSS di lacertosus.com
              </p>
              <div className="mb-3 flex h-9 overflow-hidden rounded-lg">
                <span className="flex-1 bg-brand-50" />
                <span className="flex-1 bg-brand-100" />
                <span className="flex-1 bg-brand-200" />
                <span className="flex-1 bg-brand-300" />
                <span className="flex-1 bg-brand-400" />
                <span className="flex-1 bg-brand-500" />
                <span className="flex-1 bg-brand-600" />
                <span className="flex-1 bg-brand-700" />
                <span className="flex-1 bg-brand-800" />
                <span className="flex-1 bg-brand-900" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Swatch name="brand-500 · primario" value="#F09226" className="bg-brand-500" />
                <Swatch name="brand-600 · ring" value="#D97706" className="bg-brand-600" />
                <Swatch name="brand-700 · testo" value="#B45309" className="bg-brand-700" />
                <Swatch name="selected" value="#FDF6EC" className="bg-selected" border />
              </div>
            </Card>
          </div>
          <Card>
            <p className="mb-3 text-[13px] font-medium text-ink-secondary">
              Semantici — soft per gli sfondi, text per il testo su bianco
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Swatch name="success" value="#16A34A" className="bg-success" />
              <Swatch name="danger" value="#D92D20" className="bg-destructive" />
              <Swatch name="warning" value="#F5C33B" className="bg-warning" />
              <Swatch name="info" value="#2563EB" className="bg-info" />
            </div>
          </Card>
        </Section>

        {/* Tipografia */}
        <Section overline="Token" title="Tipografia — Archivo + IBM Plex Mono">
          <Card className="space-y-5">
            <div>
              <p className="text-[28px]/[34px] font-semibold tracking-[-0.015em] text-ink">
                Campagna lancio OKTA RIG 3.5
              </p>
              <p className="mt-0.5 font-mono text-xs text-ink-muted">
                display · 28/34 · 600 · −0.015em
              </p>
            </div>
            <div>
              <p className="text-[22px]/7 font-semibold tracking-[-0.012em] text-ink">
                Task in revisione
              </p>
              <p className="mt-0.5 font-mono text-xs text-ink-muted">
                title-page · 22/28 · 600
              </p>
            </div>
            <div>
              <p className="text-[17px]/6 font-semibold tracking-[-0.008em] text-ink">
                Newsletter di settembre
              </p>
              <p className="mt-0.5 font-mono text-xs text-ink-muted">
                title-section · 17/24 · 600
              </p>
            </div>
            <div>
              <p className="text-sm/5 font-medium text-ink">
                Aggiornare le schede prodotto dei power rack PRO
              </p>
              <p className="mt-0.5 font-mono text-xs text-ink-muted">
                title-item · 14/20 · 500
              </p>
            </div>
            <div>
              <p className="max-w-lg text-sm/5 text-ink-secondary">
                Il set fotografico per il configuratore va consegnato entro
                venerdì: still life su fondo bianco, dettaglio della zigrinatura,
                tre angolazioni per variante colore.
              </p>
              <p className="mt-0.5 font-mono text-xs text-ink-muted">
                body · 14/20 · 400 · ink-secondary
              </p>
            </div>
            <div>
              <p className="text-[13px]/[18px] text-ink-muted">
                Creato da Francesca · aggiornato 2 ore fa
              </p>
              <p className="mt-0.5 font-mono text-xs text-ink-muted">
                meta · 13/18 · 400 · ink-muted
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
                In revisione · 4
              </p>
              <p className="mt-0.5 font-mono text-xs text-ink-muted">
                overline · 11/14 · 600 · +0.06em
              </p>
            </div>
            <Separator />
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <span className="font-mono text-[13px] text-ink">30 lug 2026</span>
              <span className="font-mono text-[13px] text-ink">#LAC-142</span>
              <span className="font-mono text-[13px] text-ink">12 / 18 task</span>
              <kbd className="rounded-xs border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-ink-secondary">
                Esc
              </kbd>
              <p className="font-mono text-xs text-ink-muted">
                dati sempre in mono — la voce «registro di officina»
              </p>
            </div>
          </Card>
        </Section>

        {/* Tacca di stato */}
        <Section overline="Firma" title="La tacca di stato">
          <Card>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              {(Object.keys(TASK_STATUSES) as TaskStatus[]).map((s) => (
                <StatusLabel key={s} status={s} />
              ))}
            </div>
            <p className="mt-4 max-w-2xl text-[13px] text-ink-muted">
              La ghiera si riempie con l&rsquo;avanzare del lavoro. Flusso
              monocromatico; l&rsquo;arancio marca il solo stato che chiede
              attenzione, il verde chiude. La forma cambia a ogni stato: il
              colore non è mai l&rsquo;unico canale.
            </p>
          </Card>
        </Section>

        {/* Bottoni */}
        <Section overline="Componenti" title="Bottoni — stati canonici">
          <Card className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Button>
                <Plus data-icon="inline-start" />
                Nuovo task
              </Button>
              <Button variant="outline">Filtra</Button>
              <Button variant="secondary">Duplica</Button>
              <Button variant="ghost">Annulla</Button>
              <Button variant="destructive">Elimina task</Button>
              <Button variant="link">Vedi progetto</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Salva</Button>
              <Button size="default">Salva modifiche</Button>
              <Button size="lg">Crea progetto</Button>
              <Button size="icon" aria-label="Nuovo task">
                <Plus />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled>Salva modifiche</Button>
              <Button aria-busy>
                <LoaderCircle className="animate-spin" />
                Salvataggio…
              </Button>
              <p className="text-[13px] text-ink-muted">
                disabled 45% · loading: lo spinner sostituisce l&rsquo;icona,
                mai il testo
              </p>
            </div>
            <p className="text-[13px] text-ink-muted">
              Un solo bottone primario per vista. Focus: ring 2px brand-600 con
              offset (Tab per verificarlo). Pressione: 1px verso il basso, come
              un pulsante fisico.
            </p>
          </Card>
        </Section>

        {/* Form */}
        <Section overline="Componenti" title="Form — i quattro stati obbligatori">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sg-title">Titolo del task</Label>
                <Input
                  id="sg-title"
                  placeholder="Es. Shooting still life OKTA RIG"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sg-desc">Descrizione</Label>
                <Textarea
                  id="sg-desc"
                  placeholder="Cosa serve per considerarlo fatto?"
                />
              </div>
            </Card>
            <Card className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sg-due">Scadenza</Label>
                <Input
                  id="sg-due"
                  defaultValue="30/02/2026"
                  aria-invalid
                  aria-describedby="sg-due-error"
                />
                <p id="sg-due-error" className="text-[13px] text-danger-text">
                  Questa data non esiste: usa il formato gg/mm/aaaa.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sg-owner">Responsabile</Label>
                <Input id="sg-owner" defaultValue="Francesca" disabled />
                <p className="text-[13px] text-ink-muted">
                  Solo un admin può riassegnare un task chiuso.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2">
                <span className="size-1.5 rounded-full bg-success" />
                <p className="text-[13px] font-medium text-success-text">
                  Salvato
                </p>
              </div>
            </Card>
          </div>
        </Section>

        {/* Badge */}
        <Section overline="Componenti" title="Badge — neutri di default">
          <Card className="flex flex-wrap items-center gap-2">
            <Badge>E-commerce</Badge>
            <Badge variant="outline">Q3 2026</Badge>
            <Badge variant="brand">In evidenza</Badge>
            <Badge variant="success">Consegnato</Badge>
            <Badge variant="warning">In scadenza</Badge>
            <Badge variant="danger">Bloccante</Badge>
            <Badge className="font-mono">LAC-142</Badge>
          </Card>
        </Section>

        {/* Elevazione */}
        <Section overline="Token" title="Elevazione — prima i bordi, poi le ombre">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <p className="text-[13px] font-medium text-ink">shadow-xs</p>
              <p className="mt-1 text-[13px] text-ink-muted">Card a riposo</p>
            </div>
            <div className="rounded-xl border border-border-soft bg-card p-4 shadow-sm">
              <p className="text-[13px] font-medium text-ink">shadow-sm</p>
              <p className="mt-1 text-[13px] text-ink-muted">
                Menu, popover, card trascinata
              </p>
            </div>
            <div className="rounded-xl bg-card p-4 shadow-md">
              <p className="text-[13px] font-medium text-ink">shadow-md</p>
              <p className="mt-1 text-[13px] text-ink-muted">
                Pannello laterale, dialoghi
              </p>
            </div>
          </div>
        </Section>

        {/* Raggi e spaziatura */}
        <Section overline="Token" title="Raggi e spaziatura — griglia 4px">
          <Card>
            <div className="flex flex-wrap items-end gap-6">
              <div className="space-y-1.5">
                <span className="block size-12 rounded-xs border border-border bg-muted" />
                <p className="font-mono text-xs text-ink-muted">xs · 4</p>
              </div>
              <div className="space-y-1.5">
                <span className="block size-12 rounded-sm border border-border bg-muted" />
                <p className="font-mono text-xs text-ink-muted">sm · 6</p>
              </div>
              <div className="space-y-1.5">
                <span className="block size-12 rounded-lg border border-border bg-muted" />
                <p className="font-mono text-xs text-ink-muted">md · 8</p>
              </div>
              <div className="space-y-1.5">
                <span className="block size-12 rounded-xl border border-border bg-muted" />
                <p className="font-mono text-xs text-ink-muted">xl · 12</p>
              </div>
              <div className="space-y-1.5">
                <span className="block size-12 rounded-full border border-border bg-muted" />
                <p className="font-mono text-xs text-ink-muted">full</p>
              </div>
              <Separator className="hidden h-12 sm:block" orientation="vertical" />
              <div className="flex items-end gap-2">
                {[1, 2, 3, 4, 5, 6, 8, 10].map((step) => (
                  <div key={step} className="space-y-1.5">
                    <span
                      className="block w-5 bg-brand-200"
                      style={{ height: step * 4 }}
                    />
                    <p className="font-mono text-[10px] text-ink-muted">
                      {step * 4}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-4 text-[13px] text-ink-muted">
              Controlli: sm 32 · md 36 · lg 40. Padding: card 16 · pannello 24
              · pagina 24 (16 su mobile).
            </p>
          </Card>
        </Section>

        {/* Motion */}
        <Section overline="Token" title="Motion — il movimento spiega, non decora">
          <Card>
            <MotionDemo />
          </Card>
        </Section>
      </div>

      <footer className="mt-16 border-t border-border-soft pt-4">
        <p className="font-mono text-xs text-ink-muted">
          Lacertosus Office OS · fondamenta · specifica completa in
          docs/design-system.md
        </p>
      </footer>
    </main>
  );
}
