"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  CalendarDays,
  ChartNoAxesColumn,
  Folder,
  LayoutDashboard,
  ListTodo,
  MailPlus,
  Plus,
  Repeat,
  Search,
  Settings,
  Shield,
  TreePalm,
  TriangleAlert,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

import { pop, scrim } from "@/lib/motion";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { StatusPip } from "@/components/status-pip";

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon?: LucideIcon;
  pip?: React.ReactNode;
  run: () => void;
}

/**
 * Command palette (⌘K / Ctrl+K): azioni, navigazione, task, progetti e
 * persone. Frecce + Invio, Esc chiude.
 */
export function CommandPalette() {
  const router = useRouter();
  const { tasks, projects, profiles, currentUser } = useAppStore();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery("");
        setActive(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = React.useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href, { scroll: false });
    },
    [router],
  );

  const items = React.useMemo<Item[]>(() => {
    const nav: Item[] = [
      { id: "new", group: "Azioni", label: "Nuovo task", icon: Plus, run: () => go("/tasks?task=new") },
      ...(currentUser.role === "admin"
        ? [
            {
              id: "plan",
              group: "Azioni",
              label: "Pianifica ricorrenti",
              hint: "attività standard del mese",
              icon: Repeat,
              run: () => go("/tasks?plan=1"),
            } satisfies Item,
          ]
        : []),
      {
        id: "leave-req",
        group: "Azioni",
        label: "Richiedi ferie o permesso",
        icon: TreePalm,
        run: () => go("/leave?request=1"),
      },
      {
        id: "capo",
        group: "Azioni",
        label: "Evoca il Capo",
        hint: "a tuo rischio",
        icon: Shield,
        run: () => {
          setOpen(false);
          window.dispatchEvent(new Event("capo:summon"));
        },
      },
      { id: "d", group: "Vai a", label: "Dashboard", icon: LayoutDashboard, run: () => go("/dashboard") },
      { id: "t", group: "Vai a", label: "Task", icon: ListTodo, run: () => go("/tasks") },
      { id: "c", group: "Vai a", label: "Calendario", icon: CalendarDays, run: () => go("/calendar") },
      { id: "p", group: "Vai a", label: "Progetti", icon: Folder, run: () => go("/projects") },
      { id: "pr", group: "Vai a", label: "Problemi", icon: TriangleAlert, run: () => go("/problems") },
      { id: "rq", group: "Vai a", label: "Richieste", icon: MailPlus, run: () => go("/requests") },
      { id: "lv", group: "Vai a", label: "Ferie & Permessi", icon: TreePalm, run: () => go("/leave") },
      { id: "r", group: "Vai a", label: "Report", icon: ChartNoAxesColumn, run: () => go("/reports") },
      { id: "te", group: "Vai a", label: "Team", icon: Users, run: () => go("/team") },
      { id: "s", group: "Vai a", label: "Impostazioni", icon: Settings, run: () => go("/settings/profile") },
    ];
    const taskItems: Item[] = tasks
      .filter((t) => t.status !== "done")
      .map((t) => ({
        id: `task-${t.id}`,
        group: "Task",
        label: t.title,
        pip: <StatusPip status={t.status} className="size-3.5" />,
        run: () => go(`/tasks?task=${t.id}`),
      }));
    const projectItems: Item[] = projects
      .filter((p) => !p.is_archived)
      .map((p) => ({
        id: `prj-${p.id}`,
        group: "Progetti",
        label: p.name,
        icon: Folder,
        run: () => go(`/projects/${p.id}`),
      }));
    const peopleItems: Item[] = profiles
      .filter((p) => p.is_active)
      .map((p) => ({
        id: `usr-${p.id}`,
        group: "Persone",
        label: p.full_name,
        hint: "board filtrata",
        icon: User,
        run: () => go(`/tasks?owner=${p.id}`),
      }));
    return [...nav, ...taskItems, ...projectItems, ...peopleItems];
  }, [tasks, projects, profiles, currentUser.role, go]);

  const q = query.trim().toLowerCase();
  const visible = q
    ? items
        .filter((i) => i.label.toLowerCase().includes(q))
        .sort(
          (a, b) =>
            Number(b.label.toLowerCase().startsWith(q)) -
            Number(a.label.toLowerCase().startsWith(q)),
        )
    : items.slice(0, 12);

  React.useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, visible.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      visible[active]?.run();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  let lastGroup = "";

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[70]">
          <motion.div
            variants={scrim}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute inset-0 bg-scrim"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <motion.div
            variants={pop}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-label="Comandi rapidi"
            className="glass-strong absolute inset-x-4 top-20 mx-auto max-w-[560px] overflow-hidden rounded-2xl sm:inset-x-auto sm:left-1/2 sm:w-[560px] sm:-translate-x-1/2"
          >
            <div className="flex items-center gap-2.5 border-b border-border-soft px-4">
              <Search aria-hidden className="size-4 text-ink-muted" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onInputKey}
                placeholder="Cerca task, progetti, persone… o un'azione"
                autoFocus
                className="h-12 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
              />
              <kbd className="rounded-xs border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
                Esc
              </kbd>
            </div>

            <div ref={listRef} className="max-h-[320px] overflow-y-auto p-1.5">
              {visible.length === 0 ? (
                <p className="px-3 py-6 text-center text-[13px] text-ink-muted">
                  Nessun risultato per «{query}».
                </p>
              ) : (
                visible.map((item, index) => {
                  const showGroup = item.group !== lastGroup;
                  lastGroup = item.group;
                  const Icon = item.icon;
                  return (
                    <React.Fragment key={item.id}>
                      {showGroup ? (
                        <p className="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
                          {item.group}
                        </p>
                      ) : null}
                      <button
                        data-index={index}
                        onClick={item.run}
                        onPointerEnter={() => setActive(index)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm outline-none",
                          index === active
                            ? "bg-brand-50 text-ink"
                            : "text-ink-secondary",
                        )}
                      >
                        {item.pip ??
                          (Icon ? (
                            <Icon
                              aria-hidden
                              className="size-4 text-ink-muted"
                              strokeWidth={1.75}
                            />
                          ) : null)}
                        <span className="min-w-0 flex-1 truncate">
                          {item.label}
                        </span>
                        {item.hint ? (
                          <span className="font-mono text-[10px] text-ink-faint">
                            {item.hint}
                          </span>
                        ) : null}
                      </button>
                    </React.Fragment>
                  );
                })
              )}
            </div>

            <footer className="flex items-center gap-3 border-t border-border-soft px-4 py-2">
              <p className="font-mono text-[10px] text-ink-muted">
                ↑↓ naviga · Invio apre · ⌘K chiude
              </p>
            </footer>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
