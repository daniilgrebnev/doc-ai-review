import { NextResponse } from "next/server";
import { getAgentById, isValidAgentId } from "@/lib/agents/config";
import { parseAgentResponse } from "@/lib/agents/parser";
import { getPromptByAgentId } from "@/lib/agents/prompts";
import { demoDelay } from "@/lib/demo/delay";
import { getDemoAnalyzeResult } from "@/lib/demo/sample-contract";
import {
  isRefusalText,
  REFUSAL_RETRY_PREFIX,
  REFUSAL_USER_MESSAGE,
} from "@/lib/agents/refusal";
import {
  LLM_INPUT_MAX_CHARS,
  MIN_DOCUMENT_LENGTH,
} from "@/lib/constants";
import { getStatusLabel } from "@/lib/pipeline/verdict";
import { truncateText } from "@/lib/utils";
import type { CompleteResult } from "@/lib/claude/types";
import { LlmError } from "@/lib/claude/types";
import { llmComplete } from "@/lib/llm/complete";
import { resolveProvider } from "@/lib/llm/providers";
import type { ProviderId } from "@/lib/llm/types";
import type { AgentResult } from "@/types/agent";

const RETRY_PROMPT =
  'Верни строго JSON без текста вокруг. Формат: {"status":"approved|rejected|revision","comment":"...","issues":[]}';

function buildPreviousContext(previousResults: AgentResult[]): string {
  if (!previousResults.length) return "";

  const lines = previousResults
    .filter((r) => r.comment && r.status !== "pending" && r.status !== "processing")
    .map((r) => {
      const name = getAgentById(r.agentId)?.name ?? r.agentId;
      return `- ${name} (${getStatusLabel(r.status)}): ${r.comment}`;
    });

  if (!lines.length) return "";

  return `\n\nЗамечания предыдущих экспертов:\n${lines.join("\n")}`;
}

function isRefused(result: CompleteResult): boolean {
  return result.refused || isRefusalText(result.text);
}

function refusalResult(agentId: string): AgentResult {
  return {
    agentId,
    status: "error",
    comment: "",
    error: REFUSAL_USER_MESSAGE,
    errorKind: "refusal",
    processedAt: new Date().toISOString(),
  };
}

async function analyzeWithRetry(
  provider: ProviderId,
  agentId: string,
  systemPrompt: string,
  userMessage: string
): Promise<AgentResult> {
  const messages = [
    { role: "system" as const, text: systemPrompt },
    { role: "user" as const, text: userMessage },
  ];

  const first = await llmComplete(provider, messages, { purpose: "analyze" });
  const text = first.text;

  if (isRefused(first)) {
    const retry = await llmComplete(
      provider,
      [
        {
          role: "system",
          text: `${REFUSAL_RETRY_PREFIX}\n\n${systemPrompt}`,
        },
        { role: "user", text: userMessage },
      ],
      { purpose: "analyze", temperature: 0.1 }
    );

    if (isRefused(retry)) {
      return refusalResult(agentId);
    }

    const retryResult = parseAgentResponse(agentId, retry.text);
    if (retryResult.status !== "error") {
      return retryResult;
    }
  }

  let result = parseAgentResponse(agentId, text);

  if (result.status === "error" && result.errorKind === "refusal") {
    return result;
  }

  if (result.status === "error") {
    if (process.env.NODE_ENV === "development") {
      console.error("[analyze] parse failed, raw:", text.slice(0, 500));
    }

    const retry = await llmComplete(
      provider,
      [
        { role: "system", text: `${systemPrompt}\n\n${RETRY_PROMPT}` },
        { role: "user", text: userMessage },
      ],
      { purpose: "analyze", temperature: 0.1 }
    );

    if (isRefused(retry)) {
      return refusalResult(agentId);
    }

    result = parseAgentResponse(agentId, retry.text);
  }

  return result;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      agentId?: string;
      documentText?: string;
      previousResults?: AgentResult[];
      provider?: string;
    };

    const { agentId, documentText, previousResults = [] } = body;

    if (!agentId || !isValidAgentId(agentId)) {
      return NextResponse.json(
        { error: "Невалидный agentId. Допустимые: lawyer, finance, security, pm" },
        { status: 400 }
      );
    }

    if (!documentText || typeof documentText !== "string") {
      return NextResponse.json(
        { error: "documentText обязателен" },
        { status: 400 }
      );
    }

    const trimmedText = documentText.trim();

    if (trimmedText.length < MIN_DOCUMENT_LENGTH) {
      return NextResponse.json(
        { error: `Документ слишком короткий (минимум ${MIN_DOCUMENT_LENGTH} символов)` },
        { status: 400 }
      );
    }

    const resolution = resolveProvider(body.provider, request.headers);

    if (resolution.kind === "error") {
      return NextResponse.json({ error: resolution.message }, { status: resolution.status });
    }

    if (resolution.kind === "demo") {
      await demoDelay(800 + Math.random() * 700);
      const result = getDemoAnalyzeResult(agentId);
      return NextResponse.json({
        agentId: result.agentId,
        status: result.status,
        comment: result.comment,
        issues: result.issues,
      });
    }

    const truncatedDocument = truncateText(trimmedText, LLM_INPUT_MAX_CHARS);

    const systemPrompt = getPromptByAgentId(agentId);
    if (!systemPrompt) {
      return NextResponse.json(
        { error: "Промпт для агента не найден" },
        { status: 400 }
      );
    }

    const previousContext = buildPreviousContext(previousResults);
    const userMessage = `Проанализируй следующий документ:\n\n${truncatedDocument}${previousContext}`;

    const result = await analyzeWithRetry(resolution.provider, agentId, systemPrompt, userMessage);

    return NextResponse.json({
      agentId: result.agentId,
      status: result.status,
      comment: result.comment,
      issues: result.issues,
      error: result.error,
      errorKind: result.errorKind,
    });
  } catch (error) {
    if (error instanceof LlmError) {
      const status = error.statusCode ?? 500;
      return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
