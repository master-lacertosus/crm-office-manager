"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronDown,
  Compass,
  LogOut,
  Clock4,
  MailPlus,
  Settings,
  UserRound,
  X,
} from "lucide-react";

import { drawer, pop, scrim } from "@/lib/motion";
import { cn } from "@/lib/utils";
import {
  conFiltri,
  ricorda,
  sottoscrivi,
  versione,
  versioneSulServer,
} from "@/lib/memoria-filtri";
import { SEZIONI_ZEN, useZen } from "@/components/shell/modalita-zen";
import { useAppStore } from "@/lib/store";
import { signOut } from "@/lib/supabase/auth";
import { AvatarInitials } from "@/components/avatar-initials";
import {
  IconCalendar,
  IconDashboard,
  IconLeave,
  IconProblems,
  IconProjects,
  IconReports,
  IconSettings,
  IconTasks,
  IconTeam,
} from "@/components/shell/nav-icons";
import { tastoPer } from "@/components/shell/scorciatoie";
import { SoloMie } from "@/components/shell/solo-mie";
import { Button } from "@/components/ui/button";

const NAV_ITEMS: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}[] = [
  { href: "/dashboard", label: "Dashboard", icon: IconDashboard },
  { href: "/tasks", label: "Task", icon: IconTasks },
  { href: "/calendar", label: "Calendario", icon: IconCalendar },
  { href: "/projects", label: "Progetti", icon: IconProjects },
  { href: "/problems", label: "Problemi", icon: IconProblems },
  { href: "/requests", label: "Richieste", icon: MailPlus },
  { href: "/leave", label: "Ferie", icon: IconLeave },
  { href: "/timbrature", label: "Le mie ore", icon: Clock4 },
  { href: "/reports", label: "Report", icon: IconReports },
  { href: "/team", label: "Team", icon: IconTeam },
  { href: "/settings/profile", label: "Impostazioni", icon: IconSettings },
];

/** Le voci da mostrare: tutte, o le tre di Zen. */
function vociVisibili(zen: boolean): typeof NAV_ITEMS {
  return zen
    ? NAV_ITEMS.filter((i) => SEZIONI_ZEN.includes(i.href))
    : NAV_ITEMS;
}

function isActive(pathname: string, href: string): boolean {
  const root = "/" + href.split("/")[1];
  return pathname === href || pathname.startsWith(root + "/") || pathname === root;
}

