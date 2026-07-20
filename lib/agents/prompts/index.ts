import { SYSTEM_PROMPT_FINANCE } from "@/lib/agents/prompts/finance";
import { SYSTEM_PROMPT_LAWYER } from "@/lib/agents/prompts/lawyer";
import { SYSTEM_PROMPT_PM } from "@/lib/agents/prompts/pm";
import { SYSTEM_PROMPT_SECURITY } from "@/lib/agents/prompts/security";
import type { AgentId } from "@/types/agent";

const PROMPTS: Record<AgentId, string> = {
  lawyer: SYSTEM_PROMPT_LAWYER,
  finance: SYSTEM_PROMPT_FINANCE,
  security: SYSTEM_PROMPT_SECURITY,
  pm: SYSTEM_PROMPT_PM,
};

export function getPromptByAgentId(agentId: string): string | undefined {
  return PROMPTS[agentId as AgentId];
}
