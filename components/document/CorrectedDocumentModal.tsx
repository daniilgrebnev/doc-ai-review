"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { DocumentDiffView } from "@/components/document/DocumentDiffView";
import { isRefusalText, REFUSAL_REVISE_MESSAGE } from "@/lib/agents/refusal";
import { computeLineDiff } from "@/lib/diff/line-diff";
import { formatModelLabel } from "@/lib/yandex-gpt/model-uri";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/components/ui/Toast";
import { useAgentFlowStore } from "@/store/useAgentFlowStore";
import type { AgentResult } from "@/types/agent";

interface CorrectedDocumentModalProps {
  open: boolean;
  onClose: () => void;
  originalText: string;
  agentResults: AgentResult[];
}

export function CorrectedDocumentModal({
  open,
  onClose,
  originalText,
  agentResults,
}: CorrectedDocumentModalProps) {
  const revisedText = useAgentFlowStore((s) => s.revisedText);
  const setRevisedText = useAgentFlowStore((s) => s.setRevisedText);
  const setDocumentText = useAgentFlowStore((s) => s.setDocumentText);
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelName, setModelName] = useState<string | null>(null);
  const [view, setView] = useState<"revised" | "diff">("revised");
  const dialogRef = useRef<HTMLDivElement>(null);

  const diffLines = useMemo(() => {
    if (!revisedText) return [];
    return computeLineDiff(originalText, revisedText);
  }, [originalText, revisedText]);

  const fetchRevised = useCallback(
    async (force = false) => {
      if (revisedText && !force) return;

      setLoading(true);
      setError(null);

      if (force) {
        setRevisedText(null);
      }

      try {
        const response = await fetch("/api/revise", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentText: originalText, agentResults }),
        });

        const data = (await response.json()) as {
          revisedText?: string;
          error?: string;
          errorKind?: string;
          model?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Ошибка генерации");
        }

        if (!data.revisedText?.trim()) {
          throw new Error(REFUSAL_REVISE_MESSAGE);
        }

        if (isRefusalText(data.revisedText)) {
          throw new Error(REFUSAL_REVISE_MESSAGE);
        }

        setRevisedText(data.revisedText);
        setModelName(data.model ?? null);
      } catch (err) {
        setRevisedText(null);
        setModelName(null);
        setError(
          err instanceof Error ? err.message : "Ошибка генерации документа"
        );
      } finally {
        setLoading(false);
      }
    },
    [originalText, agentResults, revisedText, setRevisedText]
  );

  const handleReload = () => {
    void fetchRevised(true);
  };

  useEffect(() => {
    if (open) {
      if (revisedText && isRefusalText(revisedText)) {
        setRevisedText(null);
        setError(REFUSAL_REVISE_MESSAGE);
        return;
      }
      void fetchRevised();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    dialogRef.current?.focus();

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleCopy = async () => {
    if (!revisedText) return;
    await navigator.clipboard.writeText(revisedText);
    toast("Текст скопирован", "success");
  };

  const handleApply = () => {
    if (!revisedText) return;
    setDocumentText(revisedText);
    toast("Документ обновлён", "success");
    onClose();
  };

  if (!open) return null;

  const hasContent = Boolean(revisedText) && !loading && !error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="revised-doc-title"
        className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-border bg-surface shadow-lg outline-none"
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-4">
          <div>
            <h2 id="revised-doc-title" className="text-sm font-medium text-neutral-900">
              Исправленный документ
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Версия с учётом замечаний экспертов
              {modelName ? ` · ${formatModelLabel(modelName)}` : ""}
            </p>
          </div>
          {!loading && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReload}
              aria-label="Перезагрузить исправления"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Перезагрузить
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12">
              <LoadingSpinner />
              <span className="text-sm text-muted">Генерация...</span>
            </div>
          )}

          {error && !loading && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-800">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 -ml-2"
                onClick={handleReload}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Перезагрузить
              </Button>
            </div>
          )}

          {hasContent && (
            <>
              <div className="mb-3 flex gap-1 rounded-md border border-border p-0.5">
                <button
                  type="button"
                  onClick={() => setView("revised")}
                  className={cn(
                    "flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors",
                    view === "revised"
                      ? "bg-neutral-900 text-white"
                      : "text-muted hover:text-neutral-900"
                  )}
                >
                  Исправленный
                </button>
                <button
                  type="button"
                  onClick={() => setView("diff")}
                  className={cn(
                    "flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors",
                    view === "diff"
                      ? "bg-neutral-900 text-white"
                      : "text-muted hover:text-neutral-900"
                  )}
                >
                  Сравнение
                </button>
              </div>

              {view === "revised" ? (
                <pre className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                  {revisedText}
                </pre>
              ) : (
                <DocumentDiffView lines={diffLines} />
              )}
            </>
          )}
        </div>

        <div className="flex gap-2 border-t border-border px-6 py-4">
          <Button variant="secondary" size="sm" onClick={handleCopy} disabled={!hasContent}>
            Скопировать
          </Button>
          <Button size="sm" onClick={handleApply} disabled={!hasContent}>
            Подставить в документ
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </div>
  );
}
