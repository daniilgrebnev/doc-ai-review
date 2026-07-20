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
import { isDemoMode } from "@/lib/demo/is-demo-mode";
import { getDemoReviseResult } from "@/lib/demo/sample-contract";
import {
  LLM_INPUT_MAX_CHARS,
  MIN_DOCUMENT_LENGTH,
  REVISE_MAX_TOKENS,
  YANDEX_CLOUD_MODEL,
  resolveModel,
} from "@/lib/constants";
import { getStatusLabel } from "@/lib/pipeline/verdict";
import { truncateText } from "@/lib/utils";
import { complete } from "@/lib/yandex-gpt/client";
import { YandexGptError } from "@/lib/yandex-gpt/types";
import type { AgentResult } from "@/types/agent";

const REVISE_ATTEMPTS: Array<{
  systemPrompt: string;
  variant: "default" | "template" | "minimal";
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
  model: string
): Promise<{ text: string; model: string } | null> {
  for (const attempt of REVISE_ATTEMPTS) {
    const userMessage = buildReviseUserMessage(document, remarks, attempt.variant);

    const { text, model: usedModel } = await complete(
      [
        { role: "system", text: attempt.systemPrompt },
        { role: "user", text: userMessage },
      ],
      {
        model,
        temperature: attempt.temperature,
        maxTokens: REVISE_MAX_TOKENS,
        fallbackOn404: true,
      }
    );

    if (isRefusalText(text)) continue;

    const parsed = parseRevisedText(text);
    if (parsed) return { text: parsed, model: usedModel };
  }

  return null;
}

async function tryPatchRewrite(
  document: string,
  remarks: string,
  model: string
): Promise<{ text: string; model: string } | null> {
  const userMessage = buildPatchUserMessage(document, remarks);

  const { text, model: usedModel } = await complete(
    [
      { role: "system", text: SYSTEM_PROMPT_REVISE_PATCHES },
      { role: "user", text: userMessage },
    ],
    {
      model,
      temperature: 0.1,
      maxTokens: REVISE_MAX_TOKENS,
      fallbackOn404: true,
    }
  );

  if (isRefusalText(text)) return null;

  const patches = parseTextPatches(text);
  if (patches.length === 0) return null;

  const { text: patched, applied } = applyTextPatches(document, patches);
  if (applied === 0) return null;

  return { text: patched, model: usedModel };
}

async function generateRevisedText(
  fullDocument: string,
  remarks: string
): Promise<{ text: string; model: string } | null> {
  const model = resolveModel(process.env.YANDEX_CLOUD_MODEL, YANDEX_CLOUD_MODEL);
  const llmDocument = truncateText(fullDocument, LLM_INPUT_MAX_CHARS);

  const fullRewrite = await tryFullRewrite(llmDocument, remarks, model);
  if (fullRewrite) {
    if (llmDocument.length < fullDocument.length) {
      return {
        text: fullRewrite.text + fullDocument.slice(llmDocument.length),
        model: fullRewrite.model,
      };
    }
    return fullRewrite;
  }

  return tryPatchRewrite(fullDocument, remarks, model);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      documentText?: string;
      agentResults?: AgentResult[];
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

    if (isDemoMode()) {
      await demoDelay(1200 + Math.random() * 800);
      const demo = getDemoReviseResult();
      return NextResponse.json({
        revisedText: demo.revisedText,
        model: demo.model,
      });
    }

    const result = await generateRevisedText(trimmedText, remarks);

    if (!result) {
      return NextResponse.json(
        { error: REFUSAL_REVISE_MESSAGE, errorKind: "refusal" },
        { status: 422 }
      );
    }

    return NextResponse.json({ revisedText: result.text, model: result.model });
  } catch (error) {
    if (error instanceof YandexGptError) {
      const status = error.statusCode ?? 500;
      return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
