import type { TaskPriority, TaskRepeat } from "@/lib/types";

/**
 * Template di task: precompilano campi, ripetizione e link tipici.
 * Fase placeholder: costanti; con Supabase diventeranno una tabella.
 */
export interface TaskTemplate {
  id: string;
  name: string;
  title: string;
  description: string;
  priority: TaskPriority;
  repeat: TaskRepeat;
  dueOffsetDays: number | null;
  links: { url: string; label: string }[];
}

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: "newsletter",
    name: "Newsletter",
    title: "Newsletter — ",
    description:
      "Checklist:\n- soggetto e preheader\n- blocco novità\n- blocco UGC\n- CTA e link tracciati\n- test invio",
    priority: "high",
    repeat: "weekly",
    dueOffsetDays: 3,
    links: [
      { url: "https://docs.google.com/document/d/linee-guida-newsletter", label: "Linee guida" },
    ],
  },
  {
    id: "shooting",
    name: "Shooting prodotto",
    title: "Shooting — ",
    description:
      "Checklist:\n- lista referenze prodotto\n- still life fondo bianco\n- dettagli (zigrinatura, saldature)\n- 3 angolazioni per variante\n- consegna in cartella condivisa",
    priority: "normal",
    repeat: "none",
    dueOffsetDays: 7,
    links: [
      { url: "https://drive.google.com/drive/folders/reference-shooting", label: "Cartella reference" },
    ],
  },
  {
    id: "lancio",
    name: "Lancio prodotto",
    title: "Lancio — ",
    description:
      "Checklist:\n- scheda prodotto online\n- foto e video caricati\n- newsletter dedicata\n- post social programmati\n- ADV attive",
    priority: "high",
    repeat: "none",
    dueOffsetDays: 14,
    links: [],
  },
];
