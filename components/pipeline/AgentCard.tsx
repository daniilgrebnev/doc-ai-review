"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, RotateCcw } from "lucide-react";
import { getAgentIcon } from "@/lib/agents/icons";
import { agentNameKey, agentRoleKey } from "@/lib/i18n/agents";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/pipeline/StatusBadge";
import { useAgentFlowStore } from "@/store/useAgentFlowStore";
import type { AgentDefinition, AgentId, AgentResult } from "@/types/agent";

const agentTint: Record<AgentId, string> = {
  lawyer: "text-[var(--agent-lawyer)]",
  finance: "text-[var(--agent-finance)]",
  security: "text-[var(--agent-security)]",
  pm: "text-[var(--agent-pm)]",
};

interface AgentCardProps {
  agent: AgentDefinition;
  result?: AgentResult;
}

export function AgentCard({ agent, result }: AgentCardProps) {
  const t = useT();
  const retryAgent = useAgentFlowStore((s) => s.retryAgent);
  const currentAgentId = useAgentFlowStore((s) => s.currentAgentId);
  const pipelineStatus = useAgentFlowStore((s) => s.pipelineStatus);
  const [expanded, setExpanded] = useState(true);

  const status = result?.status ?? "pending";
  const Icon = getAgentIcon(agent);
  const isProcessing = status === "processing" || currentAgentId === agent.id;
  const showRetry = status === "error" && pipelineStatus !== "running";
  const displayError = result?.error;
  const displayComment =
    result?.comment && result.errorKind !== "refusal" ? result.comment : null;
  const issues = result?.issues ?? [];
  const name = t(agentNameKey(agent.id));
  const role = t(agentRoleKey(agent.id));
  const canExpand = issues.length > 0 || Boolean(displayComment && displayComment.length > 80);

  if (isProcessing) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-border py-3"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <LoadingSpinner size="sm" />
            <div>
              <p className="text-sm font-medium text-foreground">{name}</p>
              <p className="text-xs text-muted">{role}</p>
            </div>
          </div>
          <Skeleton className="h-4 w-24" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="border-b border-border py-3 last:border-b-0"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Icon
            className={cn("mt-0.5 h-4 w-4 shrink-0", agentTint[agent.id])}
            strokeWidth={1.75}
          />
          <div>
            <p className="text-sm font-medium text-foreground">{name}</p>
            <p className="text-xs text-muted">{role}</p>
          </div>
        </div>
        <StatusBadge status={status} errorKind={result?.errorKind} />
      </div>

      {displayError && (
        <p className="mt-2 text-sm text-red-600">{displayError}</p>
      )}

      {displayComment && (
        <button
          type="button"
          onClick={() => canExpand && setExpanded((v) => !v)}
          className={cn(
            "mt-2 flex w-full items-start gap-1 text-left text-sm leading-relaxed text-neutral-600",
            canExpand && "hover:text-foreground"
          )}
          disabled={!canExpand}
        >
          <span className={cn(!expanded && canExpand && "line-clamp-2")}>
            {displayComment}
          </span>
          {canExpand && (
            <ChevronDown
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0 transition-transform",
                expanded && "rotate-180"
              )}
            />
          )}
        </button>
      )}

      {!displayComment && !displayError && status === "pending" && (
        <p className="mt-2 text-sm text-muted">—</p>
      )}

      {expanded && issues.length > 0 && (
        <div className="mt-2 rounded-md bg-neutral-50 px-3 py-2">
          <p className="text-xs font-medium text-muted">{t("review.issues")}</p>
          <ul className="mt-1 list-inside list-disc text-xs text-neutral-600">
            {issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {showRetry && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 -ml-2"
          onClick={() => retryAgent(agent.id)}
          aria-label={t("review.retryAgent", { name })}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t("review.retry")}
        </Button>
      )}
    </motion.div>
  );
}
