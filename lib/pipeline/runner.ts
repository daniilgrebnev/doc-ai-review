import { getSortedAgents } from "@/lib/agents/config";
import { AGENT_DELAY_MS } from "@/lib/constants";
import type { ProviderId } from "@/lib/llm/types";
import type { AgentResult } from "@/types/agent";

type ProgressCallback = (
  agentId: string,
  phase: "processing" | "done",
  result?: AgentResult
) => void;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runAgentPipeline(
  documentText: string,
  provider: ProviderId | null,
  onProgress: ProgressCallback
): Promise<AgentResult[]> {
  const agents = getSortedAgents();
  const results: AgentResult[] = [];

  for (const agent of agents) {
    onProgress(agent.id, "processing");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: agent.id,
          documentText,
          previousResults: results,
          provider,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        const errorMessage =
          data.error ??
          (response.status === 504
            ? "Превышено время ожидания. Проверьте подключение."
            : "Ошибка при анализе документа");

        const errorResult: AgentResult = {
          agentId: agent.id,
          status: "error",
          comment: "",
          error: errorMessage,
          errorKind: "network",
          processedAt: new Date().toISOString(),
        };
        results.push(errorResult);
        onProgress(agent.id, "done", errorResult);
        continue;
      }

      const data = (await response.json()) as AgentResult;
      const result: AgentResult = {
        ...data,
        processedAt: new Date().toISOString(),
      };
      results.push(result);
      onProgress(agent.id, "done", result);
    } catch {
      const errorResult: AgentResult = {
        agentId: agent.id,
        status: "error",
        comment: "",
        error: "Проверьте подключение к интернету",
        errorKind: "network",
        processedAt: new Date().toISOString(),
      };
      results.push(errorResult);
      onProgress(agent.id, "done", errorResult);
    }

    if (agent.order < agents.length) {
      await delay(AGENT_DELAY_MS);
    }
  }

  return results;
}
