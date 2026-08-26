"use client";

import { useSearchParams } from "next/navigation";

import { updateSearch } from "@/lib/shallow-nav";
import { responsabileEffettivo, TUTTI } from "@/lib/filtro-responsabile";
import { useAppStore } from "@/lib/store";
import { NativeSelect } from "@/components/ui/native-select";

/**
 * Filtri della board, persistiti nell'URL (?owner=&project=).
 * `lockProject`: nella pagina progetto il filtro progetto è implicito.
 */
export function BoardFilters({
  lockProject = false,
  idPrefix = "flt",
}: {
  lockProject?: boolean;
  /** Prefisso per gli id dei campi: unico per ogni istanza in pagina
   *  (header desktop vs sotto-barra mobile) così le label restano valide. */
  idPrefix?: string;
}) {
  const { profiles, projects, currentUser } = useAppStore();
  const searchParams = useSearchParams();

  const setParam = (key: "owner" | "project", value: string) => {
    updateSearch({ [key]: value || null }, { replace: true });
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={`${idPrefix}-owner`} className="sr-only">
        Filtra per responsabile
      </label>
      <NativeSelect
        id={`${idPrefix}-owner`}
        className="w-40"
        /* Il valore mostrato è quello EFFETTIVO, non quello scritto
           nell'indirizzo: un dipendente che apre la pagina senza filtri sta
           vedendo i propri task, e il menu deve dirlo invece di sostenere
           che stia guardando tutti. */
        value={
          responsabileEffettivo(searchParams.get("owner"), currentUser) ??
          TUTTI
        }
        onChange={(e) => setParam("owner", e.target.value)}
      >
        {/* «Tutti» ha un valore proprio (`all`) e non la stringa vuota:
            senza, un dipendente che lo sceglie produrrebbe un indirizzo
            identico al predefinito, e la scelta gli tornerebbe indietro
            appena fatta. */}
        <option value={TUTTI}>Tutti i responsabili</option>
        {profiles
          .filter((p) => p.is_active)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
      </NativeSelect>

      {!lockProject ? (
        <>
          <label htmlFor={`${idPrefix}-project`} className="sr-only">
            Filtra per progetto
          </label>
          <NativeSelect
            id={`${idPrefix}-project`}
            className="hidden w-44 sm:inline-flex"
            value={searchParams.get("project") ?? ""}
            onChange={(e) => setParam("project", e.target.value)}
          >
            <option value="">Tutti i progetti</option>
            {projects
              .filter((p) => !p.is_archived)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </NativeSelect>
        </>
      ) : null}
    </div>
  );
}
