"use client";

import { cn } from "@/lib/utils";
import type { DiffLine } from "@/lib/diff/line-diff";

interface DocumentDiffViewProps {
  lines: DiffLine[];
}

export function DocumentDiffView({ lines }: DocumentDiffViewProps) {
  if (lines.every((l) => l.type === "same")) {
    return (
      <p className="text-sm text-muted">Изменений не обнаружено.</p>
    );
  }

  return (
    <pre className="overflow-x-auto text-sm leading-relaxed">
      {lines.map((line, idx) => (
        <div
          key={idx}
          className={cn(
            "whitespace-pre-wrap px-2 py-0.5",
            line.type === "removed" && "bg-red-50 text-red-900",
            line.type === "added" && "bg-green-50 text-green-900",
            line.type === "same" && "text-neutral-600"
          )}
        >
          {line.type === "removed" && "− "}
          {line.type === "added" && "+ "}
          {line.type === "same" && "  "}
          {line.text || " "}
        </div>
      ))}
    </pre>
  );
}
