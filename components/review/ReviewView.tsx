"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { getSortedAgents } from "@/lib/agents/config";
import { MIN_DOCUMENT_LENGTH } from "@/lib/constants";
import { cn, formatElapsedTime } from "@/lib/utils";
import { readDocumentFile } from "@/lib/files/read-document";
import { AgentPipeline } from "@/components/pipeline/AgentPipeline";
import { PipelineSummary } from "@/components/pipeline/PipelineSummary";
import { PostReviewActions } from "@/components/pipeline/PostReviewActions";
import { Button } from "@/components/ui/Button";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { useToast } from "@/components/ui/Toast";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { ProviderSelector } from "@/components/review/ProviderSelector";
import type { ProviderInfo, ProvidersResponse } from "@/lib/llm/types";
import { SAMPLE_CONTRACT_TEXT } from "@/lib/demo/sample-contract";
import { useAgentFlowStore } from "@/store/useAgentFlowStore";

export function ReviewView() {
  const documentText = useAgentFlowStore((s) => s.documentText);
  const uploadedFile = useAgentFlowStore((s) => s.uploadedFile);
  const pipelineStatus = useAgentFlowStore((s) => s.pipelineStatus);
  const agentResults = useAgentFlowStore((s) => s.agentResults);
  const pipelineError = useAgentFlowStore((s) => s.pipelineError);
  const elapsedSeconds = useAgentFlowStore((s) => s.elapsedSeconds);
  const currentAgentId = useAgentFlowStore((s) => s.currentAgentId);
  const setDocumentText = useAgentFlowStore((s) => s.setDocumentText);
  const setUploadedFile = useAgentFlowStore((s) => s.setUploadedFile);
  const runPipeline = useAgentFlowStore((s) => s.runPipeline);
  const resetPipeline = useAgentFlowStore((s) => s.resetPipeline);
  const provider = useAgentFlowStore((s) => s.provider);
  const setProvider = useAgentFlowStore((s) => s.setProvider);
  const { toast } = useToast();
  const prevStatus = useRef(pipelineStatus);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileError, setFileError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);

  const isRunning = pipelineStatus === "running";
  const canStart = documentText.trim().length >= MIN_DOCUMENT_LENGTH && !isRunning;
  const agents = getSortedAgents();
  const results = agents.map((a) => agentResults[a.id]).filter(Boolean);
  const completedCount = results.filter(
    (r) => r.status !== "pending" && r.status !== "processing"
  ).length;
  const currentAgent = currentAgentId
    ? agents.find((a) => a.id === currentAgentId)
    : null;

  useEffect(() => {
    void fetch("/api/providers")
      .then((r) => r.json())
      .then((data: ProvidersResponse) => {
        setIsDemo(Boolean(data.demo));
        setProviders(data.providers ?? []);
        const current = useAgentFlowStore.getState().provider;
        const currentOk = data.providers?.some((p) => p.id === current && p.available);
        if (!currentOk) setProvider(data.defaultProvider);
      })
      .catch(() => setIsDemo(false));
  }, [setProvider]);

  useEffect(() => {
    if (prevStatus.current !== "completed" && pipelineStatus === "completed") {
      toast("Проверка завершена", "success");
    }
    prevStatus.current = pipelineStatus;
  }, [pipelineStatus, toast]);

  const handleFile = useCallback(
    async (file: File) => {
      setFileError(null);

      try {
        const text = await readDocumentFile(file);
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
        setDocumentText(text);
        setUploadedFile({
          name: file.name,
          size: file.size,
          type: file.type || (ext === "docx" ? "docx" : "txt"),
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Не удалось прочитать файл";
        setFileError(message);
      }
    },
    [setDocumentText, setUploadedFile]
  );

  const clearFile = () => {
    setUploadedFile(null);
    setDocumentText("");
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const loadSample = () => {
    setFileError(null);
    setUploadedFile(null);
    resetPipeline();
    setDocumentText(SAMPLE_CONTRACT_TEXT);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      <DemoBanner visible={isDemo} />
      {/* Document input */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <label htmlFor="document-text" className="text-sm font-medium text-neutral-900">
            Документ
          </label>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadSample}
              disabled={isRunning}
            >
              Загрузить пример
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isRunning}
            >
              <Upload className="h-3.5 w-3.5" />
              Файл
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>
        </div>

        {uploadedFile && (
          <div className="mb-2 flex items-center justify-between rounded border border-border px-3 py-1.5 text-sm">
            <span className="text-neutral-700">{uploadedFile.name}</span>
            <button
              type="button"
              onClick={clearFile}
              className="text-muted hover:text-neutral-900"
              aria-label="Удалить файл"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {fileError && <p className="mb-2 text-sm text-red-600">{fileError}</p>}

        <textarea
          id="document-text"
          value={documentText}
          onChange={(e) => {
            setFileError(null);
            setDocumentText(e.target.value);
            if (uploadedFile) setUploadedFile(null);
          }}
          placeholder="Вставьте текст договора..."
          className={cn(
            "min-h-[200px] w-full resize-y rounded-lg border border-border bg-white p-3 text-sm text-neutral-800 placeholder:text-muted focus:border-neutral-400 focus:outline-none",
            isRunning && "opacity-60"
          )}
          disabled={isRunning}
        />

        {!isDemo && (
          <div className="mt-3">
            <ProviderSelector
              providers={providers}
              value={provider}
              onChange={setProvider}
              disabled={isRunning}
            />
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-muted">
            {documentText.trim().length > 0
              ? `${documentText.trim().length.toLocaleString("ru-RU")} симв.`
              : `Мин. ${MIN_DOCUMENT_LENGTH} символов`}
          </span>
          <div className="flex gap-2">
            {pipelineStatus === "completed" && (
              <Button variant="secondary" size="sm" onClick={resetPipeline}>
                Сбросить
              </Button>
            )}
            <Button onClick={runPipeline} disabled={!canStart} loading={isRunning} size="sm">
              {isRunning ? "Проверка..." : "Запустить проверку"}
            </Button>
          </div>
        </div>
      </section>

      {/* Progress */}
      {isRunning && (
        <div className="rounded-lg border border-border bg-neutral-50 px-4 py-3 text-sm" aria-live="polite">
          <p className="text-neutral-700">
            {currentAgent
              ? `Проверяет: ${currentAgent.name} (${completedCount + 1}/${agents.length})`
              : "Подготовка..."}
          </p>
          <p className="mt-0.5 text-xs text-muted">{formatElapsedTime(elapsedSeconds)}</p>
        </div>
      )}

      {pipelineError && (
        <ErrorAlert message={pipelineError} onRetry={runPipeline} />
      )}

      {/* Results */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-neutral-900">Результаты</h2>
        <AgentPipeline showEmpty={pipelineStatus === "idle"} />
      </section>

      {pipelineStatus === "completed" && results.length > 0 && (
        <div className="space-y-4">
          <PipelineSummary results={results} />
          <PostReviewActions results={results} />
        </div>
      )}
    </div>
  );
}
