import { SettingsTabs } from "@/components/settings-tabs";
import { Topbar } from "@/components/shell/topbar";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Topbar title="Impostazioni" />
      <SettingsTabs />
      <div className="w-full max-w-2xl flex-1 px-4 py-4 sm:px-6">{children}</div>
    </>
  );
}
