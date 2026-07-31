import * as React from "react";

/**
 * Icone di navigazione duotone disegnate in casa (niente dipendenze):
 * un livello di riempimento soft (currentColor al 16%) + tratto 1.75.
 * Ereditano il colore dal testo, quindi funzionano anche in bianco
 * sulla tessera attiva arancio.
 */

interface NavIconProps {
  className?: string;
  strokeWidth?: number;
}

function Svg({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {children}
    </svg>
  );
}

export function IconDashboard({ className }: NavIconProps) {
  return (
    <Svg className={className}>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2" fill="currentColor" opacity="0.16" stroke="none" />
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2" />
      <rect x="14" y="3.5" width="6.5" height="7.5" rx="2" />
      <rect x="3.5" y="14" width="6.5" height="6.5" rx="2" />
      <rect x="13" y="14" width="7.5" height="6.5" rx="2" />
    </Svg>
  );
}

export function IconTasks({ className }: NavIconProps) {
  return (
    <Svg className={className}>
      <rect x="9.75" y="4" width="4.5" height="13" rx="1.5" fill="currentColor" opacity="0.16" stroke="none" />
      <rect x="3.5" y="4" width="4.5" height="16" rx="1.5" />
      <rect x="9.75" y="4" width="4.5" height="13" rx="1.5" />
      <rect x="16" y="4" width="4.5" height="9" rx="1.5" />
    </Svg>
  );
}

export function IconCalendar({ className }: NavIconProps) {
  return (
    <Svg className={className}>
      <path d="M3.5 9.5h17V7.5a2 2 0 0 0-2-2h-13a2 2 0 0 0-2 2Z" fill="currentColor" opacity="0.16" stroke="none" />
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3.5v3.5M16 3.5v3.5" />
      <circle cx="8.4" cy="14" r="1.5" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconProjects({ className }: NavIconProps) {
  return (
    <Svg className={className}>
      <path d="M3.5 8.5c0-1.1.9-2 2-2h15v10.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" fill="currentColor" opacity="0.16" stroke="none" />
      <path d="M3.5 17V6.8c0-1 .8-1.8 1.8-1.8h3.5l2 2.5h7.4c1 0 1.8.8 1.8 1.8V17a2 2 0 0 1-2 2h-12.5a2 2 0 0 1-2-2Z" />
      <path d="M3.5 10.5h17" />
    </Svg>
  );
}

export function IconProblems({ className }: NavIconProps) {
  return (
    <Svg className={className}>
      <path d="M12 4.2 21 19H3Z" fill="currentColor" opacity="0.16" stroke="none" />
      <path d="M10.5 5.1 3.3 17.4A1.7 1.7 0 0 0 4.8 20h14.4a1.7 1.7 0 0 0 1.5-2.6L13.5 5.1a1.75 1.75 0 0 0-3 0Z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="16.8" r="0.4" fill="currentColor" />
    </Svg>
  );
}

export function IconReports({ className }: NavIconProps) {
  return (
    <Svg className={className}>
      <rect x="15.5" y="4.5" width="4.5" height="15" rx="1.5" fill="currentColor" opacity="0.16" stroke="none" />
      <rect x="4" y="12.5" width="4.5" height="7" rx="1.5" />
      <rect x="9.75" y="8.5" width="4.5" height="11" rx="1.5" />
      <rect x="15.5" y="4.5" width="4.5" height="15" rx="1.5" />
    </Svg>
  );
}

export function IconTeam({ className }: NavIconProps) {
  return (
    <Svg className={className}>
      <circle cx="15.8" cy="9.2" r="2.6" fill="currentColor" opacity="0.16" stroke="none" />
      <path d="M20.5 18.5c0-2.4-2-4.2-4.7-4.2-.6 0-1.2.1-1.7.3" fill="currentColor" opacity="0.16" stroke="none" />
      <circle cx="9" cy="8.7" r="3.1" />
      <path d="M3.5 19c0-3 2.4-5 5.5-5s5.5 2 5.5 5" />
      <circle cx="15.8" cy="9.2" r="2.6" />
      <path d="M20.5 18.5c0-2.3-1.8-4-4.3-4.2" />
    </Svg>
  );
}

export function IconSettings({ className }: NavIconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="5.4" fill="currentColor" opacity="0.16" stroke="none" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.6v2.2M12 18.2v2.2M20.4 12h-2.2M5.8 12H3.6M17.9 6.1l-1.5 1.5M7.6 16.4l-1.5 1.5M17.9 17.9l-1.5-1.5M7.6 7.6 6.1 6.1" />
    </Svg>
  );
}
