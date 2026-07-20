"use client";

import { truncateText } from "@/lib/utils";

interface DocumentPreviewProps {
  text: string;
}

export function DocumentPreview({ text }: DocumentPreviewProps) {
  const charCount = text.length;

  if (!text.trim()) {
    return (
      <p className="mt-3 text-xs text-neutral-400">
        Минимум 10 символов
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-1">
      <p className="text-xs text-neutral-400">
        {charCount.toLocaleString("ru-RU")} символов
      </p>
      {charCount > 500 && (
        <p className="text-xs text-neutral-400">
          {truncateText(text, 500)}
        </p>
      )}
    </div>
  );
}
