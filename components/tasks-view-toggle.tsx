"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Columns3, List } from "lucide-react";

import { cn } from "@/lib/utils";

/** Toggle Board/Elenco sulla pagina Task, preservando filtri e pannello. */
export function TasksViewToggle() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "list" ? "list" : "board";

  const hrefFor = (target: "board" | "list") => {
    const params = new URLSearchParams(searchParams);
    if (target === "list") {
      params.set("view", "list");
    } else {
      params.delete("view");
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const base =
    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="flex gap-0.5 rounded-xl border border-border bg-white p-0.5 shadow-xs">
      <Link
        href={hrefFor("board")}
        className={cn(
          base,
          view === "board"
            ? "bg-brand-50 text-brand-700"
            : "text-ink-secondary hover:text-ink",
        )}
      >
        <Columns3 aria-hidden className="size-3.5" />
        Board
      </Link>
      <Link
        href={hrefFor("list")}
        className={cn(
          base,
          view === "list"
            ? "bg-brand-50 text-brand-700"
            : "text-ink-secondary hover:text-ink",
        )}
      >
        <List aria-hidden className="size-3.5" />
        Elenco
      </Link>
    </div>
  );
}
