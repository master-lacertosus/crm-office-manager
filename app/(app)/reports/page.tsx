import type { Metadata } from "next";
import { Suspense } from "react";

import { ReportsContent } from "@/components/reports-content";
import { Topbar } from "@/components/shell/topbar";

export const metadata: Metadata = { title: "Report" };

export default function ReportsPage() {
  return (
    <>
      <Topbar title="Report" />
      <Suspense>
        <ReportsContent />
      </Suspense>
    </>
  );
}
