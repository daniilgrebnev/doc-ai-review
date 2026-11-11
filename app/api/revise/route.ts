import { NextResponse } from "next/server";
import { getSortedAgents } from "@/lib/agents/config";
import { applyTextPatches, parseTextPatches } from "@/lib/agents/apply-patches";
import { parseRevisedText } from "@/lib/agents/revise-parser";
import {
  buildPatchUserMessage,
  buildReviseUserMessage,
  SYSTEM_PROMPT_REVISE,
  SYSTEM_PROMPT_REVISE_MINIMAL,
  SYSTEM_PROMPT_REVISE_PATCHES,
  SYSTEM_PROMPT_REVISE_STRICT,
} from "@/lib/agents/prompts/revise";
import { isRefusalText, REFUSAL_REVISE_MESSAGE } from "@/lib/agents/refusal";
import { demoDelay } from "@/lib/demo/delay";
import { getDemoReviseResult } from "@/lib/demo/sample-contract";
import { LLM_INPUT_MAX_CHARS, MIN_DOCUMENT_LENGTH } from "@/lib/constants";
import { getStatusLabel } from "@/lib/pipeline/verdict";
import { truncateText } from "@/lib/utils";
import { LlmError } from "@/lib/claude/types";
import { llmComplete } from "@/lib/llm/complete";
import { resolveProvider } from "@/lib/llm/providers";
import type { ProviderId } from "@/lib/llm/types";
import type { AgentResult } from "@/types/agent";

const REVISE_ATTEMPTS: Array<{
  systemPrompt: string;
  variant: "default" | "template" | "minimal";
  /** Используется только YandexGPT */
  temperature: number;
}> = [
  { systemPrompt: SYSTEM_PROMPT_REVISE, variant: "default", temperature: 0.2 },
  { systemPrompt: SYSTEM_PROMPT_REVISE_STRICT, variant: "template", temperature: 0.1 },
  { systemPrompt: SYSTEM_PROMPT_REVISE_MINIMAL, variant: "minimal", temperature: 0.05 },
];

function buildRemarksMessage(agentResults: AgentResult[]): string {
  const agents = getSortedAgents();
  const lines: string[] = [];

  for (const agent of agents) {
    const result = agentResults.find((r) => r.agentId === agent.id);
    if (!result || (!result.comment && !result.issues?.length)) continue;

    const issuesText =
      result.issues && result.issues.length > 0
        ? `\n  Замечания: ${result.issues.join("; ")}`
        : "";

    lines.push(
      `- ${agent.name} (${getStatusLabel(result.status)}): ${result.comment || "—"}${issuesText}`
    );
  }

  return lines.join("\n");
}

async function tryFullRewrite(
  document: string,
  remarks: string,
  provider: ProviderId
): Promise<{ text: string; model: string } | null> {
  for (const attempt of REVISE_ATTEMPTS) {
    const userMessage = buildReviseUserMessage(document, remarks, attempt.variant);

    const { text, model: usedModel, refused } = await llmComplete(
      provider,
      [
        { role: "system", text: attempt.systemPrompt },
        { role: "user", text: userMessage },
      ],
      { purpose: "revise", temperature: attempt.temperature }
    );

    if (refused || isRefusalText(text)) continue;

    const parsed = parseRevisedText(text);
    if (parsed) return { text: parsed, model: usedModel };
  }

  return null;
}

async function tryPatchRewrite(
  document: string,
  remarks: string,
  provider: ProviderId
): Promise<{ text: string; model: string } | null> {
  const userMessage = buildPatchUserMessage(document, remarks);

  const { text, model: usedModel, refused } = await llmComplete(
    provider,
    [
      { role: "system", text: SYSTEM_PROMPT_REVISE_PATCHES },
      { role: "user", text: userMessage },
    ],
    { purpose: "revise", temperature: 0.1 }
  );

  if (refused || isRefusalText(text)) return null;

  const patches = parseTextPatches(text);
  if (patches.length === 0) return null;

  const { text: patched, applied } = applyTextPatches(document, patches);
  if (applied === 0) return null;

  return { text: patched, model: usedModel };
}

async function generateRevisedText(
  provider: ProviderId,
  fullDocument: string,
  remarks: string
): Promise<{ text: string; model: string } | null> {
  const llmDocument = truncateText(fullDocument, LLM_INPUT_MAX_CHARS);

  const fullRewrite = await tryFullRewrite(llmDocument, remarks, provider);
  if (fullRewrite) {
    if (llmDocument.length < fullDocument.length) {
      return {
        text: fullRewrite.text + fullDocument.slice(llmDocument.length),
        model: fullRewrite.model,
      };
    }
    return fullRewrite;
  }

  return tryPatchRewrite(fullDocument, remarks, provider);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      documentText?: string;
      agentResults?: AgentResult[];
      provider?: string;
    };

    const { documentText, agentResults } = body;

    if (!documentText || typeof documentText !== "string") {
      return NextResponse.json(
        { error: "documentText обязателен" },
        { status: 400 }
      );
    }

    if (!Array.isArray(agentResults) || agentResults.length === 0) {
      return NextResponse.json(
        { error: "agentResults обязателен" },
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

    const remarks = buildRemarksMessage(agentResults);

    if (!remarks) {
      return NextResponse.json(
        { error: "Нет замечаний для исправления" },
        { status: 400 }
      );
    }

    const resolution = resolveProvider(body.provider, request.headers);

    if (resolution.kind === "error") {
      return NextResponse.json({ error: resolution.message }, { status: resolution.status });
    }

    if (resolution.kind === "demo") {
      await demoDelay(1200 + Math.random() * 800);
      const demo = getDemoReviseResult();
      return NextResponse.json({
        revisedText: demo.revisedText,
        model: demo.model,
      });
    }

    const result = await generateRevisedText(resolution.provider, trimmedText, remarks);

    if (!result) {
      return NextResponse.json(
        { error: REFUSAL_REVISE_MESSAGE, errorKind: "refusal" },
        { status: 422 }
      );
    }

    return NextResponse.json({ revisedText: result.text, model: result.model });
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
