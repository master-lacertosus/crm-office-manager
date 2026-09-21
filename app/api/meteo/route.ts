/**
 * Il tempo a Parma, preso una volta per tutti.
 *
 * Perché una rotta e non una chiamata dal browser: i client sono sei e la
 * dashboard si apre venti volte al giorno a testa. Chiamando dal browser si
 * bussa al servizio meteo centoventi volte per un dato che cambia ogni ora —
 * scortese verso chi lo offre gratis, e inutile per chi guarda.
 *
 * Qui la risposta si mette in cache per un quarto d'ora: il tempo non cambia
 * più in fretta di così, e sei persone che aprono la dashboard nello stesso
 * quarto d'ora fanno UNA chiamata sola.
 *
 * ATTENZIONE a non copiare `export const dynamic = "force-dynamic"` dalla
 * rotta delle email: secondo i doc di questa versione equivale a mettere
 * `cache: "no-store"` su OGNI fetch della rotta, e annullerebbe esattamente
 * quello che questo file esiste per fare.
 */

import { NextResponse } from "next/server";

import { leggiMeteo, PARMA, type RispostaMet } from "@/lib/meteo";

/** Quanto tiene la risposta prima di richiederla. */
const QUARTO_DORA = 900;

/**
 * MET Norway pretende di sapere chi chiama: è la condizione del loro uso
 * gratuito, e chi si presenta con lo user-agent di una libreria viene
 * bloccato. Si dichiara l'app e un indirizzo a cui scrivere.
 */
const CHI_SIAMO = "LacertosusOfficeOS/1.0 (webmaster@lacertosus.com)";

export async function GET() {
  const url =
    `https://api.met.no/weatherapi/locationforecast/2.0/compact` +
    `?lat=${PARMA.lat}&lon=${PARMA.lon}`;

  try {
    const risposta = await fetch(url, {
      headers: { "User-Agent": CHI_SIAMO },
      /* In questa versione di Next la cache è opt-in: senza `force-cache`
         ogni apertura di dashboard sarebbe una chiamata nuova. */
      cache: "force-cache",
      next: { revalidate: QUARTO_DORA },
    });

    if (!risposta.ok) {
      /* Il meteo non è un dato critico: se il servizio è giù, il blocco
         mostra «non disponibile» e la dashboard resta in piedi. Un 502
         onesto è meglio di un 200 con dentro il nulla. */
      return NextResponse.json(
        { errore: `Servizio meteo non raggiungibile (${risposta.status})` },
        { status: 502 },
      );
    }

    const meteo = leggiMeteo((await risposta.json()) as RispostaMet);
    if (!meteo) {
      return NextResponse.json(
        { errore: "Il servizio meteo ha risposto in un formato inatteso" },
        { status: 502 },
      );
    }

    return NextResponse.json(meteo, {
      /* Anche il browser tiene il dato un quarto d'ora: cambiare pagina e
         tornare in dashboard non deve ripassare dal server. */
      headers: {
        "Cache-Control": `public, max-age=${QUARTO_DORA}, stale-while-revalidate=${QUARTO_DORA}`,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { errore: e instanceof Error ? e.message : "Rete non raggiungibile" },
      { status: 502 },
    );
  }
}
