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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${manrope.variable} ${plexMono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        <div aria-hidden className="aura-layer print:hidden" />
        <TruncationTitles />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
