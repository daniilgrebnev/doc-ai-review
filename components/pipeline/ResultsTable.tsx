"use client";

import { useState } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { getSortedAgents } from "@/lib/agents/config";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/pipeline/StatusBadge";
import { useAgentFlowStore } from "@/store/useAgentFlowStore";
import type { AgentDefinition, AgentResult } from "@/types/agent";

function ResultRow({
  agent,
  result,
}: {
  agent: AgentDefinition;
  result?: AgentResult;
}) {
  const [expanded, setExpanded] = useState(true);
  const retryAgent = useAgentFlowStore((s) => s.retryAgent);
  const currentAgentId = useAgentFlowStore((s) => s.currentAgentId);
  const pipelineStatus = useAgentFlowStore((s) => s.pipelineStatus);

  const status = result?.status ?? "pending";
  const isProcessing = status === "processing" || currentAgentId === agent.id;
  const showRetry = status === "error" && pipelineStatus !== "running";
  const comment = result?.comment || result?.error;
  const issues = result?.issues ?? [];

  if (isProcessing) {
    return (
      <tr className="border-b border-border bg-neutral-50">
        <td className="px-4 py-3 font-medium text-neutral-900">{agent.name}</td>
        <td className="px-4 py-3">
          <StatusBadge status="processing" />
        </td>
        <td className="px-4 py-3" colSpan={2}>
          <Skeleton className="h-4 w-full max-w-md" />
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr
        className={cn(
          "border-b border-border",
          status === "pending" && "bg-white",
          status !== "pending" && "bg-neutral-50/50"
        )}
      >
        <td className="px-4 py-3 font-medium text-neutral-900">{agent.name}</td>
        <td className="px-4 py-3">
          <StatusBadge status={status} />
        </td>
        <td className="max-w-md px-4 py-3">
          {comment ? (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex items-start gap-1 text-left text-sm text-neutral-600 hover:text-neutral-900"
            >
              <span className="line-clamp-2 flex-1">{comment}</span>
              {(issues.length > 0 || comment.length > 80) && (
                <ChevronDown
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0 transition-transform",
                    expanded && "rotate-180"
                  )}
                />
              )}
            </button>
          ) : (
            <span className="text-sm text-muted">Комментарий отсутствует</span>
          )}
        </td>
        <td className="px-4 py-3">
          {showRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => retryAgent(agent.id)}
              aria-label={`Повторить анализ: ${agent.name}`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </td>
      </tr>
      {expanded && issues.length > 0 && (
        <tr className="border-b border-border bg-white">
          <td colSpan={4} className="px-4 py-2">
            <ul className="list-inside list-disc text-xs text-neutral-600">
              {issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}

interface ResultsTableProps {
  showEmpty?: boolean;
}

export function ResultsTable({ showEmpty = false }: ResultsTableProps) {
  const agentResults = useAgentFlowStore((s) => s.agentResults);
  const pipelineStatus = useAgentFlowStore((s) => s.pipelineStatus);
  const agents = getSortedAgents();

  const allPending = agents.every(
    (a) => agentResults[a.id]?.status === "pending"
  );

  if (showEmpty && pipelineStatus === "idle" && allPending) {
    return (
      <EmptyState
        title='Загрузите документ и нажмите "Запустить"'
        description="Результаты проверки появятся здесь"
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="sticky top-0 bg-neutral-100">
          <tr>
            <th className="px-4 py-2.5 font-medium text-neutral-700">
              Участник
            </th>
            <th className="px-4 py-2.5 font-medium text-neutral-700">
              Статус
            </th>
            <th className="px-4 py-2.5 font-medium text-neutral-700">
              Комментарий
            </th>
            <th className="px-4 py-2.5 font-medium text-neutral-700">
              Действие
            </th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
            <ResultRow
              key={agent.id}
              agent={agent}
              result={agentResults[agent.id]}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
