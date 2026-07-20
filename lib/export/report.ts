import { getAgentById } from "@/lib/agents/config";
import { getSortedAgents } from "@/lib/agents/config";
import {
  getStatusLabel,
  getVerdictLabel,
  type Verdict,
} from "@/lib/pipeline/verdict";
import { truncateText } from "@/lib/utils";
import type { AgentResult } from "@/types/agent";

interface ReportParams {
  documentText: string;
  agentResults: Record<string, AgentResult>;
  verdict: Verdict;
  elapsedSeconds: number;
  createdAt: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU");
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins} мин ${secs} сек`;
}

export function buildMarkdownReport(params: ReportParams): string {
  const { documentText, agentResults, verdict, elapsedSeconds, createdAt } =
    params;
  const agents = getSortedAgents();

  const lines: string[] = [
    "# Отчёт согласования AgentFlow",
    "",
    `**Дата:** ${formatDate(createdAt)}`,
    `**Вердикт:** ${getVerdictLabel(verdict)}`,
    `**Время проверки:** ${formatDuration(elapsedSeconds)}`,
    "",
    "## Документ (фрагмент)",
    "",
    truncateText(documentText.trim(), 1000),
    "",
    "## Результаты",
    "",
  ];

  for (const agent of agents) {
    const result = agentResults[agent.id];
    if (!result) continue;

    lines.push(`### ${agent.name} — ${getStatusLabel(result.status)}`);
    lines.push("");
    if (result.comment) {
      lines.push(`**Комментарий:** ${result.comment}`);
      lines.push("");
    }
    if (result.error) {
      lines.push(`**Ошибка:** ${result.error}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

export function buildReportFilename(extension: "md" | "pdf"): string {
  const date = new Date().toISOString().slice(0, 10);
  return `agentflow-report-${date}.${extension}`;
}

export function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function buildPrintableHtml(params: ReportParams): string {
  const { documentText, agentResults, verdict, elapsedSeconds, createdAt } =
    params;
  const agents = getSortedAgents();

  const rows = agents
    .map((agent) => {
      const result = agentResults[agent.id];
      if (!result) return "";

      const agentName = getAgentById(agent.id)?.name ?? agent.id;
      return `
        <tr>
          <td>${agentName}</td>
          <td>${getStatusLabel(result.status)}</td>
          <td>${result.comment || result.error || "—"}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="ru">
      <head>
        <meta charset="utf-8" />
        <title>Отчёт AgentFlow</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 40px; color: #171717; }
          h1 { font-size: 20px; margin-bottom: 8px; }
          .meta { color: #737373; font-size: 14px; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #e5e5e5; padding: 8px 12px; text-align: left; font-size: 13px; vertical-align: top; }
          th { background: #f5f5f5; }
          .fragment { background: #fafafa; padding: 12px; border: 1px solid #e5e5e5; font-size: 12px; white-space: pre-wrap; margin-top: 8px; }
        </style>
      </head>
      <body>
        <h1>Отчёт согласования AgentFlow</h1>
        <div class="meta">
          <div>Дата: ${formatDate(createdAt)}</div>
          <div>Вердикт: ${getVerdictLabel(verdict)}</div>
          <div>Время проверки: ${formatDuration(elapsedSeconds)}</div>
        </div>
        <h2>Документ (фрагмент)</h2>
        <div class="fragment">${truncateText(documentText.trim(), 1000).replace(/</g, "&lt;")}</div>
        <h2>Результаты</h2>
        <table>
          <thead>
            <tr>
              <th>Участник</th>
              <th>Статус</th>
              <th>Комментарий</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `;
}

export function downloadPdfViaPrint(reportHtml: string): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(reportHtml);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
