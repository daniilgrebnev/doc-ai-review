/**
 * Catalog of law-specific defects (L1…), separate from the general traps D1–D7.
 *
 * A legal defect is a clause whose validity depends on the governing law. Each entry
 * has a verdict per jurisdiction: violates = the clause is void / unenforceable / open to
 * court reduction there, with the law_slots ids (Neon) that say so. A clause planted
 * where it is lawful goes into the answer key with violatesHere = false: a distractor
 * the checker should NOT flag on legal grounds ("flip trap").
 *
 * Two kinds of entries:
 *  - standalone (L2, L3, L4, L6, L7): own clause, planted instead of its clean wording;
 *  - annotations of a general trap (L1 → D1, L5 → D6, L8 → D2): no clause of their own;
 *    whenever that general trap is planted in a jurisdiction with a verdict, the key gets
 *    the legal entry for the same clause too.
 *
 * A jurisdiction with no verdict means "not mapped" (see `unmapped` for why): a standalone
 * defect is never planted there, an annotation is not added.
 *
 * Slot ids with {lang} are EU directive slots; they resolve to the contract language when
 * the directive is loaded in it (EU_SLOT_LANGS), otherwise to English.
 *
 * DRAFT for Daniil's review: confidence "low" marks mappings that need a lawyer's look.
 */
import type { DefectCode } from "@/lib/check/types";
import type { Beneficiary } from "@/lib/generator";
import type { Jurisdiction } from "@/lib/generator/jurisdictions";

export type LegalJurisdiction = Exclude<Jurisdiction, "none">;
export type LegalDefectId = "L1" | "L2" | "L3" | "L4" | "L5" | "L6" | "L7" | "L8";

export interface LegalVerdict {
  violates: boolean;
  slotIds: string[];
  note: string;
  confidence: "high" | "medium" | "low";
}

/** Wording helpers: the party a trap favours and the one it hurts */
export interface PartyWords {
  strong: string;
  Strong: string;
  weak: string;
  Weak: string;
}

export interface LegalDefect {
  id: LegalDefectId;
  title: string;
  description: string;
  /** Clause id in the localized template (see localized.ts) */
  clauseId: string;
  /** Annotation of a general trap: the clause text is that trap's rigged wording */
  general?: DefectCode;
  /** Standalone: rigged and clean English wording of the clause */
  rigged?: (p: PartyWords) => string;
  clean?: (p: PartyWords) => string;
  /** Only planted when the traps favour this party (the clause only makes sense one way) */
  beneficiary?: Beneficiary;
  verdicts: Partial<Record<LegalJurisdiction, LegalVerdict>>;
  /** Why a jurisdiction has no verdict */
  unmapped?: Partial<Record<LegalJurisdiction, string>>;
}

