/**
 * POST /api/check — live contract check.
 * Streams NDJSON: agent steps, then findings, then "done" (or "error").
 * Body: { text: string, provider?: ProviderId }
 */
import {
  buildEscalation,
  buildLevel2Message,
  CONFIDENCE_THRESHOLD,
  getLadder,
  isCascadeEnabled,
  levelCost,
  mergeFindings,
  totalCost,
  triage,
  type CascadeState,
} from "@/lib/check/cascade";
import { buildCheckUserMessage, CHECK_SYSTEM_PROMPT } from "@/lib/check/prompt";
import { parseFindings } from "@/lib/check/parse";
import type { CheckEvent, Finding } from "@/lib/check/types";
import { llmComplete } from "@/lib/llm/complete";
import { logCheckRun, type CheckRunLog, type RunAttempt } from "@/lib/db/runs";
import { getClientHash, getQuota, LIMIT_MESSAGE } from "@/lib/db/quota";
import { getRequestCountry } from "@/lib/llm/geo";
import { formatModelLabel } from "@/lib/llm/model-label";
import { getProvidersForRequest, resolveProvider } from "@/lib/llm/providers";
import type { ProviderId } from "@/lib/llm/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** About 5 pages of contract text */
const CHECK_MAX_CHARS = 15_000;
const CHECK_MIN_CHARS = 200;
const MODEL_TIMEOUT_MS = 60_000;

