"use client";

import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { AvatarInitials } from "@/components/avatar-initials";
import { Badge } from "@/components/ui/badge";

export function TeamContent() {
  const { profiles, tasks, currentUser } = useAppStore();

  return (
    <div className="flex-1 px-4 py-4 sm:px-6">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        {profiles.map((profile, index) => {
          const openCount = tasks.filter(
            (t) => t.owner_id === profile.id && t.status !== "done",
          ).length;
          return (
            <div
              key={profile.id}
              className={cn(
                "flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3",
                index > 0 && "border-t border-border-soft",
                !profile.is_active && "opacity-60",
              )}
            >
              <AvatarInitials name={profile.full_name} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium text-ink">
                  {profile.full_name}
                  {profile.id === currentUser.id ? (
                    <span className="text-xs font-normal text-ink-muted">
                      (tu)
                    </span>
                  ) : null}
                </p>
                <p className="font-mono text-xs text-ink-muted">
                  {profile.email}
                </p>
              </div>
              <span className="hidden font-mono text-xs text-ink-muted sm:inline">
                {openCount} task aperti
              </span>
              {!profile.is_active ? (
                <Badge variant="outline">Disattivato</Badge>
              ) : profile.role === "admin" ? (
                <Badge variant="brand">Admin</Badge>
              ) : (
                <Badge>Member</Badge>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[13px] text-ink-muted">
        Inviti, cambio ruolo e disattivazione si attiveranno con il
        collegamento a Supabase (milestone M2).
      </p>
    </div>
  );
}