export const LEGAL_DEFECTS: LegalDefect[] = [
  {
    id: "L1",
    title: "Excessive daily penalty (1% per day)",
    description: "A contractual penalty of 1% of the annual fee per day of delay, uncapped. Same clause as D1.",
    clauseId: "4.1",
    general: "D1",
    verdicts: {
      RU: { violates: true, slotIds: ["ru:gk:333:1", "ru:gk:333:2"], note: "Valid but reducible by the court if clearly disproportionate; for a business debtor only in exceptional cases and on the debtor's application.", confidence: "medium" },
      DE: { violates: true, slotIds: ["de:bgb:343:1", "de:bgb:307:1"], note: "§343 reduction does not apply between merchants (§348 HGB, not loaded); in standard terms an uncapped 1%/day penalty is void under §307. Depends on AGB vs individually negotiated.", confidence: "low" },
      "US-NY": { violates: true, slotIds: ["us-ny:ucc:2-718:1"], note: "Penalty unenforceable unless a reasonable pre-estimate of harm. For services this is NY common law (Truck Rent-A-Center v. Puritan Farms); UCC 2-718 covers goods and is cited by analogy.", confidence: "low" },
    },
    unmapped: { EU: "No EU-level rule on contractual penalties between businesses; depends on the member state." },
  },
  {
    id: "L2",
    title: "Limitation period shortened to one year",
    description: "Any claim must be brought within one year after it arises.",
    clauseId: "8.3",
    rigged: () => "Any claim under this Agreement must be brought within one year after it arises; after that the claim is barred.",
    clean: () => "Claims under this Agreement are subject to the statutory limitation period.",
    verdicts: {
      RU: { violates: true, slotIds: ["ru:gk:198"], note: "Limitation periods cannot be changed by agreement of the parties; the clause is void.", confidence: "high" },
      DE: { violates: false, slotIds: ["de:bgb:202:1"], note: "Shortening by agreement is allowed (§202), except relief in advance for intentional liability. The blanket wording also covers intent, so a court may cut it back for that part only.", confidence: "medium" },
      "US-NY": { violates: false, slotIds: ["us-ny:ucc:2-725:1"], note: "NY allows a shorter period agreed in writing if reasonable (CPLR 201, not loaded); UCC 2-725 allows not less than one year for sales and is the closest loaded slot.", confidence: "medium" },
    },
    unmapped: { EU: "No EU-level rule on limitation periods between businesses." },
  },
  {
    id: "L3",
    title: "Liability excluded even for intentional breach",
    description: "The favoured party is not liable for any failure to perform, including an intentional one.",
    clauseId: "4.3",
    rigged: (p) => `${p.Strong} is not liable for any failure to perform this Agreement, including an intentional one.`,
    clean: () => "Liability for intentional breach is not limited by this Agreement.",
    verdicts: {
      RU: { violates: true, slotIds: ["ru:gk:401:4"], note: "An agreement made in advance to exclude or limit liability for intentional breach is void.", confidence: "high" },
      DE: { violates: true, slotIds: ["de:bgb:276:3"], note: "Liability for intent cannot be released in advance.", confidence: "high" },
      "US-NY": { violates: true, slotIds: [], note: "Exculpatory clauses do not cover intentional wrongdoing or gross negligence (Kalisch-Jarcho v. City of New York, common law). No statute in law_slots.", confidence: "medium" },
    },
    unmapped: { EU: "No EU-level B2B rule; every member state voids it under national law, which is not loaded." },
  },
  {
    id: "L4",
    title: "B2B payment term of 120 days",
    description: "The Client pays 120 calendar days after acceptance.",
    clauseId: "3.2",
    beneficiary: "client",
    rigged: () => "The Client pays within 120 calendar days of signing the acceptance certificate.",
    clean: () => "The Client pays within 10 business days of signing the acceptance certificate.",
    verdicts: {
      EU: { violates: true, slotIds: ["eu:2011-7@{lang}:3:5", "eu:2011-7@{lang}:7:1"], note: "Payment term over 60 days only if expressly agreed and not grossly unfair to the creditor; otherwise unenforceable (Art. 7).", confidence: "medium" },
      DE: { violates: true, slotIds: ["de:bgb:271a:1"], note: "Over 60 days valid only if expressly agreed and not grossly unfair to the creditor; 120 days dictated by the debtor is likely grossly unfair.", confidence: "medium" },
      RU: { violates: false, slotIds: [], note: "No general cap on B2B payment terms (special caps only for food retail and public procurement).", confidence: "high" },
      "US-NY": { violates: false, slotIds: [], note: "No statutory cap on B2B payment terms.", confidence: "high" },
    },
  },
  {
    id: "L5",
    title: "Unilateral price change",
    description: "One party may change the fee by a simple notice. Same clause as D6.",
    clauseId: "3.3",
    general: "D6",
    verdicts: {
      RU: { violates: false, slotIds: ["ru:gk:310:1", "ru:gk:310:2"], note: "Between businesses a unilateral change of terms is allowed where the contract provides for it. Still a general D6 trap.", confidence: "medium" },
      DE: { violates: true, slotIds: ["de:bgb:315:1", "de:bgb:315:3", "de:bgb:307:1"], note: "A unilateral pricing right binds only if exercised equitably (§315), and in standard terms an unbounded change right is void under §307.", confidence: "low" },
    },
    unmapped: {
      EU: "Directive 93/13 (eu:93-13@en:3:1) protects consumers only; these are B2B contracts.",
      "US-NY": "Generally enforceable subject to the implied covenant of good faith; not mapped.",
    },
  },
  {
    id: "L6",
    title: "Ban on assigning payment claims",
    description: "Neither party may assign any right, including the right to payment, without consent; an assignment without consent is void.",
    clauseId: "8.4",
    rigged: () => "Neither Party may assign any right under this Agreement, including the right to payment, without the other Party's written consent; an assignment made without consent is void.",
    clean: () => "Either Party may assign its right to payment to a third party after notifying the other Party in writing.",
    verdicts: {
      RU: { violates: true, slotIds: ["ru:gk:388:3"], note: "A ban on assigning a monetary claim does not make the assignment invalid (point 3; the brief cited point 4, which is about non-monetary claims).", confidence: "high" },
      "US-NY": { violates: true, slotIds: ["us-ny:ucc:9-406"], note: "A term restricting assignment of accounts (right to payment for services) is ineffective, UCC 9-406(d); subsection (d) is not sliced separately in law_slots.", confidence: "high" },
      DE: { violates: true, slotIds: ["de:bgb:399"], note: "BGB §399 lets parties ban assignment, but between merchants §354a HGB keeps the assignment of a money claim effective. HGB is not loaded.", confidence: "medium" },
    },
    unmapped: { EU: "No EU-level rule on assignment bans." },
  },
  {
    id: "L7",
    title: "Waiver of late-payment interest",
    description: "The Contractor waives any interest for late payment by the Client.",
    clauseId: "4.4",
    beneficiary: "client",
    rigged: () => "The Contractor waives any interest for late payment by the Client.",
    clean: () => "For late payment, the Client also owes interest on the overdue amount as provided by law.",
    verdicts: {
      DE: { violates: true, slotIds: ["de:bgb:288:6"], note: "An agreement made in advance that excludes default interest on a payment claim is void.", confidence: "high" },
      EU: { violates: true, slotIds: ["eu:2011-7@{lang}:7:2"], note: "A term excluding interest for late payment is grossly unfair.", confidence: "high" },
      RU: { violates: false, slotIds: ["ru:gk:395:1"], note: "Article 395 interest applies unless the contract provides otherwise, so business parties may exclude it.", confidence: "medium" },
      "US-NY": { violates: false, slotIds: [], note: "Interest on contract damages is statutory (CPLR 5001, not loaded), but parties may agree on interest terms; a waiver is generally enforced.", confidence: "low" },
    },
  },
  {
    id: "L8",
    title: "Withdrawal from a services contract restricted",
    description: "One party may terminate only for a material breach. Same clause as D2.",
    clauseId: "5.1",
    general: "D2",
    verdicts: {
      RU: { violates: true, slotIds: ["ru:gk:782:1", "ru:gk:782:2"], note: "Under a services contract the client may always withdraw (paying actual costs) and the contractor may withdraw (paying losses); courts treat these rights as mandatory.", confidence: "medium" },
    },
    unmapped: {
      DE: "Service contracts allow extraordinary termination (§626/§627), but limiting ordinary termination is generally valid; not mapped.",
      EU: "No EU-level rule.",
      "US-NY": "Freedom of contract; not mapped.",
    },
  },
];

export function getLegalDefect(id: string): LegalDefect | undefined {
  return LEGAL_DEFECTS.find((d) => d.id === id);
}

/** Resolves {lang} in EU slot ids to a language the directive is loaded in */
export function resolveSlotIds(slotIds: string[], lang: string, available: string[]): string[] {
  const l = available.includes(lang) ? lang : "en";
  return slotIds.map((s) => s.replace("{lang}", l));
}
