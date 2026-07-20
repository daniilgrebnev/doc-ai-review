import type { AgentResult } from "@/types/agent";

export interface ReviseRequest {
  documentText: string;
  agentResults: AgentResult[];
}

export interface ReviseResponse {
  revisedText: string;
}
