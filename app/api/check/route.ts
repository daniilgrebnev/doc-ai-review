/**
 * POST /api/check — live contract check.
 * Streams NDJSON: agent steps, then findings, then "done" (or "error").
 * Body: { text: string, provider?: ProviderId }
 */
import { buildCheckUserMessage, CHECK_SYSTEM_PROMPT } from "@/lib/check/prompt";
import { parseFindings } from "@/lib/check/parse";
import type { CheckEvent, Finding } from "@/lib/check/types";
import { llmComplete } from "@/lib/llm/complete";
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

      try {
        if (text.length < CHECK_MIN_CHARS) {
          send({ type: "error", kind: "input", message: "The text is too short to be a contract." });
          return;
        }
        if (text.length > CHECK_MAX_CHARS) {
          const pages = Math.ceil(text.length / 3000);
          send({ type: "error", kind: "input", message: `This text is about ${pages} pages long. The demo checks up to 5 pages.` });
          return;
        }

        const resolution = resolveProvider(body.provider, headers);
        if (resolution.kind === "error") {
          send({ type: "error", kind: resolution.status === 403 ? "blocked" : "failed", message: resolution.message });
          return;
        }
        if (resolution.kind === "demo") {
          send({ type: "error", kind: "no-model", message: "No model is configured on the server." });
          return;
        }

        send({ type: "step", step: { id: "read", text: `Read the contract · ${countClauses(text)} clauses`, status: "done", ms: since() } });

        const { providers } = getProvidersForRequest(headers);
        const order: ProviderId[] = [
          resolution.provider,
          ...providers.filter((p) => p.available && p.id !== resolution.provider).map((p) => p.id),
        ];

        let answer: Awaited<ReturnType<typeof llmComplete>> | null = null;
        let used: ProviderId | null = null;
        let findings: Finding[] | null = null;

        for (const provider of order) {
          const info = providers.find((p) => p.id === provider);
          const label = formatModelLabel(info?.model ?? provider);
          const stepId = `ask-${provider}`;
          send({ type: "step", step: { id: stepId, text: `Check against 7 requirements · ${label}`, status: "running" } });
          try {
            answer = await withTimeout(
              llmComplete(
                provider,
                [
                  { role: "system", text: CHECK_SYSTEM_PROMPT },
                  { role: "user", text: buildCheckUserMessage(text) },
                ],
                { purpose: "analyze", temperature: 0.1 }
              ),
              MODEL_TIMEOUT_MS
            );
            findings = parseFindings(answer.text, text);
            if (!findings) throw new Error("unparsable answer");
            used = provider;
            send({ type: "step", step: { id: stepId, text: `Check against 7 requirements · ${label}`, status: "done", ms: since() } });
            break;
          } catch (error) {
            const why = error instanceof Error && error.message === "timeout" ? "did not answer in time" : "failed";
            send({ type: "step", step: { id: stepId, text: `${label} ${why}`, status: "failed", ms: since() } });
            if (process.env.NODE_ENV === "development") console.error("[check]", provider, error);
          }
        }

        if (!answer || !findings || !used) {
          send({ type: "error", kind: "failed", message: "No model answered." });
          return;
        }

        for (const finding of findings) send({ type: "finding", finding });

        const exact = findings.filter((f) => f.exact).length;
        send({ type: "step", step: { id: "verify", text: `Verify quotes against the text · ${exact} of ${findings.length} exact`, status: "done", ms: since() } });
        send({
          type: "done",
          provider: used,
          model: answer.model,
          ms: since(),
          inputTokens: answer.usage.inputTokens,
          outputTokens: answer.usage.outputTokens,
          fallbackFrom: used !== resolution.provider ? resolution.provider : undefined,
        });
      } catch (error) {
        if (process.env.NODE_ENV === "development") console.error("[check]", error);
        send({ type: "error", kind: "failed", message: "Internal error." });
      } finally {
        controller.close();
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
