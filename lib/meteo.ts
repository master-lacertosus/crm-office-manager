/**
 * Il tempo che fa a Parma.
 *
 * Qui non si chiama nessuno: si traduce soltanto la risposta del servizio
 * meteo in qualcosa che si legge in italiano. È l'unico pezzo provabile
 * senza rete, ed è anche quello che sbaglia più facilmente — un codice
 * meteo non tradotto diventa «partlycloudy_day» in faccia a chi guarda.
 *
 * Il servizio è MET Norway (api.met.no) e non Open-Meteo, che pure sarebbe
 * stato più comodo: il piano gratuito di Open-Meteo è dichiarato per uso non
 * commerciale, e questo CRM lo usa un'azienda. MET Norway non pone quel
 * limite; in cambio pretende che ogni chiamata si presenti con uno
 * `User-Agent` che dica chi è e come raggiungerlo.
 */

/** Il tempo adesso, già pronto da mostrare. */
export interface MeteoAdesso {
  /** Gradi centigradi, arrotondati: mezzo grado non lo guarda nessuno. */
  gradi: number;
  /** Cielo, a parole nostre. */
  descrizione: string;
  /** Emoji che riassume, per chi legge di sfuggita. */
  simbolo: string;
  /** Km/h arrotondati (il servizio li dà in m/s). */
  vento: number;
  /** Quando il servizio ha aggiornato la previsione (ISO). */
  aggiornato: string;
}

/** Un'ora delle prossime, per la striscia. */
export interface MeteoOra {
  /** «15» — l'ora locale, senza minuti. */
  ora: string;
  gradi: number;
  simbolo: string;
  /** Millimetri di pioggia previsti in quell'ora. */
  pioggia: number;
}

export interface Meteo {
  adesso: MeteoAdesso;
  prossime: MeteoOra[];
}

/**
 * I codici di MET Norway, in italiano.
 *
 * L'elenco completo ha un centinaio di voci fra varianti giorno/notte e
 * sfumature che a Parma non servono («sleetshowersandthunder»). Si riduce al
 * prefisso: `partlycloudy_day` e `partlycloudy_night` sono la stessa cosa per
 * chi deve decidere se prendere l'ombrello, e la variante notturna cambia
 * solo l'emoji.
 */
const CIELO: Record<string, { testo: string; giorno: string; notte?: string }> = {
  clearsky: { testo: "Sereno", giorno: "☀️", notte: "🌙" },
  fair: { testo: "Poco nuvoloso", giorno: "🌤️", notte: "🌙" },
  partlycloudy: { testo: "Nuvoloso a tratti", giorno: "⛅", notte: "☁️" },
  cloudy: { testo: "Coperto", giorno: "☁️" },
  fog: { testo: "Nebbia", giorno: "🌫️" },
  lightrain: { testo: "Pioggia leggera", giorno: "🌦️" },
  rain: { testo: "Pioggia", giorno: "🌧️" },
  heavyrain: { testo: "Pioggia forte", giorno: "🌧️" },
  lightrainshowers: { testo: "Qualche rovescio", giorno: "🌦️" },
  rainshowers: { testo: "Rovesci", giorno: "🌦️" },
  heavyrainshowers: { testo: "Rovesci forti", giorno: "🌧️" },
  sleet: { testo: "Nevischio", giorno: "🌨️" },
  snow: { testo: "Neve", giorno: "❄️" },
  lightsnow: { testo: "Neve leggera", giorno: "🌨️" },
  heavysnow: { testo: "Neve forte", giorno: "❄️" },
  thunder: { testo: "Temporale", giorno: "⛈️" },
};

/**
 * Da `partlycloudy_day` a «Nuvoloso a tratti» + ⛅.
 *
 * Un codice sconosciuto non diventa un'eccezione né una stringa vuota: il
 * servizio può aggiungere varianti quando vuole, e una dashboard che si
 * rompe perché a Parma nevischia è peggio di una che scrive «—».
 */
export function leggiCielo(codice: string | undefined): {
  testo: string;
  simbolo: string;
} {
  if (!codice) return { testo: "—", simbolo: "•" };
  const notte = codice.endsWith("_night");
  const base = codice.replace(/_(day|night|polartwilight)$/, "");
  /* Il temporale può arrivare appiccicato a qualunque cosa
     («rainshowersandthunder»): se c'è, è la notizia. */
  const voce = base.includes("thunder")
    ? CIELO.thunder
    : (CIELO[base] ?? null);
  if (!voce) return { testo: "—", simbolo: "•" };
  return {
    testo: voce.testo,
    simbolo: (notte ? (voce.notte ?? voce.giorno) : voce.giorno),
  };
}

/** m/s → km/h. Il servizio dà i metri al secondo, che nessuno usa parlando. */
export function inKmOrari(metriAlSecondo: number): number {
  return Math.round(metriAlSecondo * 3.6);
}

/** «2026-09-21T15:00:00Z» → «15», nel fuso di chi guarda. */
export function oraLocale(iso: string): string {
  return String(new Date(iso).getHours());
}

/* La forma minima della risposta di MET Norway che serve qui. Non si tipizza
   tutto il documento: quello che non si usa non si descrive, o si diventa
   responsabili di tenerlo allineato a un servizio che non si controlla. */
interface PuntoMet {
  time: string;
  data: {
    instant: {
      details: {
        air_temperature: number;
        wind_speed: number;
      };
    };
    next_1_hours?: {
      summary?: { symbol_code?: string };
      details?: { precipitation_amount?: number };
    };
  };
}

export interface RispostaMet {
  properties: {
    meta: { updated_at: string };
    timeseries: PuntoMet[];
  };
}

/**
 * Dalla risposta del servizio a quello che il blocco disegna.
 *
 * `quante` ore mostrare è un parametro e non una costante perché la striscia
 * cambia larghezza con la dimensione del blocco: chi disegna sa quante ne
 * entrano, questo modulo no.
 */
export function leggiMeteo(risposta: RispostaMet, quante = 6): Meteo | null {
  const punti = risposta?.properties?.timeseries;
  if (!Array.isArray(punti) || punti.length === 0) return null;

  const ora = punti[0];
  const cielo = leggiCielo(ora.data.next_1_hours?.summary?.symbol_code);

  return {
    adesso: {
      gradi: Math.round(ora.data.instant.details.air_temperature),
      descrizione: cielo.testo,
      simbolo: cielo.simbolo,
      vento: inKmOrari(ora.data.instant.details.wind_speed),
      aggiornato: risposta.properties.meta.updated_at,
    },
    /* Si parte dal punto DOPO quello corrente: la prima riga della striscia
       dice «fra un'ora», non «adesso», che è già scritto sopra in grande. */
    prossime: punti.slice(1, quante + 1).map((p) => ({
      ora: oraLocale(p.time),
      gradi: Math.round(p.data.instant.details.air_temperature),
      simbolo: leggiCielo(p.data.next_1_hours?.summary?.symbol_code).simbolo,
      pioggia: p.data.next_1_hours?.details?.precipitation_amount ?? 0,
    })),
  };
}

/** Coordinate di Parma, dove sta l'ufficio. */
export const PARMA = { lat: 44.8015, lon: 10.3279 } as const;
