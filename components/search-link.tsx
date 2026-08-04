"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { hrefWith, updateSearch, type SearchPatch } from "@/lib/shallow-nav";

/**
 * Link «shallow» per lo stato di vista nell'URL: riceve la PATCH di
 * parametri (`params={{ task: id }}`, `{ view: null }`…) e compone da sé
 * l'href della pagina corrente. Al click naviga con la History API —
 * istantaneo, nessun round-trip RSC — restando un <a> vero (copia link,
 * apri in nuova scheda, tastiera). La sottoscrizione alla query string
 * vive qui nella foglia: i genitori (card, righe) non re-renderizzano al
 * cambio URL. Per cambiare pagina resta <Link>.
 */
export function SearchLink({
  params,
  replace = false,
  onClick,
  ...anchor
}: Omit<React.ComponentPropsWithoutRef<"a">, "href"> & {
  params: SearchPatch;
  replace?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <a
      {...anchor}
      href={hrefWith(pathname, searchParams, params)}
      onClick={(e) => {
        onClick?.(e);
        if (
          e.defaultPrevented ||
          e.button !== 0 ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey
        ) {
          return;
        }
        e.preventDefault();
        updateSearch(params, { replace });
      }}
    />
  );
}
