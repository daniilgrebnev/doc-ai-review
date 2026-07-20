import type { AgentId } from "@/types/agent";

export function agentNameKey(id: AgentId): string {
  return `agents.${id}.name`;
}

export function agentRoleKey(id: AgentId): string {
  return `agents.${id}.role`;
}
