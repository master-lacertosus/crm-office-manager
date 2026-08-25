import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import { Providers } from "@/components/providers";
import { TruncationTitles } from "@/components/truncation-titles";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Lacertosus Office OS",
    template: "%s · Lacertosus Office OS",
  },
  description:
    "Piattaforma operativa dell'ufficio marketing ed e-commerce Lacertosus.",
};

/*
 * Le preferenze d'aspetto, prima del primo disegno.
 *
 * La densita' rimappa `--spacing`, che in Tailwind v4 e' l'unita' da cui
 * discende OGNI misura: margini, imbottiture, distanze, altezze. Cambiarla
 * non ritocca un dettaglio, riscala l'interfaccia intera — misurato, il 9%
 * fra «compatto» e «comodo».
 *
 * Finora veniva applicata da un effetto React, cioe' dopo che il browser
 * aveva gia' disegnato tutto alla misura predefinita: si vedeva la pagina a
 * una scala e poi saltare all'altra, a ogni ricaricamento. Uno zoom non
 * voluto.
 *
 * Questo script e' sincrono e sta nel <head>: il browser lo esegue prima di
 * dipingere, quindi il primo fotogramma e' gia' quello giusto. Non c'e'
 * niente da smorzare con una transizione, perche' non c'e' piu' nessun
 * salto: l'unica animazione che non si nota e' quella che non serve.
 *
 * Deve restare minuscolo e non fallire mai: blocca il disegno, e un errore
 * qui lascerebbe la pagina bianca. Per questo legge dentro un try e, se
 * qualcosa non torna, semplicemente non fa niente e si ricade sui valori
 * predefiniti — lo stesso esito di prima.
 */
const PREFERENZE_PRIMA_DEL_DISEGNO = `try{
var p=JSON.parse(localStorage.getItem("office-prefs")||"{}"),e=document.documentElement;
if(p.density&&p.density!=="comfortable")e.setAttribute("data-density",p.density);
if(p.accent&&p.accent!=="orange")e.setAttribute("data-accent",p.accent);
if(p.reduceMotion)e.setAttribute("data-reduce-motion","1");
}catch(_){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${manrope.variable} ${plexMono.variable} h-full`}
      /* Lo script qui sotto scrive attributi che il server non conosce:
         senza questo React segnalerebbe una differenza a ogni caricamento. */
      suppressHydrationWarning
    >
      <head>
        <script
          // Il contenuto e' una costante scritta qui sopra: non arriva
          // niente dall'esterno, non c'e' niente da iniettare.
          dangerouslySetInnerHTML={{ __html: PREFERENZE_PRIMA_DEL_DISEGNO }}
        />
      </head>
      <body className="flex min-h-full flex-col">
        <div aria-hidden className="aura-layer print:hidden" />
        <TruncationTitles />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
