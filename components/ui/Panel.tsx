"use client";

import { cn } from "@/lib/utils";

interface PanelProps {
  children: React.ReactNode;
  className?: string;
}

export function Panel({ children, className }: PanelProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

/** @deprecated Use Panel instead */
export const GlassCard = Panel;
