import type { Metadata } from "next";
import { Suspense } from "react";

import { DashboardContent } from "@/components/dashboard-content";
import { NewTaskButton } from "@/components/new-task-button";
import { Topbar } from "@/components/shell/topbar";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <Topbar
        title="Dashboard"
        actions={
          <Suspense>
            <NewTaskButton />
          </Suspense>
        }
      />
      <Suspense>
        <DashboardContent />
      </Suspense>
    </>
  );
}