function NavLink({
  item,
  labelVisibility = "lg",
  onNavigate,
}: {
  item: (typeof NAV_ITEMS)[number];
  /** "lg": etichetta solo da lg in su (rail su md) · "always": sempre (drawer) */
  labelVisibility?: "lg" | "always";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { requests, leaves, tasks, currentUser, nuoveAssegnazioni } =
    useAppStore();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;

  /* Il link porta con sé gli ultimi filtri della sezione. Sulla sezione in
     cui si è già, l'indirizzo resta nudo: cliccare «Task» stando nei task
     è il modo naturale di dire «togli i filtri».

     L'iscrizione alla memoria non è un vezzo: i filtri vengono annotati in
     un effetto, cioè DOPO che questa barra si è già disegnata. Senza, il
     link restava indietro di un passo — uscendo dai Task con la scorciatoia
     P, «Task» tornava nudo per tutta la visita ai Progetti, e la memoria
     sembrava rotta pur avendo annotato tutto. La terza istantanea
     (`versioneSulServer`) tiene uguale il primo disegno di server e browser,
     altrimenti l'idratazione troverebbe due indirizzi diversi. */
  React.useSyncExternalStore(sottoscrivi, versione, versioneSulServer);
  const href = active ? item.href : conFiltri(item.href);

  /* I filtri si annotano al momento del clic, leggendoli dalla barra degli
     indirizzi.

     La via ovvia era `useSearchParams()`, ed è sbagliata qui: la barra
     laterale sta nel layout, quindi vive dentro OGNI pagina, e quel hook
     obbliga tutta la pagina a rinunciare alla generazione statica se non è
     avvolto in un <Suspense>. Il risultato è stato una build rotta su
     /calendar — non un dettaglio di stile, la pagina non si generava più.

     Qui non serve reagire ai cambiamenti: basta sapere dove si era un
     istante prima di andarsene, e `window.location` lo dice senza costringere
     niente a diventare dinamico. */
  const vado = () => {
    ricorda(window.location.pathname, window.location.search);
    onNavigate?.();
  };

  /* Contatori sulle voci. Due nature diverse, di proposito:
       - Richieste e Ferie: cose in attesa di una DECISIONE, quindi solo per
         chi le decide.
       - Task: quanti ne ho aperti IO in questo momento. Non il totale del
         workspace, che sarebbe un numero grande e inerte; nemmeno tutti i
         miei, che comprende il fondo del cassetto. Quelli su cui sto
         lavorando ora — il numero a cui si risponde «e adesso?».

     Su Task il numero dice SEMPRE la stessa cosa: quante ne ho in corso.
     Il lavoro appena assegnato e non ancora visto (M14) non entra in quel
     numero — diventa un pallino accanto. Sono due domande diverse («quanto
     ho per le mani» / «mi è arrivato qualcosa»), e un contatore che cambia
     significato da solo è peggio di due segni distinti: chi legge «3» deve
     sapere di cosa, senza ricordarsi una regola. */
  const inCorso = tasks.filter(
    (t) =>
      t.owner_id === currentUser.id &&
      t.status === "in_progress" &&
      !t.archived_at,
  ).length;
  const nuove = item.href === "/tasks" ? nuoveAssegnazioni.length : 0;

  const badge =
    item.href === "/tasks"
      ? inCorso
      : currentUser.role !== "admin"
        ? 0
        : item.href === "/requests"
          ? requests.filter((r) => r.status === "pending").length
          : item.href === "/leave"
            ? leaves.filter((l) => l.status === "pending").length
            : 0;

  const badgeTitolo =
    item.href !== "/tasks" || badge === 0
      ? undefined
      : `${badge} task in corso`;

  /* La lettera che porta a questa voce, se ce n'è una. */
  const scorciatoia = tastoPer(item.href);

  const titoloVoce = [
    badgeTitolo,
    nuove > 0
      ? nuove === 1
        ? "1 nuova task assegnata"
        : `${nuove} nuove task assegnate`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={href}
      onClick={vado}
      aria-current={active ? "page" : undefined}
      title={titoloVoce || undefined}
      className={cn(
        "relative flex h-9.5 items-center gap-3 rounded-lg px-2.5 text-sm outline-none transition-all",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "btn-glow font-semibold text-white"
          : "text-ink-secondary hover:bg-velo/70 hover:text-ink",
        labelVisibility === "lg" && "md:justify-center lg:justify-start",
      )}
    >
      <Icon
        aria-hidden
        className="size-[18px] shrink-0"
        strokeWidth={active ? 2 : 1.75}
      />
      <span
        className={cn(labelVisibility === "lg" && "md:hidden lg:inline")}
      >
        {item.label}
      </span>
      {/* La lettera che porta qui. Le scorciatoie esistevano già e
          funzionavano; l'unico posto che le elencava era Impostazioni › Info,
          dove nessuno va a cercare la tastiera. Mostrarle dove si clicca è il
          modo più diretto perché si imparino: si legge la lettera mentre si
          fa il gesto lento, e la volta dopo si usa quella.
          Sparisce quando c'è un contatore da mostrare: il numero dice una
          cosa che cambia, la lettera una che non cambia mai — e fra le due,
          in due caratteri di spazio, vince quella che porta informazione. */}
      {scorciatoia && badge === 0 && nuove === 0 ? (
        <kbd
          aria-hidden
          className={cn(
            "ml-auto rounded border border-border-soft px-1 font-mono text-[10px] leading-4 font-semibold text-ink-faint",
            active && "border-white/30 text-white/70",
            labelVisibility === "lg" && "md:hidden lg:inline-block",
          )}
        >
          {scorciatoia}
        </kbd>
      ) : null}
      {badge > 0 ? (
        <>
          {/* pill col conteggio dove l'etichetta è visibile */}
          <span
            className={cn(
              "ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 font-mono text-[11px] font-semibold",
              active ? "bg-white/25 text-white" : "bg-brand-500 text-white",
              labelVisibility === "lg" && "md:hidden lg:inline-flex",
            )}
          >
            {badge}
            {/* Da solo il numero si legge «Task 3», che non dice 3 di cosa. */}
            {badgeTitolo ? (
              <span className="sr-only"> — {badgeTitolo}</span>
            ) : null}
          </span>
          {/* puntino sulla rail compatta (solo icone) */}
          {labelVisibility === "lg" && nuove === 0 ? (
            <span
              aria-hidden
              className="absolute top-1.5 right-1.5 hidden size-2 rounded-full bg-brand-500 ring-2 ring-white md:block lg:hidden"
            />
          ) : null}
        </>
      ) : null}

      {/* Il lavoro appena arrivato: un pallino, non un numero — il numero
          qui accanto ha già un significato suo. Si vede a ogni larghezza,
          anche sulla rail stretta dove l'etichetta sparisce: e' la cosa che
          si e' andati a cercare aprendo l'app. Il conteggio esatto sta nella
          striscia in cima e nella campanella. */}
      {nuove > 0 ? (
        <span
          aria-hidden
          title={`${nuove} ${nuove === 1 ? "nuova task assegnata" : "nuove task assegnate"}`}
          className={cn(
            "absolute top-1.5 size-2 rounded-full bg-brand-500 ring-2 ring-white",
            /* Sulla rail compatta e' l'unico segno: va sull'icona. Con
               l'etichetta visibile si sposta al bordo, per non pestare la
               pastiglia del conteggio. */
            labelVisibility === "lg"
              ? "right-1.5 md:right-2.5 lg:right-1.5"
              : "right-1.5",
          )}
        />
      ) : null}
    </Link>
  );
}

function UserFooter({ compact = false }: { compact?: boolean }) {
  const { currentUser } = useAppStore();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item =
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-ink outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div ref={rootRef} className="relative px-2.5 pb-3">
      {/* Sopra il profilo: è lì che si guarda quando ci si chiede «e io
          cosa devo fare?». */}
      <SoloMie compact={compact} />
      <AnimatePresence>
        {open ? (
          <motion.div
            variants={pop}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="menu"
            aria-label="Menu account"
            className="absolute bottom-full left-2.5 z-50 mb-2 w-60 origin-bottom-left rounded-2xl border border-border bg-card p-1.5 shadow-[0_16px_48px_rgb(15_23_42/0.16)]"
          >
            <Link href="/settings/profile" onClick={() => setOpen(false)} className={item}>
              <UserRound className="size-4 text-ink-muted" strokeWidth={1.75} />
              Il mio profilo
            </Link>
            <Link href="/settings/workspace" onClick={() => setOpen(false)} className={item}>
              <Settings className="size-4 text-ink-muted" strokeWidth={1.75} />
              Impostazioni workspace
            </Link>
            <Link href="/dashboard?tour=1" onClick={() => setOpen(false)} className={item}>
              <Compass className="size-4 text-ink-muted" strokeWidth={1.75} />
              Rivedi il tour
            </Link>

            {/* «Vedi come…» è sparito con l'autenticazione reale: era un
                comodo trucco da demo, ma su sessioni vere sarebbe
                impersonare un collega — e la RLS non lo consentirebbe
                comunque, perché le policy leggono auth.uid(), non lo stato
                del browser. */}

            <div className="my-1.5 h-px bg-border-soft" />
            {/* Uscita vera: un link a /login non basta più, perché il proxy
                rimanda alla dashboard chi ha ancora la sessione. Serve
                cancellare i cookie lato server, cioè una Server Action. */}
            <form action={signOut}>
              <button type="submit" role="menuitem" className={item}>
                <LogOut className="size-4 text-ink-muted" strokeWidth={1.75} />
                Esci
              </button>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "glass-chip flex w-full items-center gap-2.5 rounded-2xl px-2.5 py-2 outline-none transition-all hover:-translate-y-px hover:border-input focus-visible:ring-2 focus-visible:ring-ring",
          compact && "md:justify-center lg:justify-start",
        )}
      >
        <span className="relative shrink-0">
          <AvatarInitials
            name={currentUser.full_name}
            src={currentUser.avatar_url}
            className="bg-brand-100 text-brand-700"
          />
          <span
            aria-hidden
            className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full bg-success ring-2 ring-white"
          />
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 text-left",
            compact && "md:hidden lg:block",
          )}
        >
          <span className="block truncate text-[13px] font-semibold text-ink">
            {currentUser.full_name}
          </span>
          <span className="block truncate text-xs text-ink-muted">
            {currentUser.title ??
              (currentUser.role === "admin" ? "Admin" : "Member")}
          </span>
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-ink-faint transition-transform",
            open && "rotate-180",
            compact && "md:hidden lg:block",
          )}
        />
      </button>
    </div>
  );
}

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex h-14 items-center px-3.5",
        compact && "md:justify-center lg:justify-start",
      )}
    >
      {/* mark compatto per la rail ridotta */}
      <span
        aria-hidden
        className={cn(
          "hidden size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),inset_0_0_0_1px_rgb(255_255_255/0.12)]",
          compact && "md:flex lg:hidden",
        )}
      >
        L
      </span>
      {/* wordmark ufficiale */}
      <div className={cn("leading-none", compact && "md:hidden lg:block")}>
        <Image
          src="/lacertosus-logo.svg"
          alt="Lacertosus"
          width={850}
          height={96}
          priority
          unoptimized
          className="h-[13px] w-auto"
        />
        <p className="mt-1.5 font-mono text-[10px] text-ink-muted">
          Office OS
        </p>
      </div>
    </div>
  );
}

