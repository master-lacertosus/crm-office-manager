import type { Metadata } from "next";
import { Suspense } from "react";

import { RequestsContent } from "@/components/requests-content";
import { Topbar } from "@/components/shell/topbar";

export const metadata: Metadata = { title: "Richieste" };

export default function RequestsPage() {
  return (
    <>
      <Topbar title="Richieste" />
      <Suspense>
        <RequestsContent />
      </Suspense>
    </>
  );
}
