"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { getSortedAgents } from "@/lib/agents/config";
import { agentNameKey } from "@/lib/i18n/agents";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useAgentFlowStore } from "@/store/useAgentFlowStore";
import type { AgentStatus } from "@/types/agent";

function stepColor(status: AgentStatus, isActive: boolean): string {
  if (isActive) return "border-accent bg-accent text-white";
  switch (status) {
    case "approved":
      return "border-green-600 bg-green-50 text-green-700";
    case "rejected":
    case "error":
      return "border-red-600 bg-red-50 text-red-700";
    case "revision":
      return "border-amber-600 bg-amber-50 text-amber-700";
    case "processing":
      return "border-accent bg-white text-accent ring-2 ring-accent/40 animate-pulse";
    default:
      return "border-neutral-300 bg-white text-neutral-400";
  }
}

export function PipelineStepper() {
  const t = useT();
  const agentResults = useAgentFlowStore((s) => s.agentResults);
  const currentAgentId = useAgentFlowStore((s) => s.currentAgentId);
  const agents = getSortedAgents();

  return (
    <div
      className="overflow-x-auto"
      aria-live="polite"
      aria-label={t("review.progressAria")}
      role="status"
    >
      <div className="flex min-w-max items-center px-1">
        {agents.map((agent, index) => {
          const result = agentResults[agent.id];
          const status = result?.status ?? "pending";
          const isActive =
            currentAgentId === agent.id || status === "processing";
          const isDone =
            status === "approved" ||
            status === "rejected" ||
            status === "revision" ||
            status === "error";

          return (
            <div key={agent.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <motion.div
                  layout
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-medium transition-colors",
                    stepColor(status, isActive && !isDone)
                  )}
                  animate={isActive && !isDone ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                  transition={{ duration: 1.2, repeat: isActive && !isDone ? Infinity : 0 }}
                >
                  {isDone ? (
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                  ) : (
                    index + 1
                  )}
                </motion.div>
                <span className="mt-1.5 hidden max-w-[80px] truncate text-center text-xs text-muted sm:block">
                  {t(agentNameKey(agent.id))}
                </span>
              </div>
              {index < agents.length - 1 && (
                <div
                  className={cn(
                    "mx-2 h-0.5 w-8 sm:w-12",
                    isDone ? "bg-neutral-400" : "bg-neutral-200"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex justify-center gap-1.5 sm:hidden">
        {agents.map((agent) => {
          const status = agentResults[agent.id]?.status ?? "pending";
          const isActive = currentAgentId === agent.id;
          return (
            <div
              key={agent.id}
              className={cn(
                "h-2 w-2 rounded-full",
                isActive
                  ? "bg-accent"
                  : status !== "pending"
                    ? "bg-neutral-500"
                    : "bg-neutral-200"
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
