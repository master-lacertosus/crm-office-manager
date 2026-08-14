"use client";

import * as React from "react";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  fetchPreference,
  savePreference,
  type ColonnaPreferenza,
} from "@/lib/supabase/queries";

/**
 * Una preferenza personale tenuta in due posti, di proposito.
 *
 * `localStorage` la applica **prima** che la rete risponda: senza, a ogni
 * caricamento si vedrebbe un istante di valore predefinito prima di quello
 * scelto — il tema che lampeggia, i blocchi della dashboard che saltano.
 *
 * Il database è la verità: segue la persona fra computer diversi e vince
 * sulla copia locale appena arriva.
 *
 * Lo schema era ripetuto in tre file (aspetto, layout della dashboard, fasi
 * compresse). Qui sta una volta sola.
 */
export function usePreferenzaSincronizzata<T>(
  chiaveLocale: string,
  colonna: ColonnaPreferenza,
  valore: T,
  applica: (v: T) => void,
  valida: (grezzo: unknown) => T | null,
) {
  /* Finché non si è letto, non si scrive: il primo salvataggio partirebbe
     con il valore predefinito e sovrascriverebbe quello salvato prima che
     la lettura sia avvenuta. */
  const lettoRef = React.useRef(false);

  // 1. Il browser, subito.
  React.useEffect(() => {
    queueMicrotask(() => {
      try {
        const grezzo = localStorage.getItem(chiaveLocale);
        if (grezzo) {
          const v = valida(JSON.parse(grezzo));
          if (v !== null) applica(v);
        }
      } catch {
        /* storage illeggibile: si resta sui valori predefiniti */
      }
      lettoRef.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Il database, appena risponde: vince lui.
  React.useEffect(() => {
    if (!isSupabaseConfigured) return;
    let annullato = false;
    (async () => {
      try {
        const remoto = await fetchPreference<unknown>(createClient(), colonna);
        if (annullato || remoto === null) return;
        const v = valida(remoto);
        if (v !== null) applica(v);
      } catch {
        /* non collegato: resta quella locale, che e gia applicata */
      }
    })();
    return () => {
      annullato = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3. A ogni cambiamento: in entrambi i posti.
  React.useEffect(() => {
    if (!lettoRef.current) return;
    try {
      localStorage.setItem(chiaveLocale, JSON.stringify(valore));
    } catch {
      /* quota piena: pazienza, il database resta la verita */
    }
    if (!isSupabaseConfigured) return;
    void (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getClaims();
        const userId = data?.claims?.sub as string | undefined;
        if (userId) await savePreference(supabase, userId, colonna, valore);
      } catch {
        /* il salvataggio remoto e un di piu: quello locale e gia avvenuto */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valore]);
}
