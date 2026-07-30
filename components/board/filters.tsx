"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useAppStore } from "@/lib/store";
import { NativeSelect } from "@/components/ui/native-select";

/**
 * Filtri della board, persistiti nell'URL (?owner=&project=).
 * `lockProject`: nella pagina progetto il filtro progetto è implicito.
 */
export function BoardFilters({ lockProject = false }: { lockProject?: boolean }) {
  const { profiles, projects } = useAppStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = (key: "owner" | "project", value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="filter-owner" className="sr-only">
        Filtra per responsabile
      </label>
      <NativeSelect
        id="filter-owner"
        className="w-40"
        value={searchParams.get("owner") ?? ""}
        onChange={(e) => setParam("owner", e.target.value)}
      >
        <option value="">Tutti i responsabili</option>
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
          <label htmlFor="filter-project" className="sr-only">
            Filtra per progetto
          </label>
          <NativeSelect
            id="filter-project"
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
