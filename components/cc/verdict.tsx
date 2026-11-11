import type { FindingVerdict } from "@/lib/check/types";
import { cn } from "@/lib/utils";

export const VERDICT_META: Record<FindingVerdict, { label: string; plural: string; glyph: string; text: string }> = {
  violation: { label: "Violation", plural: "Violations", glyph: "✕", text: "text-bad" },
  risk: { label: "Risk", plural: "Risks", glyph: "!", text: "text-risk" },
  compliant: { label: "Compliant", plural: "Compliant", glyph: "✓", text: "text-ok" },
};

export function VerdictLabel({ verdict, className }: { verdict: FindingVerdict; className?: string }) {
  const m = VERDICT_META[verdict];
  return (
    <span className={cn("inline-flex items-baseline gap-1.5 whitespace-nowrap text-[13px] font-semibold", m.text, className)}>
      <span aria-hidden="true">{m.glyph}</span>
      {m.label}
    </span>
  );
}
