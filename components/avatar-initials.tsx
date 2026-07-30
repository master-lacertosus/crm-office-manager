import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

/** Avatar a iniziali (niente upload nell'MVP — docs/design-system.md). */
export function AvatarInitials({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "size-5 text-[9px]",
    md: "size-7 text-[11px]",
    lg: "size-9 text-[13px]",
  } as const;

  return (
    <span
      title={name}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full bg-muted font-semibold tracking-wide text-ink-secondary",
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
