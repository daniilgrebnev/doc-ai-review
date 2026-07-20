export type AgentStatus =
  | "pending"
  | "processing"
  | "approved"
  | "rejected"
  | "revision"
  | "error";

export type PipelineStatus = "idle" | "running" | "completed" | "error";

export type AgentId = "lawyer" | "finance" | "security" | "pm";

export interface AgentDefinition {
  id: AgentId;
  name: string;
  role: string;
  order: number;
  iconName: "Scale" | "Wallet" | "Shield" | "Briefcase";
}

export type AgentErrorKind = "refusal" | "parse" | "network";

export interface AgentResult {
  agentId: string;
  status: AgentStatus;
  comment: string;
  issues?: string[];
  processedAt?: string;
  error?: string;
  errorKind?: AgentErrorKind;
}

export interface AnalyzeResponse {
  agentId: string;
  status: AgentStatus;
  comment: string;
  usage?: {
    inputTextTokens: string;
    completionTokens: string;
    totalTokens: string;
  };
}

export type Verdict = "approved" | "rejected" | "revision";

export interface ReviewRecord {
  id: string;
  createdAt: string;
  documentPreview: string;
  documentText: string;
  agentResults: AgentResult[];
  verdict: Verdict;
  elapsedSeconds: number;
}
