"use client";

import * as React from "react";
import { DatabaseBackup, Download, Upload } from "lucide-react";

import { useAppStore } from "@/lib/store";
import type { CustomStatus, WorkspaceTemplate } from "@/lib/types";
import type { SavedView } from "@/lib/store";
import { useToast } from "@/components/toaster";
import { Button } from "@/components/ui/button";

interface BackupFile {
  kind: "lacertosus-office-config";
  version: 1;
  exportedAt: string;
  templates: WorkspaceTemplate[];
  customStatuses: CustomStatus[];
  savedViews: SavedView[];
}

/**
 * Backup della configurazione del workspace: template, fasi custom e viste
 * salvate.
 *
 * Ora che i dati stanno su Supabase non serve più a trasportarli fra
 * computer — quello lo fa il database. Resta utile per due cose che il
 * database non copre: portarsi la configurazione su un altro workspace, e
 * tenersi una copia prima di una modifica corposa ai template.
 */
export function ConfigBackup() {
  const { templates, customStatuses, savedViews, importConfig, currentUser } =
    useAppStore();
  const toast = useToast();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const isAdmin = currentUser.role === "admin";

  const exportConfig = () => {
    const data: BackupFile = {
      kind: "lacertosus-office-config",
      version: 1,
      exportedAt: new Date().toISOString(),
      templates,
      customStatuses,
      savedViews,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lacertosus-office-config-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast("Configurazione esportata");
  };

  const onImportFile = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Partial<BackupFile>;
      if (
        data.kind !== "lacertosus-office-config" ||
        !Array.isArray(data.templates)
      ) {
        toast("File non riconosciuto: serve un backup di Office OS");
        return;
      }
      importConfig({
        templates: data.templates,
        customStatuses: Array.isArray(data.customStatuses)
          ? data.customStatuses
          : undefined,
        savedViews: Array.isArray(data.savedViews)
          ? data.savedViews
          : undefined,
      });
      toast(
        `Configurazione importata: ${data.templates.length} template${
          Array.isArray(data.customStatuses) && data.customStatuses.length > 0
            ? `, ${data.customStatuses.length} fasi custom`
            : ""
        }`,
      );
    } catch {
      toast("Import fallito: il file non è un JSON valido");
    }
  };

  /* «Azzera dati demo» è sparito. Cancellava la chiave `office-state` del
     browser, che non esiste più da quando i dati stanno su Supabase: non
     azzerava nulla, ricaricava soltanto. Un pulsante che promette
     un'azione e non la compie è peggio di un pulsante assente — e riscriverlo
     per cancellare i dati veri sarebbe stato un modo per perdere il lavoro
     dell'ufficio con un clic. */

  if (!isAdmin) return null;

  return (
    <div className="card-soft p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.05em] text-ink-secondary uppercase">
        <DatabaseBackup className="size-3.5" />
        Backup configurazione
      </p>
      <p className="mt-1 text-[13px] text-ink-muted">
        Template, fasi custom e viste salvate stanno su Supabase e ti seguono
        ovunque. Esportale per tenerne una copia prima di una modifica
        corposa, o per portarle su un altro workspace.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={exportConfig}>
          <Download data-icon="inline-start" />
          Esporta
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
        >
          <Upload data-icon="inline-start" />
          Importa
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImportFile(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
