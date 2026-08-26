"use client";

import * as React from "react";
import { Check, LoaderCircle, Plus, X } from "lucide-react";

import { messaggioErrore } from "@/lib/errori";
import { puoCreareProgetto } from "@/lib/permessi";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

/**
 * Il campo «Progetto», con la possibilità di crearne uno lì per lì.
 *
 * Prima, scrivendo un task per un lavoro che non aveva ancora un progetto,
 * bisognava abbandonare quello che si stava scrivendo, andare in Progetti,
 * crearlo, tornare indietro e ricominciare. Il primo task di ogni progetto
 * nuovo costava quel giro — cioè proprio quando si ha più fretta.
 *
 * Chi non è responsabile non vede l'opzione: la policy `projects_insert_admin`
 * la rifiuterebbe, e offrire una porta che si apre con un no è peggio che
 * non offrirla.
 */

/** Valore sentinella dell'opzione «nuovo»: non può collidere con un id. */
const NUOVO = "__nuovo__";

export function SceltaProgetto({
  value,
  onChange,
  id = "task-project",
}: {
  value: string;
  onChange: (projectId: string) => void;
  id?: string;
}) {
  const { projects, currentUser, createProject } = useAppStore();
  const [creando, setCreando] = React.useState(false);
  const [nome, setNome] = React.useState("");
  const [salvando, setSalvando] = React.useState(false);
  const [errore, setErrore] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const puoCreare = puoCreareProgetto(currentUser);
  const attivi = projects.filter((p) => !p.is_archived);

  React.useEffect(() => {
    if (creando) inputRef.current?.focus();
  }, [creando]);

  const conferma = async () => {
    const pulito = nome.trim();
    if (!pulito) return;
    setErrore(null);
    setSalvando(true);
    /* Il `finally` non è pignoleria: senza, un rifiuto lascerebbe il campo
       bloccato in «sto salvando» e il pulsante spento per sempre. */
    try {
      const nato = await createProject({ name: pulito });
      onChange(nato.id);
      setCreando(false);
      setNome("");
    } catch (e) {
      setErrore(messaggioErrore(e, "Progetto non creato."));
    } finally {
      setSalvando(false);
    }
  };

  const annulla = () => {
    setCreando(false);
    setNome("");
    setErrore(null);
  };

  if (creando) {
    return (
      <div className="space-y-2">
        <Label htmlFor={`${id}-nuovo`}>Nuovo progetto</Label>
        <div className="flex items-center gap-1.5">
          <Input
            ref={inputRef}
            id={`${id}-nuovo`}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome del progetto"
            maxLength={80}
            aria-invalid={errore ? true : undefined}
            /* Invio conferma, Esc annulla: il campo è dentro il modulo del
               task, e senza questo l'invio manderebbe il task invece di
               creare il progetto. */
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void conferma();
              } else if (e.key === "Escape") {
                e.preventDefault();
                annulla();
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            onClick={() => void conferma()}
            disabled={salvando || nome.trim().length === 0}
            aria-busy={salvando}
            aria-label="Crea il progetto"
          >
            {salvando ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Check />
            )}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={annulla}
            aria-label="Annulla"
          >
            <X />
          </Button>
        </div>
        {errore ? (
          <p className="text-[13px] text-danger-text">{errore}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Progetto</Label>
      <NativeSelect
        id={id}
        value={value}
        onChange={(e) => {
          if (e.target.value === NUOVO) setCreando(true);
          else onChange(e.target.value);
        }}
      >
        <option value="">Nessun progetto</option>
        {attivi.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
        {puoCreare ? <option value={NUOVO}>+ Nuovo progetto…</option> : null}
      </NativeSelect>
      {puoCreare && attivi.length === 0 ? (
        /* Il caso da cui è partita la richiesta: nessun progetto ancora.
           Un menu con una voce sola non suggerisce niente, un pulsante sì. */
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCreando(true)}
        >
          <Plus data-icon="inline-start" />
          Crea il primo progetto
        </Button>
      ) : null}
    </div>
  );
}
