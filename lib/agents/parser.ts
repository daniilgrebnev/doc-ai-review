import type { AgentResult, AgentStatus } from "@/types/agent";
import { isRefusalText, REFUSAL_USER_MESSAGE } from "@/lib/agents/refusal";

const VALID_STATUSES: AgentStatus[] = ["approved", "rejected", "revision"];

const STATUS_ALIASES: Record<string, AgentStatus> = {
  approved: "approved",
  rejected: "rejected",
  revision: "revision",
  согласовано: "approved",
  отклонено: "rejected",
  "на доработку": "revision",
  доработка: "revision",
};

interface ParsedResponse {
  status: string;
  comment: string;
  issues?: string[];
}

function stripMarkdownJson(text: string): string {
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim();
  }
  return text.trim();
}

function extractJsonObject(text: string): string | null {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

function normalizeStatus(raw: string): AgentStatus | null {
  const key = raw.trim().toLowerCase();
  return STATUS_ALIASES[key] ?? null;
}

function buildComment(comment: string, issues?: string[]): string {
  const base = comment.trim();
  if (!issues || issues.length === 0) return base;

  const bullets = issues.map((i) => `• ${i.trim()}`).join("\n");
  if (!base) return bullets;
  return `${base}\n\n${bullets}`;
}

function parseJson(text: string): ParsedResponse | null {
  try {
    const cleaned = stripMarkdownJson(text);
    const jsonStr = extractJsonObject(cleaned) ?? cleaned;
    const parsed = JSON.parse(jsonStr) as ParsedResponse;

    if (parsed.status && parsed.comment !== undefined) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function parseAgentResponse(
  agentId: string,
  rawText: string
): AgentResult {
  const parsed = parseJson(rawText);

  if (parsed) {
    const normalized = normalizeStatus(parsed.status);
    const issues = Array.isArray(parsed.issues)
      ? parsed.issues.filter((i) => typeof i === "string" && i.trim())
      : undefined;
    const comment = buildComment(parsed.comment || "", issues);

    if (normalized && VALID_STATUSES.includes(normalized)) {
      return {
        agentId,
        status: normalized,
        comment,
        issues,
        processedAt: new Date().toISOString(),
      };
    }

    if (comment) {
      return {
        agentId,
        status: "revision",
        comment,
        issues,
        processedAt: new Date().toISOString(),
      };
    }
  }

  if (isRefusalText(rawText)) {
    return {
      agentId,
      status: "error",
      comment: "",
      error: REFUSAL_USER_MESSAGE,
      errorKind: "refusal",
      processedAt: new Date().toISOString(),
    };
  }

  return {
    agentId,
    status: "error",
    comment: rawText.slice(0, 500),
    error: "Не удалось распознать ответ агента",
    errorKind: "parse",
    processedAt: new Date().toISOString(),
  };
}
