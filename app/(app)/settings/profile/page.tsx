import type { Metadata } from "next";

import { ProfileForm } from "@/components/profile-form";

export const metadata: Metadata = { title: "Profilo" };

export default function ProfileSettingsPage() {
  return <ProfileForm />;
}
