/**
 * Ready-made examples (F1): contract text plus a stored result, so the page
 * opens without a model call. Spans are computed from the quotes at load time.
 */
import { locateQuotes } from "@/lib/check/spans";
import type { ContractExample, Finding } from "@/lib/check/types";

type RawFinding = Omit<Finding, "spans" | "exact">;

function build(e: Omit<ContractExample, "findings"> & { findings: RawFinding[] }): ContractExample {
  return {
    ...e,
    findings: e.findings.map((f) => ({ ...f, ...locateQuotes(e.text, f.quotes) })),
  };
}

const SERVICES_TEXT = `Alpha Service LLC (the "Contractor") and Vector LLC (the "Client") agree as follows.

1. Subject
1.1. The Contractor shall provide technical support for the Client's website, and the Client shall accept and pay for these services.

2. Timelines
2.1. The Contractor shall begin providing services within a reasonable time after receiving the Client's request.
2.2. A monthly service report is sent to the Client by the 5th day of the following month.

3. Fees and payment
3.1. The fee for the services is $8,000 per month.
3.2. The Client shall pay for the services within 10 (ten) business days of signing the acceptance certificate.
3.3. The Contractor may change the service fee unilaterally by notifying the Client by email.

4. Liability
4.1. For late payment, the Client shall pay the Contractor a penalty of 1% of the annual fee for each day of delay.
4.2. The parties are released from liability in the event of force majeure.
4.3. The Contractor's total liability under this Agreement is capped at the fees paid for the last three months.

5. Termination
5.1. The Contractor may withdraw from this Agreement at any time without giving a reason. The Client may terminate this Agreement only in the event of a material breach by the Contractor.

6. Term
6.1. This Agreement takes effect on the date of signing and remains in force for 12 months.

7. Settlement
7.1. Final settlement for the reporting month is made no later than 30 (thirty) calendar days after the acceptance certificate is signed.

8. Miscellaneous
8.1. All notices are sent to the addresses listed in Section 9.
8.2. This Agreement is deemed renewed for the same term unless either Party gives notice of termination 60 days before it expires.`;

const NDA_TEXT = `Orbit Labs LLC (the "Discloser") and Nord Data LLC (the "Recipient") agree as follows.

1. Confidential information
1.1. The Recipient shall keep confidential all information disclosed by the Discloser in connection with the joint project.
1.2. The Discloser may amend the list of confidential information at its discretion without notice to the Recipient.

2. Return of materials
2.1. The Recipient shall return or destroy all materials promptly upon request of the Discloser.

3. Liability
3.1. The Recipient is liable for all losses of the Discloser, direct and indirect, without limit.

4. Term
4.1. This Agreement is valid for one year and renews automatically each year.
4.2. Confidentiality obligations survive for 3 years after this Agreement ends.`;

const HONEST_TEXT = `Studio Line LLC (the "Contractor") and Vector LLC (the "Client") agree as follows.

1. Subject
1.1. The Contractor shall design the layouts of the Client's website according to the brief in Appendix 1.

2. Timelines
2.1. The Contractor delivers the layouts within 15 business days of receiving the brief.
2.2. The Client reviews the layouts within 5 business days and either accepts them or sends a list of changes.

3. Fees and payment
3.1. The fee is $3,000. It may be changed only by an amendment signed by both Parties.
3.2. The Client pays within 10 business days of signing the acceptance certificate.

4. Liability
4.1. For late payment, the Client pays a penalty of 0.1% of the unpaid amount per day, capped at 10% of that amount.
4.2. Each Party's total liability under this Agreement is capped at the contract fee.

5. Termination
5.1. Either Party may terminate this Agreement with 30 days' written notice.

6. Term
6.1. This Agreement is valid until 31 December 2026 and is not renewed automatically.`;

