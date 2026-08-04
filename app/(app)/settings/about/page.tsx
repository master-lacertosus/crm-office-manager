import type { Metadata } from "next";

import { AboutSettings } from "@/components/about-settings";

export const metadata: Metadata = { title: "Info" };

export default function AboutSettingsPage() {
  return <AboutSettings />;
}
