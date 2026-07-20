"use client";

import type { AgentStatus, AgentErrorKind } from "@/types/agent";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

interface StatusBadgeProps {
  status: AgentStatus;
  errorKind?: AgentErrorKind;
}

const statusClass: Record<AgentStatus, string> = {
  pending: "text-neutral-400",
  processing: "text-accent",
  approved: "text-green-700",
  rejected: "text-red-700",
  revision: "text-amber-700",
  error: "text-red-700",
};

export function StatusBadge({ status, errorKind }: StatusBadgeProps) {
  const t = useT();
  const label =
    status === "error" && errorKind === "refusal"
      ? t("status.refusal")
      : t(`status.${status}`);

  return (
    <span className={cn("text-xs font-medium", statusClass[status])}>
      {label}
    </span>
  );
}