export const EXAMPLES: ContractExample[] = [
  build({
    id: "services",
    label: "Services agreement",
    title: "SERVICE AGREEMENT No. 17/26",
    subtitle: "Website support · 14 October 2026",
    model: "yandexgpt-5.1/latest",
    checkedAt: "2026-11-10",
    costCents: 0.3,
    text: SERVICES_TEXT,
    findings: [
      { id: "s1", verdict: "violation", defect: "D1", requirement: "R3", clause: "§4.1", title: "Disproportionate penalty", quotes: ["the Client shall pay the Contractor a penalty of 1% of the annual fee for each day of delay"], reason: "A month of delay costs 30% of the annual contract, far above any real loss, and there is no cap.", confidence: 0.92 },
      { id: "s2", verdict: "violation", defect: "D2", requirement: "R2", clause: "§5.1", title: "One-sided exit", quotes: ["The Contractor may withdraw from this Agreement at any time without giving a reason."], reason: "Only the Contractor can leave without cause; the Client needs a material breach.", confidence: 0.88 },
      { id: "s3", verdict: "violation", defect: "D6", requirement: "R6", clause: "§3.3", title: "Unilateral price change", quotes: ["The Contractor may change the service fee unilaterally by notifying the Client by email"], reason: "The price changes without the Client's consent; an email is enough.", confidence: 0.9 },
      { id: "s4", verdict: "violation", defect: "D7", requirement: "R7", clause: "§3.2 · §7.1", title: "Conflicting payment terms", quotes: ["within 10 (ten) business days of signing the acceptance certificate", "no later than 30 (thirty) calendar days after the acceptance certificate is signed"], reason: "Two clauses set different deadlines for paying the same certificate. Both fragments are highlighted.", confidence: 0.81 },
      { id: "s5", verdict: "risk", defect: "D4", requirement: "R4", clause: "§2.1", title: "Vague deadline", quotes: ["within a reasonable time after receiving the Client's request"], reason: "The start of work is not tied to a date or a number of days, so it cannot be enforced.", confidence: 0.77 },
      { id: "s6", verdict: "risk", defect: "D3", requirement: "R1", clause: "§8.2", title: "Hidden auto-renewal", quotes: ["This Agreement is deemed renewed for the same term unless either Party gives notice of termination 60 days before it expires."], reason: "The renewal sits in Miscellaneous instead of the Term section, where it is easy to miss.", confidence: 0.69 },
      { id: "s7", verdict: "compliant", defect: null, requirement: "R5", clause: "§4.3", title: "Liability is capped", quotes: ["The Contractor's total liability under this Agreement is capped at the fees paid for the last three months."], reason: "Liability is limited in amount; the requirement is met.", confidence: 0.95 },
    ],
  }),
  build({
    id: "nda",
    label: "NDA",
    title: "NON-DISCLOSURE AGREEMENT",
    subtitle: "Joint project · 2 November 2026",
    model: "yandexgpt-5.1/latest",
    checkedAt: "2026-11-10",
    costCents: 0.2,
    text: NDA_TEXT,
    findings: [
      { id: "n1", verdict: "violation", defect: "D5", requirement: "R5", clause: "§3.1", title: "Unlimited liability", quotes: ["The Recipient is liable for all losses of the Discloser, direct and indirect, without limit."], reason: "No cap, and indirect losses are included.", confidence: 0.93 },
      { id: "n2", verdict: "violation", defect: "D6", requirement: "R6", clause: "§1.2", title: "Unilateral change of terms", quotes: ["The Discloser may amend the list of confidential information at its discretion without notice to the Recipient."], reason: "The scope of the obligation can grow without the Recipient's consent or knowledge.", confidence: 0.86 },
      { id: "n3", verdict: "risk", defect: "D4", requirement: "R4", clause: "§2.1", title: "Vague deadline", quotes: ["promptly upon request of the Discloser"], reason: "\"Promptly\" is not a number of days.", confidence: 0.74 },
      { id: "n4", verdict: "risk", defect: "D3", requirement: "R1", clause: "§4.1", title: "Auto-renewal without exit", quotes: ["renews automatically each year"], reason: "There is no notice period to stop the renewal.", confidence: 0.71 },
    ],
  }),
  build({
    id: "honest",
    label: "Honest contract",
    title: "DESIGN SERVICES AGREEMENT No. 4",
    subtitle: "Control example · no traps",
    model: "yandexgpt-5.1/latest",
    checkedAt: "2026-11-10",
    costCents: 0.2,
    text: HONEST_TEXT,
    findings: [],
  }),
];

export function getExample(id: string | null | undefined): ContractExample | undefined {
  return EXAMPLES.find((e) => e.id === id);
}
