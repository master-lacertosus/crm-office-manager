/**
 * Fa capire a Node l'alias `@/` del progetto.
 *
 * Le prove importano i moduli veri invece di ricopiarne la logica: e' l'unico
 * modo perche' provino qualcosa. Ma i moduli si importano fra loro con `@/`,
 * che e' una scorciatoia di TypeScript e del bundler — Node non la conosce e
 * si ferma con «Cannot find package '@/lib'».
 *
 * Qui si insegna la corrispondenza, e basta: `@/qualcosa` diventa un percorso
 * dalla radice del progetto. Nessun compilatore di mezzo, perche' Node 24 sa
 * gia' leggere i .ts togliendo i tipi.
 *
 * Uso:
 *   node --import ./scripts/alias.mjs scripts/una-prova.mjs
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const RADICE = pathToFileURL(`${process.cwd()}/`).href;

/* Oltre all'alias serve l'estensione: nel codice si scrive `@/lib/format`,
   sul disco il file e' `lib/format.ts`. TypeScript la sottintende, Node no.
   Si provano le forme del progetto, nell'ordine in cui il bundler le cerca. */
register(
  `data:text/javascript,
   import { existsSync } from "node:fs";
   import { fileURLToPath } from "node:url";

   const CODE = [".ts", ".tsx", "/index.ts", "/index.tsx"];

   export function resolve(specifier, context, next) {
     if (!specifier.startsWith("@/")) return next(specifier, context);
     const base = new URL(specifier.slice(2), ${JSON.stringify(RADICE)}).href;
     if (existsSync(fileURLToPath(base))) return next(base, context);
     for (const coda of CODE) {
       const prova = base + coda;
       if (existsSync(fileURLToPath(prova))) return next(prova, context);
     }
     return next(base, context);
   }`,
);
