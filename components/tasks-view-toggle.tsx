"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Archive, Columns3, List } from "lucide-react";

import { cn } from "@/lib/utils";

const VIEWS = [
  { key: "board", label: "Board", icon: Columns3 },
  { key: "list", label: "Elenco", icon: List },
  { key: "archive", label: "Archivio", icon: Archive },
] as const;

/** Toggle Board/Elenco/Archivio sulla pagina Task, preservando i filtri. */
export function TasksViewToggle() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get("view");
  const view = raw === "list" || raw === "archive" ? raw : "board";

  const hrefFor = (target: (typeof VIEWS)[number]["key"]) => {
    const params = new URLSearchParams(searchParams);
    if (target === "board") {
      params.delete("view");
    } else {
      params.set("view", target);
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const base =
    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="flex gap-0.5 rounded-xl border border-border bg-white p-0.5 shadow-xs">
      {VIEWS.map(({ key, label, icon: Icon }) => (
        <Link
          key={key}
          href={hrefFor(key)}
          className={cn(
            base,
            view === key
              ? "bg-brand-50 text-brand-700"
              : "text-ink-secondary hover:text-ink",
          )}
        >
          <Icon aria-hidden className="size-3.5" />
          <span className={cn(key === "archive" && "hidden lg:inline")}>
            {label}
          </span>
        </Link>
      ))}
    </div>
  );
}
