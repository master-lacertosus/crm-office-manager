"use client";

import * as React from "react";
import { Plus, Split, X } from "lucide-react";

import type { BozzaPezzo, PezzoNuovo } from "@/lib/pezzi";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

/**
 * I pezzi di un lavoro, mentre lo si sta ancora scrivendo.
 *
 * La sezione «Lavori» del pannello compare solo su un task che esiste già —
 * e ha ragione, un pezzo ha bisogno di un padre a cui appendersi. Ma
 * «Creazione prodotto» si pensa a pezzi FIN DALL'INIZIO: scrivere il task,
 * salvarlo, riaprirlo e solo allora spezzarlo e' un giro che si fa perche'
 * il programma lo impone, non perche' serva.
 *
 * Qui i pezzi si raccolgono soltanto: nascono davvero un istante dopo il
 * padre, quando un id da mettere in `parent_id` finalmente esiste.
 *
 * Restano due campi, titolo e incaricato. Scadenze, descrizioni e stati si
 * mettono dopo: questa e' la schermata in cui si butta giu' un lavoro, e
 * riempirla di campi la trasformerebbe in un modulo da compilare.
 */

/* I tipi e la regola di raccolta vivono in `lib/pezzi`: il salvataggio deve
   poterli usare senza dipendere da questo componente. */
export type { PezzoNuovo, BozzaPezzo } from "@/lib/pezzi";

export function PezziInCreazione({
  pezzi,
  onChange,
  /* La riga in compilazione vive nel modulo, non qui dentro: al
     salvataggio dev'essere raggiungibile, altrimenti quello che ci sta
     scritto si perde senza dirlo a nessuno. */
  bozza,
  onBozzaChange,
  /** Il responsabile del lavoro padre: decide chi si puo' incaricare. */
  ownerPadre,
  puoAssegnareAdAltri,
}: {
  pezzi: PezzoNuovo[];
  onChange: (pezzi: PezzoNuovo[]) => void;
  bozza: BozzaPezzo;
  onBozzaChange: (bozza: BozzaPezzo) => void;
  ownerPadre: string;
  puoAssegnareAdAltri: boolean;
}) {
  const { profiles, currentUser } = useAppStore();
  const titolo = bozza.titolo;
  const setTitolo = (t: string) => onBozzaChange({ ...bozza, titolo: t });
  const incaricato = bozza.owner_id || currentUser.id;
  const setIncaricato = (id: string) =>
    onBozzaChange({ ...bozza, owner_id: id });

  /* Chi guida il lavoro puo' affidarne i pezzi, come un responsabile.
     E' la stessa regola di `tasks_insert_own_or_delegato` (M10): offrire
     l'elenco a chi verrebbe rifiutato sarebbe una porta che si apre con un
     no. */
  const puoIncaricareAltri =
    puoAssegnareAdAltri || ownerPadre === currentUser.id;

  const attivi = profiles.filter((p) => p.is_active);

  const aggiungi = () => {
    const pulito = titolo.trim();
    if (!pulito) return;
    onChange([
      ...pezzi,
      {
        chiave: crypto.randomUUID(),
        titolo: pulito,
        owner_id: puoIncaricareAltri ? incaricato : currentUser.id,
      },
    ]);
    /* Si azzera il titolo ma non l'incaricato: chi affida tre pezzi alla
       stessa persona non deve risceglierla ogni volta. */
    onBozzaChange({ titolo: "", owner_id: incaricato });
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="pezzo-nuovo" className="flex items-center gap-1.5">
        <Split aria-hidden className="size-3.5 text-ink-muted" />
        Pezzi di questo lavoro
        <span className="font-normal text-ink-muted">— facoltativo</span>
      </Label>

      {pezzi.length > 0 ? (
        <ul className="space-y-1.5">
          {pezzi.map((p) => {
            const chi = profiles.find((x) => x.id === p.owner_id);
            return (
              <li
                key={p.chiave}
                className="flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5"
              >
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                  {p.titolo}
                </span>
                <span className="shrink-0 text-[12px] text-ink-muted">
                  {chi?.full_name.split(" ")[0] ?? "—"}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChange(pezzi.filter((x) => x.chiave !== p.chiave))
                  }
                  aria-label={`Togli «${p.titolo}»`}
                  className="shrink-0 rounded-sm text-ink-faint outline-none hover:text-danger-text focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="flex items-center gap-1.5">
        <Input
          id="pezzo-nuovo"
          value={titolo}
          onChange={(e) => setTitolo(e.target.value)}
          placeholder="es. Scrittura testi"
          maxLength={120}
          /* Invio aggiunge il pezzo, non manda il task: questo campo vive
             dentro il modulo del task, e senza fermare l'evento si
             salverebbe un lavoro a metà. */
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            aggiungi();
          }}
        />
        {puoIncaricareAltri ? (
          <>
            <label htmlFor="pezzo-incaricato" className="sr-only">
              Chi se ne occupa
            </label>
            <NativeSelect
              id="pezzo-incaricato"
              className="w-32 shrink-0"
              value={incaricato}
              onChange={(e) => setIncaricato(e.target.value)}
            >
              {attivi.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name.split(" ")[0]}
                </option>
              ))}
            </NativeSelect>
          </>
        ) : null}
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={aggiungi}
          disabled={titolo.trim().length === 0}
          aria-label="Aggiungi il pezzo"
        >
          <Plus />
        </Button>
      </div>

      {pezzi.length > 0 ? (
        <p className="text-[12px] text-ink-muted">
          {pezzi.length === 1
            ? "1 pezzo nascerà insieme al lavoro."
            : `${pezzi.length} pezzi nasceranno insieme al lavoro.`}
        </p>
      ) : null}
    </div>
  );
}
