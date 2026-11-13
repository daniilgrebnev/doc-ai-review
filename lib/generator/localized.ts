/**
 * Localized contract generator: the services template from index.ts, placed in a
 * jurisdiction (RU / DE / EU / US-NY or none) with a chosen visibility of the country,
 * plus law-specific defects from legal-defects.ts.
 *
 * The contract is built in English from units with stable ids (clause "4.1", heading
 * "h4", "title", ...), then non-English units are translated one by one, so every key
 * entry still points to its clause. The same seed always gives the same English base;
 * translations are cached (translate.ts), so the same seed gives the same text too.
 *
 * The answer key is returned apart from the contract and must never reach the checker:
 * the check path takes the contract text only (lib/check/prompt.ts, pickCheckInput).
 */
import { locateQuote } from "@/lib/check/spans";
import type { DefectCode } from "@/lib/check/types";
import { GENERATOR_DEFECTS, rng, type Beneficiary } from "@/lib/generator";
import {
  countryFor,
  EU_SLOT_LANGS,
  NEUTRAL,
  type CountryProfile,
  type Jurisdiction,
  type Visibility,
} from "@/lib/generator/jurisdictions";
import {
  LEGAL_DEFECTS,
  resolveSlotIds,
  type LegalDefect,
  type LegalDefectId,
  type LegalJurisdiction,
  type PartyWords,
} from "@/lib/generator/legal-defects";

export interface LocalizedParams {
  level: number; // 0..5: clauses planted (general traps + legal defects, distractors included)
  beneficiary: Beneficiary;
  /** General traps to draw from; empty or undefined: any */
  defects?: DefectCode[];
  /** Draw law-specific defects too (default true; ignored for jurisdiction "none") */
  legal?: boolean;
  jurisdiction: Jurisdiction;
  visibility: Visibility;
  seed: number;
}

export type UnitKind = "title" | "header" | "preamble" | "heading" | "clause" | "party";

export interface ContractUnit {
  id: string;
  kind: UnitKind;
  text: string;
}

export interface LocalizedContract {
  title: string;
  text: string;
  clauses: Array<{ id: string; text: string }>;
}

export type CueType = "governing-law" | "court" | "city" | "currency" | "registration-id" | "company-form" | "company-name" | "language";

export interface KeyCue {
  type: CueType;
  /** English base value (the contract may show it translated) */
  value: string;
  /** Unit the cue sits in; none for "language" */
  unitId?: string;
}

export interface KeyDefect {
  /** D1…D7 or L1…L8 */
  id: string;
  kind: "general" | "legal";
  clauseId: string;
  /** The clause text as it stands in the contract */
  quote: string;
  span: [number, number] | null;
  /** law_slots ids; empty for general traps */
  slotIds: string[];
  /** false: a lawful clause here, the checker should not flag it on legal grounds */
  violatesHere: boolean;
  /** Second clause of a contradiction (D7) */
  also?: Array<{ clauseId: string; quote: string; span: [number, number] | null }>;
  note?: string;
  confidence?: "high" | "medium" | "low";
}

export interface LocalizedKey {
  jurisdiction: Jurisdiction;
  /** ISO country code; for the EU the member state the contract is placed in */
  country: string | null;
  language: string;
  visibility: Visibility;
  level: number;
  beneficiary: Beneficiary;
  seed: number;
  cues: KeyCue[];
  defects: KeyDefect[];
}

export interface LocalizedGeneration {
  contract: LocalizedContract;
  key: LocalizedKey;
}

/** Translates units into a language; must return a translation for every id */
export type Translator = (units: Array<{ id: string; text: string }>, lang: string, langName: string) => Promise<Record<string, string>>;

/** Planted item before translation */
interface Planted {
  id: DefectCode | LegalDefectId;
  clauseIds: string[];
}

export interface LocalizedBase {
  title: string;
  units: ContractUnit[];
  country: CountryProfile;
  cues: KeyCue[];
  planted: Planted[];
  params: LocalizedParams & { level: number };
}

