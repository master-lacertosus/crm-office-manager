import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

/**
 * Avatar del profilo: foto se impostata (`src`), altrimenti iniziali dal
 * nome. Il nome resta nel `title`; l'immagine è decorativa (alt vuoto).
 */
export function AvatarInitials({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
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
        src && "overflow-hidden",
        sizes[size],
        className,
      )}
    >
      {src ? (
        // Data URL locale ridotta (192px): next/image non avrebbe nulla
        // da ottimizzare.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          draggable={false}
          className="size-full object-cover"
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
