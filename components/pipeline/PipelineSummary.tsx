"use client";

import { getSortedAgents } from "@/lib/agents/config";
import { computeVerdict } from "@/lib/pipeline/verdict";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { AgentResult } from "@/types/agent";

interface PipelineSummaryProps {
  results: AgentResult[];
}

const verdictClass: Record<ReturnType<typeof computeVerdict>, string> = {
  approved: "border-green-200 bg-green-50",
  rejected: "border-red-200 bg-red-50",
  revision: "border-amber-200 bg-amber-50",
};

export function PipelineSummary({ results }: PipelineSummaryProps) {
  const t = useT();
  const totalAgents = getSortedAgents().length;
  const approvedCount = results.filter((r) => r.status === "approved").length;
  const verdict = computeVerdict(results);

  return (
    <div className={cn("rounded-lg border px-4 py-4", verdictClass[verdict])}>
      <h3 className="text-sm font-medium text-foreground">
        {t(`verdict.${verdict}`)}
      </h3>
      <p className="mt-1 text-sm text-neutral-600">
        {t(`verdict.${verdict}Desc`)}
      </p>
      <p className="mt-2 text-xs text-neutral-500">
        {t("verdict.approvedCount", {
          approved: approvedCount,
          total: totalAgents,
        })}
      </p>
    </div>
  );
}
