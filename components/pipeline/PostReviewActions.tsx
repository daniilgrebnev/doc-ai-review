"use client";

import { useState } from "react";
import { getSortedAgents } from "@/lib/agents/config";
import {
  buildMarkdownReport,
  buildPrintableHtml,
  buildReportFilename,
  downloadMarkdown,
  downloadPdfViaPrint,
} from "@/lib/export/report";
import { computeVerdict, hasRevisionNeeded } from "@/lib/pipeline/verdict";
import { CorrectedDocumentModal } from "@/components/document/CorrectedDocumentModal";
import { Button } from "@/components/ui/Button";
import { useAgentFlowStore } from "@/store/useAgentFlowStore";
import type { AgentResult } from "@/types/agent";

interface PostReviewActionsProps {
  results: AgentResult[];
}

export function PostReviewActions({ results }: PostReviewActionsProps) {
  const documentText = useAgentFlowStore((s) => s.documentText);
  const elapsedSeconds = useAgentFlowStore((s) => s.elapsedSeconds);
  const [modalOpen, setModalOpen] = useState(false);

  const verdict = computeVerdict(results);
  const showRevise = hasRevisionNeeded(results);
  const createdAt = new Date().toISOString();
  const agents = getSortedAgents();
  const agentResultsMap = agents.reduce<Record<string, AgentResult>>(
    (acc, agent) => {
      acc[agent.id] = results.find((r) => r.agentId === agent.id) ?? {
        agentId: agent.id,
        status: "pending",
        comment: "",
      };
      return acc;
    },
    {}
  );

  const reportParams = {
    documentText,
    agentResults: agentResultsMap,
    verdict,
    elapsedSeconds,
    createdAt,
  };

  const handleDownloadMd = () => {
    const content = buildMarkdownReport(reportParams);
    downloadMarkdown(content, buildReportFilename("md"));
  };

  const handleDownloadPdf = () => {
    const html = buildPrintableHtml(reportParams);
    downloadPdfViaPrint(html);
  };

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2">
        {showRevise && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setModalOpen(true)}
          >
            Показать исправленный договор
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={handleDownloadMd}>
          Скачать .md
        </Button>
        <Button variant="secondary" size="sm" onClick={handleDownloadPdf}>
          Скачать PDF
        </Button>
      </div>

      <CorrectedDocumentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        originalText={documentText}
        agentResults={results.filter((r) => r.comment || r.error)}
      />
    </>
  );
}
