import type { Metadata } from "next";
import { Suspense } from "react";

import { ProblemsContent } from "@/components/problems-content";
import { Topbar } from "@/components/shell/topbar";

export const metadata: Metadata = { title: "Problemi" };

export default function ProblemsPage() {
  return (
    <>
      <Topbar title="Problemi" />
      <Suspense>
        <ProblemsContent />
      </Suspense>
    </>
  );
}