function countClauses(text: string): number {
  return (text.match(/^\s*\d+\.\d+\.?\s/gm) ?? []).length;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

export async function POST(request: Request) {
  let body: { text?: unknown; provider?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const headers = request.headers;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (e: CheckEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      const t0 = Date.now();
      const since = () => Date.now() - t0;
      // Итог запуска для лога в БД, дописывается по ходу
      const run: Omit<CheckRunLog, "durationMs"> = {
        route: "check",
        status: "failed",
        text,
        providerRequested: typeof body.provider === "string" ? body.provider : undefined,
        country: getRequestCountry(headers),
        clientHash: getClientHash(headers),
      };
      const attempts: RunAttempt[] = [];

      try {
        if (text.length < CHECK_MIN_CHARS) {
          run.status = "input_error";
          run.error = "too short";
          send({ type: "error", kind: "input", message: "The text is too short to be a contract." });
          return;
        }
        if (text.length > CHECK_MAX_CHARS) {
          const pages = Math.ceil(text.length / 3000);
          run.status = "input_error";
          run.error = "too long";
          send({ type: "error", kind: "input", message: `This text is about ${pages} pages long. The demo checks up to 5 pages.` });
          return;
        }

        const resolution = resolveProvider(body.provider, headers);
        if (resolution.kind === "error") {
          run.status = resolution.status === 403 ? "blocked" : "failed";
          run.error = resolution.message;
          send({ type: "error", kind: resolution.status === 403 ? "blocked" : "failed", message: resolution.message });
          return;
        }
        if (resolution.kind === "demo") {
          run.status = "no_model";
          send({ type: "error", kind: "no-model", message: "No model is configured on the server." });
          return;
        }

        const quota = await getQuota(headers);
        if (quota?.exceeded) {
          run.status = "limited";
          send({ type: "error", kind: "limit", message: LIMIT_MESSAGE });
          return;
        }

        run.providerRequested = resolution.provider;
        run.clauses = countClauses(text);
        send({ type: "step", step: { id: "read", text: `Read the contract · ${countClauses(text)} clauses`, status: "done", ms: since() } });

        const { providers } = getProvidersForRequest(headers);
        const order: ProviderId[] = [
          resolution.provider,
          ...providers.filter((p) => p.available && p.id !== resolution.provider).map((p) => p.id),
        ];
        const cascadeOn = isCascadeEnabled();
        const clauseCount = countClauses(text);
        const label = (model: string, effort?: string) => `${formatModelLabel(model)}${effort ? ` · ${effort}` : ""}`;

        let answer: Awaited<ReturnType<typeof llmComplete>> | null = null;
        let used: ProviderId | null = null;
        let findings: Finding[] | null = null;
        let cascade: CascadeState | null = null;
        const sendCascade = () => cascade && send({ type: "cascade", cascade: structuredClone(cascade) });

        // ----- Level 1: the whole contract, cheap configuration; other providers are the fallback -----
        for (const provider of order) {
          const info = providers.find((p) => p.id === provider);
          const ladder = getLadder(provider);
          const l1 = cascadeOn ? ladder.l1 : { model: info?.model ?? provider };
          const stepId = `ask-${provider}`;
          const stepText = `${cascadeOn ? "Level 1 · " : ""}Check against 7 requirements · ${label(l1.model, l1.effort)}`;
          if (cascadeOn) {
            cascade = {
              textChars: text.length,
              clauses: clauseCount,
              threshold: CONFIDENCE_THRESHOLD,
              levels: [
                { level: 1, provider, model: l1.model, effort: l1.effort, status: "running", scope: `whole contract · ${clauseCount} clauses`, chars: text.length },
                { level: 2, provider, model: ladder.l2.model, effort: ladder.l2.effort, status: "pending" },
              ],
            };
            sendCascade();
          }
          send({ type: "step", step: { id: stepId, text: stepText, status: "running" } });
          const attemptStart = Date.now();
          try {
            answer = await withTimeout(
              llmComplete(
                provider,
                [
                  { role: "system", text: CHECK_SYSTEM_PROMPT },
                  { role: "user", text: buildCheckUserMessage(text) },
                ],
                { purpose: "analyze", temperature: 0.1, ...(cascadeOn ? { model: l1.model, effort: l1.effort } : {}) }
              ),
              MODEL_TIMEOUT_MS
            );
            findings = parseFindings(answer.text, text);
            if (!findings) throw new Error("unparsable answer");
            used = provider;
            attempts.push({ provider, ok: true, ms: Date.now() - attemptStart });
            send({ type: "step", step: { id: stepId, text: stepText, status: "done", ms: since() } });
            if (cascade) {
              Object.assign(cascade.levels[0], {
                model: answer.model,
                status: "done",
                inputTokens: answer.usage.inputTokens,
                outputTokens: answer.usage.outputTokens,
                ms: Date.now() - attemptStart,
              });
              cascade.levels[0].costUsd = levelCost(cascade.levels[0]);
            }
            break;
          } catch (error) {
            attempts.push({
              provider,
              ok: false,
              ms: Date.now() - attemptStart,
              error: error instanceof Error ? error.message.slice(0, 300) : String(error),
            });
            const why = error instanceof Error && error.message === "timeout" ? "did not answer in time" : "failed";
            send({ type: "step", step: { id: stepId, text: `${label(l1.model, l1.effort)} ${why}`, status: "failed", ms: since() } });
            if (cascade) {
              cascade.levels[0].status = "failed";
              sendCascade();
            }
            if (process.env.NODE_ENV === "development") console.error("[check]", provider, error);
          }
        }

        if (!answer || !findings || !used) {
          run.error = "no model answered";
          send({ type: "error", kind: "failed", message: "No model answered." });
          return;
        }

        let inputTokens = answer.usage.inputTokens;
        let outputTokens = answer.usage.outputTokens;

        // ----- Triage and level 2: only the uncertain points, stronger configuration -----
        if (cascade) {
          const { accepted, disputes } = triage(findings);
          cascade.triage = { accepted: accepted.length, disputes };
          send({
            type: "step",
            step: {
              id: "triage",
              text: disputes.length
                ? `Triage · ${accepted.length} confident, ${disputes.length} uncertain`
                : `Triage · all ${accepted.length} findings confident, no re-check needed`,
              status: "done",
              ms: since(),
            },
          });

          const l2 = cascade.levels[1];
          if (disputes.length === 0) {
            findings = findings.map((f) => ({ ...f, level: 1 as const }));
            l2.status = "skipped";
            sendCascade();
          } else {
            const ladder = getLadder(used);
            const esc = buildEscalation(text, findings, disputes);
            l2.status = "running";
            l2.chars = esc.chars;
            l2.scope = esc.wholeText
              ? `whole contract · ${esc.requirements.length} requirement${esc.requirements.length > 1 ? "s" : ""}`
              : `${esc.clauseLabels.length} clauses around them · ${Math.round((esc.chars / text.length) * 100)}% of the text`;
            sendCascade();
            const stepText = `Level 2 · Re-check ${disputes.length} uncertain point${disputes.length > 1 ? "s" : ""} · ${label(ladder.l2.model, ladder.l2.effort)}`;
            send({ type: "step", step: { id: "level2", text: stepText, status: "running" } });
            const t2 = Date.now();
            try {
              const second = await withTimeout(
                llmComplete(
                  used,
                  [
                    { role: "system", text: CHECK_SYSTEM_PROMPT },
                    { role: "user", text: buildLevel2Message(esc, disputes) },
                  ],
                  { purpose: "analyze", temperature: 0.1, model: ladder.l2.model, effort: ladder.l2.effort }
                ),
                MODEL_TIMEOUT_MS
              );
              const level2 = parseFindings(second.text, text);
              if (!level2) throw new Error("unparsable level 2 answer");
              findings = mergeFindings(accepted, level2, esc.requirements);
              inputTokens += second.usage.inputTokens;
              outputTokens += second.usage.outputTokens;
              Object.assign(l2, {
                model: second.model,
                status: "done",
                inputTokens: second.usage.inputTokens,
                outputTokens: second.usage.outputTokens,
                ms: Date.now() - t2,
              });
              l2.costUsd = levelCost(l2);
              attempts.push({ provider: `${used}:level2`, ok: true, ms: Date.now() - t2 });
              send({ type: "step", step: { id: "level2", text: stepText, status: "done", ms: since() } });
            } catch (error) {
              // Level 2 is an improvement, not a requirement: keep the level 1 findings
              findings = findings.map((f) => ({ ...f, level: 1 as const }));
              l2.status = "failed";
              l2.ms = Date.now() - t2;
              attempts.push({
                provider: `${used}:level2`,
                ok: false,
                ms: Date.now() - t2,
                error: error instanceof Error ? error.message.slice(0, 300) : String(error),
              });
              send({ type: "step", step: { id: "level2", text: `Level 2 failed · keeping the level 1 result`, status: "failed", ms: since() } });
              if (process.env.NODE_ENV === "development") console.error("[check] level 2", error);
            }
          }
          cascade.totalCostUsd = totalCost(cascade.levels);
          sendCascade();
        }

        for (const finding of findings) send({ type: "finding", finding });

        const exact = findings.filter((f) => f.exact).length;
        Object.assign(run, {
          status: "ok",
          provider: used,
          model: answer.model,
          fallbackFrom: used !== resolution.provider ? resolution.provider : undefined,
          findingsCount: findings.length,
          findingsExact: exact,
          inputTokens,
          outputTokens,
          costUsd: cascade ? cascade.totalCostUsd : undefined,
          cascade: cascade ?? undefined,
          modelMs: attempts.filter((a) => a.ok).reduce((n, a) => n + a.ms, 0),
        });
        send({ type: "step", step: { id: "verify", text: `Verify quotes against the text · ${exact} of ${findings.length} exact`, status: "done", ms: since() } });
        send({
          type: "done",
          provider: used,
          model: answer.model,
          ms: since(),
          inputTokens,
          outputTokens,
          costUsd: cascade?.totalCostUsd,
          fallbackFrom: used !== resolution.provider ? resolution.provider : undefined,
        });
      } catch (error) {
        if (process.env.NODE_ENV === "development") console.error("[check]", error);
        run.status = "failed";
        run.error = error instanceof Error ? error.message.slice(0, 300) : "internal error";
        send({ type: "error", kind: "failed", message: "Internal error." });
      } finally {
        controller.close();
        await logCheckRun({ ...run, attempts: attempts.length ? attempts : undefined, durationMs: since() });
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
