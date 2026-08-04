"use client";

import { Sparkles } from "lucide-react";

import { SearchLink } from "@/components/search-link";
import { Button } from "@/components/ui/button";

/** Azione primaria: apre il pannello in modalità creazione (?task=new). */
export function NewTaskButton() {
  return (
    <Button asChild>
      <SearchLink params={{ task: "new" }}>
        <Sparkles data-icon="inline-start" />
        <span className="hidden sm:inline">Nuovo task</span>
        <span className="sm:hidden">Nuovo</span>
      </SearchLink>
    </Button>
  );
}
