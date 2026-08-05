import type { Metadata } from "next";
import { Suspense } from "react";

import { LeaveContent, RequestLeaveButton } from "@/components/leave-content";
import { Topbar } from "@/components/shell/topbar";

export const metadata: Metadata = { title: "Ferie & Permessi" };

export default function LeavePage() {
  return (
    <>
      <Topbar title="Ferie & Permessi" actions={<RequestLeaveButton />} />
      <Suspense>
        <LeaveContent />
      </Suspense>
    </>
  );
}