/** Clauses each general trap rewrites */
const GENERAL_CLAUSES: Record<DefectCode, string[]> = {
  D1: ["4.1"],
  D2: ["5.1"],
  D3: ["8.2"],
  D4: ["2.1"],
  D5: ["4.2"],
  D6: ["3.3"],
  D7: ["7.1", "3.2"],
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SERVICES = ["website support", "bookkeeping", "cleaning of office premises", "IT infrastructure support", "copywriting"];
const BASE_FEES = [1500, 2400, 3200, 5000, 8000];

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

/** Rounds to two significant digits: 152000 -> 150000 */
function roundNice(x: number): number {
  if (x < 100) return Math.round(x);
  const p = Math.pow(10, Math.floor(Math.log10(x)) - 1);
  return Math.round(x / p) * p;
}

function fillDigits(r: () => number, pattern: string, city: string, region: string): string {
  return pattern
    .replace(/#/g, () => String(Math.floor(r() * 10)))
    .replace("{city}", city)
    .replace("{region}", region);
}

function companyName(c: CountryProfile, name: string, withForm: boolean): string {
  if (!withForm || !c.form) return name;
  return c.formPosition === "prefix" ? `${c.form} ${name}` : `${name} ${c.form}`;
}

/** English base contract, answer-key skeleton and cues. Pure and deterministic by seed. */
export function buildLocalizedBase(params: LocalizedParams): LocalizedBase {
  const level = Math.max(0, Math.min(5, Math.round(params.level)));
  const j = params.jurisdiction;
  const r = rng(params.seed);
  const country = countryFor(j, r);
  // "none" has no country to show, whatever the visibility
  const visibility: Visibility = j === "none" ? "hidden" : params.visibility;
  const showPlace = visibility !== "hidden";

  // Country-typical company names only where the place may show
  const names = shuffle(r, (showPlace && country.names) || NEUTRAL.names!);
  const contractorName = companyName(country, names[0], showPlace);
  const clientName = companyName(country, names[1], showPlace);
  const service = pick(r, SERVICES);
  const baseFee = pick(r, BASE_FEES);
  const number = 10 + Math.floor(r() * 80);
  const day = 1 + Math.floor(r() * 28);
  const month = pick(r, MONTHS);
  const city = country.cities.length ? pick(r, country.cities) : "";
  const region = country.regions?.[city] ?? "";
  const contractorIds = country.ids.map((p) => fillDigits(r, p, city, region));
  const clientIds = country.ids.map((p) => fillDigits(r, p, city, region));

  // ----- what to plant -----
  const generalPool = params.defects && params.defects.length ? params.defects : GENERATOR_DEFECTS;
  const legalPool: LegalDefect[] =
    j === "none" || params.legal === false
      ? []
      : LEGAL_DEFECTS.filter((d) => !d.general && d.verdicts[j as LegalJurisdiction] && (!d.beneficiary || d.beneficiary === params.beneficiary));
  const candidates: Planted[] = shuffle(r, [
    ...generalPool.map((id): Planted => ({ id, clauseIds: GENERAL_CLAUSES[id] })),
    ...legalPool.map((d): Planted => ({ id: d.id, clauseIds: [d.clauseId] })),
  ]);
  const planted: Planted[] = [];
  const taken = new Set<string>();
  for (const c of candidates) {
    if (planted.length >= level) break;
    if (c.clauseIds.some((id) => taken.has(id))) continue;
    planted.push(c);
    c.clauseIds.forEach((id) => taken.add(id));
  }
  const isPlanted = (id: string) => planted.some((p) => p.id === id);

  const w: PartyWords =
    params.beneficiary === "client"
      ? { strong: "the Client", Strong: "The Client", weak: "the Contractor", Weak: "The Contractor" }
      : { strong: "the Contractor", Strong: "The Contractor", weak: "the Client", Weak: "The Client" };
  const general = (code: DefectCode, clean: string, rigged: string) => (isPlanted(code) ? rigged : clean);
  const legal = (id: LegalDefectId) => {
    const d = LEGAL_DEFECTS.find((x) => x.id === id)!;
    return isPlanted(id) ? d.rigged!(w) : d.clean!(w);
  };

  // ----- cues -----
  const cues: KeyCue[] = [];
  const amount = showPlace ? roundNice(baseFee * country.feeFactor) : baseFee;
  const fmt = amount.toLocaleString("en-US");
  const feeText = showPlace ? `${country.currency} ${fmt}` : `${fmt}, in the currency stated in the invoice,`;
  if (showPlace) cues.push({ type: "currency", value: country.currency, unitId: "3.1" });

  const header = showPlace ? `${city}, ${day} ${month} 2026` : `Date: ${day} ${month} 2026`;
  if (showPlace) cues.push({ type: "city", value: city, unitId: "header" });

  // ----- units -----
  const payBy = "within 10 business days of signing the acceptance certificate";
  const d7 = "no later than 30 calendar days after the acceptance certificate is signed";
  const units: ContractUnit[] = [];
  const add = (id: string, kind: UnitKind, text: string) => units.push({ id, kind, text });
  const title = `SERVICE AGREEMENT No. ${number}/26`;
  add("title", "title", title);
  add("header", "header", header);
  add("preamble", "preamble", `${contractorName} (the "Contractor") and ${clientName} (the "Client"), together the "Parties", agree as follows.`);
  if (showPlace && country.form) cues.push({ type: "company-form", value: country.form, unitId: "preamble" });

  add("h1", "heading", "Subject");
  add("1.1", "clause", `The Contractor shall provide ${service} services, and the Client shall accept and pay for them.`);
  add("h2", "heading", "Timelines");
  add("2.1", "clause", general("D4", "The Contractor begins providing services within 3 business days of receiving the Client's request.", "The Contractor begins providing services within a reasonable time after receiving the Client's request."));
  add("h3", "heading", "Fees and payment");
  add("3.1", "clause", `The fee is ${feeText} per month.`);
  add("3.2", "clause", isPlanted("L4") ? legal("L4") : `The Client pays ${payBy}.`);
  add("3.3", "clause", general("D6", "The fee may be changed only by an amendment signed by both Parties.", `${w.Strong} may change the fee unilaterally by notifying ${w.weak} by email.`));
  add("h4", "heading", "Liability");
  add("4.1", "clause", general("D1", "For late payment, the Client pays a penalty of 0.1% of the unpaid amount per day, capped at 10% of that amount.", `For any delay, ${w.weak} pays ${w.strong} a penalty of 1% of the annual fee for each day of delay.`));
  add("4.2", "clause", general("D5", "Each Party's total liability is capped at the fees paid for the last three months.", `${w.Weak} is liable for all losses of ${w.strong}, direct and indirect, without limit.`));
  add("4.3", "clause", legal("L3"));
  add("4.4", "clause", legal("L7"));
  add("h5", "heading", "Termination");
  add("5.1", "clause", general("D2", "Either Party may terminate this Agreement with 30 days' written notice.", `${w.Strong} may withdraw from this Agreement at any time without giving a reason. ${w.Weak} may terminate only in the event of a material breach.`));
  add("h6", "heading", "Term");
  add("6.1", "clause", "This Agreement is valid for 12 months from the date of signing.");
  add("h7", "heading", "Settlement");
  add("7.1", "clause", general("D7", "Final settlement for the month is made on the basis of the signed acceptance certificate.", `Final settlement for the month is made ${d7}.`));
  add("h8", "heading", "Miscellaneous");
  add("8.1", "clause", "All notices are sent by email to the addresses the Parties have given each other in writing.");
  add("8.2", "clause", general("D3", "Any extension of this Agreement is made by a separate signed amendment.", "This Agreement is deemed renewed for the same term unless either Party gives notice 60 days before it expires."));
  add("8.3", "clause", legal("L2"));
  add("8.4", "clause", legal("L6"));
  add("h9", "heading", "Disputes");
  if (visibility === "explicit") {
    const court = country.court.replace("{city}", city);
    add("9.1", "clause", `This Agreement is governed by ${country.law}.`);
    add("9.2", "clause", `Any dispute that the Parties cannot settle by negotiation is referred to ${court}.`);
    cues.push({ type: "governing-law", value: country.law, unitId: "9.1" }, { type: "court", value: court, unitId: "9.2" });
  } else {
    add("9.1", "clause", "The Parties will try to settle any dispute by negotiation.");
    add("9.2", "clause", "A dispute that the Parties cannot settle by negotiation is referred to the competent court.");
  }
  add("h10", "heading", "Details of the Parties");
  if (showPlace) {
    add("party.contractor", "party", `Contractor: ${contractorName}, registered office: ${city}, ${contractorIds.join(", ")}.`);
    add("party.client", "party", `Client: ${clientName}, registered office: ${city}, ${clientIds.join(", ")}.`);
    cues.push({ type: "city", value: city, unitId: "party.contractor" });
    for (const id of contractorIds) cues.push({ type: "registration-id", value: id, unitId: "party.contractor" });
    for (const id of clientIds) cues.push({ type: "registration-id", value: id, unitId: "party.client" });
  } else {
    add("party.contractor", "party", `Contractor: ${contractorName}. Signature: ____________`);
    add("party.client", "party", `Client: ${clientName}. Signature: ____________`);
  }
  if (showPlace && country.names !== NEUTRAL.names) {
    cues.push({ type: "company-name", value: names[0], unitId: "preamble" }, { type: "company-name", value: names[1], unitId: "preamble" });
  }
  if (j !== "none") cues.push({ type: "language", value: country.lang });

  return { title, units, country, cues, planted, params: { ...params, visibility, level: planted.length } };
}

/** Renders units into the contract text (without the title); clauses get their number, headings their section number */
export function renderUnits(units: ContractUnit[], text: (u: ContractUnit) => string): string {
  const lines: string[] = [];
  let section = 0;
  for (const u of units) {
    const t = text(u);
    // The title goes to contract.title, like the other generators; the text starts with the header
    if (u.kind === "title") continue;
    if (u.kind === "header") lines.push(t, "");
    else if (u.kind === "preamble") lines.push(t);
    else if (u.kind === "heading") {
      section += 1;
      lines.push("", `${section}. ${t}`);
    } else if (u.kind === "clause") lines.push(`${u.id}. ${t}`);
    else lines.push(t);
  }
  return lines.join("\n");
}

/** Builds the contract and its answer key; translates non-English contracts with `translate` */
export async function generateLocalized(params: LocalizedParams, translate?: Translator): Promise<LocalizedGeneration> {
  const base = buildLocalizedBase(params);
  const lang = base.country.lang;
  let tr: Record<string, string> = {};
  if (lang !== "en") {
    if (!translate) throw new Error(`A translator is needed for language "${lang}"`);
    tr = await translate(
      base.units.map((u) => ({ id: u.id, text: u.text })),
      lang,
      base.country.langName
    );
    const missing = base.units.filter((u) => !tr[u.id]?.trim()).map((u) => u.id);
    if (missing.length) throw new Error(`Translation is missing units: ${missing.join(", ")}`);
  }
  const textOf = (u: ContractUnit) => (lang === "en" ? u.text : tr[u.id].trim());
  const text = renderUnits(base.units, textOf);
  const clauses = base.units.filter((u) => u.kind === "clause").map((u) => ({ id: u.id, text: textOf(u) }));
  const clauseText = (id: string) => clauses.find((c) => c.id === id)!.text;
  const at = (id: string) => {
    const quote = clauseText(id);
    return { clauseId: id, quote, span: locateQuote(text, quote) };
  };

  const j = base.params.jurisdiction;
  const defects: KeyDefect[] = [];
  const legalEntry = (d: LegalDefect): KeyDefect | null => {
    const v = j === "none" ? undefined : d.verdicts[j];
    if (!v) return null;
    return {
      id: d.id,
      kind: "legal",
      ...at(d.clauseId),
      slotIds: resolveSlotIds(v.slotIds, lang, EU_SLOT_LANGS),
      violatesHere: v.violates,
      note: v.note,
      confidence: v.confidence,
    };
  };
  for (const p of base.planted) {
    if (p.id.startsWith("D")) {
      const [main, ...rest] = p.clauseIds;
      defects.push({ id: p.id, kind: "general", ...at(main), slotIds: [], violatesHere: true, ...(rest.length ? { also: rest.map(at) } : {}) });
      const annotation = LEGAL_DEFECTS.find((d) => d.general === p.id);
      const e = annotation && legalEntry(annotation);
      if (e) defects.push(e);
    } else {
      const e = legalEntry(LEGAL_DEFECTS.find((d) => d.id === p.id)!);
      if (e) defects.push(e);
    }
  }
  defects.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));

  return {
    contract: { title: textOf(base.units[0]), text, clauses },
    key: {
      jurisdiction: j,
      country: base.country.code || null,
      language: lang,
      visibility: base.params.visibility,
      level: base.params.level,
      beneficiary: base.params.beneficiary,
      seed: base.params.seed,
      cues: base.cues,
      defects,
    },
  };
}
