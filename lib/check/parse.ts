import { getDefect, getRequirement } from "@/lib/check/catalog";
import { locateQuotes } from "@/lib/check/spans";
import type { DefectCode, Finding, FindingVerdict, RequirementId } from "@/lib/check/types";

const VERDICTS: FindingVerdict[] = ["violation", "risk", "compliant"];

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

/**
 * Pulls the findings array out of a model answer. Models do not always follow the
 * {"findings":[...]} shape: YandexGPT Lite sometimes answers with a bare array of findings
 * or wraps the object in an array, so all three shapes are accepted.
 */
function extractFindings(raw: string): unknown[] | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : raw).trim();
  const candidates: unknown[] = [];
  const objStart = body.indexOf("{");
  const objEnd = body.lastIndexOf("}");
  const arrStart = body.indexOf("[");
  const arrEnd = body.lastIndexOf("]");
  // The outermost bracket decides which shape to try first
  if (arrStart >= 0 && arrEnd > arrStart && (objStart < 0 || arrStart < objStart)) candidates.push(tryParse(body.slice(arrStart, arrEnd + 1)));
  if (objStart >= 0 && objEnd > objStart) candidates.push(tryParse(body.slice(objStart, objEnd + 1)));
  for (const data of candidates) {
    const findings = findingsOf(data);
    if (findings) return findings;
  }
  return null;
}

function findingsOf(data: unknown): unknown[] | null {
  if (Array.isArray(data)) {
    if (data.length === 1 && findingsOf(data[0])) return findingsOf(data[0]);
    // A bare array of findings (an empty one means "no findings")
    if (data.every((x) => typeof x === "object" && x !== null && "verdict" in x)) return data;
    return null;
  }
  if (typeof data === "object" && data !== null && Array.isArray((data as { findings?: unknown }).findings)) {
    return (data as { findings: unknown[] }).findings;
  }
  return null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Parses the model answer into findings and checks every quote against the text */
export function parseFindings(raw: string, text: string): Finding[] | null {
  const items = extractFindings(raw);
  if (!items) return null;

  const out: Finding[] = [];
  (items as Array<Record<string, unknown>>).forEach((item, i) => {
    if (!item || typeof item !== "object") return;
    const verdict = str(item.verdict).toLowerCase() as FindingVerdict;
    if (!VERDICTS.includes(verdict)) return;

    const defectRaw = str(item.defect).toUpperCase();
    const defect = getDefect(defectRaw) ? (defectRaw as DefectCode) : null;
    let requirement = str(item.requirement).toUpperCase();
    if (!getRequirement(requirement) && defect) requirement = getDefect(defect)!.requirement;
    if (!getRequirement(requirement)) return;

    const quotes = (Array.isArray(item.quotes) ? item.quotes : [item.quote])
      .map(str)
      .filter(Boolean);
    if (quotes.length === 0) return;

    const confidence = Math.min(1, Math.max(0, Number(item.confidence) || 0));
    const located = locateQuotes(text, quotes);

    out.push({
      id: `f${i + 1}`,
      verdict,
      defect: verdict === "compliant" ? null : defect,
      requirement: requirement as RequirementId,
      clause: str(item.clause),
      title: str(item.title) || (defect ? getDefect(defect)!.name : getRequirement(requirement)!.name),
      quotes,
      reason: str(item.reason),
      confidence,
      ...located,
    });
  });

  const order: Record<FindingVerdict, number> = { violation: 0, risk: 1, compliant: 2 };
  return out.sort((a, b) => order[a.verdict] - order[b.verdict]);
}
