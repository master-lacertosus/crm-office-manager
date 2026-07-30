import type { Metadata } from "next";

import { ReportsContent } from "@/components/reports-content";
import { Topbar } from "@/components/shell/topbar";

export const metadata: Metadata = { title: "Report" };

export default function ReportsPage() {
  return (
    <>
      <Topbar title="Report" />
      <ReportsContent />
    </>
  );
}
