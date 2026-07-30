"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Azione primaria: apre il pannello in modalità creazione (?task=new). */
export function NewTaskButton() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = new URLSearchParams(searchParams);
  params.set("task", "new");

  return (
    <Button asChild>
      <Link href={`${pathname}?${params.toString()}`} scroll={false}>
        <Plus data-icon="inline-start" />
        <span className="hidden sm:inline">Nuovo task</span>
        <span className="sm:hidden">Nuovo</span>
      </Link>
    </Button>
  );
}
