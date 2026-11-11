/**
 * POST /api/generate — a contract with known traps, written by the selected model.
 * Body: { level: 0..5, beneficiary: "contractor" | "client", defects?: DefectCode[], seed?: number, provider?: ProviderId }
 * Response: GenerateResponse (below). Same provider choice, geo lock and fallback order as /api/check.
 */
import { NextResponse } from "next/server";
import type { DefectCode } from "@/lib/check/types";
import { logCheckRun, type CheckRunLog, type RunAttempt } from "@/lib/db/runs";
import { GENERATOR_DEFECTS, generateContract, type GeneratedContract } from "@/lib/generator";
import {
  buildGenerateUserMessage,
  GENERATE_SYSTEM_PROMPT,
  parseGeneration,
  planGeneration,
  type ParsedGeneration,
} from "@/lib/generator/llm";
import type { CompleteResult } from "@/lib/claude/types";
import { llmComplete } from "@/lib/llm/complete";
import { getClientHash, getQuota, LIMIT_MESSAGE } from "@/lib/db/quota";
import { getRequestCountry } from "@/lib/llm/geo";
import { getProvidersForRequest, resolveProvider } from "@/lib/llm/providers";
import type { ProviderId } from "@/lib/llm/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MODEL_TIMEOUT_MS = 120_000;

export interface GenerateResponse {
  contract: GeneratedContract;
  /** "model" — written by the LLM; "template" — fallback to the built-in template generator */
  source: "model" | "template";
  provider?: ProviderId;
  model?: string;
  fallbackFrom?: ProviderId;
  /** Requested traps the model did not plant verifiably (they are not in the answer key) */
  missing: DefectCode[];
  ms: number;
  inputTokens?: number;
  outputTokens?: number;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

export async function POST(request: Request) {
  const t0 = Date.now();
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const level = Number(body.level ?? 3);
  const beneficiary = body.beneficiary === "client" ? "client" : "contractor";
  const defects = Array.isArray(body.defects)
    ? body.defects.filter((d): d is DefectCode => GENERATOR_DEFECTS.includes(d as DefectCode))
    : undefined;
  const rawSeed = Number(body.seed);
  const seed = Number.isFinite(rawSeed) && rawSeed > 0 ? Math.floor(rawSeed) : Math.floor(Math.random() * 1e6) + 1;
  const params = { level: Number.isFinite(level) ? level : 3, beneficiary, defects, seed } as const;
  const plan = planGeneration(params);

  const headers = request.headers;
  const run: Omit<CheckRunLog, "durationMs" | "text"> = {
    route: "generate",
    status: "failed",
    providerRequested: typeof body.provider === "string" ? body.provider : undefined,
    country: getRequestCountry(headers),
    clientHash: getClientHash(headers),
  };
  const attempts: RunAttempt[] = [];
  let contractText = "";

  try {
    const resolution = resolveProvider(body.provider, headers);
    if (resolution.kind === "error") {
      run.status = resolution.status === 403 ? "blocked" : "failed";
      run.error = resolution.message;
      return NextResponse.json({ error: resolution.message }, { status: resolution.status });
    }

    if (resolution.kind === "provider") {
      const quota = await getQuota(headers);
      if (quota?.exceeded) {
        run.status = "limited";
        return NextResponse.json({ error: LIMIT_MESSAGE, code: "limit" }, { status: 429 });
      }
    }

    const { providers } = getProvidersForRequest(headers);
    const order: ProviderId[] =
      resolution.kind === "provider"
        ? [resolution.provider, ...providers.filter((p) => p.available && p.id !== resolution.provider).map((p) => p.id)]
        : [];

    let best: { parsed: ParsedGeneration; provider: ProviderId; model: string } | null = null;
    let inTok = 0;
    let outTok = 0;

    outer: for (const provider of order) {
      // Up to 2 tries per model: the second one names the traps that were missing
      for (let attempt = 0; attempt < 2; attempt++) {
        const started = Date.now();
        try {
          const extra: string =
            attempt > 0 && best?.provider === provider && best.parsed.missing.length
              ? `\nYour previous answer missed or misquoted: ${best.parsed.missing.join(", ")}. Plant them and copy quotes exactly.`
              : "";
          const answer: CompleteResult = await withTimeout(
            llmComplete(
              provider,
              [
                { role: "system", text: GENERATE_SYSTEM_PROMPT },
                { role: "user", text: buildGenerateUserMessage(plan) + extra },
              ],
              { purpose: "revise", temperature: 0.7 }
            ),
            MODEL_TIMEOUT_MS
          );
          inTok += answer.usage.inputTokens;
          outTok += answer.usage.outputTokens;
          const parsed: ParsedGeneration | null = answer.refused ? null : parseGeneration(answer.text, plan);
          if (!parsed) throw new Error(answer.refused ? "refused" : "unparsable answer");
          attempts.push({ provider, ok: true, ms: Date.now() - started });
          if (!best || parsed.missing.length < best.parsed.missing.length) {
            best = { parsed, provider, model: answer.model };
          }
          if (parsed.missing.length === 0) break outer;
        } catch (error) {
          attempts.push({
            provider,
            ok: false,
            ms: Date.now() - started,
            error: error instanceof Error ? error.message.slice(0, 300) : String(error),
          });
          if (process.env.NODE_ENV === "development") console.error("[generate]", provider, error);
          break; // move on to the next model
        }
      }
      if (best) break;
    }

    if (!best) {
      // No model available or none answered: fall back to the template generator
      const contract = generateContract(params);
      contractText = contract.text;
      Object.assign(run, {
        status: order.length ? "failed" : "no_model",
        error: order.length ? "no model answered, used template" : "no model configured, used template",
        findingsCount: contract.key.length,
        findingsExact: contract.key.length,
      });
      const res: GenerateResponse = { contract, source: "template", missing: [], ms: Date.now() - t0 };
      return NextResponse.json(res);
    }

    const { parsed, provider, model } = best;
    contractText = parsed.contract.text;
    const fallbackFrom = resolution.kind === "provider" && provider !== resolution.provider ? resolution.provider : undefined;
    Object.assign(run, {
      status: "ok",
      provider,
      model,
      fallbackFrom,
      clauses: (contractText.match(/^\s*\d+\.\d+\.?\s/gm) ?? []).length,
      findingsCount: plan.defects.length,
      findingsExact: parsed.contract.key.length,
      inputTokens: inTok,
      outputTokens: outTok,
      modelMs: attempts.filter((a) => a.ok).at(-1)?.ms,
    });

    const res: GenerateResponse = {
      contract: parsed.contract,
      source: "model",
      provider,
      model,
      fallbackFrom,
      missing: parsed.missing,
      ms: Date.now() - t0,
      inputTokens: inTok,
      outputTokens: outTok,
    };
    return NextResponse.json(res);
  } catch (error) {
    run.status = "failed";
    run.error = error instanceof Error ? error.message.slice(0, 300) : "internal error";
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  } finally {
    await logCheckRun({ ...run, text: contractText, attempts: attempts.length ? attempts : undefined, durationMs: Date.now() - t0 });
  }
}
