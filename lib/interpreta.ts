import { shiftIsoDays, todayIso } from "@/lib/format";
import type { Profile, Project } from "@/lib/types";

/**
 * Da una frase ai task che descrive.
 *
 * «Devo fare un video entro venerdì per Rimini Wellness e mi serve da
 * Lorenzo una landing entro il 12» sono due lavori, due responsabili, due
 * scadenze e un progetto. Scriverlo è un gesto solo; compilarlo sono otto
 * campi.
 *
 * QUESTO NON CAPISCE L'ITALIANO. Non c'è un modello linguistico dietro:
 * ci sono regole, e le regole sbagliano. La scommessa è un'altra — che
 * indovinare l'80% e lasciar correggere il resto sia comunque molto più
 * veloce che riempire tutto a mano.
 *
 * Per questo ogni cosa che non è certa resta VUOTA invece di essere
 * indovinata: una scadenza sbagliata costa più di una scadenza assente,
 * perché quella assente si vede, quella sbagliata no.
 *
 * Dove le regole vincono davvero è sui nomi e sui progetti: non vanno
 * interpretati, vanno RICONOSCIUTI. L'elenco delle persone e dei progetti
 * è noto, quindi lì non si tira a indovinare.
 */

export interface TaskProposto {
  /** Chiave locale per l'anteprima: non è ancora un task. */
  chiave: string;
  titolo: string;
  owner_id: string;
  due_date: string | null;
  project_id: string | null;
  /** Cosa ha fatto scattare ogni deduzione: si mostra a chi corregge, così
   *  capisce perché il sistema ha scelto quel campo. */
  perche: { campo: string; indizio: string }[];
}

/* ------------------------------------------------------------------ */
/* Le date                                                             */
/* ------------------------------------------------------------------ */

const GIORNI = [
  "domenica",
  "lunedì",
  "martedì",
  "mercoledì",
  "giovedì",
  "venerdì",
  "sabato",
];
/* Anche senza accento: nessuno lo scrive di fretta. */
const GIORNI_SENZA_ACCENTO = [
  "domenica",
  "lunedi",
  "martedi",
  "mercoledi",
  "giovedi",
  "venerdi",
  "sabato",
];

const MESI = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

const NUMERI_A_PAROLE: Record<string, number> = {
  un: 1,
  una: 1,
  uno: 1,
  due: 2,
  tre: 3,
  quattro: 4,
  cinque: 5,
  sei: 6,
  sette: 7,
  otto: 8,
  nove: 9,
  dieci: 10,
};

function isoDa(anno: number, mese: number, giorno: number): string {
  const m = String(mese).padStart(2, "0");
  const g = String(giorno).padStart(2, "0");
  return `${anno}-${m}-${g}`;
}

