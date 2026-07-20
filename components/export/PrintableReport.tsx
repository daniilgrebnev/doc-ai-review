"use client";

import { forwardRef } from "react";
import { getSortedAgents } from "@/lib/agents/config";
import {
  getStatusLabel,
  getVerdictLabel,
  type Verdict,
} from "@/lib/pipeline/verdict";
import { truncateText } from "@/lib/utils";
import type { AgentResult } from "@/types/agent";

interface PrintableReportProps {
  documentText: string;
  agentResults: Record<string, AgentResult>;
  verdict: Verdict;
  elapsedSeconds: number;
  createdAt: string;
}

export const PrintableReport = forwardRef<HTMLDivElement, PrintableReportProps>(
  function PrintableReport(
    { documentText, agentResults, verdict, elapsedSeconds, createdAt },
    ref
  ) {
    const agents = getSortedAgents();

    return (
      <div ref={ref} className="hidden print:block">
        <h1 className="text-xl font-semibold">Отчёт согласования AgentFlow</h1>
        <div className="mt-2 text-sm text-neutral-600">
          <p>Дата: {new Date(createdAt).toLocaleString("ru-RU")}</p>
          <p>Вердикт: {getVerdictLabel(verdict)}</p>
          <p>
            Время проверки: {Math.floor(elapsedSeconds / 60)} мин{" "}
            {elapsedSeconds % 60} сек
          </p>
        </div>
        <h2 className="mt-6 text-base font-medium">Документ (фрагмент)</h2>
        <pre className="mt-2 whitespace-pre-wrap rounded border border-neutral-200 bg-neutral-50 p-3 text-xs">
          {truncateText(documentText.trim(), 1000)}
        </pre>
        <h2 className="mt-6 text-base font-medium">Результаты</h2>
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-300">
              <th className="py-2 text-left font-medium">Участник</th>
              <th className="py-2 text-left font-medium">Статус</th>
              <th className="py-2 text-left font-medium">Комментарий</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => {
              const result = agentResults[agent.id];
              if (!result) return null;

              return (
                <tr key={agent.id} className="border-b border-neutral-200">
                  <td className="py-2 pr-4 align-top">{agent.name}</td>
                  <td className="py-2 pr-4 align-top">
                    {getStatusLabel(result.status)}
                  </td>
                  <td className="py-2 align-top">
                    {result.comment || result.error || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
);
