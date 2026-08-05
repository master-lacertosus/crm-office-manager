"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  ChevronDown,
  Compass,
  LogOut,
  MailPlus,
  Settings,
  UserRound,
  X,
} from "lucide-react";

import { drawer, pop, scrim } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
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
import { useToast } from "@/components/toaster";
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
  { href: "/reports", label: "Report", icon: IconReports },
  { href: "/team", label: "Team", icon: IconTeam },
  { href: "/settings/profile", label: "Impostazioni", icon: IconSettings },
];

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
  const { requests, leaves, currentUser } = useAppStore();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;

  // In attesa di decisione: contatore per i responsabili.
  const badge =
    currentUser.role !== "admin"
      ? 0
      : item.href === "/requests"
        ? requests.filter((r) => r.status === "pending").length
        : item.href === "/leave"
          ? leaves.filter((l) => l.status === "pending").length
          : 0;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-9.5 items-center gap-3 rounded-lg px-2.5 text-sm outline-none transition-all",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "btn-glow font-semibold text-white"
          : "text-ink-secondary hover:bg-white/70 hover:text-ink",
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
          </span>
          {/* puntino sulla rail compatta (solo icone) */}
          {labelVisibility === "lg" ? (
            <span
              aria-hidden
              className="absolute top-1.5 right-1.5 hidden size-2 rounded-full bg-brand-500 ring-2 ring-white md:block lg:hidden"
            />
          ) : null}
        </>
      ) : null}
    </Link>
  );
}

function UserFooter({ compact = false }: { compact?: boolean }) {
  const { currentUser, profiles, switchUser } = useAppStore();
  const toast = useToast();
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
      <AnimatePresence>
        {open ? (
          <motion.div
            variants={pop}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="menu"
            aria-label="Menu account"
            className="absolute bottom-full left-2.5 z-50 mb-2 w-60 origin-bottom-left rounded-2xl border border-border bg-white p-1.5 shadow-[0_16px_48px_rgb(15_23_42/0.16)]"
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

            <p className="px-2.5 pt-2.5 pb-1 text-[10px] font-bold tracking-[0.06em] text-ink-muted uppercase">
              Vedi come (demo)
            </p>
            {profiles
              .filter((p) => p.is_active)
              .map((p) => (
                <button
                  key={p.id}
                  role="menuitem"
                  onClick={() => {
                    if (p.id !== currentUser.id) {
                      switchUser(p.id);
                      toast(`Ora vedi l'app come ${p.full_name.split(" ")[0]}`);
                    }
                    setOpen(false);
                  }}
                  className={item}
                >
                  <AvatarInitials
                    name={p.full_name}
                    src={p.avatar_url}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {p.full_name}
                    <span className="ml-1 text-[11px] font-normal text-ink-muted">
                      {p.role === "admin" ? "· admin" : ""}
                    </span>
                  </span>
                  {p.id === currentUser.id ? (
                    <Check className="size-4 text-brand-600" />
                  ) : null}
                </button>
              ))}

            <div className="my-1.5 h-px bg-border-soft" />
            <Link href="/login" onClick={() => setOpen(false)} className={item}>
              <LogOut className="size-4 text-ink-muted" strokeWidth={1.75} />
              Esci
            </Link>
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
  return (
    <aside className="glass-chrome sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-white/60 md:flex md:w-16 lg:top-4 lg:h-[calc(100dvh-2rem)] lg:w-60 print:hidden">
      <Wordmark compact />
      <nav
        aria-label="Navigazione principale"
        className="flex flex-1 flex-col gap-0.5 px-2.5 pt-2"
      >
        {NAV_ITEMS.map((item) => (
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
              {NAV_ITEMS.map((item) => (
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
