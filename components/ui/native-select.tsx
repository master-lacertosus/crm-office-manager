import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Select nativa stilizzata sui token: accessibile da tastiera per natura,
 * zero dipendenze aggiuntive. Sostituibile con una Select Radix quando
 * servirà ricerca o contenuto ricco.
 */
function NativeSelect({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <span className={cn("relative inline-flex w-full", className)}>
      <select
        data-slot="native-select"
        className="h-9 w-full appearance-none rounded-lg border border-input bg-card pr-8 pl-3 text-sm text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-destructive"
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-ink-muted"
      />
    </span>
  );
}

export { NativeSelect };
