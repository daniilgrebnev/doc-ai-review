import type { AgentResult } from "@/types/agent";

export type Verdict = "approved" | "rejected" | "revision";

export function computeVerdict(results: AgentResult[]): Verdict {
  const statuses = results.map((r) => r.status);

  if (statuses.some((s) => s === "rejected" || s === "error")) {
    return "rejected";
  }
  if (statuses.some((s) => s === "revision")) {
    return "revision";
  }
  return "approved";
}

export function getVerdictLabel(verdict: Verdict): string {
  switch (verdict) {
    case "approved":
      return "Документ согласован";
    case "rejected":
      return "Документ отклонён";
    case "revision":
      return "Требуется доработка";
  }
}

export function hasRevisionNeeded(results: AgentResult[]): boolean {
  return results.some(
    (r) =>
      r.status === "revision" ||
      r.status === "rejected" ||
      r.status === "error"
  );
}

export function getStatusLabel(status: AgentResult["status"]): string {
  switch (status) {
    case "approved":
      return "Согласовано";
    case "rejected":
      return "Отклонено";
    case "revision":
      return "На доработку";
    case "error":
      return "Ошибка";
    case "processing":
      return "Проверка";
    default:
      return "Ожидание";
  }
}
