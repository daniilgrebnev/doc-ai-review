"use client";

import { FileText, Upload, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { MAX_FILE_SIZE, MIN_DOCUMENT_LENGTH } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { readDocumentFile } from "@/lib/files/read-document";
import { Button } from "@/components/ui/Button";
import { DocumentPreview } from "@/components/document/DocumentPreview";
import { Panel } from "@/components/ui/Panel";
import { useAgentFlowStore } from "@/store/useAgentFlowStore";

export function DocumentInput() {
  const documentText = useAgentFlowStore((s) => s.documentText);
  const uploadedFile = useAgentFlowStore((s) => s.uploadedFile);
  const pipelineStatus = useAgentFlowStore((s) => s.pipelineStatus);
  const setDocumentText = useAgentFlowStore((s) => s.setDocumentText);
  const setUploadedFile = useAgentFlowStore((s) => s.setUploadedFile);

  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDisabled = pipelineStatus === "running";
  const isReady = documentText.trim().length >= MIN_DOCUMENT_LENGTH;

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (file.size > MAX_FILE_SIZE) {
        setError("Размер файла не должен превышать 5 МБ");
        return;
      }

      try {
        const text = await readDocumentFile(file);

        setDocumentText(text);
        setUploadedFile({
          name: file.name,
          size: file.size,
          type: file.type || (file.name.toLowerCase().endsWith(".docx") ? "docx" : "txt"),
        });
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Не удалось прочитать файл"
        );
      }
    },
    [setDocumentText, setUploadedFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (isDisabled) return;

      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile, isDisabled]
  );

  const clearFile = () => {
    setUploadedFile(null);
    setDocumentText("");
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Panel
      className={cn(
        "transition-opacity",
        isDisabled && "pointer-events-none opacity-50"
      )}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isDisabled}
          >
            <Upload className="h-4 w-4" />
            Загрузить файл
          </Button>
          <span className="text-xs text-muted">.txt, .docx</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {isReady ? (
            <span className="text-green-700">Готов к проверке</span>
          ) : (
            <span className="text-muted">
              Мин. {MIN_DOCUMENT_LENGTH} символов
            </span>
          )}
        </div>
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

      <div
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isDisabled) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        className={cn(
          "mb-4 rounded-md border border-dashed px-3 py-2 text-xs text-muted transition-colors",
          dragActive ? "border-neutral-400 bg-neutral-50" : "border-border"
        )}
      >
        Перетащите файл в область редактора
      </div>

      {uploadedFile && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-border px-3 py-2">
          <div className="flex items-center gap-2 text-sm text-neutral-700">
            <FileText className="h-4 w-4 text-muted" strokeWidth={1.5} />
            <span>{uploadedFile.name}</span>
            <span className="text-muted">
              {(uploadedFile.size / 1024).toFixed(1)} КБ
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={clearFile} aria-label="Удалить файл">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <textarea
        value={documentText}
        onChange={(e) => {
          setError(null);
          setDocumentText(e.target.value);
          if (uploadedFile) setUploadedFile(null);
        }}
        placeholder="Вставьте текст договора или технического задания..."
        className="min-h-[420px] w-full resize-y rounded-md border border-border bg-neutral-50 p-4 text-sm text-neutral-800 placeholder:text-muted focus:border-neutral-400 focus:bg-white focus:outline-none"
        disabled={isDisabled}
      />

      <DocumentPreview text={documentText} />
    </Panel>
  );
}
