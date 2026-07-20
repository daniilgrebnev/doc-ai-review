"use client";

import { getSortedAgents } from "@/lib/agents/config";
import { useT } from "@/lib/i18n";
import { AgentCard } from "@/components/pipeline/AgentCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAgentFlowStore } from "@/store/useAgentFlowStore";

interface AgentPipelineProps {
  showEmpty?: boolean;
}

export function AgentPipeline({ showEmpty = false }: AgentPipelineProps) {
  const t = useT();
  const agentResults = useAgentFlowStore((s) => s.agentResults);
  const pipelineStatus = useAgentFlowStore((s) => s.pipelineStatus);
  const agents = getSortedAgents();

  const allPending = agents.every(
    (a) => agentResults[a.id]?.status === "pending"
  );

  if (showEmpty && pipelineStatus === "idle" && allPending) {
    return (
      <EmptyState
        title={t("review.emptyTitle")}
        description={t("review.emptyDesc")}
      />
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface px-4">
      {agents.map((agent) => (
        <AgentCard
          key={agent.id}
          agent={agent}
          result={agentResults[agent.id]}
        />
      ))}
    </div>
  );
}
