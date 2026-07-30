"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  CalendarDays,
  ChartNoAxesColumn,
  Folder,
  LayoutDashboard,
  ListTodo,
  Settings,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import { drawer, scrim } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { AvatarInitials } from "@/components/avatar-initials";
import { Button } from "@/components/ui/button";

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Task", icon: ListTodo },
  { href: "/calendar", label: "Calendario", icon: CalendarDays },
  { href: "/projects", label: "Progetti", icon: Folder },
  { href: "/reports", label: "Report", icon: ChartNoAxesColumn },
  { href: "/team", label: "Team", icon: Users },
  { href: "/settings/profile", label: "Impostazioni", icon: Settings },
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
  const active = isActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "font-medium text-ink"
          : "text-ink-secondary hover:bg-accent hover:text-ink",
        labelVisibility === "lg" && "md:justify-center lg:justify-start",
      )}
    >
      {/* rail arancio: l'unico arancio persistente a schermo */}
      {active ? (
        <span
          aria-hidden
          className="absolute top-1.5 bottom-1.5 -left-2.5 w-0.5 rounded-full bg-primary"
        />
      ) : null}
      <Icon aria-hidden className="size-[18px] shrink-0" strokeWidth={1.75} />
      <span
        className={cn(labelVisibility === "lg" && "md:hidden lg:inline")}
      >
        {item.label}
      </span>
    </Link>
  );
}

function UserFooter({ compact = false }: { compact?: boolean }) {
  const { currentUser } = useAppStore();
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 border-t border-border-soft px-3 py-3",
        compact && "md:justify-center lg:justify-start",
      )}
    >
      <AvatarInitials name={currentUser.full_name} />
      <div className={cn("min-w-0", compact && "md:hidden lg:block")}>
        <p className="truncate text-[13px] font-medium text-ink">
          {currentUser.full_name}
        </p>
        <p className="text-xs text-ink-muted">
          {currentUser.role === "admin" ? "Admin" : "Member"}
        </p>
      </div>
    </div>
  );
}

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex h-14 items-center gap-2.5 px-3",
        compact && "md:justify-center lg:justify-start",
      )}
    >
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground"
      >
        L
      </span>
      <div className={cn("leading-none", compact && "md:hidden lg:block")}>
        <p className="text-[13px] font-semibold tracking-tight text-ink">
          LACERTOSUS
        </p>
        <p className="mt-0.5 font-mono text-[10px] text-ink-muted">Office OS</p>
      </div>
    </div>
  );
}

/** Sidebar fissa: 240px da lg, rail icone 64px su md, assente sotto md. */
export function Sidebar() {
  return (
    <aside className="glass sticky top-0 hidden h-dvh shrink-0 flex-col !border-t-0 !border-r-white/60 !border-b-0 !border-l-0 md:flex md:w-16 lg:w-60">
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
