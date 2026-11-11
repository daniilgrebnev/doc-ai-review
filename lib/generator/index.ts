/**
 * Generator of rigged contracts (F5), first version: services only.
 * A contract is assembled from clean template clauses; a chosen defect swaps
 * in a defective wording. Positions and "no extra defects" hold by construction,
 * and the same seed always gives the same contract.
 */
import { locateQuote } from "@/lib/check/spans";
import type { DefectCode } from "@/lib/check/types";

export type Beneficiary = "contractor" | "client";

export interface GeneratorParams {
  level: number; // 0..5, number of traps
  beneficiary: Beneficiary;
  defects?: DefectCode[]; // empty or undefined: any
  seed: number;
}

export interface AnswerKeyItem {
  defect: DefectCode;
  quotes: string[];
  spans: Array<[number, number]>;
}

export interface GeneratedContract {
  title: string;
  text: string;
  key: AnswerKeyItem[];
  params: GeneratorParams;
}

export const GENERATOR_DEFECTS: DefectCode[] = ["D1", "D2", "D3", "D4", "D5", "D6", "D7"];

/** mulberry32: small deterministic PRNG */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, xs: T[]): T {
  return xs[Math.floor(r() * xs.length)];
}

function shuffle<T>(r: () => number, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SERVICES = ["website support", "bookkeeping", "cleaning of office premises", "IT infrastructure support", "copywriting"];
const CONTRACTORS = ["Alpha Service LLC", "Kvant Systems LLC", "Bright Line LLC", "North Works LLC"];
const CLIENTS = ["Vector LLC", "Orion Trade LLC", "Delta Retail LLC", "Meridian Group LLC"];

export function generateContract(params: GeneratorParams): GeneratedContract {
  const level = Math.max(0, Math.min(5, Math.round(params.level)));
  const r = rng(params.seed);
  const service = pick(r, SERVICES);
  const contractor = pick(r, CONTRACTORS);
  const client = pick(r, CLIENTS);
  const fee = pick(r, [1500, 2400, 3200, 5000, 8000]);
  const number = 10 + Math.floor(r() * 80);

  const pool = params.defects && params.defects.length ? params.defects : GENERATOR_DEFECTS;
  const chosen = new Set(shuffle(r, pool).slice(0, Math.min(level, pool.length)));

  // The party that benefits from a trap, and the one that suffers
  const strong = params.beneficiary === "client" ? "the Client" : "the Contractor";
  const Strong = params.beneficiary === "client" ? "The Client" : "The Contractor";
  const weak = params.beneficiary === "client" ? "the Contractor" : "the Client";
  const Weak = params.beneficiary === "client" ? "The Contractor" : "The Client";

  const traps: Partial<Record<DefectCode, string[]>> = {};
  const clause = (code: DefectCode, clean: string, rigged: string, quotes?: string[]): string => {
    if (!chosen.has(code)) return clean;
    traps[code] = quotes ?? [rigged.replace(/^\d+\.\d+\.\s*/, "")];
    return rigged;
  };

  const payBy = "within 10 business days of signing the acceptance certificate";
  const d7 = "no later than 30 calendar days after the acceptance certificate is signed";
  const lines = [
    `${contractor} (the "Contractor") and ${client} (the "Client") agree as follows.`,
    "",
    "1. Subject",
    `1.1. The Contractor shall provide ${service} services, and the Client shall accept and pay for them.`,
    "",
    "2. Timelines",
    clause("D4", "2.1. The Contractor begins providing services within 3 business days of receiving the Client's request.", "2.1. The Contractor begins providing services within a reasonable time after receiving the Client's request."),
    "",
    "3. Fees and payment",
    `3.1. The fee is $${fee.toLocaleString("en-US")} per month.`,
    `3.2. The Client pays ${payBy}.`,
    clause("D6", "3.3. The fee may be changed only by an amendment signed by both Parties.", `3.3. ${Strong} may change the fee unilaterally by notifying ${weak} by email.`),
    "",
    "4. Liability",
    clause("D1", "4.1. For late payment, the Client pays a penalty of 0.1% of the unpaid amount per day, capped at 10% of that amount.", `4.1. For any delay, ${weak} pays ${strong} a penalty of 1% of the annual fee for each day of delay.`),
    clause("D5", "4.2. Each Party's total liability is capped at the fees paid for the last three months.", `4.2. ${Weak} is liable for all losses of ${strong}, direct and indirect, without limit.`),
    "",
    "5. Termination",
    clause("D2", "5.1. Either Party may terminate this Agreement with 30 days' written notice.", `5.1. ${Strong} may withdraw from this Agreement at any time without giving a reason. ${Weak} may terminate only in the event of a material breach.`, [`${Strong} may withdraw from this Agreement at any time without giving a reason.`]),
    "",
    "6. Term",
    "6.1. This Agreement is valid for 12 months from the date of signing.",
    "",
    "7. Settlement",
    clause("D7", "7.1. Final settlement for the month is made on the basis of the signed acceptance certificate.", `7.1. Final settlement for the month is made ${d7}.`, [payBy, d7]),
    "",
    "8. Miscellaneous",
    "8.1. All notices are sent to the addresses in Section 9.",
    clause("D3", "8.2. Any extension of this Agreement is made by a separate signed amendment.", "8.2. This Agreement is deemed renewed for the same term unless either Party gives notice 60 days before it expires."),
  ];
  const text = lines.join("\n");

  const key: AnswerKeyItem[] = (Object.keys(traps) as DefectCode[]).sort().map((defect) => {
    const quotes = traps[defect]!;
    const spans = quotes.map((q) => locateQuote(text, q)).filter((s): s is [number, number] => s !== null);
    return { defect, quotes, spans };
  });

  return { title: `SERVICE AGREEMENT No. ${number}/26`, text, key, params: { ...params, level } };
}