/** Sidebar fissa: 240px da lg, rail icone 64px su md, assente sotto md. */
export function Sidebar() {
  const [zen] = useZen();
  const voci = vociVisibili(zen);
  return (
    <aside className="glass-chrome sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-velo/60 md:flex md:w-16 lg:top-4 lg:h-[calc(100dvh-2rem)] lg:w-60 print:hidden">
      <Wordmark compact />
      <nav
        aria-label="Navigazione principale"
        className="flex flex-1 flex-col gap-0.5 px-2.5 pt-2"
      >
        {voci.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>
      <UserFooter compact />
    </aside>
  );
}

/** Drawer di navigazione mobile (<md), con scrim e chiusura su Esc. */
export function MobileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [zenMobile] = useZen();
  const vociMobile = vociVisibili(zenMobile);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <motion.div
            variants={scrim}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute inset-0 bg-scrim"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            variants={drawer}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-label="Navigazione"
            className="glass-strong absolute inset-y-0 left-0 flex w-64 flex-col"
          >
            <div className="flex items-center justify-between pr-2">
              <Wordmark />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                aria-label="Chiudi navigazione"
                autoFocus
              >
                <X />
              </Button>
            </div>
            <nav
              aria-label="Navigazione principale"
              className="flex flex-1 flex-col gap-0.5 px-2.5 pt-2"
            >
              {vociMobile.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  labelVisibility="always"
                  onNavigate={onClose}
                />
              ))}
            </nav>
            <UserFooter />
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
