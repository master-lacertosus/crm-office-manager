"use client";

import * as React from "react";
import { DatabaseBackup, Download, RotateCcw, Upload } from "lucide-react";

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
 * Backup della configurazione del workspace: template, fasi custom e
 * viste salvate vivono nel browser finché non c'è Supabase — questo file
 * è l'assicurazione (e il modo per passarli a un altro PC).
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

  const resetDemo = () => {
    if (
      !window.confirm(
        "Azzerare i dati demo? Task, commenti e cronologia tornano ai valori iniziali (template e viste restano).",
      )
    ) {
      return;
    }
    try {
      localStorage.removeItem("office-state");
    } catch {
      /* ignora */
    }
    window.location.reload();
  };

  if (!isAdmin) return null;

  return (
    <div className="card-soft p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.05em] text-ink-secondary uppercase">
        <DatabaseBackup className="size-3.5" />
        Backup configurazione
      </p>
      <p className="mt-1 text-[13px] text-ink-muted">
        Template, fasi custom e viste salvate vivono in questo browser
        (finché non arriva Supabase): esportali come assicurazione o per
        portarli su un altro PC.
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
        <Button
          variant="ghost"
          size="sm"
          onClick={resetDemo}
          className="ml-auto text-ink-muted hover:text-danger-text"
        >
          <RotateCcw data-icon="inline-start" />
          Azzera dati demo
        </Button>
      </div>
    </div>
  );
}
