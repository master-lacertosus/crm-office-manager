"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { CalendarDays, ListChecks } from "lucide-react";

import { CalendarView } from "@/components/calendar-view";
import { Segmented, SegmentedLink } from "@/components/ui/segmented";

/* L'agenda viaggia in un chunk suo: il Mese resta il predefinito e non
   paga il peso di una vista che non tutti aprono, con il prefetch che
   parte già al passaggio del mouse sul toggle. */
const AgendaView = dynamic(
  () => import("@/components/agenda-view").then((m) => m.AgendaView),
  { ssr: false },
);

type VistaCalendario = "mese" | "agenda";

const VISTE: {
  key: VistaCalendario;
  label: string;
  icon: typeof CalendarDays;
  preload?: () => void;
}[] = [
  { key: "mese", label: "Mese", icon: CalendarDays },
  {
    key: "agenda",
    label: "Agenda",
    icon: ListChecks,
    preload: () => void import("@/components/agenda-view"),
  },
];

/** Vista corrente del Calendario (?view=): unica fonte per toggle e corpo. */
function useVista(): VistaCalendario {
  return useSearchParams().get("view") === "agenda" ? "agenda" : "mese";
}

/**
 * Mese o Agenda.
 *
 * Il Mese risponde a «com'è messa la settimana»: si guarda la densità, si
 * trascina, si vede il quadro. L'Agenda risponde a «cosa devo consegnare»,
 * che è una domanda diversa e vuole un elenco, non una griglia — e vuole
 * poter guardare oltre il mese che si sta guardando.
 */
export function CalendarViewToggle() {
  const vista = useVista();
  return (
    <Segmented>
      {VISTE.map(({ key, label, icon: Icon, preload }) => (
        <SegmentedLink
          key={key}
          active={vista === key}
          params={{ view: key === "mese" ? null : key }}
          onPointerEnter={preload}
        >
          <Icon aria-hidden className="size-3.5" />
          {label}
        </SegmentedLink>
      ))}
    </Segmented>
  );
}

export function CalendarViews() {
  return useVista() === "agenda" ? <AgendaView /> : <CalendarView />;
}
