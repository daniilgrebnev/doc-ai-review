"use client";

import { useEffect, useRef } from "react";
import { getSortedAgents } from "@/lib/agents/config";
import { ESTIMATED_AGENT_TIME_SEC } from "@/lib/constants";
import { formatElapsedTime } from "@/lib/utils";
import { AgentPipeline } from "@/components/pipeline/AgentPipeline";
import { PipelineStepper } from "@/components/pipeline/PipelineStepper";
import { PipelineSummary } from "@/components/pipeline/PipelineSummary";
import { PostReviewActions } from "@/components/pipeline/PostReviewActions";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { Panel } from "@/components/ui/Panel";
import { useToast } from "@/components/ui/Toast";
import { useAgentFlowStore } from "@/store/useAgentFlowStore";

export function PipelineView() {
  const pipelineStatus = useAgentFlowStore((s) => s.pipelineStatus);
  const agentResults = useAgentFlowStore((s) => s.agentResults);
  const pipelineError = useAgentFlowStore((s) => s.pipelineError);
  const elapsedSeconds = useAgentFlowStore((s) => s.elapsedSeconds);
  const currentAgentId = useAgentFlowStore((s) => s.currentAgentId);
  const runPipeline = useAgentFlowStore((s) => s.runPipeline);
  const { toast } = useToast();
  const prevStatus = useRef(pipelineStatus);

  useEffect(() => {
    if (prevStatus.current !== "completed" && pipelineStatus === "completed") {
      toast("Проверка завершена. Результат сохранён в историю.", "success");
    }
    prevStatus.current = pipelineStatus;
  }, [pipelineStatus, toast]);

  const agents = getSortedAgents();
  const totalAgents = agents.length;
  const completedCount = Object.values(agentResults).filter(
    (r) =>
      r.status === "approved" ||
      r.status === "rejected" ||
      r.status === "revision" ||
      r.status === "error"
  ).length;
  const currentIndex = currentAgentId
    ? agents.findIndex((a) => a.id === currentAgentId) + 1
    : completedCount;
  const progressPercent = Math.round((completedCount / totalAgents) * 100);
  const isRunning = pipelineStatus === "running";
  const results = agents.map((a) => agentResults[a.id]).filter(Boolean);
  const remainingAgents = Math.max(totalAgents - completedCount, 0);
  const estimatedRemaining = remainingAgents * ESTIMATED_AGENT_TIME_SEC;

  return (
    <Panel>
      <PipelineStepper />

      {isRunning && (
        <div className="mb-6 space-y-2" aria-live="polite">
          <div className="flex justify-between text-xs text-muted">
            <span>
              Этап {Math.min(currentIndex, totalAgents)} из {totalAgents}
            </span>
            <span>{formatElapsedTime(elapsedSeconds)}</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {remainingAgents > 0 && (
            <p className="text-xs text-muted">
              Осталось ~{formatElapsedTime(estimatedRemaining)}
            </p>
          )}
        </div>
      )}

      {pipelineError && (
        <div className="mb-6">
          <ErrorAlert message={pipelineError} onRetry={runPipeline} />
        </div>
      )}

      <AgentPipeline showEmpty={pipelineStatus === "idle"} />

      {pipelineStatus === "completed" && results.length > 0 && (
        <div className="mt-6 space-y-4">
          <PipelineSummary results={results} />
          <PostReviewActions results={results} />
        </div>
      )}
    </Panel>
  );
}
