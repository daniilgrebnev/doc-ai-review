"use client";

import { Fragment, useMemo } from "react";
import type { Finding } from "@/lib/check/types";
import { cn } from "@/lib/utils";

export interface ExtraMark {
  span: [number, number];
  className: string;
  title?: string;
}

interface Mark {
  start: number;
  end: number;
  className: string;
  findingId?: string;
  first?: boolean;
  title?: string;
}

interface DocumentViewProps {
  title?: string;
  subtitle?: string;
  text: string;
  findings: Finding[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  extraMarks?: ExtraMark[];
}

/** Builds non-overlapping marks: a later mark that overlaps an earlier one is cut */
function buildMarks(findings: Finding[], extra: ExtraMark[]): Mark[] {
  const raw: Mark[] = [];
  for (const f of findings) {
    f.spans.forEach(([start, end], i) =>
      raw.push({ start, end, className: `hl-${f.verdict}`, findingId: f.id, first: i === 0, title: f.title })
    );
  }
  for (const e of extra) raw.push({ start: e.span[0], end: e.span[1], className: e.className, title: e.title });
  raw.sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Mark[] = [];
  let pos = 0;
  for (const m of raw) {
    const start = Math.max(m.start, pos);
    if (start >= m.end) continue;
    out.push({ ...m, start });
    pos = m.end;
  }
  return out;
}

/** A line that looks like a section heading: "4. Liability" */
const HEADING = /^\d+\.\s+\S[^.]*$/;

export function DocumentView({ title, subtitle, text, findings, selectedId, onSelect, extraMarks = [] }: DocumentViewProps) {
  const marks = useMemo(() => buildMarks(findings, extraMarks), [findings, extraMarks]);

  const lines = useMemo(() => {
    // Split the text into lines, keeping absolute offsets
    const result: Array<{ start: number; end: number; heading: boolean }> = [];
    let start = 0;
    for (const line of text.split("\n")) {
      result.push({ start, end: start + line.length, heading: HEADING.test(line.trim()) });
      start += line.length + 1;
    }
    return result;
  }, [text]);

  return (
    <div className="mx-auto max-w-[720px] px-6 py-8 font-serif text-[16px] leading-[1.75] text-[#2A2C31] sm:px-12 sm:py-10">
      {title && <p className="mb-0.5 text-center text-[18px] font-bold">{title}</p>}
      {subtitle && <p className="mb-6 text-center text-sm text-muted">{subtitle}</p>}
      {lines.map((line, li) => {
        if (line.start === line.end) return <div key={li} className="h-3" aria-hidden="true" />;
        const parts: React.ReactNode[] = [];
        let pos = line.start;
        for (const m of marks) {
          if (m.end <= line.start || m.start >= line.end) continue;
          const s = Math.max(m.start, line.start);
          const e = Math.min(m.end, line.end);
          if (s > pos) parts.push(text.slice(pos, s));
          const selected = m.findingId && m.findingId === selectedId;
          const content = text.slice(s, e);
          parts.push(
            m.findingId && onSelect ? (
              <mark
                key={`${li}-${s}`}
                id={m.first && s === m.start ? `q-${m.findingId}` : undefined}
                title={m.title}
                onClick={() => onSelect(m.findingId!)}
                className={cn("cursor-pointer rounded-[2px] text-inherit", m.className, selected && "hl-selected")}
              >
                {content}
              </mark>
            ) : (
              <mark key={`${li}-${s}`} title={m.title} className={cn("rounded-[2px] text-inherit", m.className)}>
                {content}
              </mark>
            )
          );
          pos = e;
        }
        if (pos < line.end) parts.push(text.slice(pos, line.end));
        return (
          <p key={li} className={cn("m-0", line.heading ? "mt-3 font-bold" : "mb-2")}>
            {parts.map((p, i) => (
              <Fragment key={i}>{p}</Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export function scrollToFinding(id: string) {
  const el = document.getElementById(`q-${id}`);
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
}
