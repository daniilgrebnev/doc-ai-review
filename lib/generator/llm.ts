/**
 * Contract generator powered by the selected model (Claude / YandexGPT / DeepSeek).
 * The model writes a service agreement with exactly the requested traps and returns
 * an answer key; every key quote is verified against the text before it is trusted.
 */
import { DEFECTS } from "@/lib/check/catalog";
import { locateQuote } from "@/lib/check/spans";
import type { DefectCode } from "@/lib/check/types";
import {
  GENERATOR_DEFECTS,
  rng,
  type AnswerKeyItem,
  type GeneratedContract,
  type GeneratorParams,
} from "@/lib/generator";

/** What each trap looks like, so the model plants the right thing */
const TRAP_HINTS: Record<DefectCode, string> = {
  D1: "a penalty far out of proportion to any likely loss (e.g. 1% of the annual fee per day, no cap)",
  D2: "one party may exit at any time without reason, the other only for a material breach",
  D3: "automatic renewal hidden outside the term section, with a long notice period to stop it",
  D4: "a vague deadline such as 'within a reasonable time' or 'promptly' instead of a number of days",
  D5: "one party is liable for all losses, direct and indirect, without any limit",
  D6: "one party may change the fee or terms unilaterally by a simple notice",
  D7: "two clauses that set different rules for the same thing (e.g. two different payment deadlines)",
};

const SUBJECTS = [
  "website support",
  "bookkeeping",
  "office cleaning",
  "IT infrastructure support",
  "copywriting",
  "marketing analytics",
  "mobile app maintenance",
  "recruitment",
];

export const GENERATE_SYSTEM_PROMPT = `You write realistic English service agreements for a test dataset of a contract-checking AI.
You plant EXACTLY the requested traps and nothing else: every clause that is not a requested trap must be fair, specific and balanced
(dates in days, capped proportionate penalties, capped liability, mutual termination, changes only by signed amendment,
explicit term without hidden renewal, no contradictions).
Write numbered sections and clauses like "4.1." Keep it 15-30 clauses, plain text, no markdown.
Reply with ONE JSON object and nothing else:
{"title": "SERVICE AGREEMENT No. ...", "text": "<full contract text>", "traps": [{"defect": "D1", "quotes": ["<exact sentence copied from text>"]}]}
Each quote must be copied character for character from "text". A D7 trap has two quotes, one from each conflicting clause.`;

export interface LlmGeneratePlan {
  level: number;
  defects: DefectCode[];
  subject: string;
  beneficiary: GeneratorParams["beneficiary"];
  seed: number;
}

/** Chooses the traps and the subject deterministically from the seed */
export function planGeneration(params: GeneratorParams): LlmGeneratePlan {
  const level = Math.max(0, Math.min(5, Math.round(params.level)));
  const r = rng(params.seed);
  const pool = params.defects && params.defects.length ? params.defects : GENERATOR_DEFECTS;
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const defects = shuffled.slice(0, Math.min(level, pool.length)).sort();
  const subject = SUBJECTS[Math.floor(r() * SUBJECTS.length)];
  return { level: defects.length, defects, subject, beneficiary: params.beneficiary, seed: params.seed };
}

export function buildGenerateUserMessage(plan: LlmGeneratePlan): string {
  const strong = plan.beneficiary === "client" ? "the Client" : "the Contractor";
  const weak = plan.beneficiary === "client" ? "the Contractor" : "the Client";
  const traps = plan.defects.length
    ? plan.defects
        .map((code) => {
          const d = DEFECTS.find((x) => x.code === code);
          return `- ${code} ${d?.name ?? ""}: ${TRAP_HINTS[code]}`;
        })
        .join("\n")
    : "- none: this contract must be completely honest";
  return `Write a monthly service agreement for ${plan.subject} services between two fictional LLCs.
Every trap must favour ${strong} and hurt ${weak} (e.g. ${weak} pays the penalty, ${strong} gets the free exit).
Plant exactly ${plan.defects.length} trap(s):
${traps}
Variation seed: ${plan.seed} (use it to vary names, amounts and wording).
Return "traps" with exactly these defect codes: [${plan.defects.join(", ")}].`;
}

interface RawAnswer {
  title?: unknown;
  text?: unknown;
  traps?: unknown;
}

export interface ParsedGeneration {
  contract: GeneratedContract;
  /** Requested traps the model did not return or quoted inexactly */
  missing: DefectCode[];
}

/** Parses the model reply and verifies the answer key against the text */
export function parseGeneration(raw: string, plan: LlmGeneratePlan): ParsedGeneration | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  let data: RawAnswer;
  try {
    data = JSON.parse(raw.slice(start, end + 1)) as RawAnswer;
  } catch {
    return null;
  }
  if (typeof data.text !== "string" || data.text.trim().length < 200) return null;

  const text = data.text.replace(/\r\n/g, "\n").trim();
  const title = typeof data.title === "string" && data.title.trim() ? data.title.trim() : "SERVICE AGREEMENT";

  const key: AnswerKeyItem[] = [];
  const traps = Array.isArray(data.traps) ? data.traps : [];
  for (const code of plan.defects) {
    const trap = traps.find(
      (t): t is { defect: string; quotes: unknown } =>
        typeof t === "object" && t !== null && (t as { defect?: unknown }).defect === code
    );
    const quotes = Array.isArray(trap?.quotes)
      ? trap.quotes.filter((q): q is string => typeof q === "string" && q.trim().length > 0)
      : [];
    const spans = quotes.map((q) => locateQuote(text, q));
    if (quotes.length && spans.every((s) => s !== null)) {
      key.push({ defect: code, quotes, spans: spans as Array<[number, number]> });
    }
  }

  const found = new Set(key.map((k) => k.defect));
  return {
    contract: {
      title,
      text,
      key,
      params: { level: plan.level, beneficiary: plan.beneficiary, defects: plan.defects, seed: plan.seed },
    },
    missing: plan.defects.filter((d) => !found.has(d)),
  };
}