/** La data trovata nel testo, e il pezzo di testo che l'ha prodotta. */
export function trovaData(
  testo: string,
  oggi = todayIso(),
): { iso: string; indizio: string } | null {
  const t = testo.toLowerCase();

  const parole: [RegExp, () => string][] = [
    [/\boggi\b/, () => oggi],
    [/\bdomani\b/, () => shiftIsoDays(oggi, 1)],
    [/\bdopodomani\b/, () => shiftIsoDays(oggi, 2)],
  ];
  for (const [re, calcola] of parole) {
    const m = re.exec(t);
    if (m) return { iso: calcola(), indizio: m[0] };
  }

  /* «fra due settimane», «tra 3 giorni», «fra un mese» */
  const fra = /\b(?:fra|tra)\s+(\d+|\w+)\s+(giorn[oi]|settiman[ae]|mes[ei])\b/.exec(t);
  if (fra) {
    const quanti = Number(fra[1]) || NUMERI_A_PAROLE[fra[1]] || 0;
    if (quanti > 0) {
      const passo = fra[2].startsWith("giorn")
        ? 1
        : fra[2].startsWith("settiman")
          ? 7
          : 30;
      return { iso: shiftIsoDays(oggi, quanti * passo), indizio: fra[0] };
    }
  }

  /* «12/3», «12-03-2026» */
  const numerica = /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/.exec(t);
  if (numerica) {
    const g = Number(numerica[1]);
    const m = Number(numerica[2]);
    const annoOggi = Number(oggi.slice(0, 4));
    let a = numerica[3] ? Number(numerica[3]) : annoOggi;
    if (a < 100) a += 2000;
    if (g >= 1 && g <= 31 && m >= 1 && m <= 12) {
      let iso = isoDa(a, m, g);
      /* Senza anno, una data già passata si intende l'anno prossimo: «entro
         il 3/1» detto a dicembre non è dieci mesi fa. */
      if (!numerica[3] && iso < oggi) iso = isoDa(a + 1, m, g);
      return { iso, indizio: numerica[0] };
    }
  }

  /* «12 marzo», «il 3 di aprile» */
  const conMese = new RegExp(
    `\\b(\\d{1,2})\\s+(?:di\\s+)?(${MESI.join("|")})\\b`,
  ).exec(t);
  if (conMese) {
    const g = Number(conMese[1]);
    const m = MESI.indexOf(conMese[2]) + 1;
    const annoOggi = Number(oggi.slice(0, 4));
    let iso = isoDa(annoOggi, m, g);
    if (iso < oggi) iso = isoDa(annoOggi + 1, m, g);
    return { iso, indizio: conMese[0] };
  }

  /* «venerdì», «lunedì prossimo»: il primo giorno con quel nome da domani
     in poi. «Entro lunedì» detto di lunedì vuol dire il lunedì dopo. */
  for (let i = 0; i < 7; i++) {
    const nome = GIORNI[i];
    const senza = GIORNI_SENZA_ACCENTO[i];
    /* Confine scritto con \p{L} e non con \b: «venerdì» finisce con una
       lettera accentata, che in modalità ASCII non conta come tale — e il
       giorno più usato per le scadenze non veniva riconosciuto. */
    const re = new RegExp(
      `(?:^|[^\\p{L}])(${nome}|${senza})(?:[^\\p{L}]|$)`,
      "u",
    );
    const m = re.exec(t);
    if (!m) continue;
    for (let avanti = 1; avanti <= 7; avanti++) {
      const iso = shiftIsoDays(oggi, avanti);
      const [y, mm, dd] = iso.split("-").map(Number);
      if (new Date(y, mm - 1, dd).getDay() === i) {
        /* m[1] e non m[0]: il gruppo esterno ha inghiottito lo spazio
           accanto, e l'indizio serve a ritagliare il titolo con
           precisione. */
        return { iso, indizio: m[1] };
      }
    }
  }

  /* «entro il 12»: giorno del mese, senza mese. */
  const soloGiorno = /\bentro\s+(?:il\s+)?(\d{1,2})\b(?!\s*[/-])/.exec(t);
  if (soloGiorno) {
    const g = Number(soloGiorno[1]);
    if (g >= 1 && g <= 31) {
      const [a, m] = oggi.split("-").map(Number);
      let iso = isoDa(a, m, g);
      if (iso < oggi) iso = m === 12 ? isoDa(a + 1, 1, g) : isoDa(a, m + 1, g);
      return { iso, indizio: soloGiorno[0] };
    }
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Le persone e i progetti: riconosciuti, non interpretati             */
/* ------------------------------------------------------------------ */

/** Confronto senza accenti e senza maiuscole: «Nicolò» e «nicolo». */
function normale(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function contieneParola(testo: string, parola: string): boolean {
  if (!parola.trim()) return false;
  const re = new RegExp(
    `(^|[^\\p{L}])${parola.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`,
    "iu",
  );
  return re.test(testo);
}

/** La persona nominata nel segmento, se ce n'è una. */
export function trovaPersona(
  segmento: string,
  profiles: Profile[],
): { profilo: Profile; indizio: string } | null {
  const t = normale(segmento);
  for (const p of profiles) {
    if (!p.is_active) continue;
    const nome = normale(p.full_name.split(" ")[0]);
    const intero = normale(p.full_name);
    if (contieneParola(t, intero)) return { profilo: p, indizio: p.full_name };
    if (contieneParola(t, nome))
      return { profilo: p, indizio: p.full_name.split(" ")[0] };
  }
  return null;
}

/** Il progetto nominato, se esiste già. Non se ne inventano. */
export function trovaProgetto(
  testo: string,
  projects: Project[],
): { progetto: Project; indizio: string } | null {
  const t = normale(testo);
  /* Prima i nomi lunghi: «Rimini Wellness» batte «Rimini». */
  const ordinati = [...projects]
    .filter((p) => !p.is_archived)
    .sort((a, b) => b.name.length - a.name.length);
  for (const p of ordinati) {
    if (contieneParola(t, normale(p.name))) {
      return { progetto: p, indizio: p.name };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Spezzare la frase                                                   */
/* ------------------------------------------------------------------ */

/* I modi in cui si introduce una seconda richiesta. Sono i connettivi che
   la gente usa davvero parlando di lavoro, non una grammatica. */
const SEPARATORI = [
  /\s+ed?\s+(?:poi\s+)?(?:ho|avrei)\s+bisogno\s+/i,
  /\s+(?:ho|avrei)\s+bisogno\s+/i,
  /\s+ed?\s+mi\s+serv[eo]\s+/i,
  /\s+mi\s+serv[eo]\s+/i,
  /\s+ed?\s+(?:poi\s+)?(?:devo|dovrei)\s+/i,
  /\s*[;]\s*/,
  /\s+inoltre\s+/i,
  /\s+e\s+poi\s+/i,
];

export function spezza(testo: string): string[] {
  let pezzi = [testo.trim()];
  for (const sep of SEPARATORI) {
    pezzi = pezzi.flatMap((p) => p.split(sep));
  }
  return pezzi.map((p) => p.trim()).filter((p) => p.length > 0);
}

/* ------------------------------------------------------------------ */
/* Il titolo: cosa resta togliendo ciò che è diventato un campo        */
/* ------------------------------------------------------------------ */

const RUMORE = [
  /^(?:io\s+)?(?:devo|dovrei|voglio|vorrei)\s+/i,
  /^(?:di\s+)?\w+\s+che\s+mi\s+(?:faccia|fa|prepari|prepara)\s+/i,
  /^(?:da\s+)?\w+\s+(?:che|il|la|un[ao]?)\s+/i,
  /^(?:che\s+)?mi\s+(?:faccia|fa|prepari|prepara)\s+/i,
  /^(?:fare|preparare|creare|scrivere|montare)\s+/i,
  /^(?:un[ao]?|il|lo|la|i|gli|le|dei|delle)\s+/i,
  /\s+entro\s*$/i,
  /^\s*(?:ed?|poi|inoltre)\s+/i,
  /\s+(?:ed?|per|di|a|con)\s*$/i,
];

function ripulisci(segmento: string, daTogliere: string[]): string {
  let t = segmento;
  for (const pezzo of daTogliere) {
    if (!pezzo) continue;
    t = t.replace(
      new RegExp(
        `\\s*(?:entro\\s+(?:il\\s+)?|per\\s+|di\\s+|a\\s+)?${pezzo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`,
        "iu",
      ),
      " ",
    );
  }
  t = t.replace(/\s+/g, " ").trim();
  /* Il rumore si toglie a giri: «io devo fare un video» → «video». */
  let prima = "";
  while (prima !== t) {
    prima = t;
    for (const re of RUMORE) t = t.replace(re, "").trim();
  }
  return t.replace(/\s{2,}/g, " ").trim();
}

/* ------------------------------------------------------------------ */
/* L'interpretazione                                                   */
/* ------------------------------------------------------------------ */

export function interpreta(
  testo: string,
  contesto: {
    profiles: Profile[];
    projects: Project[];
    io: string;
    oggi?: string;
  },
): TaskProposto[] {
  const oggi = contesto.oggi ?? todayIso();
  const segmenti = spezza(testo);
  if (segmenti.length === 0) return [];

  /* Il progetto è contesto di TUTTA la frase, non del singolo pezzo: «per
     Rimini Wellness» detto una volta vale per il video e per la landing. */
  const progetto = trovaProgetto(testo, contesto.projects);

  return segmenti.map((segmento, i) => {
    const perche: TaskProposto["perche"] = [];

    const persona = trovaPersona(segmento, contesto.profiles);
    /* Nessun nome nel pezzo: è roba di chi scrive. È anche il motivo per
       cui «io devo» non ha bisogno di essere riconosciuto. */
    const owner_id = persona ? persona.profilo.id : contesto.io;
    if (persona) {
      perche.push({ campo: "responsabile", indizio: persona.indizio });
    }

    const data = trovaData(segmento, oggi);
    if (data) perche.push({ campo: "scadenza", indizio: data.indizio });

    if (progetto) {
      perche.push({ campo: "progetto", indizio: progetto.indizio });
    }

    const titolo = ripulisci(segmento, [
      data?.indizio ?? "",
      persona?.indizio ?? "",
      progetto?.indizio ?? "",
    ]);

    return {
      chiave: `proposto-${i}`,
      /* Se ripulendo non resta niente di sensato, meglio il pezzo intero
         che una riga vuota: chi corregge ha bisogno di sapere da dove
         viene. */
      titolo: titolo.length >= 3 ? titolo : segmento.trim(),
      owner_id,
      due_date: data?.iso ?? null,
      project_id: progetto?.progetto.id ?? null,
      perche,
    };
  });
}
