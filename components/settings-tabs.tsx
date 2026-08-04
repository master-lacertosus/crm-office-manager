"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/settings/profile", label: "Profilo" },
  { href: "/settings/appearance", label: "Aspetto" },
  { href: "/settings/workspace", label: "Workspace" },
  { href: "/settings/about", label: "Info" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Sezioni impostazioni"
      className="flex gap-1 overflow-x-auto border-b border-border-soft px-4 sm:px-6"
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-2.5 py-2 text-sm outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
              active
                ? "border-primary font-medium text-ink"
                : "border-transparent text-ink-secondary hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
