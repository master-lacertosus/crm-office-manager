import type { Metadata } from "next";

import { AppearanceSettings } from "@/components/appearance-settings";

export const metadata: Metadata = { title: "Aspetto" };

export default function AppearanceSettingsPage() {
  return <AppearanceSettings />;
}
